import { useState, useEffect, useRef, useMemo } from 'react';
import { X, GitBranch, ExternalLink, Play, CheckCircle, XCircle, Loader, Trash2 } from 'lucide-react';
import { useWorktreeStore } from '@/stores/worktreeStore';
import { useProjectStore, useStartWorkStore } from '@/stores';
import { formatClaudeStream } from '@/services/claudeStreamFormatter';

interface Worktree {
  path: string;
  branch: string;
  isMain: boolean;
  isCurrent: boolean;
}

interface WorktreeNodePanelProps {
  worktree: Worktree;
  onClose: () => void;
  onDeleted?: () => void;
}

export function WorktreeNodePanel({ worktree, onClose, onDeleted }: WorktreeNodePanelProps) {
  const { projectPath, setProjectPath } = useProjectStore();
  const { removeSession } = useWorktreeStore();
  // Subscribe specifically to this worktree's session for proper reactivity
  const session = useWorktreeStore((state) => state.sessions[worktree.path]);
  const status = useWorktreeStore((state) => state.getSessionStatus(worktree.path));

  // Also check startWorkStore for planning sessions on this worktree
  // Match by worktreePath OR by branch name (in case path hasn't been set yet)
  const startWorkSessions = useStartWorkStore((state) => state.sessions);
  const planningSession = useMemo(() => {
    return Object.values(startWorkSessions).find(s =>
      s.worktreePath === worktree.path ||
      s.branchName === worktree.branch
    );
  }, [startWorkSessions, worktree.path, worktree.branch]);

  // Debug log
  useEffect(() => {
    console.log('[WorktreeNodePanel] worktree:', worktree.path, worktree.branch);
    console.log('[WorktreeNodePanel] planningSession:', planningSession?.id, planningSession?.worktreePath, planningSession?.branchName);
    console.log('[WorktreeNodePanel] session:', session?.worktreePath);
  }, [worktree, planningSession, session]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const planningOutputRef = useRef<HTMLDivElement>(null);

  // Can't delete main worktree or current worktree
  const canDelete = !worktree.isMain && !worktree.isCurrent;

  // Animate expansion on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsExpanded(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Auto-scroll to bottom when output updates
  useEffect(() => {
    if (outputRef.current && status === 'running') {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [session?.implementationOutput, status]);

  // Auto-scroll planning output
  useEffect(() => {
    if (planningOutputRef.current && planningSession?.isProcessing) {
      planningOutputRef.current.scrollTop = planningOutputRef.current.scrollHeight;
    }
  }, [planningSession?.streamingOutput, planningSession?.isProcessing]);

  const handleClose = () => {
    setIsExpanded(false);
    setTimeout(onClose, 200);
  };

  const handleSwitchWorktree = () => {
    setProjectPath(worktree.path);
  };

  const handleRevealInFinder = async () => {
    await window.electron?.revealInFinder?.(worktree.path);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setIsDeleting(true);
    try {
      const result = await window.electron?.git.worktree.remove(projectPath, worktree.path);
      if (result?.success) {
        removeSession(worktree.path);
        handleClose();
        onDeleted?.();
      } else {
        console.error('Failed to delete worktree:', result?.error);
      }
    } catch (error) {
      console.error('Failed to delete worktree:', error);
    }
    setIsDeleting(false);
    setConfirmDelete(false);
  };

  // Format streaming output
  const formattedAnalysis = session?.analysisOutput
    ? formatClaudeStream(session.analysisOutput)
    : [];
  const formattedImplementation = session?.implementationOutput
    ? formatClaudeStream(session.implementationOutput)
    : [];

  return (
    <div
      className={`
        border-t border-border-primary bg-bg-secondary overflow-hidden
        transition-all duration-200 ease-out
        ${isExpanded ? 'max-h-[60vh] opacity-100' : 'max-h-0 opacity-0'}
      `}
    >
      <div className="h-full flex flex-col max-h-[60vh]">
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-bg-tertiary">
          <div className="flex items-center gap-3">
            <GitBranch className="w-4 h-4 text-text-muted" />
            <span className="text-sm font-mono text-text-primary">{worktree.branch || 'detached'}</span>
            {worktree.isMain && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-quaternary text-text-muted">main</span>
            )}
            {worktree.isCurrent && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-primary/20 text-accent-primary">current</span>
            )}
            {/* Status indicator - planning or implementation */}
            {planningSession?.isProcessing && (
              <span className="flex items-center gap-1 text-[10px] text-cyan-400">
                <Loader className="w-3 h-3 animate-spin" /> Planning...
              </span>
            )}
            {planningSession?.needsInput && (
              <span className="flex items-center gap-1 text-[10px] text-red-400 animate-pulse">
                <XCircle className="w-3 h-3" /> Needs Input
              </span>
            )}
            {status === 'running' && (
              <span className="flex items-center gap-1 text-[10px] text-blue-400">
                <Loader className="w-3 h-3 animate-spin" /> Implementing...
              </span>
            )}
            {status === 'success' && (
              <span className="flex items-center gap-1 text-[10px] text-green-400">
                <CheckCircle className="w-3 h-3" /> Complete
              </span>
            )}
            {status === 'error' && (
              <span className="flex items-center gap-1 text-[10px] text-red-400">
                <XCircle className="w-3 h-3" /> Error
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!worktree.isCurrent && (
              <button
                onClick={handleSwitchWorktree}
                className="text-xs font-mono text-text-muted hover:text-accent-primary transition-colors"
              >
                [ open ]
              </button>
            )}
            <button
              onClick={handleRevealInFinder}
              className="text-xs font-mono text-text-muted hover:text-text-primary transition-colors"
            >
              [ reveal ]
            </button>
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className={`text-xs font-mono transition-colors ${
                  confirmDelete
                    ? 'text-red-400 hover:text-red-300'
                    : 'text-text-muted hover:text-red-400'
                }`}
              >
                {isDeleting ? '[ ... ]' : confirmDelete ? '[ confirm? ]' : '[ delete ]'}
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-auto p-4">
          {session || planningSession ? (
            <div className="space-y-4">
              {/* Linear ticket info - from either session or planning session */}
              {(session?.linearTicket || planningSession) && (
                <div className="p-3 rounded border border-border-primary bg-bg-primary">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-blue-400">
                      {session?.linearTicket?.identifier || planningSession?.issueIdentifier}
                    </span>
                    {planningSession && !session && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                        planning
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-text-primary">
                    {session?.linearTicket?.title || planningSession?.issueTitle}
                  </h3>
                  {(session?.linearTicket?.description || planningSession?.issueDescription) && (
                    <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                      {session?.linearTicket?.description || planningSession?.issueDescription}
                    </p>
                  )}
                </div>
              )}

              {/* Planning phase output */}
              {planningSession && (
                <div className="space-y-3">
                  {/* Planning logs */}
                  {planningSession.logs.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide flex items-center gap-2">
                        Planning Progress
                        {planningSession.isProcessing && (
                          <Loader className="w-3 h-3 animate-spin text-cyan-400" />
                        )}
                        {planningSession.needsInput && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 animate-pulse">
                            needs input
                          </span>
                        )}
                      </h4>
                      <div
                        ref={planningOutputRef}
                        className="p-3 rounded border border-border-primary bg-[#0d1117] font-mono text-xs max-h-[200px] overflow-auto"
                      >
                        {planningSession.logs.map((log, i) => (
                          <div key={i} className={`${getLineColor(log.type)} whitespace-pre`}>
                            {'  '.repeat(log.indent || 0)}
                            {getLogPrefix(log.type) && (
                              <span className="opacity-60">{getLogPrefix(log.type)} </span>
                            )}
                            {log.message}
                          </div>
                        ))}
                        {/* Streaming output */}
                        {planningSession.streamingOutput && (
                          <div className="border-l-2 border-border-secondary pl-2 ml-1 mt-2 space-y-0.5">
                            <div className="text-text-muted opacity-60 flex items-center gap-1.5">
                              <Loader className="w-3 h-3 animate-spin text-cyan-400" />
                              <span className="text-xs">Claude is thinking...</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Plan steps if generated */}
                  {planningSession.planSteps.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide">Implementation Plan</h4>
                      <div className="p-3 rounded border border-border-primary bg-bg-primary space-y-2">
                        {planningSession.planSteps.map((step, i) => (
                          <div key={step.id} className="text-xs">
                            <div className="text-orange-400 font-medium">Step {i + 1}: {step.description.split('\n')[0]}</div>
                            {step.files && step.files.length > 0 && (
                              <div className="text-blue-300 text-[10px] ml-2 mt-0.5">Files: {step.files.join(', ')}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Analysis output */}
              {formattedAnalysis.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide">Analysis</h4>
                  <div className="p-3 rounded border border-border-primary bg-bg-primary font-mono text-xs max-h-[150px] overflow-auto">
                    {formattedAnalysis.map((line, i) => (
                      <div key={i} className={getLineColor(line.type)}>
                        {line.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Implementation output - show streaming or formatted */}
              {(session?.implementationOutput || status === 'running') && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide flex items-center gap-2">
                    Implementation
                    {status === 'running' && (
                      <Loader className="w-3 h-3 animate-spin text-blue-400" />
                    )}
                  </h4>
                  <div
                    ref={outputRef}
                    className="p-3 rounded border border-border-primary bg-bg-primary font-mono text-xs max-h-[300px] overflow-auto whitespace-pre-wrap"
                  >
                    {formattedImplementation.length > 0 ? (
                      formattedImplementation.map((line, i) => (
                        <div key={i} className={getLineColor(line.type)}>
                          {line.content}
                        </div>
                      ))
                    ) : session?.implementationOutput ? (
                      // Show raw output if formatter couldn't process it
                      // Unescape common escape sequences for better readability
                      <div className="text-text-secondary">
                        {unescapeOutput(session.implementationOutput)}
                      </div>
                    ) : status === 'running' ? (
                      <div className="text-text-muted animate-pulse">Waiting for output...</div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Error message */}
              {session?.error && (
                <div className="p-3 rounded border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
                  {session.error}
                </div>
              )}

              {/* Timing info */}
              {(session || planningSession) && (
                <div className="text-xs text-text-muted">
                  Started: {new Date(session?.startedAt || planningSession?.startedAt || Date.now()).toLocaleTimeString()}
                  {session?.completedAt && (
                    <span className="ml-2">
                      • Duration: {Math.round((session.completedAt - session.startedAt) / 1000)}s
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <GitBranch className="w-8 h-8 text-text-muted mb-3" />
              <p className="text-sm text-text-secondary mb-1">No active work session</p>
              <p className="text-xs text-text-muted mb-4">Start work from a Linear ticket to begin</p>
              <div className="text-xs text-text-muted font-mono">{worktree.path}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getLineColor(type: string): string {
  switch (type) {
    // Claude stream types
    case 'file-read': return 'text-blue-400';
    case 'file-edit': return 'text-yellow-400';
    case 'file-write': return 'text-green-400';
    case 'command': return 'text-purple-400';
    case 'tool': return 'text-cyan-400';
    // Log entry types
    case 'init': return 'text-cyan-400';
    case 'info': return 'text-text-muted';
    case 'success': return 'text-green-400';
    case 'error': return 'text-red-400';
    case 'warning': return 'text-yellow-400';
    case 'prompt': return 'text-purple-400';
    case 'input': return 'text-blue-400';
    case 'analysis': return 'text-emerald-400';
    case 'plan': return 'text-orange-400';
    case 'file': return 'text-blue-300';
    default: return 'text-text-secondary';
  }
}

function getLogPrefix(type: string): string {
  switch (type) {
    case 'init': return '[init]';
    case 'success': return '[done]';
    case 'error': return '[error]';
    case 'prompt': return '[action]';
    default: return '';
  }
}

/**
 * Unescape common escape sequences in raw output for better readability
 */
function unescapeOutput(str: string): string {
  return str
    .replace(/\\n/g, '\n')      // Escaped newlines
    .replace(/\\t/g, '  ')      // Escaped tabs to 2 spaces
    .replace(/\\r/g, '')        // Carriage returns
    .replace(/\\"/g, '"')       // Escaped double quotes
    .replace(/\\'/g, "'")       // Escaped single quotes
    .replace(/\\\\/g, '\\');    // Escaped backslashes
}
