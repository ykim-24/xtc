import { create } from 'zustand';
import { useRulesStore } from './rulesStore';
import { useInteractionLogStore } from './interactionLogStore';
import { useSkillsStore } from './skillsStore';
import { useContextStore } from './contextStore';
import { useTestStore } from './testStore';
import { useProjectStore } from './projectStore';
import { useWorktreeStore } from './worktreeStore';

export interface PendingEdit {
  id: string;
  filePath: string;
  originalContent: string;
  newContent: string;
  description: string;
  // Track if this is a new file (for proper reject behavior)
  isNewFile?: boolean;
  // Track the prompt that generated this edit
  sourcePrompt?: string;
}

interface EditsState {
  pendingEdits: PendingEdit[];
  isLoading: boolean;
  currentPrompt: string | null; // Track current prompt for logging

  setPendingEdits: (edits: PendingEdit[]) => void;
  addPendingEdit: (edit: PendingEdit) => void;
  updatePendingEdit: (edit: PendingEdit) => void;
  removePendingEdit: (editId: string) => void;
  clearPendingEdits: () => void;
  setLoading: (loading: boolean) => void;
  setCurrentPrompt: (prompt: string | null) => void;

  // Actions that communicate with main process
  fetchPendingEdits: () => Promise<void>;
  approveEdit: (editId: string) => Promise<boolean>;
  rejectEdit: (editId: string, reason?: string) => Promise<boolean>;
  rejectEditWithReason: (editId: string, reason: string) => Promise<{ success: boolean; ruleCreated?: string }>;
  approveAll: () => Promise<void>;
  rejectAll: () => Promise<void>;
}

export const useEditsStore = create<EditsState>((set, get) => ({
  pendingEdits: [],
  isLoading: false,
  currentPrompt: null,

  setPendingEdits: (pendingEdits) => set({ pendingEdits }),
  addPendingEdit: (edit) => set((state) => {
    // Prevent duplicates by checking if edit already exists
    if (state.pendingEdits.some((e) => e.id === edit.id)) {
      return state;
    }
    return { pendingEdits: [...state.pendingEdits, edit] };
  }),
  updatePendingEdit: (edit) => set((state) => ({
    pendingEdits: state.pendingEdits.map((e) => e.id === edit.id ? edit : e)
  })),
  removePendingEdit: (editId) => set((state) => ({
    pendingEdits: state.pendingEdits.filter((e) => e.id !== editId)
  })),
  clearPendingEdits: () => set({ pendingEdits: [] }),
  setLoading: (isLoading) => set({ isLoading }),
  setCurrentPrompt: (currentPrompt) => set({ currentPrompt }),

  fetchPendingEdits: async () => {
    if (!window.electron?.claude) return;
    set({ isLoading: true });
    try {
      const edits = await window.electron.claude.getPendingEdits();
      set({ pendingEdits: edits, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  approveEdit: async (editId) => {
    if (!window.electron?.claude) return false;

    const edit = get().pendingEdits.find((e) => e.id === editId);
    if (!edit) return false;

    // Pass file path and content to main process for writing
    const result = await window.electron.claude.approveEdit(editId, edit.filePath, edit.newContent);

    if (result.success) {
      get().removePendingEdit(editId);

      // Log the interaction
      const { logInteraction } = useInteractionLogStore.getState();
      const { getActiveSkills } = useSkillsStore.getState();
      const { getActiveRules } = useRulesStore.getState();
      const { contextFiles } = useContextStore.getState();

      await logInteraction({
        prompt: get().currentPrompt || '',
        activeRules: getActiveRules().map((r) => r.name),
        activeSkills: getActiveSkills().map((s) => s.name),
        filesInContext: contextFiles.map((f) => f.path),
        editsSuggested: 1,
        filesModified: edit ? [edit.filePath] : [],
        action: 'accepted',
      });

      // Re-detect tests if the edited file is a test file
      const isTestFile = /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(edit.filePath);
      if (isTestFile) {
        const { projectPath } = useProjectStore.getState();
        if (projectPath) {
          // Re-detect tests to update counts and line numbers
          useTestStore.getState().detectTests(projectPath);
        }
      }

      // Restore previous mode if all edits are done
      if (get().pendingEdits.length === 0) {
        useTestStore.getState().restorePreviousMode();
      }

      // Update worktree diff if we're in a worktree session
      const { projectPath } = useProjectStore.getState();
      if (projectPath) {
        useWorktreeStore.getState().updateWorktreeDiff(projectPath);
      }

      return true;
    }
    return false;
  },

  rejectEdit: async (editId, reason?: string) => {
    if (!window.electron?.claude) return false;
    const result = await window.electron.claude.rejectEdit(editId);
    if (result.success) {
      get().removePendingEdit(editId);

      // Log basic rejection without rule creation
      if (!reason) {
        const { logInteraction } = useInteractionLogStore.getState();
        const { getActiveSkills } = useSkillsStore.getState();
        const { getActiveRules } = useRulesStore.getState();
        const { contextFiles } = useContextStore.getState();

        await logInteraction({
          prompt: get().currentPrompt || '',
          activeRules: getActiveRules().map((r) => r.name),
          activeSkills: getActiveSkills().map((s) => s.name),
          filesInContext: contextFiles.map((f) => f.path),
          editsSuggested: 1,
          filesModified: [],
          action: 'rejected',
        });
      }

      // Restore previous mode if all edits are done
      if (get().pendingEdits.length === 0) {
        useTestStore.getState().restorePreviousMode();
      }

      // Update worktree diff if we're in a worktree session
      const { projectPath } = useProjectStore.getState();
      if (projectPath) {
        useWorktreeStore.getState().updateWorktreeDiff(projectPath);
      }

      return true;
    }
    return false;
  },

  rejectEditWithReason: async (editId, reason) => {
    if (!window.electron?.claude) return { success: false };

    const edit = get().pendingEdits.find((e) => e.id === editId);
    const result = await window.electron.claude.rejectEdit(editId);

    if (result.success) {
      get().removePendingEdit(editId);

      // Try to create a learned rule from the rejection reason
      const { addLearnedRule } = useRulesStore.getState();
      const newRule = await addLearnedRule(
        reason,
        get().currentPrompt || undefined,
        edit?.newContent
      );

      // Log the interaction with rule creation
      const { logInteraction } = useInteractionLogStore.getState();
      const { getActiveSkills } = useSkillsStore.getState();
      const { getActiveRules } = useRulesStore.getState();
      const { contextFiles } = useContextStore.getState();

      await logInteraction({
        prompt: get().currentPrompt || '',
        activeRules: getActiveRules().map((r) => r.name),
        activeSkills: getActiveSkills().map((s) => s.name),
        filesInContext: contextFiles.map((f) => f.path),
        editsSuggested: 1,
        filesModified: [],
        action: 'rejected',
        rejectionReason: reason,
        ruleCreated: newRule.name,
      });

      // Restore previous mode if all edits are done
      if (get().pendingEdits.length === 0) {
        useTestStore.getState().restorePreviousMode();
      }

      // Update worktree diff if we're in a worktree session
      const { projectPath } = useProjectStore.getState();
      if (projectPath) {
        useWorktreeStore.getState().updateWorktreeDiff(projectPath);
      }

      return { success: true, ruleCreated: newRule.name };
    }

    return { success: false };
  },

  approveAll: async () => {
    const { pendingEdits, approveEdit } = get();
    for (const edit of pendingEdits) {
      await approveEdit(edit.id);
    }
  },

  rejectAll: async () => {
    const { pendingEdits, rejectEdit } = get();
    for (const edit of pendingEdits) {
      await rejectEdit(edit.id);
    }
  },
}));
