/**
 * Session Manager - Persists critical app state to survive sleep/restart
 *
 * Saves state to .xtc/session.json in the project directory.
 * Auto-saves on state changes and restores on app/project load.
 */

import { useChatStore, ChatMessage } from '../stores/chatStore';
import { useProjectStore, OpenFile } from '../stores/projectStore';
import { useEditsStore, PendingEdit } from '../stores/editsStore';
import { useContextStore, ContextFile } from '../stores/contextStore';

// Session data structure
export interface SessionData {
  version: 1;
  timestamp: number;
  projectPath: string;

  // Chat state
  chat: {
    messages: ChatMessage[];
    lastPrompt: string | null;
  };

  // Open files (paths only - content will be reloaded)
  openFiles: {
    path: string;
    name: string;
    language: string;
  }[];
  activeFilePath: string | null;

  // Pending edits from Claude
  pendingEdits: PendingEdit[];

  // Context files (paths only)
  contextFilePaths: string[];
}

// Debounce timer for auto-save
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 1000;

// Track if we're currently restoring to prevent save loops
let isRestoring = false;

/**
 * Get the session file path for a project
 */
function getSessionPath(projectPath: string): string {
  return `${projectPath}/.xtc/session.json`;
}

/**
 * Save current session state to disk
 */
export async function saveSession(projectPath: string): Promise<boolean> {
  if (isRestoring || !projectPath) return false;

  const chatState = useChatStore.getState();
  const projectState = useProjectStore.getState();
  const editsState = useEditsStore.getState();
  const contextState = useContextStore.getState();

  // Don't save if there's no meaningful state
  if (
    chatState.messages.length === 0 &&
    projectState.openFiles.length === 0 &&
    editsState.pendingEdits.length === 0 &&
    contextState.contextFiles.length === 0
  ) {
    return false;
  }

  const sessionData: SessionData = {
    version: 1,
    timestamp: Date.now(),
    projectPath,

    chat: {
      messages: chatState.messages.filter(m => !m.isStreaming), // Don't save streaming messages
      lastPrompt: chatState.lastPrompt,
    },

    // Save file metadata only (content will be reloaded)
    openFiles: projectState.openFiles.map(f => ({
      path: f.path,
      name: f.name,
      language: f.language,
    })),
    activeFilePath: projectState.activeFilePath,

    pendingEdits: editsState.pendingEdits,

    contextFilePaths: contextState.contextFiles.map(f => f.path),
  };

  try {
    // Ensure .xtc directory exists
    const xtcDir = `${projectPath}/.xtc`;
    await window.electron.readDir(xtcDir).catch(async () => {
      // Directory doesn't exist, it will be created by writeFile
    });

    const result = await window.electron.writeFile(
      getSessionPath(projectPath),
      JSON.stringify(sessionData, null, 2)
    );

    return result.success;
  } catch (error) {
    console.error('Failed to save session:', error);
    return false;
  }
}

/**
 * Schedule a debounced session save
 */
export function scheduleSaveSession(projectPath: string): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    saveSession(projectPath);
    saveTimeout = null;
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Force immediate session save (e.g., before sleep)
 */
export async function saveSessionImmediate(projectPath: string): Promise<boolean> {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  return saveSession(projectPath);
}

/**
 * Load and restore session from disk
 */
export async function restoreSession(projectPath: string): Promise<boolean> {
  if (!projectPath) return false;

  try {
    isRestoring = true;

    const result = await window.electron.readFile(getSessionPath(projectPath));

    if (!result.success || !result.content) {
      isRestoring = false;
      return false;
    }

    const sessionData: SessionData = JSON.parse(result.content);

    // Validate session is for this project
    if (sessionData.projectPath !== projectPath) {
      console.warn('Session file is for a different project');
      isRestoring = false;
      return false;
    }

    // Check session age - ignore if older than 24 hours
    const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;
    if (Date.now() - sessionData.timestamp > MAX_SESSION_AGE_MS) {
      console.log('Session expired, starting fresh');
      await clearSession(projectPath);
      isRestoring = false;
      return false;
    }

    // Restore chat messages
    if (sessionData.chat.messages.length > 0) {
      const chatStore = useChatStore.getState();
      // Clear existing and add saved messages
      chatStore.clearMessages();
      sessionData.chat.messages.forEach(msg => {
        chatStore.addMessage({
          role: msg.role,
          content: msg.content,
        });
      });
      if (sessionData.chat.lastPrompt) {
        chatStore.setLastPrompt(sessionData.chat.lastPrompt);
      }
    }

    // Restore open files (reload content from disk)
    if (sessionData.openFiles.length > 0) {
      const projectStore = useProjectStore.getState();

      for (const fileInfo of sessionData.openFiles) {
        // Skip untitled files
        if (fileInfo.path.startsWith('untitled-')) continue;

        try {
          const fileResult = await window.electron.readFile(fileInfo.path);
          if (fileResult.success) {
            const openFile: OpenFile = {
              path: fileInfo.path,
              name: fileInfo.name,
              content: fileResult.content || '',
              language: fileInfo.language,
              isDirty: false,
            };
            projectStore.openFile(openFile);
          }
        } catch {
          // File may have been deleted, skip it
          console.warn(`Could not restore file: ${fileInfo.path}`);
        }
      }

      // Set active file
      if (sessionData.activeFilePath) {
        const exists = projectStore.openFiles.find(f => f.path === sessionData.activeFilePath);
        if (exists) {
          projectStore.setActiveFile(sessionData.activeFilePath);
        }
      }
    }

    // NOTE: We no longer restore pending edits from session file.
    // The main process is the source of truth for pending edits.
    // Edits are sent via IPC (onPendingEditAdded/onPendingEditUpdated) from main process.
    // Restoring from session file caused issues where rejected edits would reappear.

    // Restore context files (reload content from disk)
    if (sessionData.contextFilePaths.length > 0) {
      const contextStore = useContextStore.getState();

      for (const filePath of sessionData.contextFilePaths) {
        try {
          const fileResult = await window.electron.readFile(filePath);
          if (fileResult.success) {
            const fileName = filePath.split('/').pop() || filePath;
            contextStore.addContextFile({
              path: filePath,
              name: fileName,
              content: fileResult.content || '',
            });
          }
        } catch {
          // File may have been deleted, skip it
          console.warn(`Could not restore context file: ${filePath}`);
        }
      }
    }

    console.log('Session restored successfully');
    isRestoring = false;
    return true;
  } catch (error) {
    console.error('Failed to restore session:', error);
    isRestoring = false;
    return false;
  }
}

/**
 * Clear session file
 */
export async function clearSession(projectPath: string): Promise<void> {
  if (!projectPath) return;

  try {
    await window.electron.deleteFile(getSessionPath(projectPath));
  } catch {
    // Ignore errors - file may not exist
  }
}

/**
 * Subscribe to store changes and auto-save
 */
export function setupAutoSave(projectPath: string): () => void {
  if (!projectPath) return () => {};

  const unsubscribers: (() => void)[] = [];

  // Subscribe to chat store changes
  unsubscribers.push(
    useChatStore.subscribe((state, prevState) => {
      // Only save on message changes (not loading state changes)
      if (state.messages !== prevState.messages) {
        scheduleSaveSession(projectPath);
      }
    })
  );

  // Subscribe to project store changes
  unsubscribers.push(
    useProjectStore.subscribe((state, prevState) => {
      if (
        state.openFiles !== prevState.openFiles ||
        state.activeFilePath !== prevState.activeFilePath
      ) {
        scheduleSaveSession(projectPath);
      }
    })
  );

  // Subscribe to edits store changes
  unsubscribers.push(
    useEditsStore.subscribe((state, prevState) => {
      if (state.pendingEdits !== prevState.pendingEdits) {
        scheduleSaveSession(projectPath);
      }
    })
  );

  // Subscribe to context store changes
  unsubscribers.push(
    useContextStore.subscribe((state, prevState) => {
      if (state.contextFiles !== prevState.contextFiles) {
        scheduleSaveSession(projectPath);
      }
    })
  );

  // Return cleanup function
  return () => {
    unsubscribers.forEach(unsub => unsub());
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
  };
}

/**
 * Set up visibility change handler for system sleep detection
 */
export function setupSleepHandler(projectPath: string): () => void {
  if (!projectPath) return () => {};

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      // App is being hidden (possibly due to sleep) - save immediately
      saveSessionImmediate(projectPath);
    }
  };

  const handleBeforeUnload = () => {
    // Save before page unloads
    saveSessionImmediate(projectPath);
  };

  // Listen for Electron power events (more reliable than visibility change)
  const unsubscribeSleep = window.electron?.onSystemSleep?.(() => {
    console.log('System sleep detected - saving session');
    saveSessionImmediate(projectPath);
  });

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('pagehide', handleBeforeUnload);

  return () => {
    unsubscribeSleep?.();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('pagehide', handleBeforeUnload);
  };
}
