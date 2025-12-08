import { create } from 'zustand';

export interface ContextFile {
  path: string;
  name: string;
  content: string;
  included: boolean;
  tokenEstimate: number;
}

interface ContextState {
  // Files in context
  contextFiles: ContextFile[];
  addContextFile: (file: Omit<ContextFile, 'included' | 'tokenEstimate'> & { tokenEstimate?: number }) => void;
  removeContextFile: (path: string) => void;
  toggleContextFile: (path: string) => void;
  clearContext: () => void;

  // Auto-detect settings
  autoDetect: boolean;
  setAutoDetect: (autoDetect: boolean) => void;

  // Total token estimate
  getTotalTokens: () => number;
}

export const useContextStore = create<ContextState>((set, get) => ({
  contextFiles: [],

  addContextFile: (file) =>
    set((state) => {
      if (state.contextFiles.find((f) => f.path === file.path)) {
        return state;
      }
      // Rough token estimate: ~4 chars per token
      const tokenEstimate = file.tokenEstimate ?? Math.ceil(file.content.length / 4);
      return {
        contextFiles: [
          ...state.contextFiles,
          {
            ...file,
            included: true,
            tokenEstimate,
          },
        ],
      };
    }),

  removeContextFile: (path) =>
    set((state) => ({
      contextFiles: state.contextFiles.filter((f) => f.path !== path),
    })),

  toggleContextFile: (path) =>
    set((state) => ({
      contextFiles: state.contextFiles.map((f) =>
        f.path === path ? { ...f, included: !f.included } : f
      ),
    })),

  clearContext: () => set({ contextFiles: [] }),

  autoDetect: true,
  setAutoDetect: (autoDetect) => set({ autoDetect }),

  getTotalTokens: () => {
    const state = get();
    return state.contextFiles
      .filter((f) => f.included)
      .reduce((sum, f) => sum + f.tokenEstimate, 0);
  },
}));
