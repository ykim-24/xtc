import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { PixelLinear } from '@/components/feature-sidebar/PixelIcons';
import { PixelDinoChase } from '@/components/ui/PixelDinoChase';
import { StartWorkPanel } from './StartWorkPanel';
import { useTestStore } from '@/stores';

const priorityLabels: Record<number, { label: string; color: string }> = {
  0: { label: 'No priority', color: 'text-text-muted' },
  1: { label: 'Urgent', color: 'text-red-400' },
  2: { label: 'High', color: 'text-orange-400' },
  3: { label: 'Medium', color: 'text-yellow-400' },
  4: { label: 'Low', color: 'text-blue-400' },
};

// Color palette for comment borders (excluding blue which is reserved for current user)
const userColors = [
  '#f87171', // red
  '#fb923c', // orange
  '#fbbf24', // amber
  '#a3e635', // lime
  '#34d399', // emerald
  '#22d3ee', // cyan
  '#a78bfa', // violet
  '#f472b6', // pink
  '#e879f9', // fuchsia
];

// Generate consistent color for a user based on their ID
function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash;
  }
  return userColors[Math.abs(hash) % userColors.length];
}

// Status type ordering for grouping
const statusTypeOrder: Record<string, number> = {
  'started': 0,
  'unstarted': 1,
  'backlog': 2,
  'completed': 3,
  'canceled': 4,
};

export function LinearPanel() {
  const { mode } = useTestStore();
  const [issues, setIssues] = useState<LinearIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<LinearIssueDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [filterProject, setFilterProject] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterLabel, setFilterLabel] = useState<string>('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const lastModeRef = useRef(mode);

  // Refresh when switching to linear tab (silent refresh - no loading state)
  useEffect(() => {
    if (mode === 'linear' && lastModeRef.current !== 'linear') {
      loadIssues(true); // Silent refresh
    }
    lastModeRef.current = mode;
  }, [mode]);

  const loadIssues = async (silent = false) => {
    // Only show loading spinner on initial load (no existing data)
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);

    const keyResult = await window.electron?.store.get<string>('linear_api_key');
    if (!keyResult?.success || !keyResult.data) {
      setError('No API key found');
      setIsLoading(false);
      return;
    }

    const result = await window.electron?.linear.getMyIssues(keyResult.data);

    if (result?.success && result.issues) {
      setIssues(result.issues);
    } else if (!silent) {
      // Only show error on explicit refresh, not silent background refresh
      setError(result?.error || 'Failed to load issues');
    }

    setIsLoading(false);
  };

  const loadIssueDetail = async (issueId: string) => {
    setIsLoadingDetail(true);

    const keyResult = await window.electron?.store.get<string>('linear_api_key');
    if (!keyResult?.success || !keyResult.data) {
      setIsLoadingDetail(false);
      return;
    }

    const result = await window.electron?.linear.getIssue(keyResult.data, issueId);

    if (result?.success && result.issue) {
      setSelectedIssue(result.issue);
    }

    setIsLoadingDetail(false);
  };

  const handleIssueClick = (issue: LinearIssue) => {
    loadIssueDetail(issue.id);
  };

  const handleBack = () => {
    setSelectedIssue(null);
  };

  useEffect(() => {
    loadIssues();
  }, []);

  // Extract unique filter options from issues
  const filterOptions = useMemo(() => {
    const projects = new Map<string, { id: string; name: string; color: string }>();
    const labels = new Map<string, { id: string; name: string; color: string }>();

    for (const issue of issues) {
      if (issue.project) {
        projects.set(issue.project.id, issue.project);
      }
      for (const label of issue.labels.nodes) {
        labels.set(label.id, label);
      }
    }

    return {
      projects: Array.from(projects.values()).sort((a, b) => a.name.localeCompare(b.name)),
      labels: Array.from(labels.values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [issues]);

  // Filter issues by search query and dropdown filters
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      // Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          issue.title.toLowerCase().includes(query) ||
          issue.identifier.toLowerCase().includes(query) ||
          issue.state.name.toLowerCase().includes(query) ||
          issue.project?.name.toLowerCase().includes(query) ||
          issue.labels.nodes.some(l => l.name.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Project filter
      if (filterProject && issue.project?.id !== filterProject) {
        return false;
      }

      // Priority filter
      if (filterPriority && issue.priority !== parseInt(filterPriority)) {
        return false;
      }

      // Label filter
      if (filterLabel && !issue.labels.nodes.some(l => l.id === filterLabel)) {
        return false;
      }

      return true;
    });
  }, [issues, searchQuery, filterProject, filterPriority, filterLabel]);

  const hasActiveFilters = searchQuery || filterProject || filterPriority || filterLabel;

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterProject('');
    setFilterPriority('');
    setFilterLabel('');
  };

  // Group issues by status
  const groupedIssues = useMemo(() => {
    const groups: Record<string, { status: LinearIssue['state']; issues: LinearIssue[] }> = {};

    for (const issue of filteredIssues) {
      const statusKey = issue.state.name;
      if (!groups[statusKey]) {
        groups[statusKey] = { status: issue.state, issues: [] };
      }
      groups[statusKey].issues.push(issue);
    }

    // Sort groups by status type order
    return Object.entries(groups).sort(([, a], [, b]) => {
      const orderA = statusTypeOrder[a.status.type] ?? 99;
      const orderB = statusTypeOrder[b.status.type] ?? 99;
      return orderA - orderB;
    });
  }, [filteredIssues]);

  const toggleGroup = (statusName: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(statusName)) {
        next.delete(statusName);
      } else {
        next.add(statusName);
      }
      return next;
    });
  };

  // Show detail view
  if (selectedIssue || isLoadingDetail) {
    return (
      <IssueDetailView
        issue={selectedIssue}
        isLoading={isLoadingDetail}
        onBack={handleBack}
        onRefresh={() => selectedIssue && loadIssueDetail(selectedIssue.id)}
        onListRefresh={loadIssues}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
        <div className="flex items-center gap-2">
          <PixelLinear className="w-5 h-5 text-text-primary" />
          <h2 className="text-sm font-medium text-text-primary">My Issues</h2>
          <span className="text-xs text-text-muted">({issues.length})</span>
        </div>
        {!isLoading && (
          <button
            onClick={loadIssues}
            className="text-xs text-text-muted hover:text-text-primary transition-colors font-mono"
          >
            [ refresh ]
          </button>
        )}
      </div>

      {/* Search and filters - all in one line */}
      {!isLoading && issues.length > 0 && (
        <div className="px-4 py-2 border-b border-border-primary">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center text-xs font-mono text-text-secondary">
              <span>[</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="search..."
                className="flex-1 px-1 bg-transparent focus:outline-none text-text-primary placeholder-text-muted"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-text-muted hover:text-blue-400 transition-colors mr-1"
                >
                  (clear)
                </button>
              )}
              <span>]</span>
            </div>
            {/* Project dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowProjectDropdown(!showProjectDropdown);
                  setShowPriorityDropdown(false);
                  setShowLabelDropdown(false);
                }}
                className="text-xs font-mono text-text-secondary hover:text-accent-primary transition-colors flex items-center gap-1"
              >
                [ <span className="w-[70px] truncate inline-block align-bottom">{filterProject ? filterOptions.projects.find(p => p.id === filterProject)?.name : 'project'}</span> <ChevronDown className="w-3 h-3" /> ]
              </button>
              {showProjectDropdown && (
                <div className="absolute left-0 top-full mt-1 min-w-[150px] max-w-[200px] bg-bg-secondary border border-border-primary rounded shadow-lg z-50">
                  <button
                    onClick={() => { setFilterProject(''); setShowProjectDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-bg-hover ${!filterProject ? 'text-accent-primary' : 'text-text-primary'}`}
                  >
                    All Projects
                  </button>
                  {filterOptions.projects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => { setFilterProject(project.id); setShowProjectDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-bg-hover truncate ${filterProject === project.id ? 'text-accent-primary' : 'text-text-primary'}`}
                      title={project.name}
                    >
                      {project.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Priority dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowPriorityDropdown(!showPriorityDropdown);
                  setShowProjectDropdown(false);
                  setShowLabelDropdown(false);
                }}
                className="text-xs font-mono text-text-secondary hover:text-accent-primary transition-colors flex items-center gap-1"
              >
                [ {filterPriority ? priorityLabels[parseInt(filterPriority)]?.label : 'priority'} <ChevronDown className="w-3 h-3" /> ]
              </button>
              {showPriorityDropdown && (
                <div className="absolute left-0 top-full mt-1 min-w-[120px] bg-bg-secondary border border-border-primary rounded shadow-lg z-50">
                  <button
                    onClick={() => { setFilterPriority(''); setShowPriorityDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-bg-hover ${!filterPriority ? 'text-accent-primary' : 'text-text-primary'}`}
                  >
                    All Priorities
                  </button>
                  {[1, 2, 3, 4, 0].map(p => (
                    <button
                      key={p}
                      onClick={() => { setFilterPriority(String(p)); setShowPriorityDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-bg-hover ${filterPriority === String(p) ? 'text-accent-primary' : priorityLabels[p].color}`}
                    >
                      {priorityLabels[p].label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Label dropdown */}
            {filterOptions.labels.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => {
                    setShowLabelDropdown(!showLabelDropdown);
                    setShowProjectDropdown(false);
                    setShowPriorityDropdown(false);
                  }}
                  className="text-xs font-mono text-text-secondary hover:text-accent-primary transition-colors flex items-center gap-1"
                >
                  [ {filterLabel ? filterOptions.labels.find(l => l.id === filterLabel)?.name : 'label'} <ChevronDown className="w-3 h-3" /> ]
                </button>
                {showLabelDropdown && (
                  <div className="absolute left-0 top-full mt-1 min-w-[150px] bg-bg-secondary border border-border-primary rounded shadow-lg z-50 max-h-[200px] overflow-auto">
                    <button
                      onClick={() => { setFilterLabel(''); setShowLabelDropdown(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-bg-hover ${!filterLabel ? 'text-accent-primary' : 'text-text-primary'}`}
                    >
                      All Labels
                    </button>
                    {filterOptions.labels.map(label => (
                      <button
                        key={label.id}
                        onClick={() => { setFilterLabel(label.id); setShowLabelDropdown(false); }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-bg-hover ${filterLabel === label.id ? 'text-accent-primary' : 'text-text-primary'}`}
                      >
                        {label.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => setCollapsedGroups(new Set(groupedIssues.map(([name]) => name)))}
              className="text-xs text-text-muted hover:text-text-primary font-mono whitespace-nowrap"
              title="Collapse all groups"
            >
              [ - ]
            </button>
            <button
              onClick={() => setCollapsedGroups(new Set())}
              className="text-xs text-text-muted hover:text-text-primary font-mono whitespace-nowrap"
              title="Expand all groups"
            >
              [ + ]
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <PixelDinoChase size={100} />
            <div className="text-text-muted text-sm">Loading issues...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-400 text-sm">{error}</div>
          </div>
        ) : issues.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-text-muted text-sm">No issues assigned to you</div>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-text-muted text-sm">No issues match your search</div>
          </div>
        ) : (
          <div className="py-2">
            {groupedIssues.map(([statusName, { status, issues: groupIssues }]) => {
              const isCollapsed = collapsedGroups.has(statusName);
              return (
                <div key={statusName} className="mb-2">
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(statusName)}
                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-bg-hover transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3 text-text-muted" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-text-muted" />
                    )}
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="text-xs font-medium text-text-primary">{statusName}</span>
                    <span className="text-xs text-text-muted">({groupIssues.length})</span>
                  </button>

                  {/* Group items */}
                  {!isCollapsed && (
                    <div className="divide-y divide-border-primary">
                      {groupIssues.map((issue) => (
                        <IssueRow key={issue.id} issue={issue} onClick={() => handleIssueClick(issue)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function IssueRow({ issue, onClick }: { issue: LinearIssue; onClick: () => void }) {
  const priority = priorityLabels[issue.priority] || priorityLabels[0];

  return (
    <div
      className="px-4 py-3 hover:bg-bg-hover transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* State indicator */}
        <div
          className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
          style={{ backgroundColor: issue.state.color }}
          title={issue.state.name}
        />

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted font-mono">{issue.identifier}</span>
            <span className={`text-xs ${priority.color}`}>{priority.label !== 'No priority' && `P${issue.priority}`}</span>
          </div>

          {/* Title */}
          <div className="text-sm text-text-primary mt-0.5 truncate">
            {issue.title}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {/* Project */}
            {issue.project && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${issue.project.color}20`, color: issue.project.color }}
              >
                {issue.project.name}
              </span>
            )}

            {/* Labels */}
            {issue.labels.nodes.map((label) => (
              <span
                key={label.id}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${label.color}20`, color: label.color }}
              >
                {label.name}
              </span>
            ))}

            {/* State */}
            <span className="text-xs text-text-muted">{issue.state.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function IssueDetailView({
  issue,
  isLoading,
  onBack,
  onRefresh,
  onListRefresh,
}: {
  issue: LinearIssueDetail | null;
  isLoading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onListRefresh: () => void;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isDeletingComment, setIsDeletingComment] = useState<string | null>(null);
  const [showStartWork, setShowStartWork] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [availableStates, setAvailableStates] = useState<Array<{ id: string; name: string; color: string; type: string }>>([]);
  const [isLoadingStates, setIsLoadingStates] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const priority = issue ? (priorityLabels[issue.priority] || priorityLabels[0]) : priorityLabels[0];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const generateSummary = useCallback(async () => {
    if (!issue) return;

    setIsLoadingSummary(true);
    setSummaryError(null);

    const result = await window.electron?.linear.generateSummary({
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description,
      comments: issue.comments.nodes.map(c => ({
        body: c.body,
        user: { name: c.user.name },
        createdAt: c.createdAt,
      })),
    });

    if (result?.success && result.summary) {
      setSummary(result.summary);
    } else {
      setSummaryError(result?.error || 'Failed to generate summary');
    }

    setIsLoadingSummary(false);
  }, [issue]);

  const handleSubmitComment = async () => {
    if (!issue || !commentText.trim()) return;

    setIsSubmittingComment(true);

    const keyResult = await window.electron?.store.get<string>('linear_api_key');
    if (!keyResult?.success || !keyResult.data) {
      setIsSubmittingComment(false);
      return;
    }

    const result = await window.electron?.linear.createComment(
      keyResult.data,
      issue.id,
      commentText.trim()
    );

    if (result?.success) {
      setCommentText('');
      onRefresh(); // Refresh to show new comment
    }

    setIsSubmittingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;

    setIsDeletingComment(commentId);

    const keyResult = await window.electron?.store.get<string>('linear_api_key');
    if (!keyResult?.success || !keyResult.data) {
      setIsDeletingComment(null);
      return;
    }

    const result = await window.electron?.linear.deleteComment(keyResult.data, commentId);

    if (result?.success) {
      onRefresh(); // Refresh to update comments
    }

    setIsDeletingComment(null);
  };

  const handleStatusClick = async () => {
    if (!issue || isLoadingStates) return;

    if (showStatusDropdown) {
      setShowStatusDropdown(false);
      return;
    }

    setIsLoadingStates(true);
    const keyResult = await window.electron?.store.get<string>('linear_api_key');
    if (keyResult?.success && keyResult.data) {
      const result = await window.electron?.linear.getIssueStates(keyResult.data, issue.id);
      if (result?.success && result.states) {
        setAvailableStates(result.states);
      }
    }
    setIsLoadingStates(false);
    setShowStatusDropdown(true);
  };

  const handleStatusChange = async (stateId: string) => {
    if (!issue) return;

    setIsUpdatingStatus(true);
    setShowStatusDropdown(false);

    const keyResult = await window.electron?.store.get<string>('linear_api_key');
    if (keyResult?.success && keyResult.data) {
      const result = await window.electron?.linear.updateIssue(keyResult.data, issue.id, { stateId });
      if (result?.success) {
        onRefresh(); // Refresh detail to show new status
        onListRefresh(); // Refresh list so it's updated when going back
      }
    }

    setIsUpdatingStatus(false);
  };

  // Auto-generate summary when issue loads
  useEffect(() => {
    if (issue && !summary && !isLoadingSummary) {
      generateSummary();
    }
  }, [issue?.identifier]);

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="text-xs text-text-muted hover:text-text-primary transition-colors font-mono"
          >
            [ back ]
          </button>
          {issue && (
            <>
              <span className="text-text-muted">/</span>
              <span className="text-xs text-text-muted font-mono">{issue.identifier}</span>
            </>
          )}
        </div>
        {issue && (
          <button
            onClick={() => setShowStartWork(true)}
            className="text-xs text-text-muted hover:text-text-primary transition-colors font-mono"
          >
            [ start work ]
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <PixelDinoChase size={100} />
            <div className="text-text-muted text-sm">Loading issue...</div>
          </div>
        ) : issue ? (
          <div className="p-4 space-y-4">
            {/* Title & State */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: issue.state.color }}
                />
                <span className="text-xs text-text-muted font-mono">{issue.identifier}</span>
                {priority.label !== 'No priority' && (
                  <span className={`text-xs ${priority.color}`}>P{issue.priority}</span>
                )}
                {issue.branchName && (
                  <>
                    <span className="text-text-muted">/</span>
                    <code className="text-xs text-text-primary font-mono">{issue.branchName}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(issue.branchName!)}
                      className="text-xs text-text-muted hover:text-text-primary transition-colors font-mono"
                      title="Copy branch name"
                    >
                      [ copy ]
                    </button>
                  </>
                )}
              </div>
              <h1 className="text-lg font-medium text-text-primary">{issue.title}</h1>
            </div>

            {/* Meta info */}
            <div className="flex flex-wrap gap-2">
              {issue.project && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${issue.project.color}20`, color: issue.project.color }}
                >
                  {issue.project.name}
                </span>
              )}
              {issue.labels.nodes.map((label) => (
                <span
                  key={label.id}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${label.color}20`, color: label.color }}
                >
                  {label.name}
                </span>
              ))}
              <div className="relative">
                <button
                  onClick={handleStatusClick}
                  disabled={isUpdatingStatus}
                  className="text-xs px-1.5 py-0.5 rounded cursor-pointer hover:ring-1 hover:ring-white/20 transition-all disabled:opacity-50"
                  style={{ backgroundColor: `${issue.state.color}20`, color: issue.state.color }}
                >
                  {isUpdatingStatus ? '...' : isLoadingStates ? '...' : issue.state.name}
                </button>
                {showStatusDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowStatusDropdown(false)} />
                    <div className="absolute top-full left-0 mt-1 bg-bg-secondary border border-border-primary rounded shadow-lg z-20 min-w-[120px] py-1">
                      {availableStates.map((state) => (
                        <button
                          key={state.id}
                          onClick={() => handleStatusChange(state.id)}
                          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-bg-hover flex items-center gap-2 ${state.id === issue.state.id ? 'bg-bg-hover' : ''}`}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: state.color }}
                          />
                          <span className="text-text-primary">{state.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Summary and Details side by side */}
            <div className="flex gap-4">
              {/* AI Summary */}
              <div className="flex-1 border border-border-primary rounded p-3">
                <div className="text-xs text-text-muted mb-2">AI Summary</div>
                {isLoadingSummary ? (
                  <div className="text-xs text-text-muted animate-pulse">Generating summary...</div>
                ) : summaryError ? (
                  <div className="text-xs text-red-400">{summaryError}</div>
                ) : summary ? (
                  <div className="text-xs text-text-primary leading-relaxed">{summary}</div>
                ) : (
                  <div className="text-xs text-text-muted">No summary available</div>
                )}
              </div>

              {/* Details grid */}
              <div className="flex-1 grid grid-cols-2 gap-2 text-xs border border-border-primary rounded p-3 h-fit">
                {issue.assignee && (
                  <>
                    <span className="text-text-muted">Assignee</span>
                    <span className="text-text-primary">{issue.assignee.name}</span>
                  </>
                )}
                {issue.creator && (
                  <>
                    <span className="text-text-muted">Creator</span>
                    <span className="text-text-primary">{issue.creator.name}</span>
                  </>
                )}
                {issue.dueDate && (
                  <>
                    <span className="text-text-muted">Due Date</span>
                    <span className="text-text-primary">{formatDate(issue.dueDate)}</span>
                  </>
                )}
                {issue.estimate !== undefined && issue.estimate !== null && (
                  <>
                    <span className="text-text-muted">Estimate</span>
                    <span className="text-text-primary">{issue.estimate} pts</span>
                  </>
                )}
                <span className="text-text-muted">Created</span>
                <span className="text-text-primary">{formatDate(issue.createdAt)}</span>
                <span className="text-text-muted">Updated</span>
                <span className="text-text-primary">{formatDate(issue.updatedAt)}</span>
              </div>
            </div>

            {/* Parent issue */}
            {issue.parent && (
              <div className="border border-border-primary rounded p-3">
                <div className="text-xs text-text-muted mb-2">Parent Issue</div>
                <div className="text-sm">
                  <span className="text-text-muted font-mono">{issue.parent.identifier}</span>
                  <span className="text-text-primary ml-2">{issue.parent.title}</span>
                </div>
              </div>
            )}

            {/* Description */}
            {issue.description && (
              <div className="border border-border-primary rounded p-3">
                <div className="text-xs text-text-muted mb-2">Description</div>
                <div className="text-sm text-text-primary whitespace-pre-wrap">
                  {issue.description}
                </div>
              </div>
            )}

            {/* Sub-issues */}
            {issue.children.nodes.length > 0 && (
              <div className="border border-border-primary rounded p-3">
                <div className="text-xs text-text-muted mb-2">Sub-issues ({issue.children.nodes.length})</div>
                <div className="space-y-1">
                  {issue.children.nodes.map((child) => (
                    <div key={child.id} className="flex items-center gap-2 text-sm">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: child.state.color }}
                      />
                      <span className="text-text-muted font-mono text-xs">{child.identifier}</span>
                      <span className="text-text-primary truncate">{child.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            {issue.comments.nodes.length > 0 && (
              <div className="border border-border-primary rounded p-3">
                <div className="text-xs text-text-muted mb-2">Comments ({issue.comments.nodes.length})</div>
                <div className="space-y-3">
                  {issue.comments.nodes.map((comment) => {
                    // Blue for current user (assignee), random consistent color for others
                    const isCurrentUser = issue.assignee && comment.user.id === issue.assignee.id;
                    const borderColor = isCurrentUser ? '#60a5fa' : getUserColor(comment.user.id);

                    return (
                      <div
                        key={comment.id}
                        className="border-l-2 pl-3 group"
                        style={{ borderLeftColor: borderColor }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-xs font-medium"
                              style={{ color: borderColor }}
                            >
                              {comment.user.name}
                            </span>
                            <span className="text-xs text-text-muted">{formatDate(comment.createdAt)}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            disabled={isDeletingComment === comment.id}
                            className="opacity-0 group-hover:opacity-100 text-xs text-text-muted hover:text-red-400 transition-opacity disabled:opacity-50"
                            title="Delete comment"
                          >
                            {isDeletingComment === comment.id ? '...' : '×'}
                          </button>
                        </div>
                        <div className="text-sm text-text-secondary whitespace-pre-wrap">
                          {comment.body}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Attachments */}
            {issue.attachments.nodes.length > 0 && (
              <div className="border border-border-primary rounded p-3">
                <div className="text-xs text-text-muted mb-2">Attachments ({issue.attachments.nodes.length})</div>
                <div className="space-y-1">
                  {issue.attachments.nodes.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-blue-400 hover:underline"
                    >
                      {attachment.title || attachment.url}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-400 text-sm">Failed to load issue</div>
          </div>
        )}
      </div>

      {/* Comment input */}
      {issue && (
        <div className="border-t border-border-primary p-3">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            className="w-full px-3 py-2 text-xs font-mono bg-bg-secondary border border-border-primary rounded resize-none focus:outline-none focus:border-accent-primary text-text-primary placeholder-text-muted"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmitComment();
              }
            }}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSubmitComment}
              disabled={isSubmittingComment || !commentText.trim()}
              className="text-xs font-mono text-text-secondary hover:text-accent-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-text-secondary transition-colors"
            >
              {isSubmittingComment ? '[ sending... ]' : '[ send comment ]'}
            </button>
          </div>
        </div>
      )}

      {/* Start Work Panel */}
      {issue && (
        <StartWorkPanel
          isOpen={showStartWork}
          onClose={() => setShowStartWork(false)}
          issue={issue}
        />
      )}
    </div>
  );
}
