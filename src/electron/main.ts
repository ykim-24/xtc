import { app, BrowserWindow, ipcMain, dialog, session, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { watch, FSWatcher } from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import * as pty from 'node-pty';
import * as os from 'os';
import * as crypto from 'crypto';
import { IGNORED_PATHS } from '../shared/constants/index.js';
import { lspManager } from './lspManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure PATH includes common locations for homebrew and other package managers
const getEnvWithPath = () => {
  const additionalPaths = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    process.env.HOME + '/.local/bin',
  ];
  const currentPath = process.env.PATH || '';
  const newPath = [...additionalPaths, ...currentPath.split(':')].join(':');
  return { ...process.env, PATH: newPath };
};

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false, // Custom title bar
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: -100, y: -100 }, // Hide macOS traffic lights
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#0d1117',
    show: false, // Show when ready
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:4321');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Set CSP to allow Monaco editor to load from CDN
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
          "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
          "font-src 'self' data: https://cdn.jsdelivr.net; " +
          "connect-src 'self' ws://localhost:* http://localhost:*; " +
          "img-src 'self' data: https:; " +
          "worker-src 'self' blob:;"
        ]
      }
    });
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers

// Window controls
ipcMain.on('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window:maximize', () => {
  if (process.platform === 'darwin') {
    // macOS: use true fullscreen mode
    mainWindow?.setFullScreen(!mainWindow.isFullScreen());
  } else {
    // Windows/Linux: use maximize
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  }
});

ipcMain.on('window:close', () => {
  mainWindow?.close();
});

// Helper to add XTC files to git exclude (so they don't show up in git status)
async function addToGitExclude(projectPath: string) {
  const excludePath = path.join(projectPath, '.git', 'info', 'exclude');
  const xtcEntries = ['.xtc/', 'CLAUDE.md'];
  const filesToUntrack = ['CLAUDE.md']; // Files to untrack if already tracked

  try {
    // Check if .git/info exists
    const infoDir = path.join(projectPath, '.git', 'info');
    await fs.access(infoDir);

    // Read existing exclude file or create empty
    let content = '';
    try {
      content = await fs.readFile(excludePath, 'utf-8');
    } catch {
      // File doesn't exist, start fresh
    }

    // Add entries that aren't already present
    let modified = false;
    for (const entry of xtcEntries) {
      if (!content.includes(entry)) {
        content = content.trimEnd() + '\n' + entry;
        modified = true;
      }
    }

    if (modified) {
      await fs.writeFile(excludePath, content.trim() + '\n', 'utf-8');
    }

    // Tell git to ignore changes to tracked files (assume-unchanged)
    for (const file of filesToUntrack) {
      try {
        // Check if file is tracked by git
        const git = spawn('git', ['ls-files', '--error-unmatch', file], { cwd: projectPath, env: getEnvWithPath() });
        const isTracked = await new Promise<boolean>((resolve) => {
          git.on('close', (code) => resolve(code === 0));
          git.on('error', () => resolve(false));
        });

        if (isTracked) {
          // Mark file as skip-worktree (git ignores local changes, even during checkout)
          const updateIndex = spawn('git', ['update-index', '--skip-worktree', file], { cwd: projectPath, env: getEnvWithPath() });
          await new Promise<void>((resolve) => {
            updateIndex.on('close', () => resolve());
            updateIndex.on('error', () => resolve());
          });
        }
      } catch {
        // Ignore errors for individual files
      }
    }
  } catch {
    // Not a git repo or no access - silently ignore
  }
}

// File operations
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  });

  if (!result.canceled && result.filePaths[0]) {
    // Automatically add XTC files to git exclude
    await addToGitExclude(result.filePaths[0]);
    return result.filePaths[0];
  }

  return null;
});

ipcMain.handle('dialog:openFile', async (_event, options?: { multiple?: boolean; filters?: { name: string; extensions: string[] }[] }) => {
  const properties: ('openFile' | 'multiSelections')[] = ['openFile'];
  if (options?.multiple) properties.push('multiSelections');

  const result = await dialog.showOpenDialog(mainWindow!, {
    properties,
    filters: options?.filters,
  });

  return result.canceled ? null : { filePaths: result.filePaths };
});

ipcMain.handle('file:read', async (_, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('file:write', async (_, filePath: string, content: string) => {
  try {
    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('file:readDir', async (_, dirPath: string) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const items = entries
      .filter((entry) => !IGNORED_PATHS.includes(entry.name))
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: path.join(dirPath, entry.name),
      }))
      .sort((a, b) => {
        // Directories first, then alphabetically
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    return { success: true, items };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('file:delete', async (_, filePath: string) => {
  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      await fs.rm(filePath, { recursive: true });
    } else {
      await fs.unlink(filePath);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('file:rename', async (_, oldPath: string, newPath: string) => {
  try {
    await fs.rename(oldPath, newPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('file:revealInFinder', (_, filePath: string) => {
  try {
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

// Load type definitions from node_modules/@types
ipcMain.handle('types:load', async (_, projectPath: string) => {
  try {
    const typesDir = path.join(projectPath, 'node_modules', '@types');
    const types: { packageName: string; content: string }[] = [];

    // Check if @types directory exists
    try {
      await fs.access(typesDir);
    } catch {
      return { success: true, types: [] };
    }

    // Read all type packages
    const packages = await fs.readdir(typesDir);

    for (const pkg of packages) {
      const pkgPath = path.join(typesDir, pkg);
      const stat = await fs.stat(pkgPath);

      if (stat.isDirectory()) {
        // Try to read index.d.ts
        const indexPath = path.join(pkgPath, 'index.d.ts');
        try {
          const content = await fs.readFile(indexPath, 'utf-8');
          types.push({ packageName: pkg, content });
        } catch {
          // Try package.json types field
          try {
            const pkgJson = JSON.parse(await fs.readFile(path.join(pkgPath, 'package.json'), 'utf-8'));
            const typesFile = pkgJson.types || pkgJson.typings || 'index.d.ts';
            const content = await fs.readFile(path.join(pkgPath, typesFile), 'utf-8');
            types.push({ packageName: pkg, content });
          } catch {
            // Skip packages without type definitions
          }
        }
      }
    }

    return { success: true, types };
  } catch (error) {
    return { success: false, error: String(error), types: [] };
  }
});

// File watcher
let fileWatcher: FSWatcher | null = null;

ipcMain.handle('file:watch', (_, dirPath: string) => {
  // Clean up existing watcher
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }

  if (!dirPath) return { success: true };

  try {
    fileWatcher = watch(dirPath, { recursive: true }, (eventType, filename) => {
      if (filename && !IGNORED_PATHS.some(ignored => filename.includes(ignored))) {
        mainWindow?.webContents.send('file:changed', { eventType, filename, dirPath });
      }
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('file:unwatch', () => {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
  return { success: true };
});

// App data storage (stored in OS-specific app data directory)
const getDataPath = () => path.join(app.getPath('userData'), 'data');

ipcMain.handle('store:get', async (_, key: string) => {
  try {
    const dataPath = getDataPath();
    const filePath = path.join(dataPath, `${key}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, data: JSON.parse(content) };
  } catch (error) {
    // Return null if file doesn't exist (not an error)
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { success: true, data: null };
    }
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('store:set', async (_, key: string, data: unknown) => {
  try {
    const dataPath = getDataPath();
    await fs.mkdir(dataPath, { recursive: true });
    const filePath = path.join(dataPath, `${key}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('store:delete', async (_, key: string) => {
  try {
    const dataPath = getDataPath();
    const filePath = path.join(dataPath, `${key}.json`);
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { success: true }; // Already doesn't exist
    }
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('store:getPath', () => {
  return app.getPath('userData');
});

// Claude CLI Chat
interface PendingEdit {
  id: string;
  filePath: string;
  originalContent: string;
  newContent: string;
  description: string;
  isNewFile?: boolean;
}

let pendingEdits: PendingEdit[] = [];

// Helper: Run git command and return stdout
async function runGitCommand(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const git = spawn('git', args, { cwd, env: getEnvWithPath() });
    let stdout = '';
    let stderr = '';
    git.stdout?.on('data', (data) => { stdout += data.toString(); });
    git.stderr?.on('data', (data) => { stderr += data.toString(); });
    git.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `git exited with code ${code}`));
    });
    git.on('error', reject);
  });
}

// Helper: Check if directory is a git repo
async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await runGitCommand(['rev-parse', '--git-dir'], cwd);
    return true;
  } catch {
    return false;
  }
}

// Helper: Get changed files after Claude runs
async function getGitChanges(cwd: string): Promise<Array<{ file: string; status: string }>> {
  try {
    const status = await runGitCommand(['status', '--porcelain'], cwd);
    const changes: Array<{ file: string; status: string }> = [];

    for (const line of status.split('\n').filter(Boolean)) {
      const statusCode = line.substring(0, 2).trim();
      const file = line.substring(3);
      if (file) {
        changes.push({ file, status: statusCode });
      }
    }
    return changes;
  } catch {
    return [];
  }
}

// Helper: Get original file content from git
async function getOriginalContent(cwd: string, filePath: string): Promise<string | null> {
  try {
    return await runGitCommand(['show', `HEAD:${filePath}`], cwd);
  } catch {
    return null; // File is new or not tracked
  }
}

// Helper: Detect changes and create pending edits
async function detectChangesAndCreateEdits(projectPath: string): Promise<PendingEdit[]> {
  const edits: PendingEdit[] = [];

  if (!await isGitRepo(projectPath)) {
    return edits;
  }

  const changes = await getGitChanges(projectPath);

  for (const change of changes) {
    const fullPath = path.join(projectPath, change.file);
    const isNewFile = change.status === '??' || change.status === 'A';

    try {
      // Get current content
      const newContent = await fs.readFile(fullPath, 'utf-8');

      // Get original content (empty string for new files)
      const originalContent = isNewFile ? '' : (await getOriginalContent(projectPath, change.file) || '');

      // Only create edit if content actually changed
      if (newContent !== originalContent) {
        edits.push({
          id: crypto.randomUUID(),
          filePath: fullPath,
          originalContent,
          newContent,
          description: isNewFile ? `Created ${change.file}` : `Modified ${change.file}`,
          isNewFile,
        });
      }
    } catch {
      // File might have been deleted or is binary, skip it
    }
  }

  return edits;
}

// Track conversation state per project
const conversationState: Map<string, boolean> = new Map();

ipcMain.handle('claude:send', async (_event, message: string, context: { activeFile?: { path: string; content: string }; contextFiles?: { path: string; content: string }[] }, projectPath: string | null) => {
  return new Promise((resolve) => {
    const projectKey = projectPath || '__global__';
    const hasActiveConversation = conversationState.get(projectKey) || false;

    // Build the prompt with context (rules/skills are now in CLAUDE.md, read by Claude CLI)
    let fullPrompt = '';

    if (context.activeFile) {
      fullPrompt += `Current file (${context.activeFile.path}):\n\`\`\`\n${context.activeFile.content}\n\`\`\`\n\n`;
    }

    if (context.contextFiles && context.contextFiles.length > 0) {
      fullPrompt += 'Additional context files:\n';
      for (const file of context.contextFiles) {
        fullPrompt += `\n${file.path}:\n\`\`\`\n${file.content}\n\`\`\`\n`;
      }
      fullPrompt += '\n';
    }

    fullPrompt += message;

    // Use spawn with --output-format stream-json to get structured output with tool activity
    // Use --dangerously-skip-permissions to allow Claude to execute all tools
    // Use --continue for subsequent messages in the same project
    // --print for non-interactive mode, --verbose required for stream-json format
    const args = ['--print', '--dangerously-skip-permissions', '--verbose', '--output-format', 'stream-json'];
    if (hasActiveConversation) {
      args.push('--continue');
    }

    const claude = spawn('claude', args, {
      env: getEnvWithPath(),
      shell: true,
      cwd: projectPath || undefined,
    });

    let responseText = '';
    let stdinWritten = false;
    let lastActivity: string | null = null;

    claude.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();

      // Parse JSON stream - each line is a JSON object
      const lines = chunk.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const event = JSON.parse(line);

          // Handle different event types from stream-json format
          switch (event.type) {
            case 'system':
              // System messages (init, etc)
              if (event.subtype === 'init') {
                mainWindow?.webContents.send('claude:activity', 'initializing');
              }
              break;

            case 'assistant':
              // Check message content for tool_use blocks
              if (event.message?.content && Array.isArray(event.message.content)) {
                for (const block of event.message.content) {
                  if (block.type === 'tool_use') {
                    // Tool activity - show what Claude is doing
                    const toolName = block.name || 'tool';
                    let activity = toolName.toLowerCase();

                    // Map tool names to friendly activity names
                    if (toolName === 'Read') activity = 'reading';
                    else if (toolName === 'Glob') activity = 'searching';
                    else if (toolName === 'Grep') activity = 'searching';
                    else if (toolName === 'Write') activity = 'writing';
                    else if (toolName === 'Edit') activity = 'editing';
                    else if (toolName === 'Bash') activity = 'running';
                    else if (toolName === 'Task') activity = 'delegating';
                    else if (toolName === 'WebFetch') activity = 'fetching';
                    else if (toolName === 'WebSearch') activity = 'searching web';
                    else if (toolName === 'TodoWrite') activity = 'planning';

                    // Add file/path info if available from input
                    const input = block.input || {};
                    const target = input.file_path || input.path || input.pattern || input.command || input.url || '';
                    const shortTarget = typeof target === 'string' ? target.split('/').pop()?.substring(0, 25) : '';

                    const newActivity = shortTarget ? `${activity}: ${shortTarget}` : activity;
                    if (newActivity !== lastActivity) {
                      lastActivity = newActivity;
                      mainWindow?.webContents.send('claude:activity', newActivity);
                    }
                  } else if (block.type === 'text' && block.text) {
                    // This is rare in stream mode but handle it
                    responseText += block.text;
                    mainWindow?.webContents.send('claude:stream', block.text);
                  }
                }
              }
              break;

            case 'user':
              // Tool results - file reads, command outputs, etc
              // These indicate the tool has completed
              if (event.tool_use_result) {
                const result = event.tool_use_result;
                if (result.file?.filePath) {
                  const fileName = result.file.filePath.split('/').pop()?.substring(0, 25);
                  const newActivity = `read: ${fileName}`;
                  if (newActivity !== lastActivity) {
                    lastActivity = newActivity;
                    mainWindow?.webContents.send('claude:activity', newActivity);
                  }
                } else if (result.stdout !== undefined) {
                  // Command completed
                  if (lastActivity?.startsWith('running')) {
                    mainWindow?.webContents.send('claude:activity', 'command done');
                  }
                }
              }
              break;

            case 'content_block_delta':
              // Streaming text delta
              if (event.delta?.text) {
                responseText += event.delta.text;
                mainWindow?.webContents.send('claude:stream', event.delta.text);
                if (lastActivity !== 'responding') {
                  lastActivity = 'responding';
                  mainWindow?.webContents.send('claude:activity', 'responding');
                }
              }
              break;

            case 'result':
              // Final result - this is the actual response text
              if (event.result && typeof event.result === 'string') {
                // Only use this if we didn't get streaming content
                if (!responseText) {
                  responseText = event.result;
                  mainWindow?.webContents.send('claude:stream', event.result);
                }
                mainWindow?.webContents.send('claude:activity', 'done');
              }
              break;
          }
        } catch {
          // Not JSON, treat as raw text output
          if (chunk.trim()) {
            responseText += chunk;
            mainWindow?.webContents.send('claude:stream', chunk);
            if (lastActivity !== 'responding') {
              lastActivity = 'responding';
              mainWindow?.webContents.send('claude:activity', 'responding');
            }
          }
        }
      }
    });

    let stderr = '';
    claude.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
      console.log('[Claude stderr]:', data.toString());
    });

    claude.on('error', (err) => {
      console.error('Claude spawn error:', err);
      resolve({ success: false, error: err.message });
    });

    claude.on('close', async (code) => {
      console.log('[Claude] closed with code:', code, 'response length:', responseText.length);

      if (code === 0 || responseText.length > 0) {
        // Mark conversation as active for this project
        conversationState.set(projectKey, true);

        // Detect file changes and create pending edits for review
        if (projectPath) {
          try {
            const newEdits = await detectChangesAndCreateEdits(projectPath);
            if (newEdits.length > 0) {
              pendingEdits = [...pendingEdits, ...newEdits];
              // Notify renderer of new pending edits
              for (const edit of newEdits) {
                mainWindow?.webContents.send('claude:pendingEditAdded', edit);
              }
            }
          } catch (err) {
            console.error('Failed to detect changes:', err);
          }
        }

        resolve({ success: true, response: responseText.trim() });
      } else {
        resolve({ success: false, error: stderr || `Claude exited with code ${code}` });
      }
    });

    // Write to stdin after a small delay to ensure process is ready
    setTimeout(() => {
      if (claude.stdin && !stdinWritten) {
        stdinWritten = true;
        claude.stdin.write(fullPrompt);
        claude.stdin.end();
      }
    }, 100);
  });
});

ipcMain.handle('claude:checkInstalled', async () => {
  return new Promise((resolve) => {
    const check = spawn('which', ['claude'], {
      shell: true,
      env: getEnvWithPath(),
    });
    check.on('close', (code) => {
      resolve(code === 0);
    });
    check.on('error', () => {
      resolve(false);
    });
  });
});

// Clear conversation state (start fresh)
ipcMain.handle('claude:clearConversation', async (_, projectPath: string | null) => {
  const projectKey = projectPath || '__global__';
  conversationState.delete(projectKey);
  return { success: true };
});

// Edit approval handlers
// Now edits are managed on the client side, so we just need to write/reject files
ipcMain.handle('claude:getPendingEdits', () => {
  return pendingEdits;
});

ipcMain.handle('claude:approveEdit', async (_, editId: string, filePath?: string, content?: string) => {
  // If filePath and content provided, use those (client-side edit management)
  if (filePath && content !== undefined) {
    try {
      // Ensure directory exists
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // Fallback to server-side lookup (legacy)
  const edit = pendingEdits.find(e => e.id === editId);
  if (!edit) return { success: false, error: 'Edit not found' };

  try {
    await fs.writeFile(edit.filePath, edit.newContent, 'utf-8');
    pendingEdits = pendingEdits.filter(e => e.id !== editId);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('claude:rejectEdit', async (_, editId: string) => {
  const edit = pendingEdits.find(e => e.id === editId);
  if (!edit) {
    pendingEdits = pendingEdits.filter(e => e.id !== editId);
    return { success: true };
  }

  try {
    if (edit.isNewFile || edit.originalContent === '') {
      // Delete the new file
      await fs.unlink(edit.filePath);
    } else {
      // Restore original content
      await fs.writeFile(edit.filePath, edit.originalContent, 'utf-8');
    }
    pendingEdits = pendingEdits.filter(e => e.id !== editId);
    return { success: true };
  } catch (error) {
    console.error('Failed to reject edit:', error);
    // Still remove from pending list even if restore fails
    pendingEdits = pendingEdits.filter(e => e.id !== editId);
    return { success: false, error: String(error) };
  }
});

// Terminal (PTY)
interface TerminalSession {
  pty: pty.IPty;
  id: string;
}

const terminals: Map<string, TerminalSession> = new Map();

ipcMain.handle('terminal:create', (_, cwd?: string) => {
  const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh';
  const id = crypto.randomUUID();

  // Use login shell args to load profile (.zshrc, .bashrc, etc.)
  // This ensures Oh My Posh and other customizations are loaded
  const shellArgs = process.platform === 'win32'
    ? []
    : ['--login', '-i']; // -l/--login for login shell, -i for interactive

  const ptyProcess = pty.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: cwd || os.homedir(),
    env: {
      ...getEnvWithPath(),
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      TERM_PROGRAM: 'XTC',
    } as Record<string, string>,
  });

  terminals.set(id, { pty: ptyProcess, id });

  ptyProcess.onData((data) => {
    mainWindow?.webContents.send('terminal:data', { id, data });
  });

  ptyProcess.onExit(({ exitCode }) => {
    mainWindow?.webContents.send('terminal:exit', { id, exitCode });
    terminals.delete(id);
  });

  return { success: true, id };
});

ipcMain.handle('terminal:write', (_, id: string, data: string) => {
  const terminal = terminals.get(id);
  if (!terminal) return { success: false, error: 'Terminal not found' };
  terminal.pty.write(data);
  return { success: true };
});

ipcMain.handle('terminal:resize', (_, id: string, cols: number, rows: number) => {
  const terminal = terminals.get(id);
  if (!terminal) return { success: false, error: 'Terminal not found' };
  terminal.pty.resize(cols, rows);
  return { success: true };
});

ipcMain.handle('terminal:kill', (_, id: string) => {
  const terminal = terminals.get(id);
  if (!terminal) return { success: false, error: 'Terminal not found' };
  terminal.pty.kill();
  terminals.delete(id);
  return { success: true };
});

// Clean up terminals on app quit
app.on('before-quit', async () => {
  terminals.forEach((terminal) => {
    terminal.pty.kill();
  });
  terminals.clear();

  // Stop all language servers
  await lspManager.stopAll();
});

// LSP (Language Server Protocol) Handlers
ipcMain.handle('lsp:setProjectPath', (_, projectPath: string) => {
  lspManager.setProjectPath(projectPath);
  return { success: true };
});

ipcMain.handle('lsp:startServer', async (_, serverName: string) => {
  try {
    const success = await lspManager.startServer(serverName);
    return { success };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('lsp:stopServer', async (_, serverName: string) => {
  try {
    await lspManager.stopServer(serverName);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('lsp:stopAll', async () => {
  try {
    await lspManager.stopAll();
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('lsp:didOpen', async (_, uri: string, language: string, content: string) => {
  try {
    await lspManager.didOpen(uri, language, content);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('lsp:didChange', async (_, uri: string, language: string, content: string) => {
  try {
    await lspManager.didChange(uri, language, content);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('lsp:didClose', async (_, uri: string, language: string) => {
  try {
    await lspManager.didClose(uri, language);
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('lsp:getCompletions', async (_, uri: string, language: string, line: number, character: number) => {
  try {
    const result = await lspManager.getCompletions(uri, language, line, character);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('lsp:getHover', async (_, uri: string, language: string, line: number, character: number) => {
  try {
    const result = await lspManager.getHover(uri, language, line, character);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('lsp:getDefinition', async (_, uri: string, language: string, line: number, character: number) => {
  try {
    const result = await lspManager.getDefinition(uri, language, line, character);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('lsp:getReferences', async (_, uri: string, language: string, line: number, character: number) => {
  try {
    const result = await lspManager.getReferences(uri, language, line, character);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('lsp:formatDocument', async (_, uri: string, language: string) => {
  try {
    const result = await lspManager.formatDocument(uri, language);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('lsp:isServerAvailable', (_, language: string) => {
  return { success: true, available: lspManager.isServerAvailable(language) };
});

ipcMain.handle('lsp:getAvailableServers', () => {
  return { success: true, servers: lspManager.getAvailableServers() };
});

ipcMain.handle('lsp:getRunningServers', () => {
  return { success: true, servers: lspManager.getRunningServers() };
});

// Test Runner
interface TestResult {
  id: string;
  name: string;
  fullName: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration?: number;
  filePath: string;
  line?: number;
  errorMessage?: string;
  stackTrace?: string;
  ancestorTitles: string[];
}

interface TestFileResult {
  path: string;
  name: string;
  tests: TestResult[];
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  expanded: boolean;
}

// Detect which test runner to use
async function detectTestRunner(projectPath: string): Promise<'jest' | 'vitest' | null> {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);

    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps['vitest']) return 'vitest';
    if (deps['jest']) return 'jest';

    // Check scripts for test runner hints
    const scripts = pkg.scripts || {};
    const testScript = scripts.test || '';
    if (testScript.includes('vitest')) return 'vitest';
    if (testScript.includes('jest')) return 'jest';

    return null;
  } catch {
    return null;
  }
}

// Extract JSON from output (might have extra text before/after)
function extractJson(output: string): unknown | null {
  // Try parsing the whole output first
  try {
    return JSON.parse(output);
  } catch {
    // Try to find JSON object in output
    const jsonStart = output.indexOf('{');
    const jsonEnd = output.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      try {
        return JSON.parse(output.slice(jsonStart, jsonEnd + 1));
      } catch {
        // Ignore
      }
    }
    return null;
  }
}

// Parse Jest JSON output
function parseJestOutput(output: string, _projectPath: string): TestFileResult[] {
  try {
    const result = extractJson(output) as { testResults?: Array<{ name: string; assertionResults?: Array<{ title: string; status: string; ancestorTitles?: string[]; duration?: number; failureMessages?: string[] }> }> } | null;
    if (!result) {
      console.error('Failed to extract JSON from Jest output');
      return [];
    }
    const testFiles: TestFileResult[] = [];

    for (const testResult of result.testResults || []) {
      const filePath = testResult.name;
      const fileName = path.basename(filePath);
      const tests: TestResult[] = [];

      for (const assertion of testResult.assertionResults || []) {
        const status = assertion.status === 'passed' ? 'passed'
          : assertion.status === 'failed' ? 'failed'
          : assertion.status === 'pending' ? 'skipped'
          : 'pending';

        const ancestors = assertion.ancestorTitles || [];
        const fullName = [...ancestors, assertion.title].join(' > ');
        // Use deterministic ID based on filePath and fullName
        const testId = `${filePath}::${fullName}`;
        tests.push({
          id: testId,
          name: assertion.title,
          fullName,
          status,
          duration: assertion.duration || 0,
          filePath,
          errorMessage: assertion.failureMessages?.[0]?.split('\n')[0] || undefined,
          stackTrace: assertion.failureMessages?.join('\n') || undefined,
          ancestorTitles: ancestors,
        });
      }

      const fileStatus = tests.some(t => t.status === 'failed') ? 'failed'
        : tests.every(t => t.status === 'passed') ? 'passed'
        : 'skipped';

      testFiles.push({
        path: filePath,
        name: fileName,
        tests,
        status: fileStatus,
        expanded: fileStatus === 'failed', // Auto-expand failed files
      });
    }

    return testFiles;
  } catch (e) {
    console.error('Failed to parse Jest output:', e);
    return [];
  }
}

// Parse Vitest JSON output
function parseVitestOutput(output: string, _projectPath: string): TestFileResult[] {
  try {
    const result = extractJson(output) as { testResults?: Array<{ name: string; assertionResults?: Array<{ title: string; status: string; ancestorTitles?: string[]; duration?: number; failureMessages?: string[] }> }> } | null;
    if (!result) {
      console.error('Failed to extract JSON from Vitest output');
      return [];
    }
    const testFiles: TestFileResult[] = [];

    for (const file of result.testResults || []) {
      const filePath = file.name;
      const fileName = path.basename(filePath);
      const tests: TestResult[] = [];

      for (const assertion of file.assertionResults || []) {
        const status = assertion.status === 'passed' ? 'passed'
          : assertion.status === 'failed' ? 'failed'
          : 'skipped';

        const ancestors = assertion.ancestorTitles || [];
        const fullName = [...ancestors, assertion.title].join(' > ');
        // Use deterministic ID based on filePath and fullName
        const testId = `${filePath}::${fullName}`;
        tests.push({
          id: testId,
          name: assertion.title,
          fullName,
          status,
          duration: assertion.duration || 0,
          filePath,
          errorMessage: assertion.failureMessages?.[0]?.split('\n')[0] || undefined,
          stackTrace: assertion.failureMessages?.join('\n') || undefined,
          ancestorTitles: ancestors,
        });
      }

      const fileStatus = tests.some(t => t.status === 'failed') ? 'failed'
        : tests.every(t => t.status === 'passed') ? 'passed'
        : 'skipped';

      testFiles.push({
        path: filePath,
        name: fileName,
        tests,
        status: fileStatus,
        expanded: fileStatus === 'failed',
      });
    }

    return testFiles;
  } catch (e) {
    console.error('Failed to parse Vitest output:', e);
    return [];
  }
}

// Parse Playwright JSON output
function parsePlaywrightOutput(output: string, _projectPath: string): TestFileResult[] {
  try {
    const result = extractJson(output) as {
      suites?: Array<{
        title: string;
        file: string;
        specs?: Array<{
          title: string;
          ok: boolean;
          tests?: Array<{
            expectedStatus: string;
            status: string;
            results?: Array<{
              duration: number;
              error?: { message?: string; stack?: string };
            }>;
          }>;
        }>;
        suites?: Array<{
          title: string;
          specs?: Array<{
            title: string;
            ok: boolean;
            tests?: Array<{
              expectedStatus: string;
              status: string;
              results?: Array<{
                duration: number;
                error?: { message?: string; stack?: string };
              }>;
            }>;
          }>;
        }>;
      }>;
    } | null;

    if (!result || !result.suites) {
      console.error('Failed to extract JSON from Playwright output');
      return [];
    }

    const testFiles: TestFileResult[] = [];

    // Helper to recursively extract specs from suites
    function extractSpecs(
      suite: { title: string; specs?: Array<{ title: string; ok: boolean; tests?: Array<{ status: string; results?: Array<{ duration: number; error?: { message?: string; stack?: string } }> }> }>; suites?: Array<unknown> },
      filePath: string,
      ancestors: string[] = []
    ): TestResult[] {
      const tests: TestResult[] = [];
      const currentAncestors = suite.title ? [...ancestors, suite.title] : ancestors;

      for (const spec of suite.specs || []) {
        const status = spec.ok ? 'passed' : 'failed';
        const testResult = spec.tests?.[0];
        const result = testResult?.results?.[0];
        const fullName = [...currentAncestors, spec.title].join(' > ');
        const testId = `${filePath}::${fullName}`;

        tests.push({
          id: testId,
          name: spec.title,
          fullName,
          status,
          duration: result?.duration || 0,
          filePath,
          errorMessage: result?.error?.message?.split('\n')[0],
          stackTrace: result?.error?.stack,
          ancestorTitles: currentAncestors,
        });
      }

      // Recurse into nested suites
      for (const nestedSuite of (suite.suites || []) as Array<typeof suite>) {
        tests.push(...extractSpecs(nestedSuite, filePath, currentAncestors));
      }

      return tests;
    }

    for (const suite of result.suites) {
      const filePath = suite.file;
      const fileName = path.basename(filePath);
      const tests = extractSpecs(suite, filePath);

      if (tests.length > 0) {
        const fileStatus = tests.some(t => t.status === 'failed') ? 'failed'
          : tests.every(t => t.status === 'passed') ? 'passed'
          : 'skipped';

        testFiles.push({
          path: filePath,
          name: fileName,
          tests,
          status: fileStatus,
          expanded: fileStatus === 'failed',
        });
      }
    }

    return testFiles;
  } catch (e) {
    console.error('Failed to parse Playwright output:', e);
    return [];
  }
}

// Detect available test frameworks in the project
ipcMain.handle('tests:detectFrameworks', async (_, projectPath: string) => {
  interface DetectedFramework {
    id: string;
    name: string;
    detected: boolean;
    configFile?: string;
  }

  const frameworks: DetectedFramework[] = [];

  // Check for Jest
  const jestConfigs = ['jest.config.js', 'jest.config.ts', 'jest.config.mjs', 'jest.config.cjs', 'jest.config.json'];
  for (const config of jestConfigs) {
    try {
      await fs.access(path.join(projectPath, config));
      frameworks.push({ id: 'jest', name: 'Jest', detected: true, configFile: config });
      break;
    } catch {
      // Config not found
    }
  }
  // Also check package.json for jest
  if (!frameworks.find(f => f.id === 'jest')) {
    try {
      const pkgJson = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
      if (pkgJson.devDependencies?.jest || pkgJson.dependencies?.jest) {
        frameworks.push({ id: 'jest', name: 'Jest', detected: true });
      }
    } catch {
      // No package.json
    }
  }

  // Check for Vitest
  const vitestConfigs = ['vitest.config.js', 'vitest.config.ts', 'vitest.config.mjs', 'vitest.config.mts'];
  for (const config of vitestConfigs) {
    try {
      await fs.access(path.join(projectPath, config));
      frameworks.push({ id: 'vitest', name: 'Vitest', detected: true, configFile: config });
      break;
    } catch {
      // Config not found
    }
  }
  if (!frameworks.find(f => f.id === 'vitest')) {
    try {
      const pkgJson = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
      if (pkgJson.devDependencies?.vitest || pkgJson.dependencies?.vitest) {
        frameworks.push({ id: 'vitest', name: 'Vitest', detected: true });
      }
    } catch {
      // No package.json
    }
  }

  // Check for Mocha
  const mochaConfigs = ['.mocharc.js', '.mocharc.json', '.mocharc.yaml', '.mocharc.yml'];
  for (const config of mochaConfigs) {
    try {
      await fs.access(path.join(projectPath, config));
      frameworks.push({ id: 'mocha', name: 'Mocha', detected: true, configFile: config });
      break;
    } catch {
      // Config not found
    }
  }
  if (!frameworks.find(f => f.id === 'mocha')) {
    try {
      const pkgJson = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
      if (pkgJson.devDependencies?.mocha || pkgJson.dependencies?.mocha) {
        frameworks.push({ id: 'mocha', name: 'Mocha', detected: true });
      }
    } catch {
      // No package.json
    }
  }

  // Check for Playwright
  const playwrightConfigs = ['playwright.config.js', 'playwright.config.ts'];
  for (const config of playwrightConfigs) {
    try {
      await fs.access(path.join(projectPath, config));
      frameworks.push({ id: 'playwright', name: 'Playwright', detected: true, configFile: config });
      break;
    } catch {
      // Config not found
    }
  }

  // Check for Cypress
  const cypressConfigs = ['cypress.config.js', 'cypress.config.ts', 'cypress.json'];
  for (const config of cypressConfigs) {
    try {
      await fs.access(path.join(projectPath, config));
      frameworks.push({ id: 'cypress', name: 'Cypress', detected: true, configFile: config });
      break;
    } catch {
      // Config not found
    }
  }

  return { frameworks };
});

// Detect test files and parse their structure
ipcMain.handle('tests:detect', async (_, projectPath: string, framework?: string) => {
  try {
    const testFiles: TestFileResult[] = [];

    // Common test file patterns
    const testPatterns = [
      /\.test\.[jt]sx?$/,
      /\.spec\.[jt]sx?$/,
      /_test\.[jt]sx?$/,
      /\.test\.[cm]?[jt]s$/,
    ];

    // Directories to skip
    const skipDirs = ['node_modules', 'dist', 'build', '.git', 'coverage', '.next', '.nuxt'];

    // Detect framework from file imports (definitive check)
    const detectFileFramework = async (filePath: string): Promise<'playwright' | 'cypress' | 'vitest' | 'jest' | 'mocha' | null> => {
      try {
        const content = await fs.readFile(filePath, 'utf-8');

        // Check imports - most reliable way
        if (content.includes('@playwright/test') || content.includes('from "playwright"') || content.includes("from 'playwright'")) {
          return 'playwright';
        }
        if (content.includes('from "cypress"') || content.includes("from 'cypress'") || /\bcy\.(visit|get|contains|request)\s*\(/.test(content)) {
          return 'cypress';
        }
        if (content.includes('from "vitest"') || content.includes("from 'vitest'") || content.includes('import.meta.vitest')) {
          return 'vitest';
        }
        if (content.includes('from "@jest/globals"') || content.includes("from '@jest/globals'")) {
          return 'jest';
        }
        if (content.includes('from "mocha"') || content.includes("from 'mocha'")) {
          return 'mocha';
        }

        // Default: assume jest/vitest compatible (most common)
        return null;
      } catch {
        return null;
      }
    };

    const shouldIncludeFile = async (filePath: string): Promise<boolean> => {
      if (!framework) return true; // No filter if no framework specified

      const fileFramework = await detectFileFramework(filePath);

      switch (framework) {
        case 'playwright':
          return fileFramework === 'playwright';
        case 'cypress':
          return fileFramework === 'cypress';
        case 'vitest':
          // Include vitest files and generic test files (no specific framework import)
          return fileFramework === 'vitest' || fileFramework === null;
        case 'jest':
          // Include jest files and generic test files (no specific framework import)
          return fileFramework === 'jest' || fileFramework === null;
        case 'mocha':
          return fileFramework === 'mocha' || fileFramework === null;
        default:
          return true;
      }
    };

    // Recursively find test files
    async function findTestFiles(dir: string): Promise<string[]> {
      const files: string[] = [];
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!skipDirs.includes(entry.name)) {
              files.push(...await findTestFiles(fullPath));
            }
          } else if (entry.isFile()) {
            if (testPatterns.some(p => p.test(entry.name))) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Ignore permission errors etc
      }
      return files;
    }

    // Parse test file to extract test names
    async function parseTestFile(filePath: string): Promise<TestResult[]> {
      const tests: TestResult[] = [];
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        // Track describe blocks using bracket depth
        const describeStack: { name: string; depth: number }[] = [];
        let bracketDepth = 0;

        // Count brackets in a line (accounting for strings and comments)
        function countBrackets(line: string): { open: number; close: number } {
          let open = 0;
          let close = 0;
          let inString: string | null = null;
          let escaped = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (escaped) {
              escaped = false;
              continue;
            }

            if (char === '\\' && inString) {
              escaped = true;
              continue;
            }

            // Handle string boundaries
            if (!inString && (char === '"' || char === "'" || char === '`')) {
              inString = char;
              continue;
            }
            if (inString && char === inString) {
              inString = null;
              continue;
            }

            // Skip if in string
            if (inString) continue;

            // Handle comments
            if (char === '/' && line[i + 1] === '/') break; // Line comment
            if (char === '/' && line[i + 1] === '*') {
              // Skip to end of block comment on same line
              const endComment = line.indexOf('*/', i + 2);
              if (endComment >= 0) {
                i = endComment + 1;
                continue;
              }
              break;
            }

            if (char === '{') open++;
            if (char === '}') close++;
          }

          return { open, close };
        }

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNum = i + 1;

          // Match describe/context blocks BEFORE counting brackets
          const describeMatch = line.match(/^\s*(describe|context)\s*\(\s*['"`](.+?)['"`]/);
          if (describeMatch) {
            describeStack.push({ name: describeMatch[2], depth: bracketDepth });
          }

          // Count brackets on this line
          const { open, close } = countBrackets(line);
          bracketDepth += open - close;

          // Pop describe blocks if we've exited their scope
          while (describeStack.length > 0 && bracketDepth <= describeStack[describeStack.length - 1].depth) {
            describeStack.pop();
          }

          // Match it/test/specify blocks (including skipped variants)
          const testMatch = line.match(/^\s*(it|test|specify)(?:\.skip)?\s*\(\s*['"`](.+?)['"`]/);
          const skippedTestMatch = line.match(/^\s*(xit|xtest|it\.skip|test\.skip)\s*\(\s*['"`](.+?)['"`]/);

          if (testMatch || skippedTestMatch) {
            const match = testMatch || skippedTestMatch;
            const testName = match![2];
            const isSkipped = !!skippedTestMatch || line.includes('.skip');
            const ancestors = describeStack.map(d => d.name);
            const fullName = [...ancestors, testName].join(' > ');
            // Use deterministic ID based on filePath and fullName so re-detection preserves selection
            const testId = `${filePath}::${fullName}`;
            tests.push({
              id: testId,
              name: testName,
              fullName,
              status: isSkipped ? 'skipped' : 'pending',
              filePath,
              line: lineNum,
              ancestorTitles: ancestors,
            });
          }
        }
      } catch {
        // Ignore parse errors
      }
      return tests;
    }

    // Find all test files
    const testFilePaths = await findTestFiles(projectPath);

    // Parse each test file (with framework filtering based on imports)
    for (const filePath of testFilePaths) {
      if (!(await shouldIncludeFile(filePath))) continue;

      const tests = await parseTestFile(filePath);
      if (tests.length > 0) {
        testFiles.push({
          path: filePath,
          name: path.basename(filePath),
          tests,
          status: 'pending',
          expanded: false,
        });
      }
    }

    // Sort by file name
    testFiles.sort((a, b) => a.name.localeCompare(b.name));

    return { success: true, testFiles };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('tests:run', async (_, projectPath: string, testFile?: string, testName?: string, framework?: string) => {
  // Use provided framework or auto-detect
  const runner = framework || await detectTestRunner(projectPath);

  if (!runner) {
    return { success: false, error: 'No test runner detected. Install Jest, Vitest, or Playwright.' };
  }

  return new Promise((resolve) => {
    let cmd: string;
    let args: string[];

    // Helper to escape arguments for shell
    const escapeArg = (arg: string) => `"${arg.replace(/"/g, '\\"')}"`;
    // Helper to escape regex special characters for Jest's -t flag
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (runner === 'playwright') {
      // Run with Playwright
      cmd = 'npx';
      args = ['playwright', 'test', '--reporter=json'];

      // Add file filter
      if (testFile) {
        args.push(testFile.includes(' ') ? escapeArg(testFile) : testFile);
      }

      // Add test name filter with -g (grep)
      if (testName) {
        args.push('-g', escapeArg(testName));
      }
    } else if (runner === 'vitest') {
      // Use npx to run vitest with JSON reporter
      cmd = 'npx';
      args = ['vitest', 'run', '--reporter=json'];

      // Add file filter (quote only if path has spaces)
      if (testFile) {
        args.push(testFile.includes(' ') ? escapeArg(testFile) : testFile);
      }

      // Add test name filter (escape regex chars since -t uses regex matching)
      if (testName) {
        args.push('-t', escapeArg(escapeRegex(testName)));
      }
    } else {
      // Jest
      cmd = 'npx';
      args = ['jest', '--json', '--testLocationInResults'];

      // Add file filter (quote only if path has spaces)
      if (testFile) {
        args.push(testFile.includes(' ') ? escapeArg(testFile) : testFile);
      }

      // Add test name filter (escape regex chars since -t uses regex matching)
      if (testName) {
        args.push('-t', escapeArg(escapeRegex(testName)));
      }
    }

    console.log('[TestRunner] Command:', cmd, args.join(' '));

    const proc = spawn(cmd, args, {
      cwd: projectPath,
      env: getEnvWithPath(),
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    proc.on('close', (_code) => {
      console.log('[TestRunner] stdout length:', stdout.length);
      console.log('[TestRunner] stderr preview:', stderr.slice(0, 300));
      console.log('[TestRunner] stdout preview:', stdout.slice(0, 500));

      // Combine output for display (stderr first since it usually has errors)
      const rawOutput = stderr + (stderr && stdout ? '\n' : '') + stdout;

      // Jest and Vitest return non-zero when tests fail, but that's not an error
      const parser = runner === 'playwright' ? parsePlaywrightOutput
        : runner === 'vitest' ? parseVitestOutput
        : parseJestOutput;
      const testFiles = parser(stdout, projectPath);

      console.log('[TestRunner] Parsed testFiles:', testFiles.length, 'files, tests:', testFiles[0]?.tests?.length || 0);

      if (testFiles.length > 0) {
        resolve({ success: true, testFiles, output: rawOutput });
      } else if (stderr && !stdout.includes('{')) {
        resolve({ success: false, error: stderr, output: rawOutput });
      } else {
        resolve({ success: false, error: 'No test results found.', output: rawOutput });
      }
    });
  });
});

// ==================== Git Operations ====================

// Helper to run git commands
const runGit = async (projectPath: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> => {
  return new Promise((resolve) => {
    const proc = spawn('git', args, {
      cwd: projectPath,
      env: getEnvWithPath(),
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      // Only trim trailing whitespace from stdout to preserve leading spaces (important for git status porcelain format)
      resolve({ stdout: stdout.trimEnd(), stderr: stderr.trim(), code: code || 0 });
    });

    proc.on('error', (err) => {
      resolve({ stdout: '', stderr: err.message, code: 1 });
    });
  });
};

// Check if directory is a git repo
ipcMain.handle('git:isRepo', async (_, projectPath: string) => {
  const result = await runGit(projectPath, ['rev-parse', '--is-inside-work-tree']);
  return { success: true, isRepo: result.code === 0 };
});

// Get current branch
ipcMain.handle('git:branch', async (_, projectPath: string) => {
  const current = await runGit(projectPath, ['branch', '--show-current']);
  const all = await runGit(projectPath, ['branch', '--format=%(refname:short)']);
  const remotes = await runGit(projectPath, ['branch', '-r', '--format=%(refname:short)']);

  return {
    success: true,
    current: current.stdout || 'HEAD',
    all: all.stdout.split('\n').filter(Boolean),
    remotes: remotes.stdout.split('\n').filter(Boolean),
  };
});

// Get remote info
ipcMain.handle('git:remote', async (_, projectPath: string) => {
  const url = await runGit(projectPath, ['remote', 'get-url', 'origin']);

  if (url.code !== 0) {
    return { success: true, remote: null };
  }

  // Parse GitHub URL (handles both https and ssh)
  const urlStr = url.stdout;
  let owner = '';
  let repo = '';

  // SSH: git@github.com:owner/repo.git
  const sshMatch = urlStr.match(/git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  // HTTPS: https://github.com/owner/repo.git
  const httpsMatch = urlStr.match(/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/);

  if (sshMatch) {
    owner = sshMatch[1];
    repo = sshMatch[2];
  } else if (httpsMatch) {
    owner = httpsMatch[1];
    repo = httpsMatch[2];
  }

  return {
    success: true,
    remote: {
      url: urlStr,
      owner,
      repo,
    },
  };
});

// Get git status (changed files)
ipcMain.handle('git:status', async (_, projectPath: string) => {
  const status = await runGit(projectPath, ['status', '--porcelain=v1']);
  const ahead = await runGit(projectPath, ['rev-list', '--count', '@{u}..HEAD']);
  const behind = await runGit(projectPath, ['rev-list', '--count', 'HEAD..@{u}']);

  // Porcelain v1 format: XY PATH
  // X = staging area (index) status
  // Y = worktree status
  // A file can have BOTH staged AND unstaged changes (e.g., 'MM file.txt')
  const changes: { path: string; status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed'; staged: boolean }[] = [];

  for (const line of status.stdout.split('\n').filter(Boolean)) {
    const indexStatus = line[0]; // X - staging area status
    const worktreeStatus = line[1]; // Y - worktree status
    // Path starts after XY and separator space (position 3), but handle edge cases
    // where separator might be missing or path has leading spaces
    const filePath = line.length > 3 && line[2] === ' '
      ? line.substring(3)
      : line.substring(2).trimStart();

    // Helper to determine file status from a status code
    const getFileStatus = (code: string): 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed' => {
      if (code === 'M') return 'modified';
      if (code === 'A') return 'added';
      if (code === 'D') return 'deleted';
      if (code === 'R') return 'renamed';
      if (code === '?') return 'untracked';
      return 'modified';
    };

    // Handle untracked files (both chars are '?')
    if (indexStatus === '?' && worktreeStatus === '?') {
      changes.push({ path: filePath, status: 'untracked', staged: false });
      continue;
    }

    // Check for staged changes (index status is not space)
    if (indexStatus !== ' ' && indexStatus !== '?') {
      changes.push({ path: filePath, status: getFileStatus(indexStatus), staged: true });
    }

    // Check for unstaged/worktree changes (worktree status is not space)
    if (worktreeStatus !== ' ' && worktreeStatus !== '?') {
      changes.push({ path: filePath, status: getFileStatus(worktreeStatus), staged: false });
    }
  }

  return {
    success: true,
    changes,
    ahead: parseInt(ahead.stdout) || 0,
    behind: parseInt(behind.stdout) || 0,
  };
});

// Stage files
ipcMain.handle('git:stage', async (_, projectPath: string, files: string[]) => {
  const result = await runGit(projectPath, ['add', ...files]);
  return { success: result.code === 0, error: result.stderr };
});

// Unstage files
ipcMain.handle('git:unstage', async (_, projectPath: string, files: string[]) => {
  const result = await runGit(projectPath, ['reset', 'HEAD', ...files]);
  return { success: result.code === 0, error: result.stderr };
});

// Commit
ipcMain.handle('git:commit', async (_, projectPath: string, message: string) => {
  const result = await runGit(projectPath, ['commit', '-m', message]);
  return { success: result.code === 0, error: result.stderr, output: result.stdout };
});

// Push
ipcMain.handle('git:push', async (_, projectPath: string, branch?: string) => {
  const args = branch ? ['push', '-u', 'origin', branch, '--progress'] : ['push', '--progress'];
  const result = await runGit(projectPath, args);
  return { success: result.code === 0, error: result.stderr, output: result.stdout || result.stderr };
});

// Pull
ipcMain.handle('git:pull', async (_, projectPath: string) => {
  const result = await runGit(projectPath, ['pull']);
  return { success: result.code === 0, error: result.stderr, output: result.stdout };
});

// Fetch all remotes
ipcMain.handle('git:fetch', async (_, projectPath: string) => {
  const result = await runGit(projectPath, ['fetch', '--all', '--prune']);
  return { success: result.code === 0, error: result.stderr, output: result.stdout };
});

// Create branch
ipcMain.handle('git:createBranch', async (_, projectPath: string, branchName: string, checkout: boolean = true) => {
  if (checkout) {
    const result = await runGit(projectPath, ['checkout', '-b', branchName]);
    return { success: result.code === 0, error: result.stderr };
  } else {
    const result = await runGit(projectPath, ['branch', branchName]);
    return { success: result.code === 0, error: result.stderr };
  }
});

// Checkout branch
ipcMain.handle('git:checkout', async (_, projectPath: string, branchName: string) => {
  const result = await runGit(projectPath, ['checkout', branchName]);
  return { success: result.code === 0, error: result.stderr };
});

// List worktrees
ipcMain.handle('git:worktree:list', async (_, projectPath: string) => {
  const result = await runGit(projectPath, ['worktree', 'list', '--porcelain']);

  const worktrees: { path: string; branch: string; isMain: boolean }[] = [];
  const lines = result.stdout.split('\n');

  let current: { path?: string; branch?: string } = {};

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      current.path = line.substring(9);
    } else if (line.startsWith('branch ')) {
      current.branch = line.substring(7).replace('refs/heads/', '');
    } else if (line === '') {
      if (current.path && current.branch) {
        worktrees.push({
          path: current.path,
          branch: current.branch,
          isMain: worktrees.length === 0, // First one is main
        });
      }
      current = {};
    }
  }

  // Handle last entry
  if (current.path && current.branch) {
    worktrees.push({
      path: current.path,
      branch: current.branch,
      isMain: worktrees.length === 0,
    });
  }

  return { success: true, worktrees };
});

// Add worktree
ipcMain.handle('git:worktree:add', async (_, projectPath: string, worktreePath: string, branch: string, createBranch: boolean = false) => {
  const args = createBranch
    ? ['worktree', 'add', worktreePath, '-b', branch]
    : ['worktree', 'add', worktreePath, branch];

  const result = await runGit(projectPath, args);
  return { success: result.code === 0, error: result.stderr };
});

// Remove worktree
ipcMain.handle('git:worktree:remove', async (_, projectPath: string, worktreePath: string) => {
  const result = await runGit(projectPath, ['worktree', 'remove', worktreePath]);
  return { success: result.code === 0, error: result.stderr };
});

// Create PR using gh CLI
ipcMain.handle('git:pr:create', async (_, projectPath: string, options: { title: string; body: string; base: string }) => {
  const proc = spawn('gh', ['pr', 'create', '--title', options.title, '--body', options.body, '--base', options.base], {
    cwd: projectPath,
    env: getEnvWithPath(),
  });

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        // stdout contains the PR URL
        resolve({ success: true, url: stdout.trim() });
      } else {
        resolve({ success: false, error: stderr.trim() || 'Failed to create PR' });
      }
    });

    proc.on('error', () => {
      resolve({ success: false, error: 'GitHub CLI (gh) not found. Install it with: brew install gh' });
    });
  });
});

// Get staged diff
ipcMain.handle('git:diff', async (_, projectPath: string, staged: boolean = true) => {
  const args = staged ? ['diff', '--cached'] : ['diff'];
  const result = await runGit(projectPath, args);
  return {
    success: result.code === 0,
    diff: result.stdout,
    error: result.code !== 0 ? result.stderr : undefined,
  };
});

// Get protected branches from GitHub API
ipcMain.handle('git:protectedBranches', async (_, projectPath: string) => {
  // First get remote info to construct API path
  const remoteResult = await runGit(projectPath, ['remote', 'get-url', 'origin']);
  if (remoteResult.code !== 0) {
    return { success: false, error: 'No remote found', branches: [] };
  }

  const urlStr = remoteResult.stdout;
  let owner = '';
  let repo = '';

  // SSH: git@github.com:owner/repo.git
  const sshMatch = urlStr.match(/git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  // HTTPS: https://github.com/owner/repo.git
  const httpsMatch = urlStr.match(/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/);

  if (sshMatch) {
    owner = sshMatch[1];
    repo = sshMatch[2];
  } else if (httpsMatch) {
    owner = httpsMatch[1];
    repo = httpsMatch[2];
  }

  if (!owner || !repo) {
    return { success: false, error: 'Could not parse GitHub remote', branches: [] };
  }

  // Use gh CLI to fetch branches with protection status
  // The API returns a 'protected' boolean field for each branch
  const proc = spawn('gh', ['api', `repos/${owner}/${repo}/branches`, '--jq', '[.[] | select(.protected == true) | .name]'], {
    cwd: projectPath,
    env: getEnvWithPath(),
  });

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('[git:protectedBranches] Error:', stderr);
        resolve({ success: false, error: stderr.trim() || 'Failed to fetch branches', branches: [] });
        return;
      }

      try {
        const protectedBranches = JSON.parse(stdout.trim());
        console.log('[git:protectedBranches] Found:', protectedBranches);
        resolve({ success: true, branches: protectedBranches });
      } catch (e) {
        console.error('[git:protectedBranches] Parse error:', e, 'stdout:', stdout);
        resolve({ success: true, branches: [] });
      }
    });

    proc.on('error', (err) => {
      console.error('[git:protectedBranches] Spawn error:', err);
      resolve({ success: false, error: 'GitHub CLI (gh) not found', branches: [] });
    });
  });
});

// List PRs
ipcMain.handle('git:pr:list', async (_, projectPath: string) => {
  const proc = spawn('gh', ['pr', 'list', '--json', 'number,title,state,headRefName,url'], {
    cwd: projectPath,
    env: getEnvWithPath(),
  });

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          const prs = JSON.parse(stdout);
          resolve({ success: true, prs });
        } catch {
          resolve({ success: false, error: 'Failed to parse PR list' });
        }
      } else {
        resolve({ success: false, error: stderr.trim() || 'Failed to list PRs' });
      }
    });

    proc.on('error', () => {
      resolve({ success: false, error: 'GitHub CLI (gh) not found' });
    });
  });
});

// Submit PR review with comments using gh CLI
interface PRReviewComment {
  path: string;
  line: number;  // End line (or single line)
  startLine?: number;  // Start line for multi-line comments
  body: string;
}

ipcMain.handle('git:pr:review', async (_, projectPath: string, options: {
  action: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  body: string;
  comments: PRReviewComment[];
}) => {
  try {
    // First, get the current PR number for this branch
    const prNumberProc = spawn('gh', ['pr', 'view', '--json', 'number', '--jq', '.number'], {
      cwd: projectPath,
      env: getEnvWithPath(),
    });

    const prNumber = await new Promise<string>((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      prNumberProc.stdout.on('data', (data) => { stdout += data.toString(); });
      prNumberProc.stderr.on('data', (data) => { stderr += data.toString(); });
      prNumberProc.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          resolve(stdout.trim());
        } else {
          reject(new Error(stderr.trim() || 'No PR found for current branch. Create a PR first.'));
        }
      });
      prNumberProc.on('error', () => reject(new Error('GitHub CLI (gh) not found')));
    });

    console.log('[git:pr:review] Found PR number:', prNumber);

    // Build the review submission using GitHub API
    // The gh pr review command doesn't support inline comments, so we use the API directly

    // Get repo info - use separate JSON fields to avoid jq escaping issues
    const repoProc = spawn('gh', ['repo', 'view', '--json', 'owner,name'], {
      cwd: projectPath,
      env: getEnvWithPath(),
    });

    const repoFullName = await new Promise<string>((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      repoProc.stdout.on('data', (data) => { stdout += data.toString(); });
      repoProc.stderr.on('data', (data) => { stderr += data.toString(); });
      repoProc.on('close', (code) => {
        if (code === 0) {
          try {
            const data = JSON.parse(stdout.trim());
            resolve(`${data.owner.login}/${data.name}`);
          } catch {
            reject(new Error('Failed to parse repo info'));
          }
        } else {
          reject(new Error(stderr.trim() || 'Could not get repo info'));
        }
      });
      repoProc.on('error', () => reject(new Error('GitHub CLI (gh) not found')));
    });

    console.log('[git:pr:review] Repo:', repoFullName);

    // Get the latest commit SHA for the PR
    const shaProc = spawn('gh', ['pr', 'view', prNumber, '--json', 'headRefOid', '--jq', '.headRefOid'], {
      cwd: projectPath,
      env: getEnvWithPath(),
    });

    const commitSha = await new Promise<string>((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      shaProc.stdout.on('data', (data) => { stdout += data.toString(); });
      shaProc.stderr.on('data', (data) => { stderr += data.toString(); });
      shaProc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(stderr.trim() || 'Could not get commit SHA'));
        }
      });
      shaProc.on('error', () => reject(new Error('GitHub CLI (gh) not found')));
    });

    console.log('[git:pr:review] Commit SHA:', commitSha);

    // Get list of files actually in the PR from GitHub
    const prFilesProc = spawn('gh', ['pr', 'view', prNumber, '--json', 'files', '--jq', '.files[].path'], {
      cwd: projectPath,
      env: getEnvWithPath(),
    });

    const prFilePaths = await new Promise<Set<string>>((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      prFilesProc.stdout.on('data', (data) => { stdout += data.toString(); });
      prFilesProc.stderr.on('data', (data) => { stderr += data.toString(); });
      prFilesProc.on('close', (code) => {
        if (code === 0) {
          const paths = new Set(stdout.trim().split('\n').filter(p => p));
          console.log('[git:pr:review] PR files from GitHub:', Array.from(paths));
          resolve(paths);
        } else {
          reject(new Error(stderr.trim() || 'Could not get PR files'));
        }
      });
      prFilesProc.on('error', () => reject(new Error('GitHub CLI (gh) not found')));
    });

    // Filter comments to only include files that are actually in the PR
    const validComments = options.comments.filter(c => c.line > 0 && prFilePaths.has(c.path));
    console.log('[git:pr:review] Total comments:', options.comments.length, 'Valid comments (in PR):', validComments.length);

    if (validComments.length === 0 && options.comments.length > 0) {
      console.log('[git:pr:review] Warning: All comments filtered out. Comment paths:',
        [...new Set(options.comments.map(c => c.path))].slice(0, 5));
    }

    // Format comments for GitHub API
    // Note: Disabling multi-line comments (start_line) as they require both lines to be in the same diff hunk
    const formattedComments = validComments.map(c => {
      const comment: { path: string; line: number; body: string; side: string; start_line?: number; start_side?: string } = {
        path: c.path,
        line: c.line,
        body: c.body,
        side: 'RIGHT',
      };
      // Temporarily disabled multi-line comments to debug 422 errors
      // if (c.startLine && c.startLine !== c.line) {
      //   comment.start_line = c.startLine;
      //   comment.start_side = 'RIGHT';
      // }
      return comment;
    });

    // Log first few comments for debugging
    console.log('[git:pr:review] First 3 comments:', JSON.stringify(formattedComments.slice(0, 3), null, 2));

    // Helper to submit a single review batch - returns comment IDs on success
    const submitBatch = (payload: object): Promise<{ success: boolean; error?: string; commentIds?: number[] }> => {
      return new Promise((resolve) => {
        const proc = spawn('gh', [
          'api',
          '--method', 'POST',
          `repos/${repoFullName}/pulls/${prNumber}/reviews`,
          '--input', '-',
        ], {
          cwd: projectPath,
          env: getEnvWithPath(),
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code) => {
          console.log('[git:pr:review] Batch response code:', code);
          console.log('[git:pr:review] Batch stdout:', stdout);
          console.log('[git:pr:review] Batch stderr:', stderr);
          if (code === 0) {
            // Parse response to get comment IDs for potential rollback
            let commentIds: number[] = [];
            try {
              const response = JSON.parse(stdout);
              if (response.comments && Array.isArray(response.comments)) {
                commentIds = response.comments.map((c: { id: number }) => c.id);
              }
            } catch {
              // Ignore parse errors
            }
            resolve({ success: true, commentIds });
          } else {
            let errorMsg = stderr.trim() || 'Failed to submit review';
            try {
              // gh outputs error JSON to stdout on error, try to extract it
              const jsonMatch = stdout.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const errorJson = JSON.parse(jsonMatch[0]);
                if (errorJson.message) {
                  errorMsg = errorJson.message;
                  if (errorJson.errors?.length > 0) {
                    errorMsg += ': ' + errorJson.errors.map((e: { message?: string; field?: string; resource?: string; code?: string }) =>
                      `${e.field || e.resource || ''}: ${e.message || e.code || JSON.stringify(e)}`
                    ).join(', ');
                  }
                }
              }
            } catch {
              // Use stderr as-is
            }
            resolve({ success: false, error: errorMsg });
          }
        });

        proc.on('error', () => resolve({ success: false, error: 'GitHub CLI (gh) not found' }));

        proc.stdin.write(JSON.stringify(payload));
        proc.stdin.end();
      });
    };

    // Helper to delete a comment (for rollback)
    const deleteComment = (commentId: number): Promise<void> => {
      return new Promise((resolve) => {
        const proc = spawn('gh', [
          'api',
          '--method', 'DELETE',
          `repos/${repoFullName}/pulls/comments/${commentId}`,
        ], {
          cwd: projectPath,
          env: getEnvWithPath(),
        });
        proc.on('close', () => resolve());
        proc.on('error', () => resolve());
      });
    };

    // Rollback function - delete all submitted comments
    const rollback = async (commentIds: number[]) => {
      if (commentIds.length === 0) return;
      console.log(`[git:pr:review] Rolling back ${commentIds.length} comments...`);
      for (const id of commentIds) {
        await deleteComment(id);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between deletes
      }
      console.log('[git:pr:review] Rollback complete');
    };

    // Batch comments to avoid rate limits (20 per batch with 1.5s delay)
    const BATCH_SIZE = 20;
    const BATCH_DELAY_MS = 1500;

    // Helper to send progress updates to renderer
    const sendProgress = (batch: number, total: number, status: 'pending' | 'sending' | 'success' | 'failed' | 'rolling-back') => {
      mainWindow?.webContents.send('git:pr:review:progress', { batch, total, status });
    };

    if (formattedComments.length <= BATCH_SIZE) {
      // Single batch - include everything
      console.log('[git:pr:review] Submitting single batch with', formattedComments.length, 'comments');
      sendProgress(1, 1, 'sending');
      const payload = {
        commit_id: commitSha,
        body: options.body,
        event: options.action,
        comments: formattedComments.length > 0 ? formattedComments : undefined,
      };
      const result = await submitBatch(payload);
      sendProgress(1, 1, result.success ? 'success' : 'failed');
      return result;
    }

    // Multiple batches needed - track all comment IDs for potential rollback
    const allCommentIds: number[] = [];
    const batches: typeof formattedComments[] = [];
    for (let i = 0; i < formattedComments.length; i += BATCH_SIZE) {
      batches.push(formattedComments.slice(i, i + BATCH_SIZE));
    }

    // Total includes comment batches + 1 for final review
    const totalBatches = batches.length + 1;
    console.log('[git:pr:review] Submitting', batches.length, 'comment batches + 1 final review');

    // Submit all batches as COMMENT reviews (no body text, just inline comments)
    for (let i = 0; i < batches.length; i++) {
      const batchNum = i + 1;
      console.log(`[git:pr:review] Submitting batch ${batchNum}/${totalBatches} (${batches[i].length} comments)`);
      sendProgress(batchNum, totalBatches, 'sending');

      const payload = {
        commit_id: commitSha,
        body: '',
        event: 'COMMENT',
        comments: batches[i],
      };

      const result = await submitBatch(payload);
      if (!result.success) {
        sendProgress(batchNum, totalBatches, 'failed');
        // Mark all as rolling-back
        for (let j = 1; j < batchNum; j++) {
          sendProgress(j, totalBatches, 'rolling-back');
        }
        // Rollback all previously submitted comments
        await rollback(allCommentIds);
        return { success: false, error: `Batch ${batchNum} failed: ${result.error}` };
      }

      sendProgress(batchNum, totalBatches, 'success');

      // Track comment IDs for potential rollback
      if (result.commentIds) {
        allCommentIds.push(...result.commentIds);
      }

      // Delay between batches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }

    // Submit the final review with action and summary (no inline comments)
    const finalBatchNum = totalBatches;
    console.log(`[git:pr:review] Submitting final review (batch ${finalBatchNum}/${totalBatches}) with action: ${options.action}`);
    sendProgress(finalBatchNum, totalBatches, 'sending');

    const finalPayload = {
      commit_id: commitSha,
      body: options.body,
      event: options.action,
    };

    const finalResult = await submitBatch(finalPayload);
    if (!finalResult.success) {
      sendProgress(finalBatchNum, totalBatches, 'failed');
      // Mark all previous batches as rolling-back
      for (let j = 1; j < finalBatchNum; j++) {
        sendProgress(j, totalBatches, 'rolling-back');
      }
      // Rollback all comments if final review fails
      await rollback(allCommentIds);
      return { success: false, error: `Final review failed: ${finalResult.error}` };
    }

    sendProgress(finalBatchNum, totalBatches, 'success');
    return { success: true };
  } catch (error) {
    console.error('[git:pr:review] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Get PR diff from GitHub - fetches the actual PR files and diffs
ipcMain.handle('git:pr:diffFiles', async (_, projectPath: string) => {
  try {
    // Get the PR number and state for current branch
    const prInfoProc = spawn('gh', ['pr', 'view', '--json', 'number,state,headRefName', '--jq', '{number: .number, state: .state, branch: .headRefName}'], {
      cwd: projectPath,
      env: getEnvWithPath(),
    });

    const prInfo = await new Promise<{ number: string; state: string; branch: string }>((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      prInfoProc.stdout.on('data', (data) => { stdout += data.toString(); });
      prInfoProc.stderr.on('data', (data) => { stderr += data.toString(); });
      prInfoProc.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            resolve(JSON.parse(stdout.trim()));
          } catch {
            reject(new Error('Failed to parse PR info'));
          }
        } else {
          // Check if the error is about no PR existing
          if (stderr.includes('no pull requests found') || stderr.includes('no open pull requests')) {
            reject(new Error('No open PR found for current branch. The PR may have been merged or closed.'));
          } else {
            reject(new Error(stderr.trim() || 'No PR found for current branch'));
          }
        }
      });
      prInfoProc.on('error', () => reject(new Error('GitHub CLI (gh) not found')));
    });

    console.log('[git:pr:diffFiles] PR info:', prInfo);

    // Check if PR is still open
    if (prInfo.state !== 'OPEN') {
      return {
        success: false,
        error: `PR #${prInfo.number} is ${prInfo.state.toLowerCase()}. Cannot review a ${prInfo.state.toLowerCase()} PR.`,
        files: []
      };
    }

    const prNumber = prInfo.number;

    // Get PR files with their patches from GitHub
    const filesProc = spawn('gh', ['pr', 'diff', prNumber], {
      cwd: projectPath,
      env: getEnvWithPath(),
    });

    const fullDiff = await new Promise<string>((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      filesProc.stdout.on('data', (data) => { stdout += data.toString(); });
      filesProc.stderr.on('data', (data) => { stderr += data.toString(); });
      filesProc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr.trim() || 'Could not get PR diff'));
        }
      });
      filesProc.on('error', () => reject(new Error('GitHub CLI (gh) not found')));
    });

    // Parse the unified diff into per-file diffs
    const files: { path: string; diff: string; status: 'added' | 'modified' | 'deleted' | 'renamed' }[] = [];

    // Split by file headers (diff --git a/... b/...)
    const fileDiffs = fullDiff.split(/(?=diff --git )/);

    for (const fileDiff of fileDiffs) {
      if (!fileDiff.trim()) continue;

      // Extract file path from diff header
      const headerMatch = fileDiff.match(/diff --git a\/(.+?) b\/(.+)/);
      if (!headerMatch) continue;

      const oldPath = headerMatch[1];
      const newPath = headerMatch[2];

      // Determine status
      let status: 'added' | 'modified' | 'deleted' | 'renamed' = 'modified';
      if (fileDiff.includes('new file mode')) {
        status = 'added';
      } else if (fileDiff.includes('deleted file mode')) {
        status = 'deleted';
      } else if (oldPath !== newPath) {
        status = 'renamed';
      }

      // Skip markdown files
      if (newPath.endsWith('.md')) continue;

      files.push({
        path: newPath,
        diff: fileDiff,
        status,
      });
    }

    console.log('[git:pr:diffFiles] Found', files.length, 'files in PR');

    return { success: true, base: `PR #${prNumber}`, files };
  } catch (error) {
    console.error('[git:pr:diffFiles] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error), files: [] };
  }
});

// Get diff for review - compares current branch to base (usually main/master/develop)
// Uses merge-base to find common ancestor, so unrebased branches don't show huge diffs
ipcMain.handle('git:diffFiles', async (_, projectPath: string, baseBranch?: string) => {
  // Determine base branch if not specified
  let base = baseBranch;
  if (!base) {
    // Try to find default branch in order of preference: main, master, develop
    // Check both local and remote branches
    const candidates = ['main', 'master', 'develop', 'origin/main', 'origin/master', 'origin/develop'];
    for (const candidate of candidates) {
      const check = await runGit(projectPath, ['rev-parse', '--verify', candidate]);
      if (check.code === 0) {
        base = candidate;
        break;
      }
    }
    // Fallback to HEAD~1 if no common base branch found
    if (!base) {
      base = 'HEAD~1';
    }
  }

  // Find the merge-base (common ancestor) to avoid showing all changes since branches diverged
  // This is crucial for branches that haven't been rebased
  let compareRef = base;
  const mergeBaseResult = await runGit(projectPath, ['merge-base', base, 'HEAD']);
  if (mergeBaseResult.code === 0 && mergeBaseResult.stdout.trim()) {
    compareRef = mergeBaseResult.stdout.trim();
  }

  // Get list of changed files comparing against merge-base
  const filesResult = await runGit(projectPath, ['diff', '--name-only', compareRef]);
  if (filesResult.code !== 0) {
    return { success: false, error: filesResult.stderr, files: [] };
  }

  const changedFiles = filesResult.stdout.split('\n').filter(Boolean)
    // Exclude markdown files from review
    .filter(f => !f.endsWith('.md'));

  // Get diff for each file
  const files: { path: string; diff: string; status: string }[] = [];

  for (const filePath of changedFiles) {
    const diffResult = await runGit(projectPath, ['diff', compareRef, '--', filePath]);
    const statusResult = await runGit(projectPath, ['diff', '--name-status', compareRef, '--', filePath]);

    // Parse status (A=added, M=modified, D=deleted, R=renamed)
    const statusLine = statusResult.stdout.trim();
    const status = statusLine[0] || 'M';

    files.push({
      path: filePath,
      diff: diffResult.stdout,
      status: status === 'A' ? 'added' : status === 'D' ? 'deleted' : status === 'R' ? 'renamed' : 'modified',
    });
  }

  return { success: true, base, files };
});

// Review file with Claude - dedicated fresh conversation for code review
ipcMain.handle('claude:review', async (_event, projectPath: string, _fileContent: string, filePath: string, diff: string, context: { skills: string; rules: string }) => {
  return new Promise((resolve) => {
    // Annotate diff with line numbers for clarity
    const annotateDiff = (rawDiff: string): string => {
      const lines = rawDiff.split('\n');
      const result: string[] = [];
      let newLine = 0;

      for (const line of lines) {
        if (line.startsWith('@@')) {
          // Parse hunk header @@ -old,count +new,count @@
          const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
          if (match) {
            newLine = parseInt(match[1], 10);
          }
          result.push(line);
        } else if (line.startsWith('---') || line.startsWith('+++')) {
          result.push(line);
        } else if (line.startsWith('-')) {
          // Deletion - no new line number
          result.push(`     ${line}`);
        } else if (line.startsWith('+')) {
          // Addition - show new line number
          result.push(`${String(newLine).padStart(4, ' ')} ${line}`);
          newLine++;
        } else {
          // Context line
          result.push(`${String(newLine).padStart(4, ' ')} ${line}`);
          newLine++;
        }
      }
      return result.join('\n');
    };

    const annotatedDiff = annotateDiff(diff);

    // Build a focused review prompt
    const reviewPrompt = `You are reviewing code changes for a project. Analyze the following file and its changes.

PROJECT CONTEXT:
${context.skills}

CODING STANDARDS TO CHECK:
${context.rules}

FILE: ${filePath}

DIFF (with line numbers on the left for new/context lines):
\`\`\`diff
${annotatedDiff}
\`\`\`

Review this code and respond with a JSON object (no markdown, just raw JSON):
{
  "verdict": "approve" | "concern" | "block",
  "issues": [
    {
      "severity": "error" | "warning" | "suggestion",
      "startLine": <line number from the diff above, or null for general comments>,
      "endLine": <ending line number, same as startLine if single line>,
      "message": "<brief description>",
      "rule": "<which rule/standard this violates, if any>"
    }
  ],
  "highlights": [
    {
      "startLine": <line number from the diff above, or null for general comments>,
      "endLine": <ending line number, same as startLine if single line>,
      "message": "<what's good about this code>"
    }
  ],
  "summary": "<one sentence summary of the file's quality>"
}

For verdict:
- "approve": Code is good to merge, no significant issues
- "concern": Minor issues exist but can be merged, consider fixing
- "block": Critical issues that should be fixed before merging

IMPORTANT CONSTRAINT: There is a limit of 50 total comments (issues + highlights combined) across ALL files in the PR. Be highly selective:
- For issues: Only report the MOST IMPORTANT issues - bugs, security issues, and critical coding standard violations. Skip minor style issues or nitpicks. Prioritize errors over warnings, warnings over suggestions.
- For highlights: Be VERY selective - only highlight truly exceptional code (clever algorithms, elegant solutions, significant improvements). Most files should have 0-1 highlights max. Don't highlight routine good practices.
- Aim for 2-5 comments per file maximum to stay within budget.

IMPORTANT: Use the line numbers shown on the LEFT side of the diff above. These are the actual file line numbers.`;

    // Spawn fresh Claude session (no --continue) for isolated review
    const args = ['--print', '--dangerously-skip-permissions', '--output-format', 'json'];

    const claude = spawn('claude', args, {
      env: getEnvWithPath(),
      shell: true,
      cwd: projectPath,
    });

    let responseText = '';

    claude.stdout?.on('data', (data: Buffer) => {
      responseText += data.toString();
    });

    claude.stderr?.on('data', (data: Buffer) => {
      console.error('[claude:review] stderr:', data.toString());
    });

    claude.on('close', (code) => {
      if (code === 0 && responseText) {
        try {
          // Parse the JSON response
          const response = JSON.parse(responseText);
          // The result might be in response.result or response directly
          const resultText = response.result || responseText;

          // Try to extract JSON from the result
          let reviewResult;
          try {
            // If result is already JSON
            reviewResult = typeof resultText === 'string' ? JSON.parse(resultText) : resultText;
          } catch {
            // Try to find JSON in the text
            const jsonMatch = resultText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              reviewResult = JSON.parse(jsonMatch[0]);
            } else {
              reviewResult = { issues: [], summary: resultText };
            }
          }

          resolve({ success: true, review: reviewResult });
        } catch (e) {
          console.error('[claude:review] Parse error:', e);
          resolve({ success: true, review: { issues: [], summary: responseText } });
        }
      } else {
        resolve({ success: false, error: `Review failed with code ${code}` });
      }
    });

    claude.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    // Send the prompt
    claude.stdin?.write(reviewPrompt);
    claude.stdin?.end();
  });
});
