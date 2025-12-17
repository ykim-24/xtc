import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface QueuedMessage {
  id: string;
  content: string;
  fileMappings: Map<string, string>;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  claudeInstalled: boolean | null;
  streamingMessageId: string | null;
  resultStatus: 'ok' | 'error' | null;
  lastPrompt: string | null;
  currentActivity: string | null;
  messageQueue: QueuedMessage[];

  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, content: string) => void;
  appendToMessage: (id: string, chunk: string) => void;
  finishStreaming: (id: string) => void;
  clearMessages: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setClaudeInstalled: (installed: boolean) => void;
  setStreamingMessageId: (id: string | null) => void;
  setResultStatus: (status: 'ok' | 'error' | null) => void;
  setLastPrompt: (prompt: string) => void;
  setCurrentActivity: (activity: string | null) => void;
  addToQueue: (content: string, fileMappings: Map<string, string>) => void;
  getNextFromQueue: () => QueuedMessage | undefined;
  clearQueue: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,
  claudeInstalled: null,
  streamingMessageId: null,
  resultStatus: null,
  lastPrompt: null,
  currentActivity: null,
  messageQueue: [],

  addMessage: (message) => {
    const id = crypto.randomUUID();
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id,
          timestamp: Date.now(),
        },
      ],
    }));
    return id;
  },

  updateMessage: (id, content) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content } : m
      ),
    })),

  appendToMessage: (id, chunk) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + chunk } : m
      ),
    })),

  finishStreaming: (id) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, isStreaming: false } : m
      ),
      streamingMessageId: null,
      isLoading: false,
    })),

  clearMessages: () => set({ messages: [], error: null }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set(error ? { error, isLoading: false } : { error }),

  setClaudeInstalled: (claudeInstalled) => set({ claudeInstalled }),

  setStreamingMessageId: (streamingMessageId) => set({ streamingMessageId }),

  setResultStatus: (resultStatus) => set({ resultStatus }),

  setLastPrompt: (lastPrompt) => set({ lastPrompt }),

  setCurrentActivity: (currentActivity) => set({ currentActivity }),

  addToQueue: (content, fileMappings) => {
    const id = crypto.randomUUID();
    set((state) => ({
      messageQueue: [...state.messageQueue, { id, content, fileMappings }],
    }));
  },

  getNextFromQueue: () => {
    const state = get();
    if (state.messageQueue.length === 0) return undefined;
    const [next, ...rest] = state.messageQueue;
    set({ messageQueue: rest });
    return next;
  },

  clearQueue: () => set({ messageQueue: [] }),
}));
