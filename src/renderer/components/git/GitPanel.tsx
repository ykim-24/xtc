import React, { useEffect, useState, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { GitBranch, ArrowUp, ArrowDown, Plus, Minus, ChevronDown, Search, Terminal } from 'lucide-react';
import { clsx } from 'clsx';
import { useGitStore, useProjectStore } from '@/stores';
import { ReviewPanel } from './ReviewPanel';

const statusIcons: Record<string, string> = {
  modified: 'M',
  added: 'A',
  deleted: 'D',
  untracked: '?',
  renamed: 'R',
};

const statusColors: Record<string, string> = {
  modified: 'text-yellow-500',
  added: 'text-green-500',
  deleted: 'text-red-500',
  untracked: 'text-text-muted',
  renamed: 'text-blue-500',
};

// ANSI color code to CSS color mapping
const ansiColors: Record<number, string> = {
  30: '#1e1e1e', // black
  31: '#f87171', // red
  32: '#4ade80', // green
  33: '#fbbf24', // yellow
  34: '#60a5fa', // blue
  35: '#c084fc', // magenta
  36: '#22d3ee', // cyan
  37: '#e5e5e5', // white
  90: '#737373', // bright black (gray)
  91: '#fca5a5', // bright red
  92: '#86efac', // bright green
  93: '#fde047', // bright yellow
  94: '#93c5fd', // bright blue
  95: '#d8b4fe', // bright magenta
  96: '#67e8f9', // bright cyan
  97: '#ffffff', // bright white
};

// Parse ANSI codes and return React elements
function parseAnsiOutput(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match ANSI escape sequences: ESC[...m
  const regex = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  let currentColor: string | null = null;
  let isBold = false;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      const segment = text.slice(lastIndex, match.index);
      if (segment) {
        parts.push(
          <span key={lastIndex} style={{ color: currentColor || undefined, fontWeight: isBold ? 'bold' : undefined }}>
            {segment}
          </span>
        );
      }
    }

    // Parse the ANSI codes
    const codes = match[1].split(';').map(Number);
    for (const code of codes) {
      if (code === 0) {
        // Reset
        currentColor = null;
        isBold = false;
      } else if (code === 1) {
        isBold = true;
      } else if (code === 22) {
        isBold = false;
      } else if (ansiColors[code]) {
        currentColor = ansiColors[code];
      }
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const segment = text.slice(lastIndex);
    parts.push(
      <span key={lastIndex} style={{ color: currentColor || undefined, fontWeight: isBold ? 'bold' : undefined }}>
        {segment}
      </span>
    );
  }

  return parts.length > 0 ? parts : [text];
}

export function GitPanel() {
  const { projectPath } = useProjectStore();
  const {
    isRepo,
    currentBranch,
    branches,
    remoteBranches,
    protectedBranches,
    remote,
    changes,
    ahead,
    behind,
    isLoading,
    isFetching,
    lastFetchTime,
    isCommitting,
    isPushing,
    isPulling,
    isGeneratingMessage,
    outputLog,
    refreshStatus,
    stageFiles,
    unstageFiles,
    stageAll,
    unstageAll,
    commit,
    push,
    pull,
    fetch,
    checkout,
    createBranch,
    fetchProtectedBranches,
    generateCommitMessage,
    clearOutput,
    isReviewMode,
    setReviewMode,
  } = useGitStore();

  const [commitMessage, setCommitMessage] = useState('');
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [branchSearch, setBranchSearch] = useState('');
  const [showNewBranchInput, setShowNewBranchInput] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const newBranchRef = useRef<HTMLDivElement>(null);
  const newBranchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowBranchDropdown(false);
        setBranchSearch('');
      }
      if (newBranchRef.current && !newBranchRef.current.contains(event.target as Node)) {
        setShowNewBranchInput(false);
        setNewBranchName('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (showBranchDropdown && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showBranchDropdown]);

  // Focus new branch input when dropdown opens
  useEffect(() => {
    if (showNewBranchInput && newBranchInputRef.current) {
      newBranchInputRef.current.focus();
    }
  }, [showNewBranchInput]);

  // Auto-refresh and fetch when page is shown (only if stale > 5 minutes)
  const FETCH_STALE_TIME = 5 * 60 * 1000; // 5 minutes in ms

  useEffect(() => {
    if (projectPath) {
      // Only fetch if never fetched or stale (> 5 minutes)
      const isStale = !lastFetchTime || (Date.now() - lastFetchTime > FETCH_STALE_TIME);
      if (isStale) {
        fetch(projectPath);
      }
      refreshStatus(projectPath);

      // Set up interval to refresh while on this page
      const interval = setInterval(() => {
        refreshStatus(projectPath);
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [projectPath, refreshStatus, fetch, lastFetchTime]);

  const stagedChanges = changes.filter((c) => c.staged);
  const unstagedChanges = changes.filter((c) => !c.staged);

  const handleStageFile = (path: string) => {
    if (projectPath) stageFiles(projectPath, [path]);
  };

  const handleUnstageFile = (path: string) => {
    if (projectPath) unstageFiles(projectPath, [path]);
  };

  const handleStageAll = () => {
    if (projectPath) stageAll(projectPath);
  };

  const handleUnstageAll = () => {
    if (projectPath) unstageAll(projectPath);
  };

  const handleCommit = async () => {
    if (!projectPath || !commitMessage.trim()) return;
    const success = await commit(projectPath, commitMessage);
    if (success) {
      setCommitMessage('');
    }
  };

  const handlePush = () => {
    if (projectPath) push(projectPath);
  };

  const handlePull = () => {
    if (projectPath) pull(projectPath);
  };

  const handleCheckout = async (branchName: string) => {
    if (projectPath && branchName !== currentBranch) {
      await checkout(projectPath, branchName);
      setShowBranchDropdown(false);
      setBranchSearch('');
    }
  };

  const handleCreateBranch = async () => {
    if (projectPath && newBranchName.trim()) {
      const success = await createBranch(projectPath, newBranchName.trim(), true);
      if (success) {
        setShowNewBranchInput(false);
        setNewBranchName('');
      }
    }
  };

  const handleAutoMessage = async () => {
    if (projectPath && stagedChanges.length > 0) {
      const message = await generateCommitMessage(projectPath);
      if (message) {
        setCommitMessage(message);
      }
    }
  };

  if (!projectPath) {
    return (
      <div className="flex flex-col h-full bg-bg-primary">
        <div className="flex items-center justify-center h-full text-text-muted text-sm">
          -- no project open --
        </div>
      </div>
    );
  }

  if (isLoading && !isRepo) {
    return (
      <div className="flex flex-col h-full bg-bg-primary">
        <div className="flex items-center justify-center h-full text-text-muted text-sm">
          Loading...
        </div>
      </div>
    );
  }

  if (!isRepo) {
    return (
      <div className="flex flex-col h-full bg-bg-primary">
        <div className="flex items-center justify-center h-full text-text-muted text-sm">
          -- not a git repository --
        </div>
      </div>
    );
  }

  // Review mode
  if (isReviewMode && projectPath && currentBranch) {
    return (
      <ReviewPanel
        projectPath={projectPath}
        branch={currentBranch}
        onClose={() => setReviewMode(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary relative">
      {/* Fetching modal */}
      {isFetching && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-bg-secondary border border-border-primary rounded-lg shadow-xl p-6">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-accent-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 bg-accent-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 bg-accent-primary rounded-full animate-bounce" />
              </div>
              <span className="text-sm text-text-primary font-mono">Fetching remotes...</span>
              <span className="text-xs text-text-muted">Syncing with remote repositories</span>
            </div>
          </div>
        </div>
      )}

      {/* Repo name */}
      {remote && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-primary">
          <span className="text-xs text-text-muted font-mono">{remote.owner}/{remote.repo}</span>
          <div className="flex items-center gap-2">
            {/* Fetch button */}
            <button
              onClick={() => projectPath && fetch(projectPath)}
              disabled={isFetching}
              className="text-xs font-mono text-text-secondary hover:text-accent-primary transition-colors disabled:opacity-50"
              title={lastFetchTime ? `Last fetched: ${new Date(lastFetchTime).toLocaleTimeString()}` : 'Never fetched'}
            >
              [ fetch ]
            </button>
            {/* Review button */}
            <button
              onClick={() => setReviewMode(true)}
              className="text-xs font-mono text-text-secondary hover:text-accent-primary transition-colors"
            >
              [ review ]
            </button>
            {/* New branch button */}
            <div className="relative" ref={newBranchRef}>
              <button
                onClick={() => setShowNewBranchInput(!showNewBranchInput)}
                className="text-xs font-mono text-text-secondary hover:text-accent-primary transition-colors"
              >
                [ + branch ]
              </button>
              {showNewBranchInput && (
                <div className="absolute right-0 top-full mt-1 w-[250px] bg-bg-secondary border border-border-primary rounded shadow-lg z-50 p-2">
                  <div className="flex gap-2">
                    <input
                      ref={newBranchInputRef}
                      type="text"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="Branch name..."
                      className="flex-1 px-2 py-1 text-xs font-mono bg-bg-primary border border-border-primary rounded focus:outline-none focus:border-accent-primary text-text-primary placeholder-text-muted"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateBranch();
                        } else if (e.key === 'Escape') {
                          setShowNewBranchInput(false);
                          setNewBranchName('');
                        }
                      }}
                    />
                    <button
                      onClick={handleCreateBranch}
                      disabled={!newBranchName.trim()}
                      className="px-2 py-1 text-xs font-mono bg-accent-primary text-white rounded hover:bg-accent-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      create
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* Checkout dropdown */}
            <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => {
                const newState = !showBranchDropdown;
                setShowBranchDropdown(newState);
                // Fetch protected branches when opening dropdown
                if (newState && projectPath) {
                  fetchProtectedBranches(projectPath);
                }
              }}
              className="text-xs font-mono text-text-secondary hover:text-accent-primary transition-colors flex items-center gap-1"
            >
              [ checkout <ChevronDown className="w-3 h-3" /> ]
            </button>
            {showBranchDropdown && (
              <div className="absolute right-0 top-full mt-1 w-[250px] bg-bg-secondary border border-border-primary rounded shadow-lg z-50">
                {/* Search input */}
                <div className="p-2 border-b border-border-primary">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={branchSearch}
                      onChange={(e) => setBranchSearch(e.target.value)}
                      placeholder="Search branches..."
                      className="w-full pl-7 pr-2 py-1 text-xs font-mono bg-bg-primary border border-border-primary rounded focus:outline-none focus:border-accent-primary text-text-primary placeholder-text-muted"
                    />
                  </div>
                </div>
                {/* Branch list */}
                <div className="max-h-[250px] overflow-y-auto overflow-x-hidden">
                  {(() => {
                    const filteredLocalBranches = branches
                      .filter((branch) => branch.toLowerCase().includes(branchSearch.toLowerCase()))
                      .sort((a, b) => {
                        const aProtected = protectedBranches.includes(a);
                        const bProtected = protectedBranches.includes(b);
                        if (aProtected && !bProtected) return -1;
                        if (!aProtected && bProtected) return 1;
                        return a.localeCompare(b);
                      });

                    // Filter remote branches and exclude ones that have local counterparts
                    const filteredRemoteBranches = remoteBranches
                      .filter((branch) => {
                        const shortName = branch.replace(/^origin\//, '');
                        return shortName.toLowerCase().includes(branchSearch.toLowerCase()) &&
                               !branches.includes(shortName);
                      })
                      .sort((a, b) => a.localeCompare(b));

                    const hasLocalResults = filteredLocalBranches.length > 0;
                    const hasRemoteResults = filteredRemoteBranches.length > 0;

                    if (!hasLocalResults && !hasRemoteResults) {
                      return <div className="px-3 py-2 text-xs text-text-muted">No branches found</div>;
                    }

                    return (
                      <>
                        {/* Local branches */}
                        {hasLocalResults && (
                          <>
                            <div className="px-3 py-1 text-[10px] font-medium text-text-muted bg-bg-secondary sticky top-0">
                              Local
                            </div>
                            {filteredLocalBranches.map((branch) => {
                              const isProtected = protectedBranches.includes(branch);
                              const isCurrent = branch === currentBranch;
                              return (
                                <button
                                  key={branch}
                                  onClick={() => handleCheckout(branch)}
                                  className={clsx(
                                    'w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-bg-hover transition-colors flex items-center justify-between',
                                    isCurrent && 'bg-bg-active',
                                    isProtected
                                      ? 'text-yellow-500'
                                      : isCurrent
                                        ? 'text-accent-primary'
                                        : 'text-text-primary'
                                  )}
                                >
                                  <span className="truncate">{branch}</span>
                                  {isCurrent && <span className="flex-shrink-0 ml-1">✓</span>}
                                </button>
                              );
                            })}
                          </>
                        )}
                        {/* Remote branches */}
                        {hasRemoteResults && (
                          <>
                            <div className="px-3 py-1 text-[10px] font-medium text-text-muted bg-bg-secondary sticky top-0">
                              Remote
                            </div>
                            {filteredRemoteBranches.map((branch) => {
                              const shortName = branch.replace(/^origin\//, '');
                              return (
                                <button
                                  key={branch}
                                  onClick={() => handleCheckout(shortName)}
                                  className="w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-bg-hover transition-colors flex items-center justify-between text-text-secondary"
                                >
                                  <span className="truncate">{branch}</span>
                                </button>
                              );
                            })}
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {/* Branch name */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-accent-primary" />
          <span className="text-sm font-medium text-text-primary">{currentBranch}</span>
          {(ahead > 0 || behind > 0) && (
            <span className="flex items-center gap-1 text-xs text-text-muted">
              {ahead > 0 && (
                <span className="flex items-center gap-0.5">
                  <ArrowUp className="w-3 h-3" />
                  {ahead}
                </span>
              )}
              {behind > 0 && (
                <span className="flex items-center gap-0.5">
                  <ArrowDown className="w-3 h-3" />
                  {behind}
                </span>
              )}
            </span>
          )}
        </div>
        <button
          onClick={handlePull}
          disabled={isPulling || isPushing}
          className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors disabled:opacity-50 flex items-center gap-1"
          title="Pull from remote"
        >
          <ArrowDown className={clsx('w-4 h-4', isPulling && 'animate-pulse')} />
          {behind > 0 && <span className="text-xs">{behind}</span>}
        </button>
      </div>

      <PanelGroup direction="vertical" autoSaveId="git-panel">
        {/* Main content */}
        <Panel id="git-changes" defaultSize={70} minSize={30}>
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-auto">
              {/* Staged Changes */}
              <div className="border-b border-border-primary">
                <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary">
                  <span className="text-xs font-medium text-text-secondary">
                    Staged ({stagedChanges.length})
                  </span>
                  {stagedChanges.length > 0 && (
                    <button
                      onClick={handleUnstageAll}
                      className="text-xs text-text-muted hover:text-text-primary"
                      title="Unstage all"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {stagedChanges.length > 0 ? (
                  <div className="divide-y divide-border-primary">
                    {stagedChanges.map((change) => (
                      <div
                        key={change.path}
                        className="flex items-center gap-2 px-4 py-1.5 hover:bg-bg-hover group"
                      >
                        <span className={clsx('font-mono text-xs flex-shrink-0', statusColors[change.status])}>
                          {statusIcons[change.status]}
                        </span>
                        <span className="flex-1 min-w-0 text-xs text-text-primary font-mono truncate" title={change.path}>
                          {change.path}
                        </span>
                        <button
                          onClick={() => handleUnstageFile(change.path)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-bg-active text-text-muted hover:text-text-primary transition-opacity flex-shrink-0"
                          title="Unstage"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-2 text-xs text-text-muted">No staged changes</div>
                )}
              </div>

              {/* Unstaged Changes */}
              <div className="border-b border-border-primary">
                <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary">
                  <span className="text-xs font-medium text-text-secondary">
                    Changes ({unstagedChanges.length})
                  </span>
                  {unstagedChanges.length > 0 && (
                    <button
                      onClick={handleStageAll}
                      className="text-xs text-text-muted hover:text-text-primary"
                      title="Stage all"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {unstagedChanges.length > 0 ? (
                  <div className="divide-y divide-border-primary">
                    {unstagedChanges.map((change) => (
                      <div
                        key={change.path}
                        className="flex items-center gap-2 px-4 py-1.5 hover:bg-bg-hover group"
                      >
                        <span className={clsx('font-mono text-xs flex-shrink-0', statusColors[change.status])}>
                          {statusIcons[change.status]}
                        </span>
                        <span className="flex-1 min-w-0 text-xs text-text-primary font-mono truncate" title={change.path}>
                          {change.path}
                        </span>
                        <button
                          onClick={() => handleStageFile(change.path)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-bg-active text-text-muted hover:text-text-primary transition-opacity flex-shrink-0"
                          title="Stage"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-2 text-xs text-text-muted">No changes</div>
                )}
              </div>
            </div>

            {/* Commit box */}
            <div className="border-t border-border-primary p-3 space-y-2">
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message..."
                className="w-full px-3 py-2 text-xs font-mono bg-bg-secondary border border-border-primary rounded resize-none focus:outline-none focus:border-accent-primary text-text-primary placeholder-text-muted"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleCommit();
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <button
                  onClick={handleAutoMessage}
                  disabled={isGeneratingMessage || stagedChanges.length === 0}
                  className="text-xs font-mono text-text-secondary hover:text-accent-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-text-secondary transition-colors"
                >
                  {isGeneratingMessage ? '[ generating... ]' : '[ auto message ]'}
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCommit}
                    disabled={isCommitting || stagedChanges.length === 0 || !commitMessage.trim()}
                    className="text-xs font-mono text-text-secondary hover:text-accent-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-text-secondary transition-colors"
                  >
                    {isCommitting ? '[ committing... ]' : `[ commit (${stagedChanges.length}) ]`}
                  </button>
                  <button
                    onClick={handlePush}
                    disabled={isPushing || isPulling}
                    className="text-xs font-mono text-text-secondary hover:text-accent-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-text-secondary transition-colors"
                  >
                    {isPushing ? '[ pushing... ]' : `[ push${ahead > 0 ? ` (${ahead})` : ''} ]`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="h-1 bg-border-primary hover:bg-accent-primary transition-colors" />

        {/* Output Log */}
        <Panel id="git-output" defaultSize={30} minSize={15}>
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-3 py-1.5 bg-bg-secondary border-b border-border-primary">
              <span className="text-xs font-medium text-text-muted flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                Output
              </span>
              {outputLog.length > 0 && (
                <button
                  onClick={clearOutput}
                  className="text-xs text-text-muted hover:text-text-primary"
                >
                  clear
                </button>
              )}
            </div>
            <div className="flex-1 overflow-auto p-2 bg-bg-primary">
              {outputLog.length > 0 ? (
                outputLog.map((log, i) => (
                  <div key={log.timestamp + i} className="mb-2 last:mb-0">
                    <span className="text-xs font-mono text-text-muted">$ {log.command}</span>
                    <pre className={clsx(
                      'text-xs font-mono whitespace-pre-wrap mt-0.5',
                      log.isError ? 'text-red-400' : 'text-text-secondary'
                    )}>
                      {parseAnsiOutput(log.output)}
                    </pre>
                  </div>
                ))
              ) : (
                <span className="text-xs text-text-muted">-- no output --</span>
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
