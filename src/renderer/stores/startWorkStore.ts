import { create } from 'zustand';

export type StartWorkStep =
  | 'repo-select'
  | 'repo-verify'
  | 'worktree-setup'
  | 'analyze'
  | 'planning'
  | 'plan-review'
  | 'executing'
  | 'complete';

export interface LogEntry {
  type: 'init' | 'info' | 'success' | 'error' | 'warning' | 'prompt' | 'input' | 'analysis' | 'plan' | 'file';
  message: string;
  indent?: number;
}

export interface PlanStep {
  id: string;
  description: string;
  files?: string[];
  status: 'pending' | 'approved' | 'rejected';
}

export interface PlanQuestion {
  id: string;
  question: string;
  answer: string;
}

export interface StartWorkSession {
  id: string;
  issueId: string;
  issueIdentifier: string;
  issueTitle: string;
  issueDescription?: string;

  // Workflow state
  currentStep: StartWorkStep;
  isMinimized: boolean;
  needsInput: boolean;
  isProcessing: boolean;
  hasUnansweredQuestions: boolean;  // True when questions modal was shown but not answered

  // Data
  selectedRepo: string | null;
  worktreePath: string | null;
  branchName: string;
  logs: LogEntry[];
  planSteps: PlanStep[];
  questions: PlanQuestion[];  // Questions from Claude during planning
  streamingOutput: string;  // Current streaming output from Claude
  additionalContext: string;

  // Timestamps
  startedAt: number;
  completedAt?: number;
}

interface StartWorkState {
  sessions: Record<string, StartWorkSession>;

  // Questions modal state - shown at root level
  questionsModalSessionId: string | null;

  // Session panel state - which session panel is open at root level
  activeSessionPanelId: string | null;

  // Session lifecycle
  createSession: (issueId: string, issueIdentifier: string, issueTitle: string, issueDescription?: string, branchName?: string) => string;
  removeSession: (sessionId: string) => void;

  // Modal state
  minimizeSession: (sessionId: string) => void;
  restoreSession: (sessionId: string) => void;

  // Session panel actions
  openSessionPanel: (sessionId: string) => void;
  closeSessionPanel: () => void;

  // Questions modal actions
  openQuestionsModal: (sessionId: string) => void;
  closeQuestionsModal: () => void;
  setHasUnansweredQuestions: (sessionId: string, hasUnansweredQuestions: boolean) => void;

  // Workflow actions
  setStep: (sessionId: string, step: StartWorkStep) => void;
  setNeedsInput: (sessionId: string, needsInput: boolean) => void;
  setProcessing: (sessionId: string, isProcessing: boolean) => void;
  setSelectedRepo: (sessionId: string, repo: string | null) => void;
  setWorktreePath: (sessionId: string, path: string | null) => void;

  // Logging
  addLog: (sessionId: string, log: LogEntry) => void;
  addLogs: (sessionId: string, logs: LogEntry[]) => void;

  // Plan management
  setPlanSteps: (sessionId: string, steps: PlanStep[]) => void;
  setQuestions: (sessionId: string, questions: PlanQuestion[]) => void;
  updateQuestionAnswer: (sessionId: string, questionId: string, answer: string) => void;
  setAdditionalContext: (sessionId: string, context: string) => void;

  // Streaming output
  appendStreamingOutput: (sessionId: string, chunk: string) => void;
  clearStreamingOutput: (sessionId: string) => void;

  // Completion
  completeSession: (sessionId: string) => void;

  // Getters
  getSession: (sessionId: string) => StartWorkSession | undefined;
  getMinimizedSessions: () => StartWorkSession[];
  getSessionByIssueId: (issueId: string) => StartWorkSession | undefined;
}

export const useStartWorkStore = create<StartWorkState>((set, get) => ({
  sessions: {},
  questionsModalSessionId: null,
  activeSessionPanelId: null,

  openSessionPanel: (sessionId) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return { activeSessionPanelId: sessionId };
      return {
        activeSessionPanelId: sessionId,
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, isMinimized: false },
        },
      };
    });
  },

  closeSessionPanel: () => {
    set({ activeSessionPanelId: null });
  },

  openQuestionsModal: (sessionId) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return { questionsModalSessionId: sessionId };
      return {
        questionsModalSessionId: sessionId,
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, hasUnansweredQuestions: true },
        },
      };
    });
  },

  closeQuestionsModal: () => {
    set({ questionsModalSessionId: null });
  },

  setHasUnansweredQuestions: (sessionId, hasUnansweredQuestions) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, hasUnansweredQuestions },
        },
      };
    });
  },

  createSession: (issueId, issueIdentifier, issueTitle, issueDescription, branchName) => {
    const id = `startwork-${issueId}-${Date.now()}`;
    const defaultBranchName = branchName || `${issueIdentifier.toLowerCase()}-${issueTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`;

    set((state) => ({
      sessions: {
        ...state.sessions,
        [id]: {
          id,
          issueId,
          issueIdentifier,
          issueTitle,
          issueDescription,
          currentStep: 'repo-select',
          isMinimized: false,
          needsInput: true,
          isProcessing: false,
          hasUnansweredQuestions: false,
          selectedRepo: null,
          worktreePath: null,
          branchName: defaultBranchName,
          logs: [
            { type: 'init', message: `Starting work on ${issueIdentifier}` },
            { type: 'info', message: issueTitle, indent: 1 },
            { type: 'info', message: '' },
            { type: 'prompt', message: 'Select the repository for this ticket:' },
          ],
          planSteps: [],
          questions: [],
          streamingOutput: '',
          additionalContext: '',
          startedAt: Date.now(),
        },
      },
    }));
    return id;
  },

  removeSession: (sessionId) => {
    set((state) => {
      const { [sessionId]: _, ...rest } = state.sessions;
      return { sessions: rest };
    });
  },

  minimizeSession: (sessionId) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, isMinimized: true },
        },
      };
    });
  },

  restoreSession: (sessionId) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, isMinimized: false },
        },
      };
    });
  },

  setStep: (sessionId, step) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, currentStep: step },
        },
      };
    });
  },

  setNeedsInput: (sessionId, needsInput) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, needsInput },
        },
      };
    });
  },

  setProcessing: (sessionId, isProcessing) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, isProcessing },
        },
      };
    });
  },

  setSelectedRepo: (sessionId, repo) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, selectedRepo: repo },
        },
      };
    });
  },

  setWorktreePath: (sessionId, path) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, worktreePath: path },
        },
      };
    });
  },

  addLog: (sessionId, log) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, logs: [...session.logs, log] },
        },
      };
    });
  },

  addLogs: (sessionId, logs) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, logs: [...session.logs, ...logs] },
        },
      };
    });
  },

  setPlanSteps: (sessionId, steps) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, planSteps: steps },
        },
      };
    });
  },

  setQuestions: (sessionId, questions) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, questions },
        },
      };
    });
  },

  updateQuestionAnswer: (sessionId, questionId, answer) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...session,
            questions: session.questions.map(q =>
              q.id === questionId ? { ...q, answer } : q
            ),
          },
        },
      };
    });
  },

  setAdditionalContext: (sessionId, context) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, additionalContext: context },
        },
      };
    });
  },

  appendStreamingOutput: (sessionId, chunk) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, streamingOutput: session.streamingOutput + chunk },
        },
      };
    });
  },

  clearStreamingOutput: (sessionId) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: { ...session, streamingOutput: '' },
        },
      };
    });
  },

  completeSession: (sessionId) => {
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...session,
            currentStep: 'complete',
            isProcessing: false,
            needsInput: false,
            completedAt: Date.now(),
          },
        },
      };
    });
  },

  getSession: (sessionId) => {
    return get().sessions[sessionId];
  },

  getMinimizedSessions: () => {
    return Object.values(get().sessions).filter(s => s.isMinimized);
  },

  getSessionByIssueId: (issueId) => {
    return Object.values(get().sessions).find(s => s.issueId === issueId);
  },
}));
