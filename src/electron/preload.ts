import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Open external URL in default browser
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // System events (power management)
  onSystemSleep: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('system:sleep', handler);
    return () => ipcRenderer.removeListener('system:sleep', handler);
  },
  onSystemWake: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('system:wake', handler);
    return () => ipcRenderer.removeListener('system:wake', handler);
  },

  // Dialogs
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  dialog: {
    openFile: (options?: { multiple?: boolean; filters?: { name: string; extensions: string[] }[] }) =>
      ipcRenderer.invoke('dialog:openFile', options),
  },

  // File operations
  readFile: (path: string) => ipcRenderer.invoke('file:read', path),
  readImageFile: (path: string) => ipcRenderer.invoke('file:readImage', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
  readDir: (path: string) => ipcRenderer.invoke('file:readDir', path),
  deleteFile: (path: string) => ipcRenderer.invoke('file:delete', path),
  renameFile: (oldPath: string, newPath: string) => ipcRenderer.invoke('file:rename', oldPath, newPath),
  revealInFinder: (path: string) => ipcRenderer.invoke('file:revealInFinder', path),
  loadTypes: (projectPath: string) => ipcRenderer.invoke('types:load', projectPath),
  watchDir: (path: string) => ipcRenderer.invoke('file:watch', path),
  unwatchDir: () => ipcRenderer.invoke('file:unwatch'),
  onFileChanged: (callback: (event: { eventType: string; filename: string; dirPath: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { eventType: string; filename: string; dirPath: string }) => callback(data);
    ipcRenderer.on('file:changed', handler);
    return () => ipcRenderer.removeListener('file:changed', handler);
  },

  // App data storage
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, data: unknown) => ipcRenderer.invoke('store:set', key, data),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
    getPath: () => ipcRenderer.invoke('store:getPath'),
  },

  // Claude chat
  claude: {
    send: (message: string, context: { activeFile?: { path: string; content: string }; contextFiles?: { path: string; content: string }[] }, projectPath: string | null, options?: { planOnly?: boolean }) =>
      ipcRenderer.invoke('claude:send', message, context, projectPath, options),
    checkInstalled: () => ipcRenderer.invoke('claude:checkInstalled'),
    clearConversation: (projectPath: string | null) => ipcRenderer.invoke('claude:clearConversation', projectPath),
    onStream: (callback: (chunk: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, chunk: string) => callback(chunk);
      ipcRenderer.on('claude:stream', handler);
      return () => ipcRenderer.removeListener('claude:stream', handler);
    },
    getPendingEdits: () => ipcRenderer.invoke('claude:getPendingEdits'),
    approveEdit: (editId: string, filePath?: string, content?: string) => ipcRenderer.invoke('claude:approveEdit', editId, filePath, content),
    rejectEdit: (editId: string) => ipcRenderer.invoke('claude:rejectEdit', editId),
    onPendingEditAdded: (callback: (edit: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, edit: unknown) => callback(edit);
      ipcRenderer.on('claude:pendingEditAdded', handler);
      return () => ipcRenderer.removeListener('claude:pendingEditAdded', handler);
    },
    onPendingEditUpdated: (callback: (edit: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, edit: unknown) => callback(edit);
      ipcRenderer.on('claude:pendingEditUpdated', handler);
      return () => ipcRenderer.removeListener('claude:pendingEditUpdated', handler);
    },
    onActivity: (callback: (activity: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, activity: string) => callback(activity);
      ipcRenderer.on('claude:activity', handler);
      return () => ipcRenderer.removeListener('claude:activity', handler);
    },
  },

  // Terminal
  terminal: {
    create: (cwd?: string) => ipcRenderer.invoke('terminal:create', cwd),
    write: (id: string, data: string) => ipcRenderer.invoke('terminal:write', id, data),
    resize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
    kill: (id: string) => ipcRenderer.invoke('terminal:kill', id),
    onData: (callback: (event: { id: string; data: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { id: string; data: string }) => callback(data);
      ipcRenderer.on('terminal:data', handler);
      return () => ipcRenderer.removeListener('terminal:data', handler);
    },
    onExit: (callback: (event: { id: string; exitCode: number }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { id: string; exitCode: number }) => callback(data);
      ipcRenderer.on('terminal:exit', handler);
      return () => ipcRenderer.removeListener('terminal:exit', handler);
    },
  },

  // Test Runner
  detectTestFrameworks: (projectPath: string) => ipcRenderer.invoke('tests:detectFrameworks', projectPath),
  detectTests: (projectPath: string, framework?: string) => ipcRenderer.invoke('tests:detect', projectPath, framework),
  runTests: (projectPath: string, testFile?: string, testName?: string, framework?: string) =>
    ipcRenderer.invoke('tests:run', projectPath, testFile, testName, framework),

  // Language Server Protocol (LSP)
  lsp: {
    setProjectPath: (projectPath: string) => ipcRenderer.invoke('lsp:setProjectPath', projectPath),
    startServer: (serverName: string) => ipcRenderer.invoke('lsp:startServer', serverName),
    stopServer: (serverName: string) => ipcRenderer.invoke('lsp:stopServer', serverName),
    stopAll: () => ipcRenderer.invoke('lsp:stopAll'),
    didOpen: (uri: string, language: string, content: string) => ipcRenderer.invoke('lsp:didOpen', uri, language, content),
    didChange: (uri: string, language: string, content: string) => ipcRenderer.invoke('lsp:didChange', uri, language, content),
    didClose: (uri: string, language: string) => ipcRenderer.invoke('lsp:didClose', uri, language),
    getCompletions: (uri: string, language: string, line: number, character: number) =>
      ipcRenderer.invoke('lsp:getCompletions', uri, language, line, character),
    getHover: (uri: string, language: string, line: number, character: number) =>
      ipcRenderer.invoke('lsp:getHover', uri, language, line, character),
    getDefinition: (uri: string, language: string, line: number, character: number) =>
      ipcRenderer.invoke('lsp:getDefinition', uri, language, line, character),
    getReferences: (uri: string, language: string, line: number, character: number) =>
      ipcRenderer.invoke('lsp:getReferences', uri, language, line, character),
    formatDocument: (uri: string, language: string) => ipcRenderer.invoke('lsp:formatDocument', uri, language),
    isServerAvailable: (language: string) => ipcRenderer.invoke('lsp:isServerAvailable', language),
    getAvailableServers: () => ipcRenderer.invoke('lsp:getAvailableServers'),
    getRunningServers: () => ipcRenderer.invoke('lsp:getRunningServers'),
  },

  // Linear
  linear: {
    test: (apiKey: string) => ipcRenderer.invoke('linear:test', apiKey),
    getMyIssues: (apiKey: string) => ipcRenderer.invoke('linear:getMyIssues', apiKey),
    getIssue: (apiKey: string, issueId: string) => ipcRenderer.invoke('linear:getIssue', apiKey, issueId),
    createComment: (apiKey: string, issueId: string, body: string) => ipcRenderer.invoke('linear:createComment', apiKey, issueId, body),
    deleteComment: (apiKey: string, commentId: string) => ipcRenderer.invoke('linear:deleteComment', apiKey, commentId),
    getIssueStates: (apiKey: string, issueId: string) => ipcRenderer.invoke('linear:getIssueStates', apiKey, issueId),
    updateIssue: (apiKey: string, issueId: string, updates: { stateId?: string; stateName?: string }) =>
      ipcRenderer.invoke('linear:updateIssue', apiKey, issueId, updates),
    generateSummary: (issueData: {
      identifier: string;
      title: string;
      description?: string;
      comments: Array<{ body: string; user: { name: string }; createdAt: string }>;
    }) => ipcRenderer.invoke('linear:generateSummary', issueData),
  },

  // Git operations
  git: {
    isRepo: (projectPath: string) => ipcRenderer.invoke('git:isRepo', projectPath),
    branch: (projectPath: string) => ipcRenderer.invoke('git:branch', projectPath),
    remote: (projectPath: string) => ipcRenderer.invoke('git:remote', projectPath),
    status: (projectPath: string) => ipcRenderer.invoke('git:status', projectPath),
    stage: (projectPath: string, files: string[]) => ipcRenderer.invoke('git:stage', projectPath, files),
    unstage: (projectPath: string, files: string[]) => ipcRenderer.invoke('git:unstage', projectPath, files),
    commit: (projectPath: string, message: string) => ipcRenderer.invoke('git:commit', projectPath, message),
    push: (projectPath: string, branch?: string) => ipcRenderer.invoke('git:push', projectPath, branch),
    pull: (projectPath: string) => ipcRenderer.invoke('git:pull', projectPath),
    fetch: (projectPath: string) => ipcRenderer.invoke('git:fetch', projectPath),
    createBranch: (projectPath: string, branchName: string, checkout?: boolean) =>
      ipcRenderer.invoke('git:createBranch', projectPath, branchName, checkout),
    checkout: (projectPath: string, branchName: string) => ipcRenderer.invoke('git:checkout', projectPath, branchName),
    restore: (projectPath: string) => ipcRenderer.invoke('git:restore', projectPath),
    worktree: {
      list: (projectPath: string) => ipcRenderer.invoke('git:worktree:list', projectPath),
      add: (projectPath: string, worktreePath: string, branch: string, createBranch?: boolean) =>
        ipcRenderer.invoke('git:worktree:add', projectPath, worktreePath, branch, createBranch),
      remove: (projectPath: string, worktreePath: string) =>
        ipcRenderer.invoke('git:worktree:remove', projectPath, worktreePath),
    },
    pr: {
      create: (projectPath: string, options: { title: string; body: string; base: string }) =>
        ipcRenderer.invoke('git:pr:create', projectPath, options),
      list: (projectPath: string) => ipcRenderer.invoke('git:pr:list', projectPath),
      template: (projectPath: string) => ipcRenderer.invoke('git:pr:template', projectPath),
      comments: (projectPath: string) => ipcRenderer.invoke('git:pr:comments', projectPath),
      review: (projectPath: string, options: {
        action: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
        body: string;
        comments: { path: string; line: number; startLine?: number; body: string }[];
      }) => ipcRenderer.invoke('git:pr:review', projectPath, options),
      onReviewProgress: (callback: (progress: { batch: number; total: number; status: 'pending' | 'sending' | 'success' | 'failed' | 'rolling-back' }) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, progress: { batch: number; total: number; status: 'pending' | 'sending' | 'success' | 'failed' | 'rolling-back' }) => callback(progress);
        ipcRenderer.on('git:pr:review:progress', handler);
        return () => ipcRenderer.removeListener('git:pr:review:progress', handler);
      },
    },
    defaultBranch: (projectPath: string) => ipcRenderer.invoke('git:defaultBranch', projectPath),
    protectedBranches: (projectPath: string) => ipcRenderer.invoke('git:protectedBranches', projectPath),
    diff: (projectPath: string, staged?: boolean) => ipcRenderer.invoke('git:diff', projectPath, staged),
    diffFiles: (projectPath: string, baseBranch?: string) => ipcRenderer.invoke('git:diffFiles', projectPath, baseBranch),
    prDiffFiles: (projectPath: string) => ipcRenderer.invoke('git:pr:diffFiles', projectPath),
  },
  review: (projectPath: string, fileContent: string, filePath: string, diff: string, context: { skills: string; rules: string }) =>
    ipcRenderer.invoke('claude:review', projectPath, fileContent, filePath, diff, context),
});
