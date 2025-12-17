import React, { useEffect, useState, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ArrowUp, ArrowDown, Plus, Minus, ChevronDown, Search, Terminal } from 'lucide-react';
import { PixelGit } from '@/components/feature-sidebar/PixelIcons';
import { clsx } from 'clsx';
import { useGitStore, useProjectStore, useTestStore, useChatStore, useWorktreeStore } from '@/stores';
import { ReviewPanel } from './ReviewPanel';
import { ConfirmModal, Modal } from '@/components/ui';
import globeToFolderGif from '@/assets/globe-to-folder.gif';

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
  const { projectPath, setProjectPath } = useProjectStore();
  const { mode, setMode } = useTestStore();
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
    worktrees,
    isLoading,
    isFetching,
    lastFetchTime,
    isCommitting,
    isPushing,
    isPulling,
    isGeneratingMessage,
    isCreatingPR,
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
    createPR,
    fetchProtectedBranches,
    listWorktrees,
    generateCommitMessage,
    clearOutput,
    isReviewMode,
    setReviewMode,
  } = useGitStore();

  const [commitMessage, setCommitMessage] = useState('');
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [branchSearch, setBranchSearch] = useState('');
  const lastModeRef = useRef(mode);

  // Refresh when switching to git tab
  useEffect(() => {
    if (mode === 'git' && lastModeRef.current !== 'git' && projectPath) {
      refreshStatus(projectPath);
    }
    lastModeRef.current = mode;
  }, [mode, projectPath, refreshStatus]);
  const [showNewBranchInput, setShowNewBranchInput] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [prCommentCount, setPrCommentCount] = useState(0);
  const [isFixing, setIsFixing] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<{ inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costUsd: number; isClosed?: boolean } | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showPRModal, setShowPRModal] = useState(false);
  const [prTitle, setPrTitle] = useState('');
  const [prBaseBranch, setPrBaseBranch] = useState('');
  const [prDescription, setPrDescription] = useState('');
  const [isGeneratingPRDescription, setIsGeneratingPRDescription] = useState(false);
  const [showBaseBranchDropdown, setShowBaseBranchDropdown] = useState(false);
  const [baseBranchSearch, setBaseBranchSearch] = useState('');
  const baseBranchDropdownRef = useRef<HTMLDivElement>(null);
  const baseBranchSearchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const newBranchRef = useRef<HTMLDivElement>(null);
  const newBranchInputRef = useRef<HTMLInputElement>(null);

  const { addMessage, setLoading, setStreamingMessageId, finishStreaming, setCurrentActivity, setResultStatus } = useChatStore();

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
      if (baseBranchDropdownRef.current && !baseBranchDropdownRef.current.contains(event.target as Node)) {
        setShowBaseBranchDropdown(false);
        setBaseBranchSearch('');
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

  // Focus base branch search when dropdown opens
  useEffect(() => {
    if (showBaseBranchDropdown && baseBranchSearchRef.current) {
      baseBranchSearchRef.current.focus();
    }
  }, [showBaseBranchDropdown]);

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

  // Fetch PR comment count when branch changes
  useEffect(() => {
    const fetchPRComments = async () => {
      if (!projectPath) return;
      try {
        const result = await window.electron?.git.pr.comments(projectPath);
        if (result?.success && result.reviewComments) {
          setPrCommentCount(result.reviewComments.length);
        } else {
          setPrCommentCount(0);
        }
      } catch {
        setPrCommentCount(0);
      }
    };
    fetchPRComments();
  }, [projectPath, currentBranch]);

  // Load token usage for worktree sessions
  useEffect(() => {
    const loadTokenUsage = async () => {
      if (!projectPath) {
        setTokenUsage(null);
        return;
      }

      // First, check if this projectPath has an active worktree session
      const session = useWorktreeStore.getState().getSession(projectPath);
      if (session?.linearTicket?.identifier) {
        try {
          const result = await window.electron?.git.worktree.readTokenUsage(projectPath, session.linearTicket.identifier);
          if (result?.success && result.usage) {
            setTokenUsage(result.usage);
            return;
          }
        } catch {
          // Continue to fallback
        }
      }

      // Fallback: scan for existing token usage files (for after refresh)
      try {
        const result = await window.electron?.git.worktree.listTokenUsage(projectPath);
        if (result?.success && result.usages?.length > 0) {
          // Use the most recent usage (by lastUpdated)
          const sorted = result.usages.sort((a: { usage: { lastUpdated: number } }, b: { usage: { lastUpdated: number } }) => b.usage.lastUpdated - a.usage.lastUpdated);
          setTokenUsage(sorted[0].usage);
          return;
        }
      } catch {
        // Ignore errors
      }

      setTokenUsage(null);
    };
    loadTokenUsage();

    // Reload periodically to catch updates from Claude usage events
    const interval = setInterval(loadTokenUsage, 5000);
    return () => clearInterval(interval);
  }, [projectPath]);

  // Handle fix - send PR comments to Claude
  const handleFix = async () => {
    if (!projectPath || prCommentCount === 0) return;

    setIsFixing(true);
    setLoading(true);

    try {
      // Fetch the actual comments
      const result = await window.electron?.git.pr.comments(projectPath);
      if (!result?.success || !result.reviewComments?.length) {
        setIsFixing(false);
        setLoading(false);
        return;
      }

      // Build the prompt
      let prompt = `Please fix the following issues from PR comments:\n\n`;

      // Group by file
      const byFile = new Map<string, typeof result.reviewComments>();
      for (const comment of result.reviewComments) {
        if (!byFile.has(comment.path)) {
          byFile.set(comment.path, []);
        }
        byFile.get(comment.path)!.push(comment);
      }

      for (const [filePath, comments] of byFile) {
        prompt += `### ${filePath}\n`;
        for (const c of comments) {
          const lineInfo = c.line ? (c.startLine && c.startLine !== c.line ? `L${c.startLine}-${c.line}` : `L${c.line}`) : '';
          // Strip HTML tags and clean up the comment body
          const cleanBody = c.body
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/```suggestion[\s\S]*?```/g, '') // Remove suggestion blocks
            .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
            .replace(/\n{3,}/g, '\n\n') // Collapse multiple newlines
            .trim();
          if (cleanBody) {
            prompt += `- ${lineInfo ? `(${lineInfo}) ` : ''}[@${c.user}] ${cleanBody}\n`;
          }
        }
        prompt += '\n';
      }

      prompt += `\nPlease address each comment and make the necessary code changes.`;

      // Add user message to chat
      addMessage({
        role: 'user',
        content: prompt,
      });

      // Create placeholder for assistant response
      const assistantMessageId = addMessage({
        role: 'assistant',
        content: '',
        isStreaming: true,
      });
      setStreamingMessageId(assistantMessageId);

      // Switch to home mode to see the chat
      setMode('home');

      // Send to Claude
      const claudeResult = await window.electron?.claude.send(prompt, {}, projectPath);

      if (claudeResult?.success) {
        finishStreaming(assistantMessageId);
        setCurrentActivity(null);
        setResultStatus('ok');
        setTimeout(() => setResultStatus(null), 2500);
      } else {
        // Show error in the assistant message
        const errorMsg = claudeResult?.error || 'Failed to get response from Claude';
        useChatStore.getState().updateMessage(assistantMessageId, `Error: ${errorMsg}`);
        finishStreaming(assistantMessageId);
        setResultStatus('error');
        setTimeout(() => setResultStatus(null), 2500);
      }
    } catch (err) {
      console.error('Fix failed:', err);
      setResultStatus('error');
    } finally {
      setIsFixing(false);
      setLoading(false);
    }
  };

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

  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestoreAll = async () => {
    if (!projectPath) return;
    setShowDiscardConfirm(true);
  };

  const confirmRestoreAll = async () => {
    if (!projectPath) return;

    setIsRestoring(true);
    try {
      const result = await window.electron?.git.restore(projectPath);
      if (result?.success) {
        // Refresh status
        refreshStatus(projectPath);
      }
    } catch (err) {
      console.error('Failed to restore:', err);
    }
    setIsRestoring(false);
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
      // Check if a worktree exists for this branch
      const worktreeForBranch = worktrees.find(wt => wt.branch === branchName);

      if (worktreeForBranch && worktreeForBranch.path !== projectPath) {
        // Switch to the worktree directory instead of checking out
        setProjectPath(worktreeForBranch.path);
      } else {
        // No worktree for this branch, do regular checkout
        await checkout(projectPath, branchName);
      }

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

  const handleCreatePR = async () => {
    if (!currentBranch || !projectPath) return;

    // Fetch protected branches first
    await fetchProtectedBranches(projectPath);

    // Pre-fill title with branch name (convert dashes to spaces, capitalize first letter)
    const title = currentBranch.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
    setPrTitle(title);

    // Get the repo's default branch (what GitHub uses for PRs)
    let defaultBase = 'main';
    try {
      const result = await window.electron?.git.defaultBranch(projectPath);
      if (result?.success && result.branch) {
        defaultBase = result.branch;
      }
    } catch {
      // Fallback to develop > main > master
      const commonBaseBranches = ['develop', 'main', 'master'];
      defaultBase = branches.find(b => commonBaseBranches.includes(b)) || 'main';
    }

    setPrBaseBranch(defaultBase);
    setPrDescription('');
    setShowBaseBranchDropdown(false);
    setBaseBranchSearch('');

    setShowPRModal(true);
    setIsGeneratingPRDescription(true);

    try {
      // Check for PR template
      let template = '';
      const templatePaths = [
        `${projectPath}/.github/PULL_REQUEST_TEMPLATE.md`,
        `${projectPath}/.github/pull_request_template.md`,
        `${projectPath}/PULL_REQUEST_TEMPLATE.md`,
        `${projectPath}/pull_request_template.md`,
      ];

      for (const templatePath of templatePaths) {
        const result = await window.electron?.readFile(templatePath);
        if (result?.success && result.content) {
          template = result.content;
          break;
        }
      }

      // Get the diff files list against the base branch
      const diffFilesResult = await window.electron?.git.diffFiles(projectPath, defaultBase);
      const changedFiles = diffFilesResult?.success && diffFilesResult.files
        ? diffFilesResult.files.map(f => `${f.status} ${f.path}`).join('\n')
        : '';

      // Get actual diff content (truncated for prompt)
      const diffResult = await window.electron?.git.diff(projectPath, false, defaultBase);
      const diff = diffResult?.success && diffResult.diff
        ? (diffResult.diff.length > 4000 ? diffResult.diff.substring(0, 4000) + '\n... (truncated)' : diffResult.diff)
        : '';

      // Generate title and description using Claude with clear instructions
      const prompt = template
        ? `You are generating a PR title and description. Fill out this template based on the changes below. DO NOT use any tools. Just analyze and respond.

PR Template:
${template}

Changed files:
${changedFiles}

Diff preview:
${diff}

Respond in this exact format:
TITLE: <concise PR title, max 72 chars>
DESCRIPTION:
<filled template>`
        : `You are generating a PR title and description. DO NOT use any tools. Just analyze the changes.

Changed files:
${changedFiles}

Diff preview:
${diff}

Respond in this exact format:
TITLE: <concise PR title, max 72 chars>
DESCRIPTION:
<brief summary (2-3 sentences) followed by key changes as bullet points>`;

      const result = await window.electron?.claude.send(prompt, {}, projectPath);
      if (result?.success && result.response) {
        let response = result.response.trim();
        // Clean up any markdown code blocks or JSON artifacts
        response = response.replace(/^```\w*\n?|\n?```$/g, '');
        response = response.replace(/^\s*\{[\s\S]*"type"[\s\S]*\}\s*$/gm, '');
        response = response.replace(/^\s*\[[\s\S]*"tool_use"[\s\S]*\]\s*$/gm, '');

        // Parse title and description
        const titleMatch = response.match(/^TITLE:\s*(.+?)(?:\n|$)/im);
        const descMatch = response.match(/DESCRIPTION:\s*([\s\S]*)/im);

        if (titleMatch && titleMatch[1]) {
          setPrTitle(titleMatch[1].trim());
        }
        if (descMatch && descMatch[1]) {
          setPrDescription(descMatch[1].trim());
        } else {
          // Fallback: use entire response as description
          setPrDescription(response.trim());
        }
      }
    } catch (err) {
      console.error('Failed to generate PR description:', err);
    } finally {
      setIsGeneratingPRDescription(false);
    }
  };

  const handleSubmitPR = async () => {
    if (!projectPath || !prTitle.trim() || !prBaseBranch) return;

    // Clean up base branch - remove any remote prefixes
    const cleanBaseBranch = prBaseBranch
      .replace(/^remotes\/origin\//, '')
      .replace(/^remotes\//, '')
      .replace(/^origin\//, '');

    const url = await createPR(projectPath, {
      title: prTitle.trim(),
      body: prDescription,
      base: cleanBaseBranch,
    });

    setShowPRModal(false);
    setPrTitle('');
    setPrBaseBranch('');
    setPrDescription('');
    setShowBaseBranchDropdown(false);
    setBaseBranchSearch('');

    if (url) {
      // Open the PR in browser
      window.electron?.openExternal?.(url);
    }
  };

  if (!projectPath) {
    return (
      <div className="flex flex-col h-full bg-bg-primary">
        <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
          <PixelGit className="w-8 h-8" />
          <span className="text-sm">-- no project open --</span>
        </div>
      </div>
    );
  }

  if (isLoading && !isRepo) {
    return (
      <div className="flex flex-col h-full bg-bg-primary">
        <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
          <PixelGit className="w-8 h-8" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isRepo) {
    return (
      <div className="flex flex-col h-full bg-bg-primary">
        <div className="flex flex-col items-center justify-center h-full gap-3 text-text-muted">
          <PixelGit className="w-8 h-8" />
          <span className="text-sm">-- not a git repository --</span>
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
      {/* Discard changes confirmation modal */}
      <ConfirmModal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={confirmRestoreAll}
        title="Discard Changes"
        message="This will restore all modified files and remove untracked files. This action cannot be undone."
        confirmText="Discard"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Create PR modal */}
      <Modal
        isOpen={showPRModal}
        onClose={() => setShowPRModal(false)}
        title="Create Pull Request"
        className="w-[600px]"
      >
        <div className="p-4 space-y-4">
          {/* Title input */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">
              Title
              {isGeneratingPRDescription && (
                <span className="ml-2 text-accent-primary animate-pulse">generating...</span>
              )}
            </label>
            <input
              type="text"
              value={prTitle}
              onChange={(e) => setPrTitle(e.target.value)}
              placeholder={isGeneratingPRDescription ? 'Generating title...' : 'PR title...'}
              disabled={isGeneratingPRDescription}
              className="w-full px-3 py-2 text-sm font-mono bg-bg-primary border border-border-primary rounded focus:outline-none focus:border-accent-primary text-text-primary placeholder-text-muted disabled:opacity-50"
              autoFocus
            />
          </div>

          {/* Base branch selector */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Base branch</label>
            <div className="relative" ref={baseBranchDropdownRef}>
              {(() => {
                const commonBaseBranches = ['develop', 'main', 'master', 'dev', 'staging'];
                const baseBranches = protectedBranches.length > 0
                  ? protectedBranches
                  : branches.filter(b => commonBaseBranches.includes(b));
                const isBaseBranch = baseBranches.includes(prBaseBranch);
                return (
                  <button
                    type="button"
                    onClick={() => setShowBaseBranchDropdown(!showBaseBranchDropdown)}
                    className={clsx(
                      'w-full px-3 py-2 text-sm font-mono bg-bg-primary border border-border-primary rounded text-left flex items-center justify-between',
                      'hover:border-border-secondary focus:outline-none focus:border-accent-primary',
                      isBaseBranch ? 'text-yellow-500' : 'text-text-primary'
                    )}
                  >
                    <span>{prBaseBranch || 'Select branch...'}</span>
                    <ChevronDown className="w-3 h-3 text-text-muted" />
                  </button>
                );
              })()}
              {showBaseBranchDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-bg-secondary border border-border-primary rounded shadow-lg z-50">
                  {/* Search input */}
                  <div className="p-2 border-b border-border-primary">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
                      <input
                        ref={baseBranchSearchRef}
                        type="text"
                        value={baseBranchSearch}
                        onChange={(e) => setBaseBranchSearch(e.target.value)}
                        placeholder="Search branches..."
                        className="w-full pl-7 pr-2 py-1 text-xs font-mono bg-bg-primary border border-border-primary rounded focus:outline-none focus:border-accent-primary text-text-primary placeholder-text-muted"
                      />
                    </div>
                  </div>
                  {/* Branch list */}
                  <div className="max-h-[200px] overflow-y-auto">
                    {(() => {
                      // Use protected branches or fallback to common base branches
                      const commonBaseBranches = ['develop', 'main', 'master', 'dev', 'staging'];
                      const baseBranches = protectedBranches.length > 0
                        ? protectedBranches
                        : branches.filter(b => commonBaseBranches.includes(b));

                      // Get all branches except current, with base branches first
                      const allBranches = branches
                        .filter((b) => b !== currentBranch && b.toLowerCase().includes(baseBranchSearch.toLowerCase()))
                        .sort((a, b) => {
                          const aBase = baseBranches.includes(a);
                          const bBase = baseBranches.includes(b);
                          if (aBase && !bBase) return -1;
                          if (!aBase && bBase) return 1;
                          // Within base branches, sort by common order
                          if (aBase && bBase) {
                            return commonBaseBranches.indexOf(a) - commonBaseBranches.indexOf(b);
                          }
                          return a.localeCompare(b);
                        });

                      if (allBranches.length === 0) {
                        return <div className="px-3 py-2 text-xs text-text-muted">No branches found</div>;
                      }

                      return allBranches.map((branch) => {
                        const isBaseBranch = baseBranches.includes(branch);
                        const isSelected = branch === prBaseBranch;
                        return (
                          <button
                            key={branch}
                            type="button"
                            onClick={() => {
                              setPrBaseBranch(branch);
                              setShowBaseBranchDropdown(false);
                              setBaseBranchSearch('');
                            }}
                            className={clsx(
                              'w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-bg-hover transition-colors flex items-center justify-between',
                              isSelected && 'bg-bg-active',
                              isBaseBranch ? 'text-yellow-500' : 'text-text-primary'
                            )}
                          >
                            <span className="truncate">{branch}</span>
                            {isSelected && <span className="flex-shrink-0 ml-1">✓</span>}
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description textarea */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">
              Description
              {isGeneratingPRDescription && (
                <span className="ml-2 text-accent-primary animate-pulse">generating...</span>
              )}
            </label>
            <textarea
              value={prDescription}
              onChange={(e) => setPrDescription(e.target.value)}
              placeholder={isGeneratingPRDescription ? 'Generating description...' : 'PR description...'}
              disabled={isGeneratingPRDescription}
              className="w-full px-3 py-2 text-sm font-mono bg-bg-primary border border-border-primary rounded focus:outline-none focus:border-accent-primary text-text-primary placeholder-text-muted resize-none disabled:opacity-50"
              rows={10}
            />
          </div>

          {/* Info text */}
          <p className="text-xs text-text-muted">
            Creating PR from <span className="text-accent-primary font-mono">{currentBranch}</span> into <span className="text-accent-primary font-mono">{prBaseBranch}</span>
          </p>

          {/* Actions */}
          <div className="flex justify-end gap-4 pt-2">
            <button
              onClick={() => setShowPRModal(false)}
              className="text-xs font-mono text-text-secondary hover:text-text-primary transition-colors"
            >
              [ cancel ]
            </button>
            <button
              onClick={handleSubmitPR}
              disabled={isCreatingPR || isGeneratingPRDescription || !prTitle.trim() || !prBaseBranch}
              className="text-xs font-mono text-text-secondary hover:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-text-secondary transition-colors"
            >
              {isCreatingPR ? '[ creating... ]' : '[ create pr ]'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Fetching modal - Windows 98 style */}
      {isFetching && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080] shadow-xl" style={{ imageRendering: 'pixelated' }}>
            {/* Title bar */}
            <div className="bg-[#000080] px-2 py-1 flex items-center justify-between gap-8">
              <span className="text-white text-xs font-bold" style={{ fontFamily: 'MS Sans Serif, Arial, sans-serif' }}>Fetching</span>
              <button
                onClick={() => setIsFetching(false)}
                className="bg-[#c0c0c0] border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080] w-4 h-4 flex items-center justify-center text-xs font-bold hover:bg-[#d4d4d4] active:border-t-[#808080] active:border-l-[#808080] active:border-b-white active:border-r-white"
              >
                ×
              </button>
            </div>
            {/* Content */}
            <div className="p-5 pb-4">
              {/* Animation - Windows shell32 globe to folder */}
              <div className="flex justify-center mb-4">
                <img
                  src={globeToFolderGif}
                  alt="Downloading from remote"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>

              {/* Status text */}
              <div className="text-[11px] text-black mb-3" style={{ fontFamily: 'MS Sans Serif, Tahoma, sans-serif' }}>
                Fetching from remote...
              </div>

              {/* Progress bar - chunky Win98 style with blocks */}
              {/* 14 blocks × 17px + 13 gaps × 2px = 264px content */}
              <div
                className="bg-white border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white overflow-hidden"
                style={{ width: '272px', height: '20px', padding: '2px' }}
              >
                <div className="h-full flex gap-[2px]">
                  {[...Array(14)].map((_, i) => (
                    <div
                      key={i}
                      className="h-full bg-[#000080]"
                      style={{
                        width: '17px',
                        flexShrink: 0,
                        animation: `blockFill${i} 5s steps(1) infinite`,
                        opacity: 0,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        ${[...Array(14)].map((_, i) => {
          const onStart = (i * 5); // Each block turns on 5% later
          const offStart = 85; // All blocks turn off at 85%
          return `
            @keyframes blockFill${i} {
              0%, ${onStart}% { opacity: 0; }
              ${onStart + 1}%, ${offStart}% { opacity: 1; }
              ${offStart + 1}%, 100% { opacity: 0; }
            }
          `;
        }).join('')}
      `}</style>

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
            {/* Fix button - shown when there are PR comments */}
            {prCommentCount > 0 && (
              <button
                onClick={handleFix}
                disabled={isFixing}
                className="text-xs font-mono text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-50"
                title={`Fix ${prCommentCount} PR comment${prCommentCount !== 1 ? 's' : ''}`}
              >
                {isFixing ? '[ fixing... ]' : `[ fix (${prCommentCount}) ]`}
              </button>
            )}
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
                // Fetch protected branches and worktrees when opening dropdown
                if (newState && projectPath) {
                  fetchProtectedBranches(projectPath);
                  listWorktrees(projectPath);
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
                    // Use protected branches or fallback to common base branches
                    const commonBaseBranches = ['develop', 'main', 'master', 'dev', 'staging'];
                    const highlightedBranches = protectedBranches.length > 0
                      ? protectedBranches
                      : branches.filter(b => commonBaseBranches.includes(b));

                    const filteredLocalBranches = branches
                      .filter((branch) => branch.toLowerCase().includes(branchSearch.toLowerCase()))
                      .sort((a, b) => {
                        const aHighlighted = highlightedBranches.includes(a);
                        const bHighlighted = highlightedBranches.includes(b);
                        if (aHighlighted && !bHighlighted) return -1;
                        if (!aHighlighted && bHighlighted) return 1;
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
                              const isHighlighted = highlightedBranches.includes(branch);
                              const isCurrent = branch === currentBranch;
                              return (
                                <button
                                  key={branch}
                                  onClick={() => handleCheckout(branch)}
                                  className={clsx(
                                    'w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-bg-hover transition-colors flex items-center justify-between',
                                    isCurrent && 'bg-bg-active',
                                    isHighlighted
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
          <PixelGit className="w-4 h-4 text-accent-primary" />
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
          {tokenUsage && tokenUsage.costUsd > 0 && (
            <span
              className={clsx(
                'text-xs font-mono px-1.5 py-0.5 rounded',
                tokenUsage.isClosed
                  ? 'bg-text-muted/10 text-text-muted'
                  : 'bg-accent-primary/10 text-accent-primary'
              )}
              title={`Input: ${tokenUsage.inputTokens.toLocaleString()} | Output: ${tokenUsage.outputTokens.toLocaleString()} | Cache Read: ${tokenUsage.cacheReadTokens.toLocaleString()} | Cache Write: ${tokenUsage.cacheWriteTokens.toLocaleString()}${tokenUsage.isClosed ? ' (closed)' : ''}`}
            >
              ${tokenUsage.costUsd.toFixed(2)}
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
                  <div className="flex items-center gap-1">
                    {unstagedChanges.length > 0 && (
                      <>
                        <button
                          onClick={handleRestoreAll}
                          disabled={isRestoring}
                          className="text-xs text-text-muted hover:text-yellow-400 disabled:opacity-50"
                          title="Discard all changes"
                        >
                          <Minus className={`w-3 h-3 ${isRestoring ? 'animate-pulse' : ''}`} />
                        </button>
                        <button
                          onClick={handleStageAll}
                          className="text-xs text-text-muted hover:text-text-primary"
                          title="Stage all"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
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
                  {currentBranch && remoteBranches.includes(`origin/${currentBranch}`) && (
                    <button
                      onClick={handleCreatePR}
                      disabled={isCreatingPR}
                      className="text-xs font-mono text-text-secondary hover:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-text-secondary transition-colors"
                    >
                      {isCreatingPR ? '[ creating... ]' : '[ create pr ]'}
                    </button>
                  )}
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
