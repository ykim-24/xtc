import { useState, useEffect, useCallback } from 'react';
import { GitBranch, FolderOpen, Trash2, ExternalLink, Plus, RefreshCw, Loader2 } from 'lucide-react';
import { useProjectStore, useTestStore } from '@/stores';
import { useWorktreeStore } from '@/stores/worktreeStore';
import { PixelTree } from '@/components/feature-sidebar/PixelIcons';

interface Worktree {
  path: string;
  branch: string;
  isMain: boolean;
  isCurrent: boolean;
}

export function WorktreesFullPanel() {
  const { projectPath, setProjectPath } = useProjectStore();
  const { sessions, getSession } = useWorktreeStore();
  const { setMode } = useTestStore();
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mainRepoPath, setMainRepoPath] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorktrees = useCallback(async () => {
    if (!projectPath) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electron?.git.worktree.list(projectPath);

      if (result?.success && result.worktrees) {
        // Find the main worktree path
        const main = result.worktrees.find(w => w.isMain);
        if (main) {
          setMainRepoPath(main.path);
        }

        // Mark which one is current
        const mapped = result.worktrees.map(w => ({
          ...w,
          isCurrent: w.path === projectPath,
        }));

        setWorktrees(mapped);
      } else if (result?.error) {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load worktrees');
      console.error('Failed to load worktrees:', err);
    }
    setIsLoading(false);
  }, [projectPath]);

  // Load worktrees when project changes
  useEffect(() => {
    loadWorktrees();
  }, [loadWorktrees]);

  const handleSwitchWorktree = (worktree: Worktree) => {
    if (worktree.isCurrent) return;
    setProjectPath(worktree.path);
    // Switch to home mode to show the editor
    setMode('home');
  };

  const handleRemoveWorktree = async (worktree: Worktree) => {
    if (worktree.isMain || worktree.isCurrent) return;

    // Need to run remove from the main repo path
    const repoPath = mainRepoPath || projectPath;
    if (!repoPath) return;

    const result = await window.electron?.git.worktree.remove(repoPath, worktree.path);
    if (result?.success) {
      loadWorktrees();
    } else if (result?.error) {
      setError(result.error);
    }
  };

  const handleRevealInFinder = async (worktree: Worktree) => {
    await window.electron?.revealInFinder?.(worktree.path);
  };

  const handleCreateWorktree = async () => {
    if (!newBranchName.trim() || !mainRepoPath) return;

    setIsCreating(true);
    setError(null);

    const branchName = newBranchName.trim().replace(/[^a-z0-9\-_\/]/gi, '-');
    const worktreePath = `${mainRepoPath}/../${branchName}`;

    try {
      const result = await window.electron?.git.worktree.add(mainRepoPath, worktreePath, branchName, true);

      if (result?.success) {
        setNewBranchName('');
        await loadWorktrees();
        // Switch to the new worktree using the resolved path
        const resolvedPath = result.path || worktreePath;
        setProjectPath(resolvedPath);
        // Switch to home mode to show the editor
        setMode('home');
      } else {
        setError(result?.error || 'Failed to create worktree');
      }
    } catch (err) {
      setError('Failed to create worktree');
    }

    setIsCreating(false);
  };

  if (!projectPath) {
    return (
      <div className="h-full flex items-center justify-center bg-bg-primary">
        <div className="text-center text-text-muted">
          <PixelTree className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-sm">Open a project to manage worktrees</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-bg-secondary">
        <div className="flex items-center gap-3">
          <PixelTree className="w-5 h-5 text-green-400" />
          <span className="text-sm font-medium text-text-primary">Worktrees</span>
          <span className="text-xs text-text-muted px-2 py-0.5 bg-bg-tertiary rounded">
            {worktrees.length} worktree{worktrees.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={loadWorktrees}
          className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          title="Refresh worktrees"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Create new worktree */}
      <div className="px-4 py-3 border-b border-border-primary bg-bg-secondary/50">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateWorktree()}
              placeholder="New branch name..."
              className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-primary rounded focus:outline-none focus:border-accent-primary placeholder-text-muted"
              disabled={isCreating}
            />
          </div>
          <button
            onClick={handleCreateWorktree}
            disabled={!newBranchName.trim() || isCreating || !mainRepoPath}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-accent-primary text-white rounded hover:bg-accent-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </div>
        {mainRepoPath && newBranchName && (
          <p className="text-xs text-text-muted mt-2">
            Will create: <span className="font-mono text-text-secondary">{mainRepoPath}/../{newBranchName.trim().replace(/[^a-z0-9\-_\/]/gi, '-')}</span>
          </p>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Worktree list */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading && worktrees.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-6 h-6 text-text-muted animate-spin" />
          </div>
        ) : worktrees.length === 0 ? (
          <div className="text-center text-text-muted py-8">
            <p className="text-sm">No worktrees found</p>
            <p className="text-xs mt-1">Create a new worktree to get started</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {worktrees.map((worktree) => {
              const session = getSession(worktree.path);
              const isRunning = session?.status === 'running';
              const isSuccess = session?.status === 'success';
              const isError = session?.status === 'error';

              return (
              <div
                key={worktree.path}
                className={`
                  group relative p-4 rounded-lg border transition-all cursor-pointer
                  ${worktree.isCurrent
                    ? 'bg-accent-primary/10 border-accent-primary/30 shadow-sm'
                    : isRunning
                    ? 'bg-yellow-500/5 border-yellow-500/30'
                    : isSuccess
                    ? 'bg-green-500/5 border-green-500/30'
                    : isError
                    ? 'bg-red-500/5 border-red-500/30'
                    : 'bg-bg-secondary border-border-primary hover:border-border-secondary hover:bg-bg-hover'
                  }
                `}
                onClick={() => handleSwitchWorktree(worktree)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {isRunning ? (
                      <Loader2 className="w-5 h-5 flex-shrink-0 text-yellow-400 animate-spin" />
                    ) : (
                      <GitBranch className={`w-5 h-5 flex-shrink-0 ${
                        worktree.isCurrent ? 'text-accent-primary' :
                        isSuccess ? 'text-green-400' :
                        isError ? 'text-red-400' :
                        'text-text-muted'
                      }`} />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-medium ${
                          worktree.isCurrent ? 'text-accent-primary' :
                          isRunning ? 'text-yellow-400' :
                          isSuccess ? 'text-green-400' :
                          isError ? 'text-red-400' :
                          'text-text-primary'
                        }`}>
                          {worktree.branch || 'detached HEAD'}
                        </span>
                        {worktree.isMain && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-quaternary text-text-muted font-medium uppercase tracking-wide">
                            main
                          </span>
                        )}
                        {worktree.isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-primary/30 text-accent-primary font-medium uppercase tracking-wide">
                            current
                          </span>
                        )}
                        {isRunning && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/30 text-yellow-400 font-medium uppercase tracking-wide animate-pulse">
                            working
                          </span>
                        )}
                        {isSuccess && !worktree.isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/30 text-green-400 font-medium uppercase tracking-wide">
                            done
                          </span>
                        )}
                        {isError && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/30 text-red-400 font-medium uppercase tracking-wide">
                            error
                          </span>
                        )}
                      </div>
                      {session?.linearTicket && (
                        <p className="text-xs text-text-secondary mt-0.5">
                          <span className="font-mono text-accent-primary">{session.linearTicket.identifier}</span>
                          {' · '}
                          <span className="truncate">{session.linearTicket.title}</span>
                        </p>
                      )}
                      <p className="text-xs text-text-muted mt-1 font-mono truncate max-w-[400px]">
                        {worktree.path}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className={`flex items-center gap-1 ${worktree.isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRevealInFinder(worktree);
                      }}
                      className="p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
                      title="Reveal in Finder"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    {!worktree.isMain && !worktree.isCurrent && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveWorktree(worktree);
                        }}
                        className="p-1.5 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors"
                        title="Remove worktree"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {!worktree.isCurrent && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSwitchWorktree(worktree);
                        }}
                        className="p-1.5 rounded hover:bg-accent-primary/20 text-text-muted hover:text-accent-primary transition-colors"
                        title="Open worktree"
                      >
                        <FolderOpen className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="px-4 py-2 border-t border-border-primary bg-bg-secondary text-xs text-text-muted">
        <p>
          Git worktrees allow you to check out multiple branches simultaneously in separate directories.
        </p>
      </div>
    </div>
  );
}
