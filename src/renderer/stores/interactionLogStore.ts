import { create } from 'zustand';
import { useProjectStore } from './projectStore';

export interface InteractionLog {
  id: string;
  timestamp: string;
  sessionId: string;

  // Input context
  prompt: string;
  activeRules: string[]; // Rule names that were active
  activeSkills: string[]; // Skill names that were active
  filesInContext: string[]; // File paths

  // Output
  editsSuggested: number;
  filesModified: string[];

  // User action
  action: 'accepted' | 'rejected' | 'partial';
  rejectionReason?: string;

  // Outcome
  ruleCreated?: string; // New rule name if created
}

interface InteractionLogState {
  logs: InteractionLog[];
  sessionId: string;
  isLoading: boolean;

  loadLogs: () => Promise<void>;
  saveLogs: () => Promise<void>;
  logInteraction: (log: Omit<InteractionLog, 'id' | 'timestamp' | 'sessionId'>) => Promise<void>;
  getSessionLogs: () => InteractionLog[];
  getRecentLogs: (count?: number) => InteractionLog[];
  getRejectionStats: () => { total: number; withReason: number; rulesCreated: number };
  clearLogs: () => void;
}

const getLogsPath = (projectPath: string) => `${projectPath}/.xtc/logs/interactions.json`;

// Generate a session ID for this app session
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
};

export const useInteractionLogStore = create<InteractionLogState>((set, get) => ({
  logs: [],
  sessionId: generateSessionId(),
  isLoading: false,

  loadLogs: async () => {
    const projectPath = useProjectStore.getState().projectPath;
    if (!projectPath || !window.electron) return;

    set({ isLoading: true });

    const result = await window.electron.readFile(getLogsPath(projectPath));

    if (result.success && result.content) {
      try {
        const logs = JSON.parse(result.content);
        // Keep only last 500 logs to prevent bloat
        const recentLogs = logs.slice(-500);
        set({ logs: recentLogs });
      } catch {
        set({ logs: [] });
      }
    } else {
      set({ logs: [] });
    }

    set({ isLoading: false });
  },

  saveLogs: async () => {
    const projectPath = useProjectStore.getState().projectPath;
    if (!projectPath || !window.electron) return;

    const { logs } = get();

    // Keep only last 500 logs
    const logsToSave = logs.slice(-500);

    await window.electron.writeFile(
      getLogsPath(projectPath),
      JSON.stringify(logsToSave, null, 2)
    );
  },

  logInteraction: async (logData) => {
    const { sessionId } = get();

    const log: InteractionLog = {
      ...logData,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      sessionId,
    };

    set((state) => ({
      logs: [...state.logs, log],
    }));

    // Save asynchronously
    get().saveLogs();
  },

  getSessionLogs: () => {
    const { logs, sessionId } = get();
    return logs.filter((log) => log.sessionId === sessionId);
  },

  getRecentLogs: (count = 50) => {
    const { logs } = get();
    return logs.slice(-count);
  },

  getRejectionStats: () => {
    const { logs } = get();

    const rejections = logs.filter((log) => log.action === 'rejected');
    const withReason = rejections.filter((log) => log.rejectionReason);
    const rulesCreated = rejections.filter((log) => log.ruleCreated);

    return {
      total: rejections.length,
      withReason: withReason.length,
      rulesCreated: rulesCreated.length,
    };
  },

  clearLogs: () => set({ logs: [] }),
}));
