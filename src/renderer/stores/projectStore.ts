import { create } from 'zustand';
import { loadProjectTypes } from '../services/monacoConfig';
import { useChatStore } from './chatStore';

export interface ProjectFile {
  path: string;
  name: string;
  type: 'file' | 'directory';
  children?: ProjectFile[];
  expanded?: boolean;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
}

interface ProjectState {
  // Current project
  projectPath: string | null;
  setProjectPath: (path: string | null) => void;

  // File tree
  fileTree: ProjectFile[];
  setFileTree: (tree: ProjectFile[]) => void;
  toggleFolder: (path: string) => void;
  setFolderChildren: (path: string, children: ProjectFile[]) => void;

  // Open files
  openFiles: OpenFile[];
  activeFilePath: string | null;
  openFile: (file: OpenFile) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  setActiveFilePath: (path: string) => void; // Alias for setActiveFile
  updateFileContent: (path: string, content: string) => void;
  markFileDirty: (path: string, isDirty: boolean) => void;
  saveFile: (path: string) => Promise<boolean>;
  saveActiveFile: () => Promise<boolean>;
  saveAllFiles: () => Promise<boolean>;

  // Recently closed files (for reopen)
  recentlyClosed: OpenFile[];
  reopenLastClosedFile: () => void;

  // New file
  newFileCounter: number;
  createNewFile: () => void;

  // Edit review mode
  isEditReviewMode: boolean;
  setEditReviewMode: (isActive: boolean) => void;

  // Reveal file in explorer
  revealPath: string | null;
  revealInExplorer: (path: string) => void;
  clearRevealPath: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // Current project
  projectPath: null,
  setProjectPath: (projectPath) => {
    // Clear all open files and reset state when switching projects
    set({
      projectPath,
      openFiles: [],
      activeFilePath: null,
      fileTree: [],
      recentlyClosed: [],
    });
    // Clear chat messages and reset Claude conversation for the new project
    useChatStore.getState().clearMessages();
    // Also clear the conversation state on the backend
    if (window.electron?.claude) {
      window.electron.claude.clearConversation(projectPath);
    }
    // Load type definitions from the project's node_modules
    if (projectPath) {
      loadProjectTypes(projectPath);
    }
  },

  // File tree
  fileTree: [],
  setFileTree: (fileTree) => set({ fileTree }),
  toggleFolder: (path) =>
    set((state) => ({
      fileTree: toggleFolderInTree(state.fileTree, path),
    })),
  setFolderChildren: (path, children) =>
    set((state) => ({
      fileTree: setChildrenInTree(state.fileTree, path, children),
    })),

  // Open files
  openFiles: [],
  activeFilePath: null,
  openFile: (file) =>
    set((state) => {
      const exists = state.openFiles.find((f) => f.path === file.path);
      if (exists) {
        return { activeFilePath: file.path };
      }
      return {
        openFiles: [...state.openFiles, file],
        activeFilePath: file.path,
      };
    }),
  closeFile: (path) =>
    set((state) => {
      const closedFile = state.openFiles.find((f) => f.path === path);
      const newOpenFiles = state.openFiles.filter((f) => f.path !== path);
      let newActivePath = state.activeFilePath;
      if (state.activeFilePath === path) {
        newActivePath = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1].path : null;
      }
      // Add to recently closed (keep last 10)
      const newRecentlyClosed = closedFile
        ? [closedFile, ...state.recentlyClosed.filter(f => f.path !== path)].slice(0, 10)
        : state.recentlyClosed;
      return {
        openFiles: newOpenFiles,
        activeFilePath: newActivePath,
        recentlyClosed: newRecentlyClosed,
      };
    }),
  setActiveFile: (activeFilePath) => set({ activeFilePath }),
  setActiveFilePath: (activeFilePath) => set({ activeFilePath }),
  updateFileContent: (path, content) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path ? { ...f, content, isDirty: true } : f
      ),
    })),
  markFileDirty: (path, isDirty) =>
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path ? { ...f, isDirty } : f
      ),
    })),

  saveFile: async (path) => {
    const file = get().openFiles.find((f) => f.path === path);
    if (!file || !window.electron) return false;

    const result = await window.electron.writeFile(path, file.content);
    if (result.success) {
      set((state) => ({
        openFiles: state.openFiles.map((f) =>
          f.path === path ? { ...f, isDirty: false } : f
        ),
      }));
      return true;
    }
    return false;
  },

  saveActiveFile: async () => {
    const { activeFilePath, saveFile } = get();
    if (!activeFilePath) return false;
    return saveFile(activeFilePath);
  },

  saveAllFiles: async () => {
    const { openFiles, saveFile } = get();
    const dirtyFiles = openFiles.filter((f) => f.isDirty);
    const results = await Promise.all(dirtyFiles.map((f) => saveFile(f.path)));
    return results.every((r) => r);
  },

  // Recently closed files
  recentlyClosed: [],
  reopenLastClosedFile: () =>
    set((state) => {
      if (state.recentlyClosed.length === 0) return state;
      const [fileToReopen, ...remainingClosed] = state.recentlyClosed;
      // Check if already open
      if (state.openFiles.some(f => f.path === fileToReopen.path)) {
        return {
          activeFilePath: fileToReopen.path,
          recentlyClosed: remainingClosed,
        };
      }
      return {
        openFiles: [...state.openFiles, fileToReopen],
        activeFilePath: fileToReopen.path,
        recentlyClosed: remainingClosed,
      };
    }),

  // New file
  newFileCounter: 1,
  createNewFile: () =>
    set((state) => {
      const counter = state.newFileCounter;
      const newFile: OpenFile = {
        path: `untitled-${counter}`,
        name: `Untitled-${counter}`,
        content: '',
        language: 'plaintext',
        isDirty: false,
      };
      return {
        openFiles: [...state.openFiles, newFile],
        activeFilePath: newFile.path,
        newFileCounter: counter + 1,
      };
    }),

  // Edit review mode
  isEditReviewMode: false,
  setEditReviewMode: (isEditReviewMode) => set({ isEditReviewMode }),

  // Reveal file in explorer
  revealPath: null,
  revealInExplorer: (path) => {
    const { projectPath, fileTree } = get();
    if (!projectPath || !path.startsWith(projectPath)) return;

    // Get all parent directory paths
    const relativePath = path.slice(projectPath.length + 1);
    const parts = relativePath.split('/');
    const parentPaths: string[] = [];

    // Build parent paths (all except the file itself)
    for (let i = 0; i < parts.length - 1; i++) {
      const parentPath = projectPath + '/' + parts.slice(0, i + 1).join('/');
      parentPaths.push(parentPath);
    }

    // Expand all parent folders
    const expandedTree = expandParentsInTree(fileTree, parentPaths);

    set({
      fileTree: expandedTree,
      revealPath: path,
    });
  },
  clearRevealPath: () => set({ revealPath: null }),
}));

// Helper function to toggle folder expansion
function toggleFolderInTree(tree: ProjectFile[], targetPath: string): ProjectFile[] {
  return tree.map((node) => {
    if (node.path === targetPath) {
      return { ...node, expanded: !node.expanded };
    }
    if (node.children) {
      return { ...node, children: toggleFolderInTree(node.children, targetPath) };
    }
    return node;
  });
}

// Helper function to set children for a folder
function setChildrenInTree(tree: ProjectFile[], targetPath: string, children: ProjectFile[]): ProjectFile[] {
  return tree.map((node) => {
    if (node.path === targetPath) {
      return { ...node, children, expanded: true };
    }
    if (node.children) {
      return { ...node, children: setChildrenInTree(node.children, targetPath, children) };
    }
    return node;
  });
}

// Helper function to expand parent folders
function expandParentsInTree(tree: ProjectFile[], parentPaths: string[]): ProjectFile[] {
  const pathSet = new Set(parentPaths);

  const expandRecursively = (nodes: ProjectFile[]): ProjectFile[] => {
    return nodes.map((node) => {
      if (pathSet.has(node.path)) {
        // This is a parent folder - expand it
        return {
          ...node,
          expanded: true,
          children: node.children ? expandRecursively(node.children) : undefined,
        };
      }
      if (node.children) {
        return { ...node, children: expandRecursively(node.children) };
      }
      return node;
    });
  };

  return expandRecursively(tree);
}
