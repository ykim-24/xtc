// Shared types between Electron and Renderer

export interface FileInfo {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: number;
}

export interface ProjectConfig {
  name: string;
  path: string;
  patterns: string[];
  skills: string[];
  contextFiles: string[];
}

export interface EditChange {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  oldContent: string;
  newContent: string;
  reasoning: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface EditReviewSession {
  id: string;
  changes: EditChange[];
  summary: string;
  timestamp: number;
}

// IPC Channel names
export const IPC_CHANNELS = {
  // File operations
  READ_FILE: 'file:read',
  WRITE_FILE: 'file:write',
  READ_DIR: 'file:readDir',
  WATCH_DIR: 'file:watchDir',

  // Project operations
  OPEN_PROJECT: 'project:open',
  CLOSE_PROJECT: 'project:close',
  GET_PROJECT_CONFIG: 'project:getConfig',
  SAVE_PROJECT_CONFIG: 'project:saveConfig',

  // Claude CLI operations
  CLAUDE_SEND: 'claude:send',
  CLAUDE_CANCEL: 'claude:cancel',
  CLAUDE_STREAM: 'claude:stream',

  // Dialog operations
  SHOW_OPEN_DIALOG: 'dialog:open',
  SHOW_SAVE_DIALOG: 'dialog:save',

  // Window operations
  MINIMIZE: 'window:minimize',
  MAXIMIZE: 'window:maximize',
  CLOSE: 'window:close',
} as const;
