import { create } from 'zustand';

export interface GitChange {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed';
  staged: boolean;
}

export interface GitRemote {
  url: string;
  owner: string;
  repo: string;
}

export interface GitWorktree {
  path: string;
  branch: string;
  isMain: boolean;
}

export interface GitPR {
  number: number;
  title: string;
  state: string;
  headRefName: string;
  url: string;
}

interface GitState {
  // Status
  isRepo: boolean;
  currentBranch: string | null;
  branches: string[];
  remoteBranches: string[];
  protectedBranches: string[];
  remote: GitRemote | null;
  changes: GitChange[];
  ahead: number;
  behind: number;

  // Worktrees
  worktrees: GitWorktree[];

  // PRs
  prs: GitPR[];

  // Loading states
  isLoading: boolean;
  isFetching: boolean;
  lastFetchTime: number | null;
  isCommitting: boolean;
  isPushing: boolean;
  isPulling: boolean;
  isCreatingPR: boolean;
  error: string | null;

  // Output log
  outputLog: { command: string; output: string; isError: boolean; timestamp: number }[];

  // Actions
  refreshStatus: (projectPath: string) => Promise<void>;
  stageFiles: (projectPath: string, files: string[]) => Promise<void>;
  unstageFiles: (projectPath: string, files: string[]) => Promise<void>;
  stageAll: (projectPath: string) => Promise<void>;
  unstageAll: (projectPath: string) => Promise<void>;
  commit: (projectPath: string, message: string) => Promise<boolean>;
  push: (projectPath: string, branch?: string) => Promise<boolean>;
  pull: (projectPath: string) => Promise<boolean>;
  fetch: (projectPath: string) => Promise<boolean>;
  createBranch: (projectPath: string, branchName: string, checkout?: boolean) => Promise<boolean>;
  checkout: (projectPath: string, branchName: string) => Promise<boolean>;

  // Worktree actions
  listWorktrees: (projectPath: string) => Promise<void>;
  addWorktree: (projectPath: string, worktreePath: string, branch: string, createBranch?: boolean) => Promise<boolean>;
  removeWorktree: (projectPath: string, worktreePath: string) => Promise<boolean>;

  // PR actions
  listPRs: (projectPath: string) => Promise<void>;
  createPR: (projectPath: string, options: { title: string; body: string; base: string }) => Promise<string | null>;

  // Protected branches
  fetchProtectedBranches: (projectPath: string) => Promise<void>;

  // Auto commit message
  generateCommitMessage: (projectPath: string) => Promise<string | null>;
  isGeneratingMessage: boolean;

  // Review mode
  isReviewMode: boolean;
  setReviewMode: (value: boolean) => void;

  // Utility
  clearError: () => void;
  clearOutput: () => void;
  addOutput: (command: string, output: string, isError?: boolean) => void;
  reset: () => void;

  // Dev/testing
  setIsFetching: (value: boolean) => void;
}

const initialState = {
  isRepo: false,
  currentBranch: null,
  branches: [],
  remoteBranches: [],
  protectedBranches: [] as string[],
  remote: null,
  changes: [],
  ahead: 0,
  behind: 0,
  worktrees: [],
  prs: [],
  isLoading: false,
  isFetching: false,
  lastFetchTime: null,
  isCommitting: false,
  isPushing: false,
  isPulling: false,
  isCreatingPR: false,
  isGeneratingMessage: false,
  isReviewMode: false,
  error: null,
  outputLog: [] as { command: string; output: string; isError: boolean; timestamp: number }[],
};

export const useGitStore = create<GitState>((set, get) => ({
  ...initialState,

  refreshStatus: async (projectPath: string) => {
    if (!projectPath) return;
    set({ isLoading: true, error: null });

    try {
      const [isRepoResult, branchResult, remoteResult, statusResult] = await Promise.all([
        window.electron?.git.isRepo(projectPath),
        window.electron?.git.branch(projectPath),
        window.electron?.git.remote(projectPath),
        window.electron?.git.status(projectPath),
      ]);

      if (!isRepoResult?.success || !isRepoResult.isRepo) {
        set({ ...initialState, isLoading: false });
        return;
      }

      set({
        isRepo: true,
        currentBranch: branchResult?.current || null,
        branches: branchResult?.all || [],
        remoteBranches: branchResult?.remotes || [],
        remote: remoteResult?.remote || null,
        changes: statusResult?.changes || [],
        ahead: statusResult?.ahead || 0,
        behind: statusResult?.behind || 0,
        isLoading: false,
      });
    } catch (err) {
      console.error('Failed to refresh git status:', err);
      set({ error: err instanceof Error ? err.message : 'Failed to refresh git status', isLoading: false });
    }
  },

  stageFiles: async (projectPath: string, files: string[]) => {
    if (!projectPath || files.length === 0) return;
    try {
      const result = await window.electron?.git.stage(projectPath, files);
      if (result?.success) {
        get().addOutput(`git add ${files.join(' ')}`, `Staged ${files.length} file(s)`);
        await get().refreshStatus(projectPath);
      } else {
        get().addOutput(`git add ${files.join(' ')}`, result?.error || 'Failed to stage files', true);
        set({ error: result?.error || 'Failed to stage files' });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to stage files';
      get().addOutput(`git add ${files.join(' ')}`, errorMsg, true);
      set({ error: errorMsg });
    }
  },

  unstageFiles: async (projectPath: string, files: string[]) => {
    if (!projectPath || files.length === 0) return;
    try {
      const result = await window.electron?.git.unstage(projectPath, files);
      if (result?.success) {
        get().addOutput(`git reset ${files.join(' ')}`, `Unstaged ${files.length} file(s)`);
        await get().refreshStatus(projectPath);
      } else {
        get().addOutput(`git reset ${files.join(' ')}`, result?.error || 'Failed to unstage files', true);
        set({ error: result?.error || 'Failed to unstage files' });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to unstage files';
      get().addOutput(`git reset ${files.join(' ')}`, errorMsg, true);
      set({ error: errorMsg });
    }
  },

  stageAll: async (projectPath: string) => {
    const { changes } = get();
    const unstagedFiles = changes.filter((c) => !c.staged).map((c) => c.path);
    await get().stageFiles(projectPath, unstagedFiles);
  },

  unstageAll: async (projectPath: string) => {
    const { changes } = get();
    const stagedFiles = changes.filter((c) => c.staged).map((c) => c.path);
    await get().unstageFiles(projectPath, stagedFiles);
  },

  commit: async (projectPath: string, message: string) => {
    if (!projectPath || !message.trim()) return false;
    set({ isCommitting: true, error: null });
    try {
      const result = await window.electron?.git.commit(projectPath, message);
      if (result?.success) {
        get().addOutput('git commit', result.output || `Committed: "${message}"`);
        await get().refreshStatus(projectPath);
        set({ isCommitting: false });
        return true;
      } else {
        get().addOutput('git commit', result?.error || 'Failed to commit', true);
        set({ error: result?.error || 'Failed to commit', isCommitting: false });
        return false;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to commit';
      get().addOutput('git commit', errorMsg, true);
      set({ error: errorMsg, isCommitting: false });
      return false;
    }
  },

  push: async (projectPath: string, branch?: string) => {
    if (!projectPath) return false;
    set({ isPushing: true, error: null });
    try {
      const result = await window.electron?.git.push(projectPath, branch);
      if (result?.success) {
        get().addOutput('git push', result.output || 'Pushed successfully');
        await get().refreshStatus(projectPath);
        set({ isPushing: false });
        return true;
      } else {
        get().addOutput('git push', result?.error || 'Failed to push', true);
        set({ error: result?.error || 'Failed to push', isPushing: false });
        return false;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to push';
      get().addOutput('git push', errorMsg, true);
      set({ error: errorMsg, isPushing: false });
      return false;
    }
  },

  pull: async (projectPath: string) => {
    if (!projectPath) return false;
    set({ isPulling: true, error: null });
    try {
      const result = await window.electron?.git.pull(projectPath);
      if (result?.success) {
        get().addOutput('git pull', result.output || 'Already up to date');
        await get().refreshStatus(projectPath);
        set({ isPulling: false });
        return true;
      } else {
        get().addOutput('git pull', result?.error || 'Failed to pull', true);
        set({ error: result?.error || 'Failed to pull', isPulling: false });
        return false;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to pull';
      get().addOutput('git pull', errorMsg, true);
      set({ error: errorMsg, isPulling: false });
      return false;
    }
  },

  fetch: async (projectPath: string) => {
    if (!projectPath) return false;
    set({ isFetching: true, error: null });
    try {
      const result = await window.electron?.git.fetch(projectPath);
      if (result?.success) {
        get().addOutput('git fetch --all --prune', result.output || 'Fetched all remotes');
        await get().refreshStatus(projectPath);
        set({ isFetching: false, lastFetchTime: Date.now() });
        return true;
      } else {
        get().addOutput('git fetch --all --prune', result?.error || 'Failed to fetch', true);
        set({ error: result?.error || 'Failed to fetch', isFetching: false });
        return false;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch';
      get().addOutput('git fetch --all --prune', errorMsg, true);
      set({ error: errorMsg, isFetching: false });
      return false;
    }
  },

  createBranch: async (projectPath: string, branchName: string, checkout = true) => {
    if (!projectPath || !branchName.trim()) return false;
    set({ error: null });
    try {
      const cmd = checkout ? `git checkout -b ${branchName}` : `git branch ${branchName}`;
      const result = await window.electron?.git.createBranch(projectPath, branchName, checkout);
      if (result?.success) {
        get().addOutput(cmd, `Created branch '${branchName}'${checkout ? ' and switched to it' : ''}`);
        await get().refreshStatus(projectPath);
        return true;
      } else {
        get().addOutput(cmd, result?.error || 'Failed to create branch', true);
        set({ error: result?.error || 'Failed to create branch' });
        return false;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create branch';
      get().addOutput(`git branch ${branchName}`, errorMsg, true);
      set({ error: errorMsg });
      return false;
    }
  },

  checkout: async (projectPath: string, branchName: string) => {
    if (!projectPath || !branchName) return false;
    set({ error: null });
    try {
      const result = await window.electron?.git.checkout(projectPath, branchName);
      if (result?.success) {
        get().addOutput(`git checkout ${branchName}`, `Switched to branch '${branchName}'`);
        await get().refreshStatus(projectPath);
        return true;
      } else {
        get().addOutput(`git checkout ${branchName}`, result?.error || 'Failed to checkout branch', true);
        set({ error: result?.error || 'Failed to checkout branch' });
        return false;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to checkout branch';
      get().addOutput(`git checkout ${branchName}`, errorMsg, true);
      set({ error: errorMsg });
      return false;
    }
  },

  listWorktrees: async (projectPath: string) => {
    if (!projectPath) return;
    try {
      const result = await window.electron?.git.worktree.list(projectPath);
      if (result?.success) {
        set({ worktrees: result.worktrees || [] });
      }
    } catch (err) {
      console.error('Failed to list worktrees:', err);
    }
  },

  addWorktree: async (projectPath: string, worktreePath: string, branch: string, createBranch = false) => {
    if (!projectPath || !worktreePath || !branch) return false;
    set({ error: null });
    try {
      const cmd = createBranch ? `git worktree add ${worktreePath} -b ${branch}` : `git worktree add ${worktreePath} ${branch}`;
      const result = await window.electron?.git.worktree.add(projectPath, worktreePath, branch, createBranch);
      if (result?.success) {
        get().addOutput(cmd, `Added worktree at '${worktreePath}'`);
        await get().listWorktrees(projectPath);
        return true;
      } else {
        get().addOutput(cmd, result?.error || 'Failed to add worktree', true);
        set({ error: result?.error || 'Failed to add worktree' });
        return false;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to add worktree';
      get().addOutput(`git worktree add ${worktreePath}`, errorMsg, true);
      set({ error: errorMsg });
      return false;
    }
  },

  removeWorktree: async (projectPath: string, worktreePath: string) => {
    if (!projectPath || !worktreePath) return false;
    set({ error: null });
    try {
      const result = await window.electron?.git.worktree.remove(projectPath, worktreePath);
      if (result?.success) {
        get().addOutput(`git worktree remove ${worktreePath}`, `Removed worktree at '${worktreePath}'`);
        await get().listWorktrees(projectPath);
        return true;
      } else {
        get().addOutput(`git worktree remove ${worktreePath}`, result?.error || 'Failed to remove worktree', true);
        set({ error: result?.error || 'Failed to remove worktree' });
        return false;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to remove worktree';
      get().addOutput(`git worktree remove ${worktreePath}`, errorMsg, true);
      set({ error: errorMsg });
      return false;
    }
  },

  listPRs: async (projectPath: string) => {
    if (!projectPath) return;
    try {
      const result = await window.electron?.git.pr.list(projectPath);
      if (result?.success) {
        set({ prs: result.prs || [] });
      }
    } catch (err) {
      console.error('Failed to list PRs:', err);
    }
  },

  createPR: async (projectPath: string, options: { title: string; body: string; base: string }) => {
    if (!projectPath || !options.title) return null;
    set({ isCreatingPR: true, error: null });
    try {
      const result = await window.electron?.git.pr.create(projectPath, options);
      if (result?.success && result.url) {
        get().addOutput(`gh pr create --title "${options.title}"`, `Created PR: ${result.url}`);
        await get().listPRs(projectPath);
        set({ isCreatingPR: false });
        return result.url;
      } else {
        get().addOutput(`gh pr create --title "${options.title}"`, result?.error || 'Failed to create PR', true);
        set({ error: result?.error || 'Failed to create PR', isCreatingPR: false });
        return null;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create PR';
      get().addOutput(`gh pr create`, errorMsg, true);
      set({ error: errorMsg, isCreatingPR: false });
      return null;
    }
  },

  fetchProtectedBranches: async (projectPath: string) => {
    if (!projectPath) return;
    try {
      const result = await window.electron?.git.protectedBranches(projectPath);
      if (result?.success) {
        set({ protectedBranches: result.branches || [] });
      }
    } catch (err) {
      console.error('Failed to fetch protected branches:', err);
    }
  },

  generateCommitMessage: async (projectPath: string) => {
    if (!projectPath) return null;
    set({ isGeneratingMessage: true, error: null });
    try {
      // Get the staged diff
      const diffResult = await window.electron?.git.diff(projectPath, true);
      if (!diffResult?.success || !diffResult.diff) {
        set({ error: 'No staged changes to generate message from', isGeneratingMessage: false });
        return null;
      }

      // Truncate diff if too large (keep first 8000 chars)
      const diff = diffResult.diff.length > 8000
        ? diffResult.diff.substring(0, 8000) + '\n... (truncated)'
        : diffResult.diff;

      // Send to Claude to generate commit message
      const prompt = `Based on the following git diff, generate a concise and descriptive commit message. Follow conventional commit format (e.g., "feat:", "fix:", "refactor:", "docs:", "chore:"). Only respond with the commit message itself, nothing else. Keep it under 72 characters for the first line.

Git diff:
\`\`\`
${diff}
\`\`\``;

      const result = await window.electron?.claude.send(prompt, {}, projectPath);
      if (result?.success && result.response) {
        // Clean up the response - remove quotes, backticks, etc.
        let message = result.response.trim();
        message = message.replace(/^["'`]+|["'`]+$/g, '');
        message = message.replace(/^```\w*\n?|\n?```$/g, '');
        set({ isGeneratingMessage: false });
        return message.trim();
      } else {
        set({ error: result?.error || 'Failed to generate commit message', isGeneratingMessage: false });
        return null;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate commit message';
      set({ error: errorMsg, isGeneratingMessage: false });
      return null;
    }
  },

  setReviewMode: (value: boolean) => set({ isReviewMode: value }),

  clearError: () => set({ error: null }),

  clearOutput: () => set({ outputLog: [] }),

  addOutput: (command: string, output: string, isError = false) => {
    set((state) => ({
      outputLog: [
        ...state.outputLog,
        { command, output, isError, timestamp: Date.now() },
      ].slice(-20), // Keep last 20 entries
    }));
  },

  reset: () => set(initialState),

  // Dev/testing
  setIsFetching: (value: boolean) => set({ isFetching: value }),
}));
