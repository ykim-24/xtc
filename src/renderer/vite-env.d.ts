/// <reference types="vite/client" />

interface FileItem {
  name: string;
  type: "file" | "directory";
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

interface ListAllFilesResult {
  success: boolean;
  files?: { path: string; name: string }[];
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

interface ClaudeSendOptions {
  planOnly?: boolean; // Restrict to read-only tools (for planning phase)
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
}

interface ClaudeAPI {
  send: (
    message: string,
    context: ChatContext,
    projectPath: string | null,
    options?: ClaudeSendOptions
  ) => Promise<ClaudeSendResult>;
  checkInstalled: () => Promise<boolean>;
  clearConversation: (projectPath: string | null) => Promise<StoreSetResult>;
  onStream: (callback: (chunk: string) => void) => () => void;
  getPendingEdits: () => Promise<PendingEdit[]>;
  approveEdit: (
    editId: string,
    filePath?: string,
    content?: string
  ) => Promise<StoreSetResult>;
  rejectEdit: (editId: string) => Promise<StoreSetResult>;
  onPendingEditAdded: (callback: (edit: PendingEdit) => void) => () => void;
  onPendingEditUpdated: (callback: (edit: PendingEdit) => void) => () => void;
  onActivity: (callback: (activity: string) => void) => () => void;
  onUsage: (
    callback: (data: { projectPath: string; usage: TokenUsage }) => void
  ) => () => void;
}

interface TerminalCreateResult {
  success: boolean;
  id?: string;
  error?: string;
}

interface TerminalAPI {
  create: (cwd?: string) => Promise<TerminalCreateResult>;
  write: (
    id: string,
    data: string
  ) => Promise<{ success: boolean; error?: string }>;
  resize: (
    id: string,
    cols: number,
    rows: number
  ) => Promise<{ success: boolean; error?: string }>;
  kill: (id: string) => Promise<{ success: boolean; error?: string }>;
  onData: (
    callback: (event: { id: string; data: string }) => void
  ) => () => void;
  onExit: (
    callback: (event: { id: string; exitCode: number }) => void
  ) => () => void;
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
  status: "passed" | "failed" | "skipped" | "pending";
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
  status: "passed" | "failed" | "skipped" | "pending";
  expanded: boolean;
}

interface RunTestsResult {
  success: boolean;
  testFiles?: TestFileResult[];
  error?: string;
  output?: string;
}

interface DetectedFramework {
  id: "jest" | "vitest" | "mocha" | "playwright" | "cypress";
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
  didOpen: (
    uri: string,
    language: string,
    content: string
  ) => Promise<{ success: boolean }>;
  didChange: (
    uri: string,
    language: string,
    content: string
  ) => Promise<{ success: boolean }>;
  didClose: (uri: string, language: string) => Promise<{ success: boolean }>;
  getCompletions: (
    uri: string,
    language: string,
    line: number,
    character: number
  ) => Promise<LSPResult>;
  getHover: (
    uri: string,
    language: string,
    line: number,
    character: number
  ) => Promise<LSPResult>;
  getDefinition: (
    uri: string,
    language: string,
    line: number,
    character: number
  ) => Promise<LSPResult>;
  getReferences: (
    uri: string,
    language: string,
    line: number,
    character: number
  ) => Promise<LSPResult>;
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
  status: "modified" | "added" | "deleted" | "untracked" | "renamed";
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
  path?: string; // For worktree:add - the resolved absolute path
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
  action: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
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
  status: "added" | "modified" | "deleted" | "renamed";
}

interface GitDiffFilesResult {
  success: boolean;
  base?: string;
  files: GitDiffFile[];
  error?: string;
}

interface GitPRReviewComment {
  id: number;
  path: string;
  line: number;
  body: string;
  user: string;
  createdAt: string;
  side: string;
  startLine?: number;
}

interface GitPRIssueComment {
  id: number;
  body: string;
  user: string;
  createdAt: string;
}

interface GitPRCommentsResult {
  success: boolean;
  prNumber?: number;
  reviewComments?: GitPRReviewComment[];
  issueComments?: GitPRIssueComment[];
  error?: string;
}

interface ReviewIssue {
  severity: "error" | "warning" | "suggestion";
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
    verdict?: "approve" | "concern" | "block";
    issues: ReviewIssue[];
    highlights: ReviewHighlight[];
    summary: string;
  };
  error?: string;
}

// Linear types
interface LinearUser {
  id: string;
  name: string;
  email: string;
}

interface LinearTestResult {
  success: boolean;
  user?: LinearUser;
  error?: string;
}

interface LinearLabel {
  id: string;
  name: string;
  color: string;
}

interface LinearState {
  id: string;
  name: string;
  color: string;
  type: string;
}

interface LinearProject {
  id: string;
  name: string;
  color: string;
}

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  state: LinearState;
  labels: { nodes: LinearLabel[] };
  project?: LinearProject;
  createdAt: string;
  updatedAt: string;
}

interface LinearAssignee {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface LinearCreator {
  id: string;
  name: string;
  email: string;
}

interface LinearCommentUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface LinearComment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  user: LinearCommentUser;
}

interface LinearAttachment {
  id: string;
  title: string;
  url: string;
  sourceType: string;
}

interface LinearChildIssue {
  id: string;
  identifier: string;
  title: string;
  state: { name: string; color: string };
}

interface LinearParentIssue {
  id: string;
  identifier: string;
  title: string;
}

interface LinearIssueDetail {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  estimate?: number;
  dueDate?: string;
  url: string;
  branchName?: string;
  state: LinearState;
  labels: { nodes: LinearLabel[] };
  project?: LinearProject;
  assignee?: LinearAssignee;
  creator?: LinearCreator;
  comments: { nodes: LinearComment[] };
  attachments: { nodes: LinearAttachment[] };
  parent?: LinearParentIssue;
  children: { nodes: LinearChildIssue[] };
  createdAt: string;
  updatedAt: string;
}

interface LinearIssuesResult {
  success: boolean;
  issues?: LinearIssue[];
  error?: string;
}

interface LinearIssueDetailResult {
  success: boolean;
  issue?: LinearIssueDetail;
  error?: string;
}

interface LinearSummaryInput {
  identifier: string;
  title: string;
  description?: string;
  comments: Array<{ body: string; user: { name: string }; createdAt: string }>;
}

interface LinearSummaryResult {
  success: boolean;
  summary?: string;
  cached?: boolean;
  error?: string;
}

interface LinearCreateCommentResult {
  success: boolean;
  comment?: {
    id: string;
    body: string;
    createdAt: string;
    user: { id: string; name: string; email: string };
  };
  error?: string;
}

interface LinearUpdateIssueResult {
  success: boolean;
  issue?: {
    id: string;
    state: { id: string; name: string };
  };
  error?: string;
}

interface LinearAPI {
  test: (apiKey: string) => Promise<LinearTestResult>;
  getMyIssues: (apiKey: string) => Promise<LinearIssuesResult>;
  getIssue: (
    apiKey: string,
    issueId: string
  ) => Promise<LinearIssueDetailResult>;
  createComment: (
    apiKey: string,
    issueId: string,
    body: string
  ) => Promise<LinearCreateCommentResult>;
  deleteComment: (
    apiKey: string,
    commentId: string
  ) => Promise<{ success: boolean; error?: string }>;
  getIssueStates: (
    apiKey: string,
    issueId: string
  ) => Promise<{
    success: boolean;
    states?: Array<{ id: string; name: string; color: string; type: string }>;
    error?: string;
  }>;
  updateIssue: (
    apiKey: string,
    issueId: string,
    updates: { stateId?: string; stateName?: string }
  ) => Promise<LinearUpdateIssueResult>;
  generateSummary: (
    issueData: LinearSummaryInput
  ) => Promise<LinearSummaryResult>;
}

interface GitAPI {
  isRepo: (projectPath: string) => Promise<GitIsRepoResult>;
  branch: (projectPath: string) => Promise<GitBranchResult>;
  remote: (projectPath: string) => Promise<GitRemoteResult>;
  status: (projectPath: string) => Promise<GitStatusResult>;
  stage: (projectPath: string, files: string[]) => Promise<GitOperationResult>;
  unstage: (
    projectPath: string,
    files: string[]
  ) => Promise<GitOperationResult>;
  commit: (projectPath: string, message: string) => Promise<GitOperationResult>;
  push: (projectPath: string, branch?: string) => Promise<GitOperationResult>;
  pull: (projectPath: string) => Promise<GitOperationResult>;
  fetch: (projectPath: string) => Promise<GitOperationResult>;
  createBranch: (
    projectPath: string,
    branchName: string,
    checkout?: boolean
  ) => Promise<GitOperationResult>;
  checkout: (
    projectPath: string,
    branchName: string
  ) => Promise<GitOperationResult>;
  restore: (projectPath: string) => Promise<GitOperationResult>;
  worktree: {
    list: (projectPath: string) => Promise<GitWorktreeListResult>;
    add: (
      projectPath: string,
      worktreePath: string,
      branch: string,
      createBranch?: boolean
    ) => Promise<GitOperationResult>;
    remove: (
      projectPath: string,
      worktreePath: string
    ) => Promise<GitOperationResult>;
    saveDiff: (
      worktreePath: string,
      sessionId: string,
      baseBranch?: string
    ) => Promise<{
      success: boolean;
      path?: string;
      base?: string;
      diffLength?: number;
      error?: string;
    }>;
    readDiff: (
      worktreePath: string,
      sessionId: string
    ) => Promise<{
      success: boolean;
      diff?: string;
      path?: string;
      error?: string;
    }>;
    deleteDiff: (
      worktreePath: string,
      sessionId: string
    ) => Promise<{ success: boolean; error?: string }>;
    updateTokenUsage: (
      worktreePath: string,
      sessionId: string,
      usage: TokenUsage
    ) => Promise<{
      success: boolean;
      total?: TokenUsage & { isClosed?: boolean };
      error?: string;
    }>;
    readTokenUsage: (
      worktreePath: string,
      sessionId: string
    ) => Promise<{
      success: boolean;
      usage?: TokenUsage & { isClosed?: boolean };
      error?: string;
    }>;
    closeTokenUsage: (
      worktreePath: string,
      sessionId: string
    ) => Promise<{ success: boolean; error?: string }>;
  };
  pr: {
    create: (
      projectPath: string,
      options: { title: string; body: string; base: string }
    ) => Promise<GitPRCreateResult>;
    list: (projectPath: string) => Promise<GitPRListResult>;
    template: (
      projectPath: string
    ) => Promise<{ success: boolean; template: string | null; path?: string }>;
    comments: (projectPath: string) => Promise<GitPRCommentsResult>;
    review: (
      projectPath: string,
      options: GitPRReviewOptions
    ) => Promise<GitPRReviewResult>;
    onReviewProgress: (
      callback: (progress: {
        batch: number;
        total: number;
        status: "pending" | "sending" | "success" | "failed" | "rolling-back";
      }) => void
    ) => () => void;
  };
  defaultBranch: (
    projectPath: string
  ) => Promise<{ success: boolean; branch: string }>;
  protectedBranches: (
    projectPath: string
  ) => Promise<GitProtectedBranchesResult>;
  diff: (projectPath: string, staged?: boolean, baseBranch?: string) => Promise<GitDiffResult>;
  diffFiles: (
    projectPath: string,
    baseBranch?: string
  ) => Promise<GitDiffFilesResult>;
  prDiffFiles: (projectPath: string) => Promise<GitDiffFilesResult>;
  mergeBase: (
    projectPath: string,
    branches: string[]
  ) => Promise<{ success: boolean; branch: string; distance: number }>;
}

interface ElectronAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
  getVersion: () => Promise<string>;
  onSystemSleep: (callback: () => void) => () => void;
  onSystemWake: (callback: () => void) => () => void;
  openFolder: () => Promise<string | null>;
  readFile: (path: string) => Promise<ReadFileResult>;
  readImageFile: (
    path: string
  ) => Promise<{ success: boolean; data?: string; error?: string }>;
  writeFile: (path: string, content: string) => Promise<WriteFileResult>;
  readDir: (path: string) => Promise<ReadDirResult>;
  listAllFiles: (path: string) => Promise<ListAllFilesResult>;
  deleteFile: (path: string) => Promise<WriteFileResult>;
  renameFile: (oldPath: string, newPath: string) => Promise<WriteFileResult>;
  loadTypes: (projectPath: string) => Promise<LoadTypesResult>;
  watchDir: (path: string) => Promise<WatchResult>;
  unwatchDir: () => Promise<WatchResult>;
  onFileChanged: (callback: (event: FileChangeEvent) => void) => () => void;
  store: StoreAPI;
  claude: ClaudeAPI;
  terminal: TerminalAPI;
  lsp: LSPAPI;
  linear: LinearAPI;
  git: GitAPI;
  detectTests: (
    projectPath: string,
    framework?: string
  ) => Promise<RunTestsResult>;
  runTests: (
    projectPath: string,
    testFile?: string,
    testName?: string,
    framework?: string
  ) => Promise<RunTestsResult>;
  detectTestFrameworks: (
    projectPath: string
  ) => Promise<DetectFrameworksResult>;
  review: (
    projectPath: string,
    fileContent: string,
    filePath: string,
    diff: string,
    context: { skills: string; rules: string }
  ) => Promise<ReviewResult>;
  testUpdate: () => Promise<void>;
  onUpdateAvailable: (
    callback: (event: unknown, info: { version: string }) => void
  ) => () => void;
  onUpdateDownloaded: (
    callback: (event: unknown, info: { version: string }) => void
  ) => () => void;
  restartAndUpdate: () => void;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}
