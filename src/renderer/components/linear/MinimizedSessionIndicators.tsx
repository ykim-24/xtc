import { useState, useEffect } from 'react';
import { useStartWorkStore } from '@/stores/startWorkStore';
import { StartWorkPanel } from './StartWorkPanel';

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
  };
  onRestore: () => void;
}

function SessionIndicator({ session, onRestore }: SessionIndicatorProps) {
  const needsAttention = session.needsInput;
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
  const restoreSession = useStartWorkStore((state) => state.restoreSession);

  // Get minimized sessions
  const minimizedSessions = Object.values(sessions).filter(s => s.isMinimized);

  // Track which session is being restored to show the modal
  const [restoringSessionId, setRestoringSessionId] = useState<string | null>(null);
  const restoringSession = restoringSessionId ? sessions[restoringSessionId] : null;

  const handleRestore = (sessionId: string) => {
    restoreSession(sessionId);
    setRestoringSessionId(sessionId);
  };

  const handleCloseModal = () => {
    setRestoringSessionId(null);
  };

  if (minimizedSessions.length === 0 && !restoringSessionId) {
    return null;
  }

  return (
    <>
      {/* Fixed position container in bottom right */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
        {minimizedSessions.map((session) => (
          <SessionIndicator
            key={session.id}
            session={session}
            onRestore={() => handleRestore(session.id)}
          />
        ))}
      </div>

      {/* Modal for restored session */}
      {restoringSessionId && restoringSession && (
        <StartWorkPanel
          isOpen={true}
          onClose={handleCloseModal}
          onMinimize={() => {
            setRestoringSessionId(null);
          }}
          issue={{
            id: restoringSession.issueId,
            identifier: restoringSession.issueIdentifier,
            title: restoringSession.issueTitle,
            description: restoringSession.issueDescription || '',
            priority: 0,
            state: { id: '', name: '', color: '#888', type: 'unstarted' },
            labels: { nodes: [] },
            project: null,
            assignee: null,
            creator: null,
            dueDate: null,
            estimate: null,
            parent: null,
            children: { nodes: [] },
            comments: { nodes: [] },
            attachments: { nodes: [] },
            createdAt: '',
            updatedAt: '',
            branchName: restoringSession.branchName,
          }}
          sessionId={restoringSessionId}
        />
      )}
    </>
  );
}
