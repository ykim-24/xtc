import { useEffect, useState, useCallback } from 'react';
import { useStartWorkStore } from '@/stores/startWorkStore';
import { useWorktreeStore } from '@/stores/worktreeStore';
import { useTestStore, useProjectStore } from '@/stores';
import { Square } from 'lucide-react';

// ASCII spinner frames
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function AsciiSpinner({ className = '' }: { className?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return <span className={className}>{SPINNER_FRAMES[frame]}</span>;
}

interface SessionIndicatorProps {
  session: {
    id: string;
    issueIdentifier: string;
    issueTitle: string;
    needsInput: boolean;
    isProcessing: boolean;
    hasUnansweredQuestions: boolean;
    worktreePath: string | null;
  };
  onRestore: () => void;
  onStop: () => void;
}

function SessionIndicator({ session, onRestore, onStop }: SessionIndicatorProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  // Show red ! for any user input needed (including unanswered questions)
  const needsAttention = session.needsInput || session.hasUnansweredQuestions;
  const isProcessing = session.isProcessing;

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Menu dimensions (approximate)
    const menuWidth = 140;
    const menuHeight = 70;

    // Calculate position, keeping menu within viewport
    let x = e.clientX;
    let y = e.clientY;

    // Adjust if menu would overflow right edge
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 8;
    }

    // Adjust if menu would overflow bottom edge
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 8;
    }

    setContextMenuPos({ x, y });
    setShowContextMenu(true);
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    if (showContextMenu) {
      const handleClick = () => setShowContextMenu(false);
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [showContextMenu]);

  return (
    <>
      <button
        onClick={onRestore}
        onContextMenu={handleContextMenu}
        className={`
          relative flex items-center justify-center
          w-10 h-10 rounded
          font-mono text-xs
          transition-all duration-200
          hover:scale-110 hover:shadow-lg
          ${needsAttention
            ? 'border-2 border-red-500 bg-red-500/20 text-red-400 animate-pulse'
            : isProcessing
              ? 'border-2 border-cyan-400 bg-bg-secondary text-cyan-400'
              : 'border-2 border-border-primary bg-bg-secondary text-text-muted hover:border-accent-primary'
          }
        `}
        title={`${session.issueIdentifier}: ${session.issueTitle}${needsAttention ? ' (needs input!)' : ''}\nRight-click for options`}
      >
        {/* Main content */}
        <div className="flex flex-col items-center">
          {needsAttention ? (
            <span className="text-lg font-bold">!</span>
          ) : isProcessing ? (
            <AsciiSpinner className="text-sm" />
          ) : (
            <span className="text-[10px] leading-none">{session.issueIdentifier.slice(0, 4)}</span>
          )}
        </div>

        {/* Alert badge for needs input */}
        {needsAttention && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
        )}
      </button>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className="fixed z-[100] bg-bg-secondary border border-border-primary rounded shadow-lg py-1 min-w-[140px]"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setShowContextMenu(false);
              onRestore();
            }}
            className="w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-bg-hover flex items-center gap-2"
          >
            Open Session
          </button>
          <button
            onClick={() => {
              setShowContextMenu(false);
              onStop();
            }}
            className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
          >
            <Square className="w-3 h-3" />
            Stop Session
          </button>
        </div>
      )}
    </>
  );
}

export function MinimizedSessionIndicators() {
  const sessions = useStartWorkStore((state) => state.sessions);
  const removeSession = useStartWorkStore((state) => state.removeSession);
  const openQuestionsModal = useStartWorkStore((state) => state.openQuestionsModal);
  const openSessionPanel = useStartWorkStore((state) => state.openSessionPanel);
  const questionsModalSessionId = useStartWorkStore((state) => state.questionsModalSessionId);
  const activeSessionPanelId = useStartWorkStore((state) => state.activeSessionPanelId);
  const worktreeSessions = useWorktreeStore((state) => state.sessions);
  const setWorktreeSessionStatus = useWorktreeStore((state) => state.setSessionStatus);

  // Get sessions that should show an indicator:
  // 1. Minimized sessions (but not if their panel is currently open)
  // 2. Sessions with unanswered questions (when questions modal is closed)
  // 3. Processing sessions that aren't currently being viewed (e.g., background worktree during planning)
  const startWorkIndicatorSessions = Object.values(sessions).filter(s =>
    (s.isMinimized && activeSessionPanelId !== s.id) ||
    (s.hasUnansweredQuestions && questionsModalSessionId !== s.id) ||
    (s.isProcessing && activeSessionPanelId !== s.id)
  );

  // Also get worktree sessions that are running/planning (implementation phase)
  // These don't exist in startWorkStore anymore but should still show an indicator
  const worktreeIndicatorSessions = Object.values(worktreeSessions)
    .filter(s => s.status === 'running' || s.status === 'planning')
    .filter(s => {
      // Don't show if there's already a startWork session for this worktree
      return !Object.values(sessions).some(ss => ss.worktreePath === s.worktreePath);
    })
    .map(s => ({
      id: s.worktreePath, // Use worktree path as ID
      issueIdentifier: s.linearTicket?.identifier || 'Work',
      issueTitle: s.linearTicket?.title || 'Implementation in progress',
      needsInput: false,
      isProcessing: s.status === 'running' || s.status === 'planning',
      hasUnansweredQuestions: false,
      worktreePath: s.worktreePath,
      isWorktreeSession: true, // Flag to identify these
    }));

  const indicatorSessions = [...startWorkIndicatorSessions, ...worktreeIndicatorSessions];

  const { setMode } = useTestStore();
  const { setProjectPath } = useProjectStore();

  const handleRestore = (sessionId: string) => {
    // Check if this is a worktree session (ID is worktree path)
    const worktreeSession = worktreeSessions[sessionId];
    if (worktreeSession) {
      // Navigate to worktrees panel and select this worktree
      setProjectPath(sessionId);
      setMode('worktrees');
      return;
    }

    // Otherwise it's a startWork session
    const session = sessions[sessionId];
    if (session?.hasUnansweredQuestions) {
      // If session has unanswered questions, reopen the questions modal
      openQuestionsModal(sessionId);
    } else {
      // Otherwise open the session panel
      openSessionPanel(sessionId);
    }
  };

  const handleStop = useCallback(async (sessionId: string) => {
    // Check if this is a worktree session
    const worktreeSession = worktreeSessions[sessionId];
    if (worktreeSession) {
      // Stop Claude and update worktree status
      await window.electron?.claude.stop(sessionId);
      setWorktreeSessionStatus(sessionId, 'stopped');
      return;
    }

    // Otherwise it's a startWork session
    const session = sessions[sessionId];
    if (!session) return;

    // Stop any running Claude process
    if (session.worktreePath) {
      await window.electron?.claude.stop(session.worktreePath);
      // Update worktreeStore status
      setWorktreeSessionStatus(session.worktreePath, 'stopped');
    }

    // Remove the session from startWorkStore
    removeSession(sessionId);
  }, [sessions, worktreeSessions, removeSession, setWorktreeSessionStatus]);

  if (indicatorSessions.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
      {indicatorSessions.map((session) => (
        <SessionIndicator
          key={session.id}
          session={session}
          onRestore={() => handleRestore(session.id)}
          onStop={() => handleStop(session.id)}
        />
      ))}
    </div>
  );
}
