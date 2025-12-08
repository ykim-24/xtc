import { create } from 'zustand';
import { useProjectStore } from './projectStore';

export interface Pattern {
  id: string;
  name: string;
  description: string;
  rule: string; // The actual pattern rule/instruction
  category: 'naming' | 'architecture' | 'error-handling' | 'styling' | 'testing' | 'other';
  isActive: boolean;
  isAutoDetected: boolean;
}

interface PatternsState {
  patterns: Pattern[];
  isLoading: boolean;
  loadPatterns: () => Promise<void>;
  savePatterns: () => Promise<void>;
  addPattern: (pattern: Omit<Pattern, 'id' | 'isAutoDetected'>) => void;
  updatePattern: (id: string, updates: Partial<Pattern>) => void;
  removePattern: (id: string) => void;
  togglePattern: (id: string) => void;
  getActivePatterns: () => Pattern[];
  setPatterns: (patterns: Pattern[]) => void;
  clearPatterns: () => void;
}

const getPatternsPath = (projectPath: string) => `${projectPath}/.xtc/patterns.json`;

export const usePatternsStore = create<PatternsState>((set, get) => ({
  patterns: [],
  isLoading: false,

  loadPatterns: async () => {
    const projectPath = useProjectStore.getState().projectPath;
    if (!projectPath || !window.electron) return;

    set({ isLoading: true });
    const result = await window.electron.readFile(getPatternsPath(projectPath));
    if (result.success && result.content) {
      try {
        const patterns = JSON.parse(result.content);
        set({ patterns });
      } catch {
        set({ patterns: [] });
      }
    } else {
      set({ patterns: [] });
    }
    set({ isLoading: false });
  },

  savePatterns: async () => {
    const projectPath = useProjectStore.getState().projectPath;
    if (!projectPath || !window.electron) return;

    const { patterns } = get();
    await window.electron.writeFile(
      getPatternsPath(projectPath),
      JSON.stringify(patterns, null, 2)
    );
  },

  addPattern: (pattern) => {
    set((state) => ({
      patterns: [
        ...state.patterns,
        {
          ...pattern,
          id: crypto.randomUUID(),
          isAutoDetected: false,
        },
      ],
    }));
    get().savePatterns();
  },

  updatePattern: (id, updates) => {
    set((state) => ({
      patterns: state.patterns.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }));
    get().savePatterns();
  },

  removePattern: (id) => {
    set((state) => ({
      patterns: state.patterns.filter((p) => p.id !== id),
    }));
    get().savePatterns();
  },

  togglePattern: (id) => {
    set((state) => ({
      patterns: state.patterns.map((p) =>
        p.id === id ? { ...p, isActive: !p.isActive } : p
      ),
    }));
    get().savePatterns();
  },

  getActivePatterns: () => get().patterns.filter((p) => p.isActive),

  setPatterns: (patterns) => {
    set({ patterns });
    get().savePatterns();
  },

  clearPatterns: () => set({ patterns: [] }),
}));
