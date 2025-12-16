import React, { useEffect, useState, useRef, useMemo } from 'react';
import { X, Check, XIcon, ChevronRight, ChevronLeft, FileCode, AlertCircle, AlertTriangle, Info, CheckCircle, MessageSquare, User, Bot, GitBranch, Play, Clock, RefreshCw, Search, Trash2, Wrench } from 'lucide-react';
import { useSkillsStore, useRulesStore, useChatStore } from '@/stores';
import { useProjectStore } from '@/stores/projectStore';

interface ReviewPanelProps {
  projectPath: string;
  branch: string;
  onClose: () => void;
}

interface LogEntry {
  type: 'init' | 'info' | 'success' | 'error' | 'warning' | 'file' | 'issue' | 'highlight' | 'summary' | 'fileStatus';
  message: string;
  timestamp: number;
  indent?: number;
  fileStatus?: 'added' | 'deleted' | 'modified' | 'renamed';
}

interface ReviewComment {
  id: string;
  type: 'issue' | 'highlight' | 'user';
  severity?: 'error' | 'warning' | 'suggestion';
  startLine: number | null;
  endLine: number | null;
  message: string;
  rule?: string;
  suggestedFix?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  author: 'claude' | 'user';
}

interface FileReviewData {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  content: string;
  diff: string;
  comments: ReviewComment[];
  summary: string;
  verdict?: 'approve' | 'concern' | 'block';
}

interface DiffLine {
  type: 'context' | 'addition' | 'deletion' | 'header';
  content: string;
  oldLineNum: number | null;
  newLineNum: number | null;
}

interface SavedReview {
  index: number;
  branch: string;
  baseBranch: string;
  timestamp: number;
  reviewData: FileReviewData[];
}

interface SavedReviewsStore {
  reviews: SavedReview[];
}

type ViewMode = 'setup' | 'reviewing' | 'generating' | 'report';

// Steps per file: load, analyze, process
const STEPS_PER_FILE = 3;

// Parse unified diff into lines with line numbers
function parseDiff(diff: string): DiffLine[] {
  const lines = diff.split('\n');
  const result: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Parse hunk header @@ -old,count +new,count @@
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      result.push({ type: 'header', content: line, oldLineNum: null, newLineNum: null });
    } else if (line.startsWith('---') || line.startsWith('+++')) {
      // Skip file headers
      continue;
    } else if (line.startsWith('-')) {
      result.push({ type: 'deletion', content: line.slice(1), oldLineNum: oldLine, newLineNum: null });
      oldLine++;
    } else if (line.startsWith('+')) {
      result.push({ type: 'addition', content: line.slice(1), oldLineNum: null, newLineNum: newLine });
      newLine++;
    } else if (line.startsWith(' ') || line === '') {
      result.push({ type: 'context', content: line.slice(1) || '', oldLineNum: oldLine, newLineNum: newLine });
      oldLine++;
      newLine++;
    }
  }

  return result;
}

export function ReviewPanel({ projectPath, branch, onClose }: ReviewPanelProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('setup');
  const [filesReviewed, setFilesReviewed] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentStepLabel, setCurrentStepLabel] = useState('initializing');
  const [reviewData, setReviewData] = useState<FileReviewData[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [lineSelection, setLineSelection] = useState<{ startLine: number; endLine: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [selectedBaseBranch, setSelectedBaseBranch] = useState<string>('');
  const [baseBranchUsed, setBaseBranchUsed] = useState<string>('');
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [savedReviews, setSavedReviews] = useState<SavedReview[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState<number | null>(null);
  const [loadingSavedReview, setLoadingSavedReview] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ batch: number; total: number; status: 'pending' | 'sending' | 'success' | 'failed' | 'rolling-back' }[]>([]);
  const [showBatchProgress, setShowBatchProgress] = useState(false);
  const [hasOpenPR, setHasOpenPR] = useState(false);
  const [showCreatePRModal, setShowCreatePRModal] = useState(false);
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [prBaseBranch, setPrBaseBranch] = useState('');
  const [prTemplate, setPrTemplate] = useState<string | null>(null);
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [createPRError, setCreatePRError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchMatches, setSearchMatches] = useState<{ fileIndex: number; lineIndex: number }[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [existingPRComments, setExistingPRComments] = useState<Array<{ path: string; line: number; startLine?: number; body: string; user: string }>>([]);
  const [loadingPRComments, setLoadingPRComments] = useState(true);
  const [applyingFix, setApplyingFix] = useState<string | null>(null); // comment ID being fixed
  const searchInputRef = useRef<HTMLInputElement>(null);
  const diffRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  // Storage key for saved reviews - based on project path and branch
  // Sanitize the key to avoid invalid file paths (colons/slashes aren't valid in filenames)
  const sanitizedProjectPath = projectPath.replace(/[/:]/g, '_');
  const sanitizedBranch = branch.replace(/[/:]/g, '_');
  const reviewStorageKey = `review_${sanitizedProjectPath}_${sanitizedBranch}`;

  const { getActiveSkills, projectDescription } = useSkillsStore();
  const { getActiveRulesByServerity } = useRulesStore();
  const { addMessage, setLoading, setStreamingMessageId, finishStreaming, setCurrentActivity, setResultStatus } = useChatStore();
  const { setMode } = useProjectStore();

  // Load available branches and PR comments on mount
  useEffect(() => {
    const loadBranches = async () => {
      const branchResult = await window.electron?.git.branch(projectPath);
      if (branchResult?.success) {
        // Combine local and remote branches, filter out current branch
        const allBranches = [...branchResult.all, ...branchResult.remotes]
          .filter(b => b !== branchResult.current && !b.startsWith('origin/HEAD'));
        setAvailableBranches(allBranches);

        // Auto-select a sensible default (main, master, or develop)
        const defaultBranch = allBranches.find(b =>
          b === 'main' || b === 'origin/main' ||
          b === 'master' || b === 'origin/master' ||
          b === 'develop' || b === 'origin/develop'
        ) || allBranches[0] || '';
        setSelectedBaseBranch(defaultBranch);
      }
    };

    const loadPRComments = async () => {
      setLoadingPRComments(true);
      try {
        const result = await window.electron?.git.pr.comments(projectPath);
        if (result?.success && result.reviewComments) {
          setExistingPRComments(result.reviewComments.map(c => ({
            path: c.path,
            line: c.line,
            startLine: c.startLine,
            body: c.body,
            user: c.user,
          })));
          setHasOpenPR(true);
        } else {
          setExistingPRComments([]);
        }
      } catch {
        setExistingPRComments([]);
      } finally {
        setLoadingPRComments(false);
      }
    };

    loadBranches();
    loadPRComments();
  }, [projectPath]);

  // Handle Cmd+F / Ctrl+F for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
        setSearchMatches([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  // Find matches when search query changes
  useEffect(() => {
    if (!searchQuery.trim() || reviewData.length === 0) {
      setSearchMatches([]);
      setCurrentMatchIndex(0);
      return;
    }

    const query = searchQuery.toLowerCase();
    const matches: { fileIndex: number; lineIndex: number }[] = [];

    reviewData.forEach((file, fileIndex) => {
      const lines = parseDiff(file.diff);
      lines.forEach((line, lineIndex) => {
        if (line.content.toLowerCase().includes(query)) {
          matches.push({ fileIndex, lineIndex });
        }
      });
    });

    setSearchMatches(matches);
    setCurrentMatchIndex(0);

    // Navigate to first match
    if (matches.length > 0) {
      setSelectedFileIndex(matches[0].fileIndex);
    }
  }, [searchQuery, reviewData]);

  // Navigate to current match
  const navigateToMatch = (index: number) => {
    if (searchMatches.length === 0) return;
    const match = searchMatches[index];
    setSelectedFileIndex(match.fileIndex);
    // Scroll to the line
    setTimeout(() => {
      const lineEl = diffRef.current?.querySelector(`[data-line-index="${match.lineIndex}"]`);
      lineEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleSearchNext = () => {
    if (searchMatches.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIndex);
    navigateToMatch(nextIndex);
  };

  const handleSearchPrev = () => {
    if (searchMatches.length === 0) return;
    const prevIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIndex);
    navigateToMatch(prevIndex);
  };

  // Open PR creation modal
  const openCreatePRModal = async () => {
    setShowCreatePRModal(true);
    setCreatePRError(null);

    // Auto-generate title from branch name
    const branchTitle = branch
      .replace(/[-_]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^\w/, c => c.toUpperCase());
    setPrTitle(branchTitle);

    // Get default branch and strip remote prefixes
    const defaultBranchResult = await window.electron?.git.defaultBranch(projectPath);
    if (defaultBranchResult?.branch) {
      const cleanBranch = defaultBranchResult.branch
        .replace(/^origin\//, '')
        .replace(/^remotes\/origin\//, '')
        .replace(/^remotes\//, '');
      setPrBaseBranch(cleanBranch);
    }

    // Generate description from review summary
    const summary = generatePRDescription();

    // Load PR template
    const templateResult = await window.electron?.git.pr.template(projectPath);
    if (templateResult?.template) {
      setPrTemplate(templateResult.template);
      // Fill in template sections intelligently
      let filledTemplate = templateResult.template;

      // Find and fill the Description section
      // Look for <!-- comment --> after ## Description and replace it, or insert after the header
      const descriptionMatch = filledTemplate.match(/(## Description\s*\n)(<!--[\s\S]*?-->)?(\s*\n)?/i);
      if (descriptionMatch) {
        const [fullMatch, header] = descriptionMatch;
        filledTemplate = filledTemplate.replace(fullMatch, `${header}\n${summary}\n\n`);
      } else {
        // No Description section found, prepend our summary
        filledTemplate = summary + '\n\n---\n\n' + filledTemplate;
      }

      // Try to auto-check Type of Change based on branch name
      const branchLower = branch.toLowerCase();
      if (branchLower.includes('fix') || branchLower.includes('bug')) {
        filledTemplate = filledTemplate.replace('- [ ] Bug fix', '- [x] Bug fix');
      } else if (branchLower.includes('feat') || branchLower.includes('add')) {
        filledTemplate = filledTemplate.replace('- [ ] New feature', '- [x] New feature');
      } else if (branchLower.includes('refactor')) {
        filledTemplate = filledTemplate.replace('- [ ] Code refactor', '- [x] Code refactor');
      } else if (branchLower.includes('doc')) {
        filledTemplate = filledTemplate.replace('- [ ] Documentation update', '- [x] Documentation update');
      } else if (branchLower.includes('perf')) {
        filledTemplate = filledTemplate.replace('- [ ] Performance improvement', '- [x] Performance improvement');
      }

      setPrBody(filledTemplate);
    } else {
      setPrBody(summary);
    }
  };

  // Generate PR description from review data
  const generatePRDescription = () => {
    if (reviewData.length === 0) return '';

    let description = '## Changes\n\n';
    description += `This PR includes changes to ${reviewData.length} file(s):\n\n`;

    reviewData.forEach(file => {
      const icon = file.status === 'added' ? '➕' : file.status === 'deleted' ? '🗑️' : '✏️';
      description += `- ${icon} \`${file.path}\``;
      if (file.summary) {
        description += `: ${file.summary}`;
      }
      description += '\n';
    });

    const allComments = reviewData.flatMap(f => f.comments);
    const issues = allComments.filter(c => c.type === 'issue');
    const highlights = allComments.filter(c => c.type === 'highlight');

    if (issues.length > 0 || highlights.length > 0) {
      description += '\n## Review Notes\n\n';
      if (highlights.length > 0) {
        description += `✅ ${highlights.length} highlight(s)\n`;
      }
      if (issues.length > 0) {
        const errors = issues.filter(c => c.severity === 'error').length;
        const warnings = issues.filter(c => c.severity === 'warning').length;
        const suggestions = issues.filter(c => c.severity === 'suggestion').length;
        if (errors > 0) description += `❌ ${errors} error(s)\n`;
        if (warnings > 0) description += `⚠️ ${warnings} warning(s)\n`;
        if (suggestions > 0) description += `💡 ${suggestions} suggestion(s)\n`;
      }
    }

    return description;
  };

  // Handle push and create PR
  const handleCreatePR = async () => {
    if (!prTitle.trim() || !prBaseBranch.trim()) return;

    setIsCreatingPR(true);
    setCreatePRError(null);

    try {
      // First push the branch
      setIsPushing(true);
      const pushResult = await window.electron?.git.push(projectPath, branch);
      setIsPushing(false);

      if (!pushResult?.success) {
        setCreatePRError(pushResult?.error || 'Failed to push branch');
        setIsCreatingPR(false);
        return;
      }

      // Create the PR - strip remote prefixes from base branch
      const cleanBaseBranch = prBaseBranch
        .replace(/^origin\//, '')
        .replace(/^remotes\/origin\//, '')
        .replace(/^remotes\//, '');

      const prResult = await window.electron?.git.pr.create(projectPath, {
        title: prTitle,
        body: prBody,
        base: cleanBaseBranch,
      });

      if (prResult?.success && prResult.url) {
        // PR created successfully
        setHasOpenPR(true);
        setShowCreatePRModal(false);
        // Open PR in browser
        window.electron?.openExternal(prResult.url);
      } else {
        setCreatePRError(prResult?.error || 'Failed to create PR');
      }
    } catch (err) {
      setCreatePRError(err instanceof Error ? err.message : 'Failed to create PR');
    } finally {
      setIsCreatingPR(false);
      setIsPushing(false);
    }
  };

  // Scroll to a specific line range in the diff view
  const scrollToLine = (startLine: number | null, endLine?: number | null) => {
    if (startLine === null) return;
    const end = endLine ?? startLine;
    setTimeout(() => {
      const container = diffRef.current;
      if (!container) return;

      // Find all lines in the range
      const linesToHighlight: Element[] = [];
      for (let line = startLine; line <= end; line++) {
        const lineEl = container.querySelector(`[data-line="${line}"]`);
        if (lineEl) linesToHighlight.push(lineEl);
      }

      if (linesToHighlight.length === 0) return;

      // Scroll to the first line
      linesToHighlight[0].scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Clear previous highlights
      container.querySelectorAll('[data-highlighted="true"]').forEach((el) => {
        (el as HTMLElement).style.backgroundColor = '';
        el.removeAttribute('data-highlighted');
      });

      // Highlight all lines with background
      linesToHighlight.forEach((el) => {
        (el as HTMLElement).style.backgroundColor = 'rgba(139, 92, 246, 0.3)';
        el.setAttribute('data-highlighted', 'true');
      });
    }, 100);
  };

  // Load saved reviews on mount - auto-load most recent and go to report if exists
  useEffect(() => {
    const loadSavedReviews = async () => {
      setLoadingSavedReview(true);
      console.log('[ReviewPanel] Loading saved reviews for key:', reviewStorageKey);
      try {
        if (!window.electron?.store) {
          console.error('[ReviewPanel] Store API not available');
          setLoadingSavedReview(false);
          return;
        }
        const result = await window.electron.store.get<SavedReviewsStore>(reviewStorageKey);
        console.log('[ReviewPanel] Store get result:', result);
        if (result?.success && result.data && result.data.reviews && result.data.reviews.length > 0) {
          console.log('[ReviewPanel] Found saved reviews, loading latest...');
          const reviews = result.data.reviews;
          setSavedReviews(reviews);
          // Auto-load the most recent review (highest index)
          const latestReview = reviews[reviews.length - 1];
          setCurrentReviewIndex(latestReview.index);
          setReviewData(latestReview.reviewData);
          setBaseBranchUsed(latestReview.baseBranch);
          setViewMode('report');
        } else {
          console.log('[ReviewPanel] No saved reviews found or load failed');
        }
      } catch (e) {
        console.error('[ReviewPanel] Failed to load saved reviews:', e);
      } finally {
        setLoadingSavedReview(false);
      }
    };
    loadSavedReviews();
  }, [reviewStorageKey]);

  // Calculate detailed progress percentage
  const getProgress = () => {
    if (totalFiles === 0) return 0;
    const completedSteps = filesReviewed * STEPS_PER_FILE + currentStep;
    const totalSteps = totalFiles * STEPS_PER_FILE;
    return Math.round((completedSteps / totalSteps) * 100);
  };

  // Generate ASCII progress bar
  const getAsciiBar = (width = 20) => {
    const progress = getProgress();
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  };

  const addLog = (type: LogEntry['type'], message: string, indent = 0, fileStatus?: LogEntry['fileStatus']) => {
    setLogs(prev => [...prev, { type, message, timestamp: Date.now(), indent, fileStatus }]);
  };

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Listen for batch progress events
  useEffect(() => {
    const unsubscribe = window.electron?.git.pr.onReviewProgress((progress) => {
      setBatchProgress(prev => {
        // Initialize array if first progress event
        if (prev.length === 0 || prev.length !== progress.total) {
          // Create array with all pending
          const initial = Array.from({ length: progress.total }, (_, i) => ({
            batch: i + 1,
            total: progress.total,
            status: 'pending' as const
          }));
          // Update the current batch
          initial[progress.batch - 1] = progress;
          return initial;
        }
        // Update existing progress
        const updated = [...prev];
        updated[progress.batch - 1] = progress;
        return updated;
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  // Summary tab is selected by default (selectedCommentId = null)

  // Start review function - called when user clicks start
  const startReview = async () => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    setViewMode('reviewing');

    const runReview = async () => {
      addLog('init', `reviewing ${branch} against ${selectedBaseBranch}`);

      // Load skills and rules
      addLog('info', 'loading project context...');
      const activeSkills = getActiveSkills();
      const { errors, warnings, suggestions } = getActiveRulesByServerity();

      // Format skills context
      let skillsContext = '';
      if (projectDescription) {
        skillsContext += `Project: ${projectDescription}\n`;
      }
      if (activeSkills.length > 0) {
        skillsContext += `Tech Stack: ${activeSkills.map(s => s.name).join(', ')}\n`;
      }

      // Format rules context
      let rulesContext = '';
      if (errors.length > 0) {
        rulesContext += `ERRORS (must fix):\n${errors.map(r => `- ${r.content}`).join('\n')}\n\n`;
      }
      if (warnings.length > 0) {
        rulesContext += `WARNINGS:\n${warnings.map(r => `- ${r.content}`).join('\n')}\n\n`;
      }
      if (suggestions.length > 0) {
        rulesContext += `SUGGESTIONS:\n${suggestions.map(r => `- ${r.content}`).join('\n')}\n`;
      }

      const skillCount = activeSkills.length;
      const ruleCount = errors.length + warnings.length + suggestions.length;
      addLog('info', `skills: ${skillCount}, rules: ${ruleCount}`, 1);

      // Get changed files - try PR diff from GitHub first, fall back to local git diff
      addLog('info', 'fetching changed files...');
      let diffResult = await window.electron?.git.prDiffFiles(projectPath);

      // Store PR comments for later use
      let existingPRComments: Map<string, Array<{ line: number; startLine?: number; body: string; user: string; createdAt: string }>> = new Map();

      if (diffResult?.success) {
        // Have an open PR - can submit review to GitHub
        setHasOpenPR(true);
        addLog('info', `using GitHub PR diff (${diffResult.base})`);

        // Fetch existing PR comments
        addLog('info', 'fetching existing PR comments...');
        const prCommentsResult = await window.electron?.git.pr.comments(projectPath);
        if (prCommentsResult?.success && prCommentsResult.reviewComments) {
          // Group review comments by file path
          for (const comment of prCommentsResult.reviewComments) {
            if (!existingPRComments.has(comment.path)) {
              existingPRComments.set(comment.path, []);
            }
            existingPRComments.get(comment.path)!.push({
              line: comment.line,
              startLine: comment.startLine,
              body: comment.body,
              user: comment.user,
              createdAt: comment.createdAt,
            });
          }
          const totalComments = prCommentsResult.reviewComments.length;
          if (totalComments > 0) {
            addLog('info', `found ${totalComments} existing PR comment${totalComments > 1 ? 's' : ''}`);
          }
        }
      } else {
        // No open PR - fall back to local git diff (can still review, just can't submit to GitHub)
        setHasOpenPR(false);
        addLog('info', 'no open PR, using local diff...');
        diffResult = await window.electron?.git.diffFiles(projectPath, selectedBaseBranch || undefined);
      }

      if (!diffResult?.success || !diffResult.files.length) {
        addLog('info', 'no changed files found');
        addLog('success', 'review complete - no changes to review');
        setViewMode('report');
        return;
      }

      const files = diffResult.files;
      setTotalFiles(files.length);
      setBaseBranchUsed(diffResult.base || selectedBaseBranch);
      addLog('info', `found ${files.length} changed files (comparing to ${diffResult.base})`);

      // List all files upfront
      addLog('summary', '');
      addLog('summary', 'Files to review:');
      for (const file of files) {
        const status = file.status === 'added' ? 'added' : file.status === 'deleted' ? 'deleted' : file.status === 'renamed' ? 'renamed' : 'modified';
        addLog('fileStatus', file.path, 0, status as LogEntry['fileStatus']);
      }
      addLog('summary', '');

      // Review each file and collect data
      const allReviewData: FileReviewData[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setFilesReviewed(i);

        // Calculate diff stats
        const diffLines = file.diff.split('\n');
        const additions = diffLines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
        const deletions = diffLines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;

        addLog('file', `${i + 1}/${files.length}: ${file.path}`);
        addLog('info', `status: ${file.status} (+${additions}/-${deletions} lines)`, 1);

        // Step 0: Read the current file content
        setCurrentStep(0);
        setCurrentStepLabel('loading');
        addLog('info', 'reading file content...', 1);
        const fileResult = await window.electron?.readFile(`${projectPath}/${file.path}`);
        const fileContent = fileResult?.success ? fileResult.content || '' : '';

        if (file.status === 'deleted') {
          addLog('info', 'file was deleted, skipping content review', 1);
          addLog('success', 'noted deletion', 1);
          setCurrentStep(STEPS_PER_FILE);
          allReviewData.push({
            path: file.path,
            status: file.status as FileReviewData['status'],
            content: '',
            diff: file.diff,
            comments: [],
            summary: 'File deleted',
            verdict: 'approve' // deletions are generally fine
          });
          continue;
        }

        const fileSize = fileContent.length;
        addLog('info', `loaded ${fileSize.toLocaleString()} chars`, 1);

        // Step 1: Call Claude to review
        setCurrentStep(1);
        setCurrentStepLabel('analyzing');
        addLog('info', 'sending to Claude for analysis...', 1);
        const startTime = Date.now();

        const reviewResult = await window.electron?.review(
          projectPath,
          fileContent,
          file.path,
          file.diff,
          { skills: skillsContext, rules: rulesContext }
        );

        // Step 2: Process results
        setCurrentStep(2);
        setCurrentStepLabel('processing');
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        addLog('info', `analysis complete (${duration}s)`, 1);

        const comments: ReviewComment[] = [];

        if (reviewResult?.success && reviewResult.review) {
          const fileIssues = reviewResult.review.issues || [];
          const fileHighlights = reviewResult.review.highlights || [];

          // Show highlights first (what's good)
          if (fileHighlights.length > 0) {
            addLog('success', `${fileHighlights.length} highlight${fileHighlights.length > 1 ? 's' : ''}`, 1);
            for (const highlight of fileHighlights) {
              // Support both new (startLine/endLine) and legacy (line) format
              const startLine = highlight.startLine ?? highlight.line ?? null;
              const endLine = highlight.endLine ?? highlight.line ?? null;
              const lineInfo = startLine ? (endLine && endLine !== startLine ? `:${startLine}-${endLine}` : `:${startLine}`) : '';
              addLog('highlight', `[✓] ${highlight.message}${lineInfo}`, 2);
              comments.push({
                id: `h-${file.path}-${comments.length}`,
                type: 'highlight',
                startLine,
                endLine,
                message: highlight.message,
                status: 'pending',
                author: 'claude'
              });
            }
          }

          // Show issues
          if (fileIssues.length > 0) {
            addLog('warning', `${fileIssues.length} issue${fileIssues.length > 1 ? 's' : ''}`, 1);
            for (const issue of fileIssues) {
              const icon = issue.severity === 'error' ? '[!]' : issue.severity === 'warning' ? '[~]' : '[i]';
              // Support both new (startLine/endLine) and legacy (line) format
              const startLine = issue.startLine ?? issue.line ?? null;
              const endLine = issue.endLine ?? issue.line ?? null;
              const lineInfo = startLine ? (endLine && endLine !== startLine ? `:${startLine}-${endLine}` : `:${startLine}`) : '';
              addLog('issue', `${icon} ${issue.message}${lineInfo}`, 2);
              comments.push({
                id: `i-${file.path}-${comments.length}`,
                type: 'issue',
                severity: issue.severity,
                startLine,
                endLine,
                message: issue.message,
                rule: issue.rule,
                suggestedFix: issue.suggestedFix || null,
                status: 'pending',
                author: 'claude'
              });
            }
          }

          if (fileIssues.length === 0 && fileHighlights.length === 0) {
            addLog('success', 'looks good, no specific feedback', 1);
          }

          // Add existing PR comments for this file
          const existingFileComments = existingPRComments.get(file.path) || [];
          if (existingFileComments.length > 0) {
            addLog('info', `${existingFileComments.length} existing PR comment${existingFileComments.length > 1 ? 's' : ''}`, 1);
            for (const prComment of existingFileComments) {
              const lineInfo = prComment.line ? (prComment.startLine && prComment.startLine !== prComment.line ? `:${prComment.startLine}-${prComment.line}` : `:${prComment.line}`) : '';
              addLog('info', `[@${prComment.user}${lineInfo}] ${prComment.body.slice(0, 60)}${prComment.body.length > 60 ? '...' : ''}`, 2);
              comments.push({
                id: `pr-${file.path}-${comments.length}`,
                type: 'user',
                startLine: prComment.startLine || prComment.line,
                endLine: prComment.line,
                message: `[@${prComment.user}] ${prComment.body}`,
                status: 'approved', // Existing PR comments are already submitted
                author: 'user'
              });
            }
          }

          // Show Claude's verdict and summary
          const verdict = reviewResult.review.verdict || 'concern'; // default to concern if not provided
          const verdictIcon = verdict === 'approve' ? '✓' : verdict === 'block' ? '✗' : '~';
          const verdictColor = verdict === 'approve' ? 'success' : verdict === 'block' ? 'error' : 'warning';
          addLog(verdictColor as LogEntry['type'], `verdict: ${verdictIcon} ${verdict}`, 1);

          if (reviewResult.review.summary) {
            addLog('info', `summary: ${reviewResult.review.summary}`, 1);
          }

          allReviewData.push({
            path: file.path,
            status: file.status as FileReviewData['status'],
            content: fileContent,
            diff: file.diff,
            comments,
            summary: reviewResult.review.summary || '',
            verdict
          });
        } else {
          addLog('error', `review failed: ${reviewResult?.error || 'unknown error'}`, 1);
          allReviewData.push({
            path: file.path,
            status: file.status as FileReviewData['status'],
            content: fileContent,
            diff: file.diff,
            comments: [],
            summary: 'Review failed',
            verdict: 'concern' // default for failed reviews
          });
        }

        addLog('summary', ''); // spacing between files
      }

      // Mark complete and transition to generating report
      setFilesReviewed(files.length);
      setCurrentStep(STEPS_PER_FILE);
      setCurrentStepLabel('generating report');
      setViewMode('generating');
      addLog('success', 'review complete');
      addLog('info', 'generating report...');

      // Store the review data
      setReviewData(allReviewData);

      // Save review to storage with incrementing index
      const nextIndex = savedReviews.length > 0
        ? Math.max(...savedReviews.map(r => r.index)) + 1
        : 1;
      const savedData: SavedReview = {
        index: nextIndex,
        branch,
        baseBranch: selectedBaseBranch,
        timestamp: Date.now(),
        reviewData: allReviewData
      };
      const updatedReviews = [...savedReviews, savedData];
      console.log('[ReviewPanel] Saving review with key:', reviewStorageKey, 'index:', nextIndex);
      console.log('[ReviewPanel] Review data to save:', savedData);
      const saveResult = await window.electron?.store.set(reviewStorageKey, { reviews: updatedReviews });
      console.log('[ReviewPanel] Save result:', saveResult);
      setSavedReviews(updatedReviews);
      setCurrentReviewIndex(nextIndex);

      // Brief delay to show generating state
      await new Promise(resolve => setTimeout(resolve, 500));

      // Transition to report view
      setViewMode('report');
    };

    runReview();
  };

  // Load a saved review by index directly into report view
  const loadSavedReviewByIndex = (index: number) => {
    const review = savedReviews.find(r => r.index === index);
    if (!review) return;
    setCurrentReviewIndex(index);
    setReviewData(review.reviewData);
    setBaseBranchUsed(review.baseBranch);
    setViewMode('report');
  };

  // Navigate to previous review
  const goToPreviousReview = () => {
    if (currentReviewIndex === null) return;
    const currentIdx = savedReviews.findIndex(r => r.index === currentReviewIndex);
    if (currentIdx > 0) {
      loadSavedReviewByIndex(savedReviews[currentIdx - 1].index);
    }
  };

  // Navigate to next review
  const goToNextReview = () => {
    if (currentReviewIndex === null) return;
    const currentIdx = savedReviews.findIndex(r => r.index === currentReviewIndex);
    if (currentIdx < savedReviews.length - 1) {
      loadSavedReviewByIndex(savedReviews[currentIdx + 1].index);
    }
  };

  // Delete a specific review
  const deleteReview = async (index: number) => {
    const updatedReviews = savedReviews.filter(r => r.index !== index);
    await window.electron?.store.set(reviewStorageKey, { reviews: updatedReviews });
    setSavedReviews(updatedReviews);

    // If we deleted the current review, navigate to another or go to setup
    if (currentReviewIndex === index) {
      if (updatedReviews.length > 0) {
        // Load the latest remaining review
        const latest = updatedReviews[updatedReviews.length - 1];
        loadSavedReviewByIndex(latest.index);
      } else {
        // No reviews left, go to setup
        setCurrentReviewIndex(null);
        setReviewData([]);
        setViewMode('setup');
      }
    }
  };

  // Start new review (keep history)
  const handleRegenerate = () => {
    console.log('[ReviewPanel] handleRegenerate called, current viewMode:', viewMode);
    // Reset state but keep saved reviews
    setReviewData([]);
    setLogs([]);
    setFilesReviewed(0);
    setTotalFiles(0);
    setCurrentStep(0);
    setCurrentReviewIndex(null);
    // Reset initialization flag so startReview can run again
    hasInitialized.current = false;
    // Go to setup
    console.log('[ReviewPanel] Setting viewMode to setup');
    setViewMode('setup');
  };

  // Delete all reviews
  const deleteAllReviews = async () => {
    await window.electron?.store.delete(reviewStorageKey);
    setSavedReviews([]);
    setCurrentReviewIndex(null);
    setReviewData([]);
    setViewMode('setup');
  };

  // Submit review to GitHub PR
  const handleSubmitReview = async (action: 'approve' | 'reject') => {
    setIsSubmitting(true);
    setSubmitError(null);
    setBatchProgress([]);
    setShowBatchProgress(true);

    try {
      // Collect all comments to submit (limited due to GitHub rate limits)
      const MAX_COMMENTS = 50; // GitHub rate limits restrict total comments
      const MAX_COMMENT_LENGTH = 500;

      // Helper to get valid line numbers from a diff (only lines that can be commented on)
      const getValidDiffLines = (diff: string): Set<number> => {
        const validLines = new Set<number>();
        const diffLines = parseDiff(diff);
        for (const line of diffLines) {
          // Can only comment on additions and context lines (RIGHT side)
          if ((line.type === 'addition' || line.type === 'context') && line.newLineNum !== null) {
            validLines.add(line.newLineNum);
          }
        }
        return validLines;
      };

      // First, collect all comments (for summary and non-diff-line comments)
      const allPendingComments = reviewData.flatMap(file =>
        file.comments
          .filter(c => c.status === 'approved' || c.status === 'pending')
          .map(c => ({
            path: file.path,
            line: c.endLine || c.startLine || 0,
            message: c.message,
            severity: c.severity,
            type: c.type,
            rule: c.rule,
          }))
      );

      // Filter to only comments on valid diff lines (can be inline comments)
      const allCommentsToSubmit = reviewData.flatMap(file => {
        // Get valid line numbers for this file's diff
        const validLines = getValidDiffLines(file.diff);

        return file.comments
          .filter(c => c.status === 'approved' || c.status === 'pending') // Include approved and pending
          .map(c => {
            // Format with text labels instead of emojis
            const label = c.type === 'highlight' ? '[highlight]' :
                          c.severity === 'error' ? '[error]' :
                          c.severity === 'warning' ? '[warning]' : '[suggestion]';
            let body = `${label} ${c.message}`;
            if (c.rule) body += `\n\n_Rule: ${c.rule}_`;
            if (body.length > MAX_COMMENT_LENGTH) {
              body = body.slice(0, MAX_COMMENT_LENGTH - 3) + '...';
            }
            return {
              path: file.path,
              line: c.endLine || c.startLine || 0,
              // Disabled multi-line comments (startLine) to debug 422 errors
              // startLine: c.startLine && c.endLine && c.startLine !== c.endLine ? c.startLine : undefined,
              body,
              // Keep severity for sorting priority
              _severity: c.severity
            };
          })
          .filter(c => c.line > 0 && validLines.has(c.line)) // Only include comments on valid diff lines
          .map(c => {
            // For multi-line comments, verify startLine is also valid
            if (c.startLine && !validLines.has(c.startLine)) {
              // If startLine is invalid, make it a single-line comment
              return { ...c, startLine: undefined };
            }
            return c;
          });
      });

      // Count comments that couldn't be placed inline (not on diff lines)
      const filteredOutCount = allPendingComments.length - allCommentsToSubmit.length;

      // Prioritize errors > warnings > suggestions > highlights, then take top 50
      const priorityOrder = { error: 0, warning: 1, suggestion: 2, undefined: 3 };
      const commentsToSubmit = allCommentsToSubmit
        .sort((a, b) => (priorityOrder[a._severity as keyof typeof priorityOrder] ?? 3) - (priorityOrder[b._severity as keyof typeof priorityOrder] ?? 3))
        .slice(0, MAX_COMMENTS)
        .map(({ _severity, ...c }) => c); // Remove _severity before sending

      // Generate review body summary (keep it concise)
      const errorCount = allPendingComments.filter(c => c.type === 'issue' && c.severity === 'error').length;
      const warningCount = allPendingComments.filter(c => c.type === 'issue' && c.severity === 'warning').length;
      const suggestionCount = allPendingComments.filter(c => c.type === 'issue' && c.severity === 'suggestion').length;
      const highlightCount = allPendingComments.filter(c => c.type === 'highlight').length;

      const summaryLines = [
        `## Code Review Summary`,
        ``,
        `| Type | Count |`,
        `|------|-------|`,
        `| Errors | ${errorCount} |`,
        `| Warnings | ${warningCount} |`,
        `| Suggestions | ${suggestionCount} |`,
        `| Highlights | ${highlightCount} |`,
      ];

      // Only add file summaries if <= 10 files to keep payload small
      if (reviewData.length <= 10) {
        summaryLines.push(
          ``,
          `### Files`,
          ...reviewData.map(f => {
            const summary = f.summary ? (f.summary.length > 80 ? f.summary.slice(0, 77) + '...' : f.summary) : '';
            return `- **${f.path}** (${f.verdict})${summary ? `: ${summary}` : ''}`;
          })
        );
      } else {
        summaryLines.push(``, `_${reviewData.length} files reviewed_`);
      }

      // If there are important comments that couldn't be placed inline, include them in the body
      if (filteredOutCount > 0) {
        // Get non-inline errors (most important)
        const inlineCommentPaths = new Set(allCommentsToSubmit.map(c => `${c.path}:${c.line}`));
        const nonInlineErrors = allPendingComments
          .filter(c => c.severity === 'error' && !inlineCommentPaths.has(`${c.path}:${c.line}`))
          .slice(0, 10); // Limit to top 10 errors

        if (nonInlineErrors.length > 0) {
          summaryLines.push(
            ``,
            `### Additional Issues (not on changed lines)`,
            ``,
            `<details>`,
            `<summary>Show ${nonInlineErrors.length} error${nonInlineErrors.length > 1 ? 's' : ''} found outside diff</summary>`,
            ``,
            ...nonInlineErrors.map(c => `- **${c.path}:${c.line}** - ${c.message.slice(0, 100)}${c.message.length > 100 ? '...' : ''}`),
            ``,
            `</details>`
          );
        }

        summaryLines.push(``, `_Note: ${filteredOutCount} comment${filteredOutCount > 1 ? 's' : ''} on unchanged lines (shown in summary only)_`);
      }

      if (allCommentsToSubmit.length > MAX_COMMENTS) {
        summaryLines.push(``, `_Note: ${allCommentsToSubmit.length - MAX_COMMENTS} additional inline comments omitted (GitHub limit: ${MAX_COMMENTS})_`);
      }

      summaryLines.push(``, `---`, `_Review by Claude AI via XTC_`);

      const result = await window.electron?.git.pr.review(projectPath, {
        action: action === 'approve' ? 'APPROVE' : 'REQUEST_CHANGES',
        body: summaryLines.join('\n'),
        comments: commentsToSubmit
      });

      if (result?.success) {
        // Mark all comments as approved after successful submit
        setReviewData(prev => prev.map(file => ({
          ...file,
          comments: file.comments.map(c => ({ ...c, status: 'approved' as const }))
        })));
        // Keep batch progress visible briefly to show success
        await new Promise(resolve => setTimeout(resolve, 1000));
        setShowConfirmModal(false);
        setShowBatchProgress(false);
        setBatchProgress([]);
      } else {
        setSubmitError(result?.error || 'Failed to submit review');
      }
    } catch (e) {
      setSubmitError(String(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommentAction = (fileIndex: number, commentId: string, action: 'approved' | 'rejected') => {
    setReviewData(prev => {
      const newData = [...prev];
      const file = newData[fileIndex];
      const comment = file.comments.find(c => c.id === commentId);
      if (comment) {
        comment.status = action;
      }
      return newData;
    });
  };

  // Apply a suggested fix using Claude
  const handleApplyFix = async (fileIndex: number, commentId: string) => {
    const file = reviewData[fileIndex];
    const comment = file.comments.find(c => c.id === commentId);

    if (!comment || !comment.suggestedFix) return;

    setApplyingFix(commentId);

    try {
      // Read the current file content
      const fileContent = await window.electron?.readFile(projectPath + '/' + file.path);

      if (!fileContent?.success || !fileContent.content) {
        console.error('Failed to read file for fix');
        setApplyingFix(null);
        return;
      }

      // Build a prompt for Claude to apply the fix
      const fixPrompt = `Apply this fix to the file. Only output the modified code section, nothing else.

FILE: ${file.path}
ISSUE: ${comment.message}
${comment.startLine ? `LOCATION: Lines ${comment.startLine}${comment.endLine && comment.endLine !== comment.startLine ? `-${comment.endLine}` : ''}` : ''}
SUGGESTED FIX: ${comment.suggestedFix}

CURRENT FILE CONTENT:
\`\`\`
${fileContent.content}
\`\`\`

Apply the suggested fix and output the complete modified file content. Make sure the fix is valid and doesn't break anything.`;

      const result = await window.electron?.claude.send(
        fixPrompt,
        { activeFile: file.path, contextFiles: [] },
        projectPath
      );

      if (result?.success) {
        // Mark the comment as approved after fix is applied
        handleCommentAction(fileIndex, commentId, 'approved');

        // Refresh the diff to show updated content
        const diffResult = await window.electron?.git.diff(projectPath, selectedBaseBranch, file.path);
        if (diffResult?.success) {
          setReviewData(prev => {
            const newData = [...prev];
            newData[fileIndex] = {
              ...newData[fileIndex],
              diff: diffResult.diff || ''
            };
            return newData;
          });
        }
      }
    } catch (err) {
      console.error('Failed to apply fix:', err);
    } finally {
      setApplyingFix(null);
    }
  };

  // Line selection handlers
  const handleLineMouseDown = (lineNum: number, e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    setIsSelecting(true);
    setLineSelection({ startLine: lineNum, endLine: lineNum });
    setShowCommentInput(false);
    setCommentText('');
  };

  const handleLineMouseEnter = (lineNum: number) => {
    if (!isSelecting || !lineSelection) return;
    setLineSelection(prev => prev ? { ...prev, endLine: lineNum } : null);
  };

  const handleLineMouseUp = () => {
    if (!isSelecting) return;
    setIsSelecting(false);
    if (lineSelection) {
      // Normalize the selection (start <= end)
      const start = Math.min(lineSelection.startLine, lineSelection.endLine);
      const end = Math.max(lineSelection.startLine, lineSelection.endLine);
      setLineSelection({ startLine: start, endLine: end });
      setShowCommentInput(true);
    }
  };

  const handleStartComment = () => {
    setShowCommentInput(true);
  };

  const handleSubmitComment = () => {
    if (!lineSelection || !commentText.trim()) return;

    const file = reviewData[selectedFileIndex];
    const newComment: ReviewComment = {
      id: `u-${file.path}-${Date.now()}`,
      type: 'user',
      startLine: lineSelection.startLine,
      endLine: lineSelection.endLine,
      message: commentText.trim(),
      status: 'pending',
      author: 'user'
    };

    setReviewData(prev => {
      const newData = [...prev];
      newData[selectedFileIndex] = {
        ...newData[selectedFileIndex],
        comments: [...newData[selectedFileIndex].comments, newComment]
      };
      return newData;
    });

    // Reset selection
    setLineSelection(null);
    setCommentText('');
    setShowCommentInput(false);
  };

  const handleCancelComment = () => {
    setLineSelection(null);
    setCommentText('');
    setShowCommentInput(false);
  };

  // Check if a line is within the current selection
  const isLineSelected = (lineNum: number) => {
    if (!lineSelection) return false;
    const start = Math.min(lineSelection.startLine, lineSelection.endLine);
    const end = Math.max(lineSelection.startLine, lineSelection.endLine);
    return lineNum >= start && lineNum <= end;
  };

  // Check if a line has comments (considering line ranges)
  const getLineComments = (file: FileReviewData, lineNum: number) => {
    return file.comments.filter(c => {
      if (c.startLine === null) return false;
      const end = c.endLine || c.startLine;
      return lineNum >= c.startLine && lineNum <= end;
    });
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'init': return 'text-cyan-400';
      case 'info': return 'text-text-muted';
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      case 'file': return 'text-blue-400';
      case 'issue': return 'text-orange-400';
      case 'highlight': return 'text-emerald-400';
      case 'summary': return 'text-purple-400';
      default: return 'text-text-primary';
    }
  };

  const formatLog = (entry: LogEntry, index: number) => {
    // Special handling for fileStatus type
    if (entry.type === 'fileStatus') {
      const statusIcon = entry.fileStatus === 'added' ? '+' :
                        entry.fileStatus === 'deleted' ? '-' :
                        entry.fileStatus === 'renamed' ? '→' : '~';
      const statusColor = entry.fileStatus === 'added' ? 'text-green-400' :
                         entry.fileStatus === 'deleted' ? 'text-red-400' :
                         'text-yellow-400';
      return (
        <div key={index} className="font-mono text-xs text-text-muted">
          {'  '}<span className={statusColor}>{statusIcon}</span> {entry.message}
        </div>
      );
    }

    const prefix = entry.type === 'init' ? '[init]' :
                   entry.type === 'info' ? '[info]' :
                   entry.type === 'success' ? '[done]' :
                   entry.type === 'error' ? '[error]' :
                   entry.type === 'warning' ? '[warn]' :
                   entry.type === 'file' ? '[file]' :
                   entry.type === 'issue' ? '' :
                   entry.type === 'highlight' ? '' :
                   entry.type === 'summary' ? '' : '>';

    const indent = '  '.repeat(entry.indent || 0);

    return (
      <div key={index} className={`font-mono text-xs ${getLogColor(entry.type)}`}>
        {indent}{prefix && <span className="opacity-60">{prefix} </span>}{entry.message}
      </div>
    );
  };

  // Get total counts
  const totalIssues = reviewData.reduce((sum, f) => sum + f.comments.filter(c => c.type === 'issue').length, 0);
  const totalHighlights = reviewData.reduce((sum, f) => sum + f.comments.filter(c => c.type === 'highlight').length, 0);
  const totalUserComments = reviewData.reduce((sum, f) => sum + f.comments.filter(c => c.type === 'user').length, 0);
  const pendingCount = reviewData.reduce((sum, f) => sum + f.comments.filter(c => c.status === 'pending').length, 0);

  // Render inline comments for a specific line (show at the end line of the comment range)
  const renderLineComments = (fileIndex: number, file: FileReviewData, lineNum: number) => {
    // Only show comment at the end line of its range
    const lineComments = file.comments.filter(c => {
      const endLine = c.endLine || c.startLine;
      return endLine === lineNum;
    });
    if (lineComments.length === 0) return null;

    return (
      <div className="border-l-2 border-blue-500 ml-4 my-1">
        {lineComments.map(comment => {
          const isHighlight = comment.type === 'highlight';
          const isUser = comment.type === 'user';
          const Icon = isUser ? User : isHighlight ? CheckCircle :
                       comment.severity === 'error' ? AlertCircle :
                       comment.severity === 'warning' ? AlertTriangle : Info;
          const borderColor = isUser ? 'border-purple-500/50' : isHighlight ? 'border-emerald-500/50' :
                              comment.severity === 'error' ? 'border-red-500/50' :
                              comment.severity === 'warning' ? 'border-orange-500/50' : 'border-blue-500/50';
          const bgColor = isUser ? 'bg-purple-500/10' : isHighlight ? 'bg-emerald-500/10' :
                          comment.severity === 'error' ? 'bg-red-500/10' :
                          comment.severity === 'warning' ? 'bg-orange-500/10' : 'bg-blue-500/10';
          const iconColor = isUser ? 'text-purple-400' : isHighlight ? 'text-emerald-400' :
                           comment.severity === 'error' ? 'text-red-400' :
                           comment.severity === 'warning' ? 'text-orange-400' : 'text-blue-400';

          // Format line range for display
          const lineRange = comment.startLine !== null ?
            (comment.endLine && comment.endLine !== comment.startLine ?
              `L${comment.startLine}-${comment.endLine}` :
              `L${comment.startLine}`) : '';

          return (
            <div
              key={comment.id}
              className={`mx-2 my-1 rounded border ${borderColor} ${bgColor} ${
                comment.status === 'approved' ? 'opacity-50' :
                comment.status === 'rejected' ? 'opacity-30' : ''
              }`}
            >
              <div className="flex items-start gap-2 p-2">
                <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                  {comment.author === 'claude' ? <Bot className="w-3 h-3 text-text-muted" /> : <User className="w-3 h-3 text-text-muted" />}
                  <Icon className={`w-3 h-3 ${iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  {lineRange && (
                    <span className="text-[10px] text-text-muted mr-2">{lineRange}</span>
                  )}
                  <p className="text-xs text-text-primary">{comment.message}</p>
                  {comment.rule && (
                    <p className="text-[10px] text-text-muted mt-0.5">Rule: {comment.rule}</p>
                  )}
                  {comment.suggestedFix && (
                    <div className="mt-2 border-t border-border-secondary pt-2">
                      <p className="text-[10px] text-text-muted mb-1">Suggested fix:</p>
                      <pre className="text-[10px] text-green-400 bg-green-500/10 p-2 rounded overflow-x-auto whitespace-pre-wrap font-mono">{comment.suggestedFix}</pre>
                    </div>
                  )}
                </div>
                {comment.status === 'pending' && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {comment.suggestedFix && (
                      <button
                        onClick={() => handleApplyFix(fileIndex, comment.id)}
                        disabled={applyingFix === comment.id}
                        className="p-1 rounded hover:bg-blue-500/20 text-text-muted hover:text-blue-400 transition-colors disabled:opacity-50"
                        title="Apply fix"
                      >
                        {applyingFix === comment.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Wrench className="w-3 h-3" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleCommentAction(fileIndex, comment.id, 'approved')}
                      className="p-1 rounded hover:bg-green-500/20 text-text-muted hover:text-green-400 transition-colors"
                      title="Approve"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleCommentAction(fileIndex, comment.id, 'rejected')}
                      className="p-1 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors"
                      title="Reject"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {comment.status !== 'pending' && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                    comment.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {comment.status}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const selectedFile = reviewData[selectedFileIndex];
  const selectedDiffLines = selectedFile ? parseDiff(selectedFile.diff) : [];

  // Get all comments across all files for the left panel
  const allComments = reviewData.flatMap((file, fileIndex) =>
    file.comments.map(comment => ({ ...comment, fileIndex, filePath: file.path }))
  );

  // Get the currently selected comment
  const selectedComment = selectedCommentId
    ? allComments.find(c => c.id === selectedCommentId)
    : null;

  // When a comment is selected, show that file's diff
  const displayFileIndex = selectedComment ? selectedComment.fileIndex : selectedFileIndex;
  const displayFile = reviewData[displayFileIndex];

  // Memoize the parsed diff lines to prevent unnecessary re-parsing
  const displayDiffLines = useMemo(() => {
    return displayFile ? parseDiff(displayFile.diff) : [];
  }, [displayFile?.diff]);

  // Memoize diff stats
  const diffStats = useMemo(() => ({
    additions: displayDiffLines.filter(l => l.type === 'addition').length,
    deletions: displayDiffLines.filter(l => l.type === 'deletion').length,
  }), [displayDiffLines]);

  // Setup View - choose base branch
  if (viewMode === 'setup') {
    return (
      <div className="flex flex-col h-full bg-bg-primary">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-primary bg-bg-secondary">
          <span className="text-xs font-mono text-text-muted">
            review: <span className="text-accent-primary">{branch}</span>
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Setup Content */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full space-y-6">
            <div className="text-center">
              <GitBranch className="w-12 h-12 mx-auto text-accent-primary mb-4" />
              <h2 className="text-lg font-medium text-text-primary mb-2">Code Review</h2>
              <p className="text-sm text-text-muted">
                Review changes on <span className="text-accent-primary font-mono">{branch}</span> compared to a base branch
              </p>
            </div>

            {/* Saved Reviews Section */}
            {!loadingSavedReview && savedReviews.length > 0 && (
              <div className="bg-bg-secondary border border-border-primary rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {savedReviews.length} Saved Review{savedReviews.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    onClick={deleteAllReviews}
                    className="text-xs font-mono text-red-400/60 hover:text-red-400 transition-colors"
                  >
                    clear all
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {savedReviews.slice().reverse().map((review) => (
                    <div
                      key={review.index}
                      className="flex items-center justify-between p-2 rounded bg-bg-primary hover:bg-bg-hover transition-colors group"
                    >
                      <button
                        onClick={() => loadSavedReviewByIndex(review.index)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-accent-primary">#{review.index}</span>
                          <span className="text-xs text-text-muted">
                            {new Date(review.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs text-text-muted mt-0.5">
                          vs {review.baseBranch} · {review.reviewData.length} files
                        </div>
                      </button>
                      <button
                        onClick={() => deleteReview(review.index)}
                        className="p-1 text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete this review"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2 border-t border-border-primary">
                  <button
                    onClick={() => loadSavedReviewByIndex(savedReviews[savedReviews.length - 1].index)}
                    className="flex-1 flex items-center justify-center gap-1 text-xs font-mono bg-accent-primary/20 text-accent-primary hover:bg-accent-primary/30 px-3 py-2 rounded transition-colors"
                  >
                    <CheckCircle className="w-3 h-3" /> view latest
                  </button>
                </div>
              </div>
            )}

            {/* New Review Section - always shown in setup view */}
            {!loadingSavedReview && (
              <>
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-text-muted">
                    Compare against
                  </label>
                  <select
                    value={selectedBaseBranch}
                    onChange={(e) => setSelectedBaseBranch(e.target.value)}
                    className="w-full bg-bg-secondary border border-border-primary rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                  >
                    {availableBranches.length === 0 ? (
                      <option value="">Loading branches...</option>
                    ) : (
                      availableBranches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))
                    )}
                  </select>
                  <p className="text-xs text-text-muted">
                    Claude will review the diff between <span className="font-mono text-text-secondary">{selectedBaseBranch || '...'}</span> and <span className="font-mono text-text-secondary">{branch}</span>
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={startReview}
                    disabled={!selectedBaseBranch}
                    className="flex items-center gap-1 text-xs font-mono text-accent-primary hover:text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    [ <Play className="w-3 h-3 inline" /> start ]
                  </button>
                </div>
              </>
            )}

            {/* Loading state */}
            {loadingSavedReview && (
              <div className="text-center text-text-muted text-sm">
                Loading...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Check if a line is highlighted by the selected comment
  const isLineHighlighted = (lineNum: number) => {
    if (!selectedComment || selectedComment.startLine === null) return false;
    const end = selectedComment.endLine || selectedComment.startLine;
    return lineNum >= selectedComment.startLine && lineNum <= end;
  };

  // Get highlighted lines for the selected comment (extract from diff)
  const getHighlightedCodeLines = () => {
    if (!selectedComment || selectedComment.startLine === null || !displayFile) return [];
    const start = selectedComment.startLine;
    const end = selectedComment.endLine || start;

    // Just grab exactly the lines the comment references
    return displayDiffLines.filter(line => {
      if (line.newLineNum === null) return false;
      return line.newLineNum >= start && line.newLineNum <= end;
    });
  };

  const highlightedCodeLines = getHighlightedCodeLines();

  // Get current position in review history
  const currentReviewPosition = currentReviewIndex !== null
    ? savedReviews.findIndex(r => r.index === currentReviewIndex)
    : -1;
  const hasPreviousReview = currentReviewPosition > 0;
  const hasNextReview = currentReviewPosition >= 0 && currentReviewPosition < savedReviews.length - 1;

  // Report View
  if (viewMode === 'report') {
    return (
      <div className="flex flex-col h-full bg-bg-primary">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-primary bg-bg-secondary">
          <span className="text-xs font-mono text-text-muted flex items-center gap-2">
            {/* Review navigation */}
            {savedReviews.length > 1 && (
              <span className="flex items-center gap-1 mr-2">
                <button
                  onClick={goToPreviousReview}
                  disabled={!hasPreviousReview}
                  className="p-0.5 hover:text-accent-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Previous review"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span className="text-accent-primary">#{currentReviewIndex}</span>
                <span className="text-text-muted">/ {savedReviews.length}</span>
                <button
                  onClick={goToNextReview}
                  disabled={!hasNextReview}
                  className="p-0.5 hover:text-accent-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Next review"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </span>
            )}
            {savedReviews.length === 1 && currentReviewIndex && (
              <span className="text-accent-primary mr-2">#{currentReviewIndex}</span>
            )}
            review: <span className="text-accent-primary">{branch}</span>
            <span className="text-text-muted"> vs </span>
            <span className="text-text-secondary">{baseBranchUsed}</span>
            <span className="ml-3 text-text-muted">
              {totalIssues} issue{totalIssues !== 1 ? 's' : ''} · {totalHighlights} highlight{totalHighlights !== 1 ? 's' : ''}
              {totalUserComments > 0 && <span className="text-purple-400"> · {totalUserComments} comment{totalUserComments !== 1 ? 's' : ''}</span>}
              {pendingCount > 0 && <span className="ml-2 text-yellow-400">({pendingCount} pending)</span>}
            </span>
          </span>
          <div className="flex items-center gap-2">
            {currentReviewIndex !== null && (
              <button
                onClick={() => deleteReview(currentReviewIndex)}
                className="text-xs font-mono text-text-muted hover:text-red-400 transition-colors"
                title="Delete this review"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={handleRegenerate}
              className="text-xs font-mono text-text-muted hover:text-accent-primary transition-colors"
              title="Create new review"
            >
              [ new ]
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
              title="Exit review"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Comment + Highlighted Code */}
          <div className="w-1/2 border-r border-border-primary flex flex-col overflow-hidden">
            {/* Comments List Header */}
            <div className="flex-shrink-0 border-b border-border-primary">
              <div className="p-2 text-xs font-mono text-text-muted bg-bg-secondary flex items-center justify-between">
                <span>Comments ({allComments.length})</span>
                {selectedComment && (
                  <span className="text-accent-primary">
                    {allComments.findIndex(c => c.id === selectedCommentId) + 1} / {allComments.length}
                  </span>
                )}
              </div>

              {/* Horizontal scrollable comment tabs - checklist style */}
              <div className="flex bg-[#0d1117] border-b border-border-primary">
                {/* Summary tab - sticky */}
                <button
                  onClick={() => setSelectedCommentId(null)}
                  className={`flex-shrink-0 px-3 py-2 flex items-center gap-1.5 border-b-2 border-r border-border-primary transition-colors ${
                    selectedCommentId === null
                      ? 'border-b-accent-primary bg-accent-primary/10'
                      : 'border-b-transparent hover:bg-bg-hover'
                  }`}
                >
                  <FileCode className="w-3 h-3 text-accent-primary" />
                  <span className="text-xs text-accent-primary">Summary</span>
                </button>

                {/* Scrollable comment tabs */}
                <div className="flex overflow-x-auto">
                  {allComments.map((comment, idx) => {
                    const isSelected = selectedCommentId === comment.id;

                    return (
                      <button
                        key={comment.id}
                        onClick={() => {
                          setSelectedCommentId(comment.id);
                          setSelectedFileIndex(comment.fileIndex);
                          scrollToLine(comment.startLine, comment.endLine);
                        }}
                        className={`flex-shrink-0 px-3 py-2 flex items-center gap-1.5 border-b-2 transition-colors ${
                          isSelected
                            ? 'border-accent-primary bg-accent-primary/10'
                            : 'border-transparent hover:bg-bg-hover'
                        }`}
                      >
                        {/* Status indicator - colored ring by type/severity */}
                        {comment.status === 'approved' ? (
                          <Check className="w-3 h-3 text-green-400" />
                        ) : comment.status === 'rejected' ? (
                          <XIcon className="w-3 h-3 text-red-400" />
                        ) : (
                          <div className={`w-3 h-3 rounded-full border ${
                            comment.type === 'highlight' ? 'border-green-500' :
                            comment.type === 'user' ? 'border-purple-500' :
                            comment.severity === 'error' ? 'border-red-500' :
                            comment.severity === 'warning' ? 'border-yellow-500' :
                            'border-blue-500'
                          }`} />
                        )}
                        <span className={`text-xs ${comment.status === 'pending' ? 'text-text-muted' : 'text-text-secondary'}`}>{idx + 1}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Selected Comment Detail + Code Snippet OR Summary View */}
            {selectedComment ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Comment message */}
                <div className="flex-shrink-0 p-4 bg-[#161b22] border-b border-border-primary">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 pt-0.5">
                      {/* Comment type icon */}
                      {selectedComment.type === 'user' ? (
                        <User className="w-4 h-4 text-purple-400" />
                      ) : selectedComment.type === 'highlight' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : selectedComment.severity === 'error' ? (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      ) : selectedComment.severity === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-orange-400" />
                      ) : (
                        <Info className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-text-muted">
                          {selectedComment.filePath.split('/').pop()}
                        </span>
                        <span className="text-xs font-mono text-accent-primary">
                          {selectedComment.startLine !== null ?
                            (selectedComment.endLine && selectedComment.endLine !== selectedComment.startLine ?
                              `L${selectedComment.startLine}-${selectedComment.endLine}` :
                              `L${selectedComment.startLine}`) : 'General'}
                        </span>
                        {selectedComment.status !== 'pending' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            selectedComment.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {selectedComment.status}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-text-primary">{selectedComment.message}</p>
                      {selectedComment.rule && (
                        <p className="text-xs text-text-muted mt-2">Rule: {selectedComment.rule}</p>
                      )}
                    </div>
                    {selectedComment.status === 'pending' && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleCommentAction(selectedComment.fileIndex, selectedComment.id, 'approved')}
                          className="p-1.5 rounded hover:bg-green-500/20 text-text-muted hover:text-green-400 transition-colors"
                          title="Approve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCommentAction(selectedComment.fileIndex, selectedComment.id, 'rejected')}
                          className="p-1.5 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors"
                          title="Reject"
                        >
                          <XIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Code snippet for this comment */}
                <div className="flex-1 overflow-auto bg-[#0d1117] font-mono text-xs">
                  {highlightedCodeLines.length > 0 ? (
                    highlightedCodeLines.map((line, lineIndex) => {
                      const lineNum = line.newLineNum;
                      const highlighted = lineNum ? isLineHighlighted(lineNum) : false;

                      return (
                        <div
                          key={`snippet-${lineIndex}`}
                          className={`flex items-stretch border-l-2 ${
                            highlighted ? 'bg-accent-primary/30 border-accent-primary' :
                            line.type === 'addition' ? 'bg-green-500/10 border-transparent' :
                            line.type === 'deletion' ? 'bg-red-500/10 border-transparent' : 'border-transparent'
                          }`}
                        >
                          <div className="w-10 text-right pr-2 py-0.5 text-text-muted select-none border-r border-border-primary flex-shrink-0">
                            {line.newLineNum || ''}
                          </div>
                          <div className="flex-1 flex items-center">
                            <span className={`w-4 text-center flex-shrink-0 ${
                              line.type === 'addition' ? 'text-green-400' :
                              line.type === 'deletion' ? 'text-red-400' : ''
                            }`}>
                              {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' '}
                            </span>
                            <pre className="flex-1 py-0.5 pr-4 whitespace-pre text-text-primary">
                              {line.content}
                            </pre>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-text-muted text-center">
                      General comment - no specific lines
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Summary View */
              <div className="flex-1 overflow-auto bg-[#0d1117] p-4">
                {/* Approval Confidence - based on LLM verdicts per file */}
                {(() => {
                  // Calculate confidence from file verdicts
                  // approve = 3 points, concern = 2 points, block = 1 point
                  const verdictScores = { approve: 3, concern: 2, block: 1 };
                  const totalScore = reviewData.reduce((sum, file) => {
                    return sum + verdictScores[file.verdict || 'concern'];
                  }, 0);
                  const maxScore = reviewData.length * 3;
                  const confidence = reviewData.length > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

                  // Count verdicts for display
                  const approveCount = reviewData.filter(f => f.verdict === 'approve').length;
                  const concernCount = reviewData.filter(f => f.verdict === 'concern').length;
                  const blockCount = reviewData.filter(f => f.verdict === 'block').length;

                  const confidenceColor = confidence >= 80 ? 'text-green-400' :
                                         confidence >= 60 ? 'text-yellow-400' :
                                         confidence >= 40 ? 'text-orange-400' : 'text-red-400';
                  const confidenceBg = confidence >= 80 ? 'bg-green-500' :
                                      confidence >= 60 ? 'bg-yellow-500' :
                                      confidence >= 40 ? 'bg-orange-500' : 'bg-red-500';
                  const overallVerdict = confidence >= 80 ? 'Ready to merge' :
                                        confidence >= 60 ? 'Needs minor fixes' :
                                        confidence >= 40 ? 'Needs attention' : 'Needs significant work';

                  return (
                    <div className="bg-[#161b22] rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-text-muted">Approval Confidence</span>
                        <span className={`text-2xl font-bold ${confidenceColor}`}>{confidence}%</span>
                      </div>
                      <div className="w-full bg-bg-tertiary rounded-full h-2 mb-2">
                        <div
                          className={`h-2 rounded-full ${confidenceBg} transition-all`}
                          style={{ width: `${confidence}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className={`text-xs ${confidenceColor}`}>{overallVerdict}</div>
                        <div className="flex items-center gap-3 text-[10px]">
                          <span className="text-green-400">✓ {approveCount}</span>
                          <span className="text-yellow-400">~ {concernCount}</span>
                          <span className="text-red-400">✗ {blockCount}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <h3 className="text-sm font-medium text-text-primary mb-4">Review Summary</h3>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-[#161b22] rounded p-3">
                    <div className="text-2xl font-bold text-text-primary">{reviewData.length}</div>
                    <div className="text-xs text-text-muted">Files reviewed</div>
                  </div>
                  <div className="bg-[#161b22] rounded p-3">
                    <div className="text-2xl font-bold text-text-primary">{allComments.length}</div>
                    <div className="text-xs text-text-muted">Total comments</div>
                  </div>
                  <div className="bg-[#161b22] rounded p-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400" />
                      <span className="text-lg font-bold text-red-400">
                        {allComments.filter(c => c.type === 'issue' && c.severity === 'error').length}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted">Errors</div>
                  </div>
                  <div className="bg-[#161b22] rounded p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-400" />
                      <span className="text-lg font-bold text-orange-400">
                        {allComments.filter(c => c.type === 'issue' && c.severity === 'warning').length}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted">Warnings</div>
                  </div>
                  <div className="bg-[#161b22] rounded p-3">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-400" />
                      <span className="text-lg font-bold text-blue-400">
                        {allComments.filter(c => c.type === 'issue' && c.severity === 'suggestion').length}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted">Suggestions</div>
                  </div>
                  <div className="bg-[#161b22] rounded p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span className="text-lg font-bold text-emerald-400">
                        {allComments.filter(c => c.type === 'highlight').length}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted">Highlights</div>
                  </div>
                </div>

                {/* Files with summaries */}
                <h4 className="text-xs font-medium text-text-muted mb-2">Files</h4>
                <div className="space-y-2">
                  {reviewData.map((file, idx) => {
                    const verdictIcon = file.verdict === 'approve' ? '✓' : file.verdict === 'block' ? '✗' : '~';
                    const verdictColor = file.verdict === 'approve' ? 'text-green-400' :
                                        file.verdict === 'block' ? 'text-red-400' : 'text-yellow-400';
                    const isSelected = selectedFileIndex === idx;
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedFileIndex(idx);
                          setSelectedCommentId(null);
                          // Scroll to first comment line if any, otherwise scroll to top
                          const firstComment = file.comments[0];
                          if (firstComment?.startLine) {
                            scrollToLine(firstComment.startLine, firstComment.endLine);
                          }
                        }}
                        className={`bg-[#161b22] rounded p-3 cursor-pointer transition-colors ${
                          isSelected ? 'ring-1 ring-accent-primary' : 'hover:bg-[#1c2128]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold ${verdictColor}`} title={file.verdict}>
                            {verdictIcon}
                          </span>
                          <span className={`text-xs ${
                            file.status === 'added' ? 'text-green-400' :
                            file.status === 'deleted' ? 'text-red-400' :
                            'text-yellow-400'
                          }`}>
                            {file.status === 'added' ? '+' : file.status === 'deleted' ? '-' : '~'}
                          </span>
                          <span className="text-xs font-mono text-text-primary truncate">{file.path}</span>
                          <span className="text-[10px] text-text-muted ml-auto">
                            {file.comments.length} comment{file.comments.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {file.summary && (
                          <p className="text-xs text-text-muted mt-1">{file.summary}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Full Diff View */}
          <div className="w-1/2 flex flex-col overflow-hidden">
            {displayFile ? (
              <>
                {/* File Header */}
                <div className="px-4 py-2 border-b border-border-primary bg-[#161b22] flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-text-muted" />
                    <span className="text-sm font-mono text-text-primary truncate">{displayFile.path}</span>
                    <span className={`text-[10px] px-1 rounded ${
                      displayFile.status === 'added' ? 'bg-green-500/20 text-green-400' :
                      displayFile.status === 'deleted' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {displayFile.status === 'added' ? 'A' : displayFile.status === 'deleted' ? 'D' : 'M'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-400">+{diffStats.additions}</span>
                    <span className="text-xs text-red-400">-{diffStats.deletions}</span>
                  </div>
                </div>

                {/* Search Bar */}
                {showSearch && (
                  <div className="px-4 py-2 border-b border-border-primary bg-[#161b22] flex items-center gap-2">
                    <Search className="w-4 h-4 text-text-muted" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.shiftKey ? handleSearchPrev() : handleSearchNext();
                        }
                      }}
                      placeholder="Search in diff..."
                      className="flex-1 bg-bg-primary border border-border-primary rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-primary"
                      autoFocus
                    />
                    <span className="text-xs text-text-muted">
                      {searchMatches.length > 0 ? `${currentMatchIndex + 1}/${searchMatches.length}` : 'No matches'}
                    </span>
                    <button
                      onClick={handleSearchPrev}
                      disabled={searchMatches.length === 0}
                      className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                      title="Previous (Shift+Enter)"
                    >
                      <ChevronRight className="w-4 h-4 rotate-180" />
                    </button>
                    <button
                      onClick={handleSearchNext}
                      disabled={searchMatches.length === 0}
                      className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
                      title="Next (Enter)"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setShowSearch(false);
                        setSearchQuery('');
                        setSearchMatches([]);
                      }}
                      className="p-1 text-text-muted hover:text-text-primary"
                      title="Close (Esc)"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Full Diff View */}
                <div
                  ref={diffRef}
                  className="flex-1 overflow-auto bg-[#0d1117] font-mono text-xs"
                >
                  {displayDiffLines.map((line, lineIndex) => {
                    const lineNum = line.newLineNum;
                    const highlighted = lineNum ? isLineHighlighted(lineNum) : false;
                    // Create a stable key based on the file path and line position
                    const stableKey = `${displayFile.path}-${lineIndex}`;

                    // Check if this line is a search match
                    const isSearchMatch = searchQuery && searchMatches.some(
                      m => m.fileIndex === selectedFileIndex && m.lineIndex === lineIndex
                    );
                    const isCurrentMatch = searchQuery && searchMatches[currentMatchIndex]?.fileIndex === selectedFileIndex
                      && searchMatches[currentMatchIndex]?.lineIndex === lineIndex;

                    // Highlight search matches in content
                    const renderContent = () => {
                      if (!searchQuery || !line.content.toLowerCase().includes(searchQuery.toLowerCase())) {
                        return line.content;
                      }
                      const parts: React.ReactNode[] = [];
                      let lastIndex = 0;
                      const lowerContent = line.content.toLowerCase();
                      const lowerQuery = searchQuery.toLowerCase();
                      let matchIndex = lowerContent.indexOf(lowerQuery);
                      let partKey = 0;
                      while (matchIndex !== -1) {
                        if (matchIndex > lastIndex) {
                          parts.push(<span key={partKey++}>{line.content.slice(lastIndex, matchIndex)}</span>);
                        }
                        parts.push(
                          <span key={partKey++} className={`${isCurrentMatch ? 'bg-yellow-400 text-black' : 'bg-yellow-400/50 text-black'} rounded px-0.5`}>
                            {line.content.slice(matchIndex, matchIndex + searchQuery.length)}
                          </span>
                        );
                        lastIndex = matchIndex + searchQuery.length;
                        matchIndex = lowerContent.indexOf(lowerQuery, lastIndex);
                      }
                      if (lastIndex < line.content.length) {
                        parts.push(<span key={partKey++}>{line.content.slice(lastIndex)}</span>);
                      }
                      return parts;
                    };

                    return (
                      <div
                        key={stableKey}
                        data-line={lineNum}
                        data-line-index={lineIndex}
                        className={`flex items-stretch border-l-2 ${
                          isCurrentMatch ? 'bg-yellow-500/20 border-yellow-400' :
                          highlighted ? 'bg-accent-primary/30 border-accent-primary' :
                          line.type === 'addition' ? 'bg-green-500/10 border-transparent' :
                          line.type === 'deletion' ? 'bg-red-500/10 border-transparent' :
                          line.type === 'header' ? 'bg-blue-500/10 border-transparent' : 'border-transparent'
                        }`}
                      >
                        {/* Line numbers */}
                        <div className="w-10 text-right pr-2 py-0.5 text-text-muted select-none border-r border-border-primary flex-shrink-0">
                          {line.oldLineNum || ''}
                        </div>
                        <div className="w-10 text-right pr-2 py-0.5 text-text-muted select-none border-r border-border-primary flex-shrink-0">
                          {line.newLineNum || ''}
                        </div>

                        {/* Line content */}
                        <div className="flex-1 flex items-center">
                          <span className={`w-4 text-center flex-shrink-0 ${
                            line.type === 'addition' ? 'text-green-400' :
                            line.type === 'deletion' ? 'text-red-400' :
                            line.type === 'header' ? 'text-blue-400' : ''
                          }`}>
                            {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : line.type === 'header' ? '@' : ' '}
                          </span>
                          <pre className={`flex-1 py-0.5 pr-4 whitespace-pre ${
                            line.type === 'header' ? 'text-blue-400' : 'text-text-primary'
                          }`}>
                            {renderContent()}
                          </pre>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-text-muted">
                No files to review
              </div>
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="px-4 py-2 border-t border-border-primary bg-bg-secondary">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted font-mono">
              {pendingCount === 0 ? 'all comments reviewed' : `${pendingCount} pending review`}
              {!hasOpenPR && <span className="ml-2 text-yellow-500">(local review - no PR)</span>}
            </span>
            <div className="flex items-center gap-3">
              {hasOpenPR ? (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="text-xs font-mono text-green-400 hover:text-green-300 transition-colors"
                >
                  [ submit review ]
                </button>
              ) : (
                <button
                  onClick={openCreatePRModal}
                  className="text-xs font-mono text-accent-primary hover:text-accent-primary/80 transition-colors"
                >
                  [ push & create PR ]
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Confirm Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className={`bg-bg-secondary border border-border-primary rounded-lg shadow-xl w-full mx-4 transition-all ${showBatchProgress ? 'max-w-xs' : 'max-w-md'}`}>
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
                <h3 className="text-sm font-medium text-text-primary">
                  {showBatchProgress ? 'Submitting Review...' : 'Submit Review to GitHub'}
                </h3>
                {!showBatchProgress && (
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Modal Body */}
              <div className="p-4 max-h-[60vh] overflow-auto">
                {/* Batch Progress View */}
                {showBatchProgress ? (
                  <div className="py-4">
                    <div className="text-center mb-4">
                      <p className="text-sm text-text-primary mb-2">
                        {batchProgress.some(b => b.status === 'failed') ? 'Submission failed' :
                         batchProgress.some(b => b.status === 'rolling-back') ? 'Rolling back...' :
                         batchProgress.every(b => b.status === 'success') ? 'Review submitted!' :
                         'Submitting review to GitHub...'}
                      </p>
                      <p className="text-xs text-text-muted">
                        {batchProgress.length > 0 ?
                          `${batchProgress.filter(b => b.status === 'success').length} of ${batchProgress.length} batches complete` :
                          'Preparing batches...'}
                      </p>
                    </div>

                    {/* Batch boxes - flexbox for centering */}
                    <div className="flex flex-wrap justify-center gap-[3px] mb-4">
                      {batchProgress.map((batch) => {
                        const bgColor = batch.status === 'sending' ? 'bg-blue-500/10' :
                                       batch.status === 'success' ? 'bg-green-500/20' :
                                       batch.status === 'failed' ? 'bg-red-500/20' :
                                       batch.status === 'rolling-back' ? 'bg-orange-500/20' :
                                       'bg-bg-primary';
                        const borderColor = batch.status === 'success' ? 'border-green-500' :
                                           batch.status === 'failed' ? 'border-red-500' :
                                           batch.status === 'rolling-back' ? 'border-orange-500' :
                                           batch.status === 'sending' ? 'border-transparent' :
                                           'border-border-primary';
                        const textColor = batch.status === 'sending' ? 'text-blue-400' :
                                         batch.status === 'success' ? 'text-green-400' :
                                         batch.status === 'failed' ? 'text-red-400' :
                                         batch.status === 'rolling-back' ? 'text-orange-400' :
                                         'text-text-muted';

                        // Animated border for sending state
                        if (batch.status === 'sending') {
                          // Perimeter of the rect (36*4 = 144) for stroke-dasharray
                          return (
                            <div
                              key={batch.batch}
                              className="relative w-10 h-10"
                            >
                              {/* SVG with animated stroke traveling along the border */}
                              <svg
                                className="absolute inset-0 w-full h-full"
                                viewBox="0 0 40 40"
                              >
                                {/* Background rect border */}
                                <rect
                                  x="2"
                                  y="2"
                                  width="36"
                                  height="36"
                                  rx="4"
                                  fill="none"
                                  stroke="#1e3a5f"
                                  strokeWidth="2"
                                />
                                {/* Animated traveling line */}
                                <rect
                                  x="2"
                                  y="2"
                                  width="36"
                                  height="36"
                                  rx="4"
                                  fill="none"
                                  stroke="#3b82f6"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeDasharray="30 114"
                                  style={{
                                    animation: 'dash-travel 1s linear infinite',
                                  }}
                                />
                              </svg>
                              {/* Inner box */}
                              <div className={`absolute inset-[3px] rounded ${bgColor} flex items-center justify-center`}>
                                <span className={`text-sm font-mono font-bold ${textColor}`}>
                                  {batch.batch}
                                </span>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={batch.batch}
                            className={`w-10 h-10 flex items-center justify-center rounded border-2 ${borderColor} ${bgColor} transition-all duration-300`}
                          >
                            <span className={`text-sm font-mono font-bold ${textColor}`}>
                              {batch.batch}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Status legend */}
                    <div className="flex justify-center gap-4 text-[10px] text-text-muted">
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded border border-border-primary bg-bg-primary" /> pending
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded border-2 border-blue-500 bg-blue-500/10 animate-pulse" /> sending
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded border-2 border-green-500 bg-green-500/20" /> success
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded border-2 border-red-500 bg-red-500/20" /> failed
                      </span>
                    </div>

                    {/* Error display */}
                    {submitError && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded p-3 mt-4">
                        <div className="flex items-center gap-2 text-red-400 text-xs">
                          <AlertCircle className="w-4 h-4" />
                          <span>{submitError}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Summary stats */}
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      <div className="bg-bg-primary rounded p-2 text-center">
                        <div className="text-lg font-bold text-red-400">
                          {allComments.filter(c => c.type === 'issue' && c.severity === 'error').length}
                        </div>
                        <div className="text-[10px] text-text-muted">Errors</div>
                      </div>
                      <div className="bg-bg-primary rounded p-2 text-center">
                        <div className="text-lg font-bold text-yellow-400">
                          {allComments.filter(c => c.type === 'issue' && c.severity === 'warning').length}
                        </div>
                        <div className="text-[10px] text-text-muted">Warnings</div>
                      </div>
                      <div className="bg-bg-primary rounded p-2 text-center">
                        <div className="text-lg font-bold text-blue-400">
                          {allComments.filter(c => c.type === 'issue' && c.severity === 'suggestion').length}
                        </div>
                        <div className="text-[10px] text-text-muted">Suggestions</div>
                      </div>
                      <div className="bg-bg-primary rounded p-2 text-center">
                        <div className="text-lg font-bold text-green-400">
                          {allComments.filter(c => c.type === 'highlight').length}
                        </div>
                        <div className="text-[10px] text-text-muted">Highlights</div>
                      </div>
                    </div>

                    {/* Pending comments warning */}
                    {pendingCount > 0 && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 mb-4">
                        <div className="flex items-center gap-2 text-yellow-400 text-xs mb-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="font-medium">{pendingCount} comment{pendingCount !== 1 ? 's' : ''} not yet reviewed</span>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-auto">
                          {allComments.filter(c => c.status === 'pending').map((comment) => (
                            <div key={comment.id} className="flex items-center gap-2 text-xs text-text-muted">
                              <div className={`w-2 h-2 rounded-full border ${
                                comment.type === 'highlight' ? 'border-green-500' :
                                comment.severity === 'error' ? 'border-red-500' :
                                comment.severity === 'warning' ? 'border-yellow-500' :
                                'border-blue-500'
                              }`} />
                              <span className="font-mono text-[10px] text-text-secondary">{comment.filePath.split('/').pop()}</span>
                              <span className="truncate">{comment.message.slice(0, 50)}{comment.message.length > 50 ? '...' : ''}</span>
                              {comment.suggestedFix && <span className="text-[10px] text-green-400" title="Has suggested fix">[fix]</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Error display */}
                    {submitError && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded p-3 mb-4">
                        <div className="flex items-center gap-2 text-red-400 text-xs">
                          <AlertCircle className="w-4 h-4" />
                          <span>{submitError}</span>
                        </div>
                      </div>
                    )}

                    {/* Info text */}
                    <p className="text-xs text-text-muted mb-4">
                      This will submit your review comments to the GitHub PR. Choose an action:
                    </p>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-primary bg-bg-primary/50">
                {showBatchProgress ? (
                  <button
                    onClick={() => {
                      setShowConfirmModal(false);
                      setShowBatchProgress(false);
                      setBatchProgress([]);
                      setSubmitError(null);
                    }}
                    className="text-xs font-mono text-text-muted hover:text-text-primary px-3 py-1.5 rounded transition-colors"
                  >
                    [ close ]
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setShowConfirmModal(false)}
                      disabled={isSubmitting}
                      className="text-xs font-mono text-text-muted hover:text-text-primary px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                    >
                      [ cancel ]
                    </button>
                    <button
                      onClick={() => handleSubmitReview('reject')}
                      disabled={isSubmitting}
                      className="text-xs font-mono text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                    >
                      [ request changes ]
                    </button>
                    <button
                      onClick={() => handleSubmitReview('approve')}
                      disabled={isSubmitting}
                      className="text-xs font-mono text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                    >
                      [ approve ]
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create PR Modal */}
        {showCreatePRModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-bg-secondary border border-border-primary rounded-lg shadow-xl w-full max-w-lg mx-4">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
                <h3 className="text-sm font-medium text-text-primary">
                  Push & Create Pull Request
                </h3>
                <button
                  onClick={() => setShowCreatePRModal(false)}
                  className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 space-y-4">
                {/* Branch info */}
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <GitBranch className="w-4 h-4" />
                  <span className="font-mono text-accent-primary">{branch}</span>
                  <span>→</span>
                  <span className="font-mono text-text-primary">{prBaseBranch || 'main'}</span>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs text-text-muted mb-1">Title</label>
                  <input
                    type="text"
                    value={prTitle}
                    onChange={(e) => setPrTitle(e.target.value)}
                    className="w-full bg-bg-primary border border-border-primary rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                    placeholder="PR title..."
                  />
                </div>

                {/* Base branch */}
                <div>
                  <label className="block text-xs text-text-muted mb-1">Base branch</label>
                  <input
                    type="text"
                    value={prBaseBranch}
                    onChange={(e) => setPrBaseBranch(e.target.value)}
                    className="w-full bg-bg-primary border border-border-primary rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                    placeholder="main"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs text-text-muted mb-1">
                    Description
                    {prTemplate && <span className="text-accent-primary ml-1">(template loaded)</span>}
                  </label>
                  <textarea
                    value={prBody}
                    onChange={(e) => setPrBody(e.target.value)}
                    className="w-full bg-bg-primary border border-border-primary rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary h-48 font-mono resize-none"
                    placeholder="Describe your changes..."
                  />
                </div>

                {/* Error */}
                {createPRError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                    <div className="flex items-center gap-2 text-red-400 text-xs">
                      <AlertCircle className="w-4 h-4" />
                      <span>{createPRError}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-primary bg-bg-primary/50">
                <button
                  onClick={() => setShowCreatePRModal(false)}
                  disabled={isCreatingPR}
                  className="text-xs font-mono text-text-muted hover:text-text-primary px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                >
                  [ cancel ]
                </button>
                <button
                  onClick={handleCreatePR}
                  disabled={isCreatingPR || !prTitle.trim() || !prBaseBranch.trim()}
                  className="text-xs font-mono text-accent-primary hover:text-accent-primary/80 bg-accent-primary/10 hover:bg-accent-primary/20 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                >
                  {isCreatingPR ? (isPushing ? '[ pushing... ]' : '[ creating PR... ]') : '[ push & create PR ]'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Reviewing/Generating View
  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-primary bg-bg-secondary">
        <span className="text-xs font-mono text-text-muted">
          review: <span className="text-accent-primary">{branch}</span>
          {viewMode === 'reviewing' && totalFiles > 0 && (
            <span className="text-text-muted ml-2">({filesReviewed}/{totalFiles})</span>
          )}
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          title="Exit review"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Terminal-style log output */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-auto p-4 bg-[#0d1117]"
      >
        <div className="space-y-0.5">
          {logs.map((log, i) => formatLog(log, i))}
          {viewMode !== 'report' && (
            <div className="font-mono text-xs text-text-muted animate-pulse">
              <span className="opacity-60">...</span>
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 py-2 border-t border-border-primary bg-bg-secondary">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted font-mono">
            {viewMode === 'generating' ? 'generating report...' :
             totalFiles > 0 ? `${currentStepLabel}...` : 'initializing...'}
          </span>
          <div className="flex items-center gap-3">
            {viewMode === 'reviewing' && totalFiles > 0 && (
              <span className="text-xs font-mono text-accent-primary">
                {getAsciiBar(16)} {getProgress()}%
              </span>
            )}
            {viewMode === 'generating' && (
              <span className="text-xs font-mono text-purple-400 animate-pulse">
                preparing report...
              </span>
            )}
            <button
              onClick={onClose}
              className="text-xs font-mono text-text-secondary hover:text-accent-primary transition-colors"
            >
              [ exit ]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
