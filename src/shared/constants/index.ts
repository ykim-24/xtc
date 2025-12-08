// Application constants

export const APP_NAME = 'XTC';
export const APP_VERSION = '0.1.0';

// File type to language mapping for Monaco
export const FILE_EXTENSIONS_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.json': 'json',
  '.md': 'markdown',
  '.css': 'css',
  '.scss': 'scss',
  '.html': 'html',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.sql': 'sql',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

// Files/folders to ignore in file explorer
export const IGNORED_PATHS: string[] = [];

// Pattern categories
export const PATTERN_CATEGORIES = [
  { id: 'naming', label: 'Naming Conventions' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'error-handling', label: 'Error Handling' },
  { id: 'styling', label: 'Styling' },
  { id: 'testing', label: 'Testing' },
  { id: 'other', label: 'Other' },
] as const;

// Default panel sizes
export const DEFAULT_PANEL_SIZES = {
  leftPanel: 20,
  rightPanel: 30,
  explorerHeight: 60,
  contextHeight: 40,
  chatHeight: 60,
  skillsHeight: 20,
  patternsHeight: 20,
};
