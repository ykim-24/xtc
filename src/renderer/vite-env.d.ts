/// <reference types="vite/client" />

interface FileItem {
  name: string;
  type: 'file' | 'directory';
  path: string;
}

interface ReadFileResult {
  success: boolean;
  content?: string;
  error?: string;
}

interface WriteFileResult {
  success: boolean;
  error?: string;
}

interface ReadDirResult {
  success: boolean;
  items?: FileItem[];
  error?: string;
}

interface FileChangeEvent {
  eventType: string;
  filename: string;
  dirPath: string;
}

interface WatchResult {
  success: boolean;
  error?: string;
}

interface StoreGetResult<T = unknown> {
  success: boolean;
  data?: T | null;
  error?: string;
}

interface StoreSetResult {
  success: boolean;
  error?: string;
}

interface StoreAPI {
  get: <T = unknown>(key: string) => Promise<StoreGetResult<T>>;
  set: (key: string, data: unknown) => Promise<StoreSetResult>;
  delete: (key: string) => Promise<StoreSetResult>;
  getPath: () => Promise<string>;
}

interface ChatContext {
  activeFile?: { path: string; content: string };
  contextFiles?: { path: string; content: string }[];
}

interface ClaudeSendResult {
  success: boolean;
  response?: string;
  error?: string;
}

interface PendingEdit {
  id: string;
  filePath: string;
  originalContent: string;
  newContent: string;
  description: string;
  isNewFile?: boolean;
}

interface ClaudeAPI {
  send: (message: string, context: ChatContext, projectPath: string | null) => Promise<ClaudeSendResult>;
  checkInstalled: () => Promise<boolean>;
  clearConversation: (projectPath: string | null) => Promise<StoreSetResult>;
  onStream: (callback: (chunk: string) => void) => () => void;
  getPendingEdits: () => Promise<PendingEdit[]>;
  approveEdit: (editId: string, filePath?: string, content?: string) => Promise<StoreSetResult>;
  rejectEdit: (editId: string) => Promise<StoreSetResult>;
  onPendingEditAdded: (callback: (edit: PendingEdit) => void) => () => void;
  onActivity: (callback: (activity: string) => void) => () => void;
}

interface TerminalCreateResult {
  success: boolean;
  id?: string;
  error?: string;
}

interface TerminalAPI {
  create: (cwd?: string) => Promise<TerminalCreateResult>;
  write: (id: string, data: string) => Promise<{ success: boolean; error?: string }>;
  resize: (id: string, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>;
  kill: (id: string) => Promise<{ success: boolean; error?: string }>;
  onData: (callback: (event: { id: string; data: string }) => void) => () => void;
  onExit: (callback: (event: { id: string; exitCode: number }) => void) => () => void;
}

interface LSPResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

interface LSPServerAvailableResult {
  success: boolean;
  available: boolean;
}

interface LSPServersResult {
  success: boolean;
  servers: string[];
}

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

interface RunTestsResult {
  success: boolean;
  testFiles?: TestFileResult[];
  error?: string;
  output?: string;
}

interface DetectedFramework {
  id: 'jest' | 'vitest' | 'mocha' | 'playwright' | 'cypress';
  name: string;
  detected: boolean;
  configFile?: string;
}

interface DetectFrameworksResult {
  success: boolean;
  frameworks?: DetectedFramework[];
  error?: string;
}

interface LSPAPI {
  setProjectPath: (projectPath: string) => Promise<{ success: boolean }>;
  startServer: (serverName: string) => Promise<{ success: boolean }>;
  stopServer: (serverName: string) => Promise<{ success: boolean }>;
  stopAll: () => Promise<{ success: boolean }>;
  didOpen: (uri: string, language: string, content: string) => Promise<{ success: boolean }>;
  didChange: (uri: string, language: string, content: string) => Promise<{ success: boolean }>;
  didClose: (uri: string, language: string) => Promise<{ success: boolean }>;
  getCompletions: (uri: string, language: string, line: number, character: number) => Promise<LSPResult>;
  getHover: (uri: string, language: string, line: number, character: number) => Promise<LSPResult>;
  getDefinition: (uri: string, language: string, line: number, character: number) => Promise<LSPResult>;
  getReferences: (uri: string, language: string, line: number, character: number) => Promise<LSPResult>;
  formatDocument: (uri: string, language: string) => Promise<LSPResult>;
  isServerAvailable: (language: string) => Promise<LSPServerAvailableResult>;
  getAvailableServers: () => Promise<LSPServersResult>;
  getRunningServers: () => Promise<LSPServersResult>;
}

interface LoadTypesResult {
  success: boolean;
  types: { packageName: string; content: string }[];
  error?: string;
}

// Git types
interface GitChange {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed';
  staged: boolean;
}

interface GitRemote {
  url: string;
  owner: string;
  repo: string;
}

interface GitWorktree {
  path: string;
  branch: string;
  isMain: boolean;
}

interface GitPR {
  number: number;
  title: string;
  state: string;
  headRefName: string;
  url: string;
}

interface GitIsRepoResult {
  success: boolean;
  isRepo: boolean;
}

interface GitBranchResult {
  success: boolean;
  current: string;
  all: string[];
  remotes: string[];
}

interface GitRemoteResult {
  success: boolean;
  remote: GitRemote | null;
}

interface GitStatusResult {
  success: boolean;
  changes: GitChange[];
  ahead: number;
  behind: number;
}

interface GitOperationResult {
  success: boolean;
  error?: string;
  output?: string;
}

interface GitWorktreeListResult {
  success: boolean;
  worktrees: GitWorktree[];
}

interface GitPRCreateResult {
  success: boolean;
  url?: string;
  error?: string;
}

interface GitPRListResult {
  success: boolean;
  prs?: GitPR[];
  error?: string;
}

interface GitPRReviewComment {
  path: string;
  line: number;
  startLine?: number;
  body: string;
}

interface GitPRReviewOptions {
  action: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  body: string;
  comments: GitPRReviewComment[];
}

interface GitPRReviewResult {
  success: boolean;
  error?: string;
}

interface GitProtectedBranchesResult {
  success: boolean;
  branches: string[];
  error?: string;
}

interface GitDiffResult {
  success: boolean;
  diff: string;
  error?: string;
}

interface GitDiffFile {
  path: string;
  diff: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}

interface GitDiffFilesResult {
  success: boolean;
  base?: string;
  files: GitDiffFile[];
  error?: string;
}

interface ReviewIssue {
  severity: 'error' | 'warning' | 'suggestion';
  startLine: number | null;
  endLine: number | null;
  line?: number | null; // legacy support
  message: string;
  rule: string;
}

interface ReviewHighlight {
  startLine: number | null;
  endLine: number | null;
  line?: number | null; // legacy support
  message: string;
}

interface ReviewResult {
  success: boolean;
  review?: {
    verdict?: 'approve' | 'concern' | 'block';
    issues: ReviewIssue[];
    highlights: ReviewHighlight[];
    summary: string;
  };
  error?: string;
}

interface GitAPI {
  isRepo: (projectPath: string) => Promise<GitIsRepoResult>;
  branch: (projectPath: string) => Promise<GitBranchResult>;
  remote: (projectPath: string) => Promise<GitRemoteResult>;
  status: (projectPath: string) => Promise<GitStatusResult>;
  stage: (projectPath: string, files: string[]) => Promise<GitOperationResult>;
  unstage: (projectPath: string, files: string[]) => Promise<GitOperationResult>;
  commit: (projectPath: string, message: string) => Promise<GitOperationResult>;
  push: (projectPath: string, branch?: string) => Promise<GitOperationResult>;
  pull: (projectPath: string) => Promise<GitOperationResult>;
  fetch: (projectPath: string) => Promise<GitOperationResult>;
  createBranch: (projectPath: string, branchName: string, checkout?: boolean) => Promise<GitOperationResult>;
  checkout: (projectPath: string, branchName: string) => Promise<GitOperationResult>;
  worktree: {
    list: (projectPath: string) => Promise<GitWorktreeListResult>;
    add: (projectPath: string, worktreePath: string, branch: string, createBranch?: boolean) => Promise<GitOperationResult>;
    remove: (projectPath: string, worktreePath: string) => Promise<GitOperationResult>;
  };
  pr: {
    create: (projectPath: string, options: { title: string; body: string; base: string }) => Promise<GitPRCreateResult>;
    list: (projectPath: string) => Promise<GitPRListResult>;
    review: (projectPath: string, options: GitPRReviewOptions) => Promise<GitPRReviewResult>;
  };
  protectedBranches: (projectPath: string) => Promise<GitProtectedBranchesResult>;
  diff: (projectPath: string, staged?: boolean) => Promise<GitDiffResult>;
  diffFiles: (projectPath: string, baseBranch?: string) => Promise<GitDiffFilesResult>;
  prDiffFiles: (projectPath: string) => Promise<GitDiffFilesResult>;
}

interface ElectronAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  openFolder: () => Promise<string | null>;
  readFile: (path: string) => Promise<ReadFileResult>;
  writeFile: (path: string, content: string) => Promise<WriteFileResult>;
  readDir: (path: string) => Promise<ReadDirResult>;
  loadTypes: (projectPath: string) => Promise<LoadTypesResult>;
  watchDir: (path: string) => Promise<WatchResult>;
  unwatchDir: () => Promise<WatchResult>;
  onFileChanged: (callback: (event: FileChangeEvent) => void) => () => void;
  store: StoreAPI;
  claude: ClaudeAPI;
  terminal: TerminalAPI;
  lsp: LSPAPI;
  git: GitAPI;
  detectTests: (projectPath: string, framework?: string) => Promise<RunTestsResult>;
  runTests: (projectPath: string, testFile?: string, testName?: string, framework?: string) => Promise<RunTestsResult>;
  detectTestFrameworks: (projectPath: string) => Promise<DetectFrameworksResult>;
  review: (projectPath: string, fileContent: string, filePath: string, diff: string, context: { skills: string; rules: string }) => Promise<ReviewResult>;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}
