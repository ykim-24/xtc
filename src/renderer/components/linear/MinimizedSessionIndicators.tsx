import { useEffect, useState } from 'react';
import { useStartWorkStore } from '@/stores/startWorkStore';

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
  };
  onRestore: () => void;
}

function SessionIndicator({ session, onRestore }: SessionIndicatorProps) {
  // Show red ! for any user input needed (including unanswered questions)
  const needsAttention = session.needsInput || session.hasUnansweredQuestions;
  const isProcessing = session.isProcessing;

  return (
    <button
      onClick={onRestore}
      className={`
        relative flex items-center justify-center
        w-10 h-10 rounded
        border-2 font-mono text-xs
        transition-all duration-200
        hover:scale-110 hover:shadow-lg
        ${needsAttention
          ? 'border-red-500 bg-red-500/20 text-red-400 animate-pulse'
          : isProcessing
            ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
            : 'border-border-primary bg-bg-secondary text-text-muted hover:border-accent-primary'
        }
      `}
      title={`${session.issueIdentifier}: ${session.issueTitle}${needsAttention ? ' (needs input!)' : ''}`}
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
  );
}

export function MinimizedSessionIndicators() {
  const sessions = useStartWorkStore((state) => state.sessions);
  const openQuestionsModal = useStartWorkStore((state) => state.openQuestionsModal);
  const openSessionPanel = useStartWorkStore((state) => state.openSessionPanel);
  const questionsModalSessionId = useStartWorkStore((state) => state.questionsModalSessionId);
  const activeSessionPanelId = useStartWorkStore((state) => state.activeSessionPanelId);

  // Get sessions that should show an indicator:
  // 1. Minimized sessions (but not if their panel is currently open)
  // 2. Sessions with unanswered questions (when questions modal is closed)
  const indicatorSessions = Object.values(sessions).filter(s =>
    (s.isMinimized && activeSessionPanelId !== s.id) ||
    (s.hasUnansweredQuestions && questionsModalSessionId !== s.id)
  );

  const handleRestore = (sessionId: string) => {
    const session = sessions[sessionId];
    if (session?.hasUnansweredQuestions) {
      // If session has unanswered questions, reopen the questions modal
      openQuestionsModal(sessionId);
    } else {
      // Otherwise open the session panel
      openSessionPanel(sessionId);
    }
  };

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
        />
      ))}
    </div>
  );
}
