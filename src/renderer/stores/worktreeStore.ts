import { create } from 'zustand';
import { WorktreeStatus } from '@/components/worktrees/WorktreeNode';

export interface LinearTicketInfo {
  id: string;
  identifier: string;
  title: string;
  description?: string;
}

export interface WorkSession {
  worktreePath: string;
  linearTicket?: LinearTicketInfo;
  status: WorktreeStatus;
  analysisOutput: string;
  implementationOutput: string;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

interface WorktreeState {
  // Active work sessions keyed by worktree path
  sessions: Record<string, WorkSession>;

  // Actions
  startSession: (worktreePath: string, linearTicket?: LinearTicketInfo) => void;
  updateSession: (worktreePath: string, updates: Partial<WorkSession>) => void;
  appendAnalysisOutput: (worktreePath: string, output: string) => void;
  appendImplementationOutput: (worktreePath: string, output: string) => void;
  setSessionStatus: (worktreePath: string, status: WorktreeStatus) => void;
  setSessionError: (worktreePath: string, error: string) => void;
  completeSession: (worktreePath: string, success: boolean) => void;
  removeSession: (worktreePath: string) => void;
  clearAllSessions: () => void;

  // Getters
  getSession: (worktreePath: string) => WorkSession | undefined;
  getSessionStatus: (worktreePath: string) => WorktreeStatus;
  hasActiveSession: (worktreePath: string) => boolean;

  // Diff management
  updateWorktreeDiff: (worktreePath: string) => Promise<void>;
}

export const useWorktreeStore = create<WorktreeState>((set, get) => ({
  sessions: {},

  startSession: (worktreePath, linearTicket) => {
    set((state) => ({
      sessions: {
        ...state.sessions,
        [worktreePath]: {
          worktreePath,
          linearTicket,
          status: 'running',
          analysisOutput: '',
          implementationOutput: '',
          startedAt: Date.now(),
        },
      },
    }));
  },

  updateSession: (worktreePath, updates) => {
    set((state) => {
      const session = state.sessions[worktreePath];
      if (!session) return state;

      return {
        sessions: {
          ...state.sessions,
          [worktreePath]: {
            ...session,
            ...updates,
          },
        },
      };
    });
  },

  appendAnalysisOutput: (worktreePath, output) => {
    set((state) => {
      const session = state.sessions[worktreePath];
      if (!session) return state;

      return {
        sessions: {
          ...state.sessions,
          [worktreePath]: {
            ...session,
            analysisOutput: session.analysisOutput + output,
          },
        },
      };
    });
  },

  appendImplementationOutput: (worktreePath, output) => {
    set((state) => {
      const session = state.sessions[worktreePath];
      if (!session) return state;

      return {
        sessions: {
          ...state.sessions,
          [worktreePath]: {
            ...session,
            implementationOutput: session.implementationOutput + output,
          },
        },
      };
    });
  },

  setSessionStatus: (worktreePath, status) => {
    set((state) => {
      const session = state.sessions[worktreePath];
      if (!session) return state;

      return {
        sessions: {
          ...state.sessions,
          [worktreePath]: {
            ...session,
            status,
          },
        },
      };
    });
  },

  setSessionError: (worktreePath, error) => {
    set((state) => {
      const session = state.sessions[worktreePath];
      if (!session) return state;

      return {
        sessions: {
          ...state.sessions,
          [worktreePath]: {
            ...session,
            status: 'error',
            error,
          },
        },
      };
    });
  },

  completeSession: (worktreePath, success) => {
    set((state) => {
      const session = state.sessions[worktreePath];
      if (!session) return state;

      return {
        sessions: {
          ...state.sessions,
          [worktreePath]: {
            ...session,
            status: success ? 'success' : 'error',
            completedAt: Date.now(),
          },
        },
      };
    });
  },

  removeSession: (worktreePath) => {
    set((state) => {
      const { [worktreePath]: _, ...rest } = state.sessions;
      return { sessions: rest };
    });
  },

  clearAllSessions: () => {
    set({ sessions: {} });
  },

  getSession: (worktreePath) => {
    return get().sessions[worktreePath];
  },

  getSessionStatus: (worktreePath) => {
    const session = get().sessions[worktreePath];
    return session?.status || 'idle';
  },

  hasActiveSession: (worktreePath) => {
    const session = get().sessions[worktreePath];
    return session?.status === 'running';
  },

  updateWorktreeDiff: async (worktreePath) => {
    const session = get().sessions[worktreePath];
    if (!session?.linearTicket?.identifier) {
      console.log('[WorktreeStore] No session or ticket identifier found for:', worktreePath);
      return;
    }

    try {
      console.log('[WorktreeStore] Updating diff for:', worktreePath, 'session:', session.linearTicket.identifier);
      const result = await window.electron?.git.worktree.saveDiff(worktreePath, session.linearTicket.identifier);
      if (result?.success) {
        console.log('[WorktreeStore] Diff updated:', result.path, 'length:', result.diffLength);
      } else {
        console.warn('[WorktreeStore] Failed to update diff:', result?.error);
      }
    } catch (error) {
      console.warn('[WorktreeStore] Error updating diff:', error);
    }
  },
}));
