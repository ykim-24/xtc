import { useState, useEffect, useCallback, useRef } from 'react';
import { FolderOpen, FolderPlus, FilePlus, ChevronsDownUp, RefreshCw, ExternalLink } from 'lucide-react';
import { Panel, IconButton, ContextMenu, useContextMenu, ContextMenuItem } from '@/components/ui';
import { FileTreeItem } from './FileTreeItem';
import { useProjectStore, useSkillsStore, useRulesStore, useInteractionLogStore, ProjectFile } from '@/stores';
import { loadLastProjectPath } from '@/stores/projectStore';
import { restoreSession, setupAutoSave, setupSleepHandler } from '@/services/sessionManager';

// File extension to language mapping
const FILE_EXTENSIONS_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescriptreact',
  '.js': 'javascript',
  '.jsx': 'javascriptreact',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.json': 'json',
  '.md': 'markdown',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.html': 'html',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.java': 'java',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.xml': 'xml',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.gql': 'graphql',
};

function getLanguageFromPath(filePath: string): string {
  const ext = '.' + filePath.split('.').pop();
  return FILE_EXTENSIONS_TO_LANGUAGE[ext] || 'plaintext';
}

// Flatten file tree to get ordered list of all file paths (for shift+click range)
function flattenTree(nodes: ProjectFile[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    paths.push(node.path);
    if (node.type === 'directory' && node.expanded && node.children) {
      paths.push(...flattenTree(node.children));
    }
  }
  return paths;
}

export function Explorer() {
  const { fileTree, activeFilePath, toggleFolder, projectPath, setProjectPath, setFileTree, openFile, setFolderChildren, closeFile, revealPath, clearRevealPath } = useProjectStore();
  const { loadSkills, clearSkills } = useSkillsStore();
  const { loadRules, clearRules } = useRulesStore();
  const { loadLogs } = useInteractionLogStore();
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Multi-select state
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);

  // Handle reveal in explorer from file search
  useEffect(() => {
    if (revealPath) {
      setSelectedPaths(new Set([revealPath]));
      setLastSelectedPath(revealPath);

      // Scroll to the file after a short delay to allow DOM update
      setTimeout(() => {
        const element = document.querySelector(`[data-path="${revealPath}"]`);
        if (element) {
          element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        clearRevealPath();
      }, 100);
    }
  }, [revealPath, clearRevealPath]);

  const loadDirectory = useCallback(async (dirPath: string): Promise<ProjectFile[]> => {
    const result = await window.electron?.readDir(dirPath);
    if (!result?.success || !result.items) return [];

    return result.items.map((item) => ({
      path: item.path,
      name: item.name,
      type: item.type,
      expanded: false,
      children: item.type === 'directory' ? [] : undefined,
    }));
  }, []);

  // Refresh the file tree (debounced)
  const refreshFileTree = useCallback(async () => {
    if (!projectPath) return;

    // Debounce rapid changes
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(async () => {
      const tree = await loadDirectory(projectPath);
      setFileTree(tree);
    }, 300);
  }, [projectPath, loadDirectory, setFileTree]);

  // Track if session has been restored for the current project to avoid re-restoring on remount
  const sessionRestoredForRef = useRef<string | null>(null);

  // On startup, load the last opened project
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    const loadStartupProject = async () => {
      // Only load once on mount, and only if no project is set
      if (hasLoadedRef.current || projectPath) return;
      hasLoadedRef.current = true;

      const lastPath = await loadLastProjectPath();
      if (lastPath) {
        // Verify the directory still exists
        try {
          const result = await window.electron?.readDir(lastPath);
          if (result?.success) {
            setProjectPath(lastPath);
          }
        } catch {
          // Directory no longer exists, ignore
        }
      }
    };

    loadStartupProject();
  }, [projectPath, setProjectPath]);

  // Load directory tree when project path changes
  useEffect(() => {
    if (!projectPath) return;

    const loadTree = async () => {
      // Clear previous project data
      clearSkills();
      clearRules();

      const tree = await loadDirectory(projectPath);
      setFileTree(tree);
      // Load project-specific skills, rules, and logs
      await Promise.all([
        loadSkills(),
        loadRules(),
        loadLogs(),
      ]);

      // Restore session state only if it hasn't been restored for this project yet
      // This prevents re-restoring when Explorer remounts due to mode switching
      if (sessionRestoredForRef.current !== projectPath) {
        sessionRestoredForRef.current = projectPath;
        await restoreSession(projectPath);
      }
    };

    loadTree();
  }, [projectPath, loadDirectory, setFileTree, loadSkills, loadRules, loadLogs, clearSkills, clearRules]);

  // Set up session auto-save and sleep handlers
  useEffect(() => {
    if (!projectPath) return;

    const cleanupAutoSave = setupAutoSave(projectPath);
    const cleanupSleepHandler = setupSleepHandler(projectPath);

    return () => {
      cleanupAutoSave();
      cleanupSleepHandler();
    };
  }, [projectPath]);

  // Set up file watcher when project path changes
  useEffect(() => {
    if (!projectPath || !window.electron?.watchDir) return;

    // Start watching the directory
    window.electron.watchDir(projectPath);

    // Listen for file changes
    const unsubscribe = window.electron.onFileChanged?.(() => {
      refreshFileTree();
    });

    return () => {
      unsubscribe?.();
      window.electron?.unwatchDir?.();
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [projectPath, refreshFileTree]);

  const handleOpenFolder = async () => {
    const path = await window.electron?.openFolder();
    if (path) {
      // Clear previous project data
      clearSkills();
      clearRules();

      setProjectPath(path);
      const tree = await loadDirectory(path);
      setFileTree(tree);

      // Load project-specific skills, rules, and logs
      await Promise.all([
        loadSkills(),
        loadRules(),
        loadLogs(),
      ]);

      // Restore session state for the new project
      sessionRestoredForRef.current = path;
      await restoreSession(path);
    }
  };

  const handleSelectFile = async (filePath: string, event?: React.MouseEvent) => {
    const isCtrlOrCmd = event?.metaKey || event?.ctrlKey;
    const isShift = event?.shiftKey;

    if (isShift && lastSelectedPath) {
      // Range selection
      const allPaths = flattenTree(fileTree);
      const lastIndex = allPaths.indexOf(lastSelectedPath);
      const currentIndex = allPaths.indexOf(filePath);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangePaths = allPaths.slice(start, end + 1);

        setSelectedPaths(prev => {
          const next = new Set(prev);
          rangePaths.forEach(p => next.add(p));
          return next;
        });
      }
    } else if (isCtrlOrCmd) {
      // Toggle selection
      setSelectedPaths(prev => {
        const next = new Set(prev);
        if (next.has(filePath)) {
          next.delete(filePath);
        } else {
          next.add(filePath);
        }
        return next;
      });
      setLastSelectedPath(filePath);
    } else {
      // Single selection - clear others and select this one
      setSelectedPaths(new Set([filePath]));
      setLastSelectedPath(filePath);

      // Check if it's an image file
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.avif'];
      const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
      const isImage = imageExtensions.includes(ext);

      if (isImage) {
        // For images, just open without reading content
        const fileName = filePath.split('/').pop() || 'untitled';
        openFile({
          path: filePath,
          name: fileName,
          content: '', // Images don't need content
          language: 'image',
          isDirty: false,
        });
      } else {
        // Open file in editor (only on single click without modifiers)
        const result = await window.electron?.readFile(filePath);
        if (result?.success && result.content !== undefined) {
          const fileName = filePath.split('/').pop() || 'untitled';
          openFile({
            path: filePath,
            name: fileName,
            content: result.content,
            language: getLanguageFromPath(filePath),
            isDirty: false,
          });
        }
      }
    }
  };

  const handleToggleFolder = async (folderPath: string) => {
    // Find the folder in the tree to check if it needs loading
    const findFolder = (tree: ProjectFile[]): ProjectFile | undefined => {
      for (const node of tree) {
        if (node.path === folderPath) return node;
        if (node.children) {
          const found = findFolder(node.children);
          if (found) return found;
        }
      }
      return undefined;
    };

    const folder = findFolder(fileTree);
    if (folder && folder.type === 'directory') {
      if (!folder.expanded && folder.children?.length === 0) {
        // Load children on first expand
        const children = await loadDirectory(folderPath);
        setFolderChildren(folderPath, children);
      } else {
        // Just toggle if already loaded
        toggleFolder(folderPath);
      }
    }
  };

  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [createInPath, setCreateInPath] = useState<string | null>(null); // Path to create new item in

  // Rename state
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameSubmittingRef = useRef(false);

  const collapseAllFolders = () => {
    const collapseTree = (tree: ProjectFile[]): ProjectFile[] => {
      return tree.map((node) => ({
        ...node,
        expanded: false,
        children: node.children ? collapseTree(node.children) : undefined,
      }));
    };
    setFileTree(collapseTree(fileTree));
  };

  const handleCreateFile = async () => {
    if (!newItemName.trim()) {
      setIsCreatingFile(false);
      setNewItemName('');
      setCreateInPath(null);
      return;
    }

    const basePath = createInPath || projectPath;
    if (!basePath) return;

    const filePath = `${basePath}/${newItemName.trim()}`;
    await window.electron?.writeFile(filePath, '');

    // Refresh the tree
    if (projectPath) {
      const tree = await loadDirectory(projectPath);
      setFileTree(tree);
    }

    // Open the new file
    handleSelectFile(filePath);

    setIsCreatingFile(false);
    setNewItemName('');
    setCreateInPath(null);
  };

  const handleCreateFolder = async () => {
    if (!newItemName.trim()) {
      setIsCreatingFolder(false);
      setNewItemName('');
      setCreateInPath(null);
      return;
    }

    const basePath = createInPath || projectPath;
    if (!basePath) return;

    const folderPath = `${basePath}/${newItemName.trim()}`;
    // Create folder by writing a placeholder and then the folder will exist
    await window.electron?.writeFile(`${folderPath}/.gitkeep`, '');

    // Refresh the tree
    if (projectPath) {
      const tree = await loadDirectory(projectPath);
      setFileTree(tree);
    }

    setIsCreatingFolder(false);
    setNewItemName('');
    setCreateInPath(null);
  };

  const handleNewItemKeyDown = (e: React.KeyboardEvent, isFolder: boolean) => {
    if (e.key === 'Enter') {
      if (isFolder) {
        handleCreateFolder();
      } else {
        handleCreateFile();
      }
    } else if (e.key === 'Escape') {
      setIsCreatingFile(false);
      setIsCreatingFolder(false);
      setNewItemName('');
      setCreateInPath(null);
    }
  };

  // Context menu handlers
  const handleContextNewFile = (parentPath: string) => {
    setCreateInPath(parentPath);
    setIsCreatingFile(true);
    setIsCreatingFolder(false);
  };

  const handleContextNewFolder = (parentPath: string) => {
    setCreateInPath(parentPath);
    setIsCreatingFolder(true);
    setIsCreatingFile(false);
  };

  const handleRename = (path: string) => {
    const name = path.split('/').pop() || '';
    setRenamingPath(path);
    setRenameValue(name);
  };

  const handleRenameSubmit = async () => {
    // Prevent double submission from blur + enter
    if (renameSubmittingRef.current) return;

    if (!renamingPath || !renameValue.trim()) {
      setRenamingPath(null);
      setRenameValue('');
      return;
    }

    renameSubmittingRef.current = true;

    const oldPath = renamingPath;
    const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = `${parentPath}/${renameValue.trim()}`;

    // Clear state first to prevent UI issues
    setRenamingPath(null);
    setRenameValue('');

    if (oldPath !== newPath) {
      const result = await window.electron?.renameFile?.(oldPath, newPath);
      console.log('Rename result:', result, 'from', oldPath, 'to', newPath);
      // Refresh the tree
      if (projectPath) {
        const tree = await loadDirectory(projectPath);
        setFileTree(tree);
      }
    }

    renameSubmittingRef.current = false;
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setRenamingPath(null);
      setRenameValue('');
    }
  };

  const handleDelete = async (path: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete "${path.split('/').pop()}"?`);
    if (confirmed) {
      await window.electron?.deleteFile?.(path);
      // Close the tab if the file is open
      closeFile(path);
      // Refresh the tree
      if (projectPath) {
        const tree = await loadDirectory(projectPath);
        setFileTree(tree);
      }
    }
  };

  // Context menu for empty space
  const emptySpaceContextMenu = useContextMenu();

  const handleRevealInFinder = () => {
    if (projectPath) {
      window.electron?.revealInFinder?.(projectPath);
    }
  };

  const emptySpaceMenuItems: ContextMenuItem[] = [
    {
      label: 'New File',
      icon: <FilePlus className="w-4 h-4" />,
      onClick: () => {
        setCreateInPath(null);
        setIsCreatingFile(true);
      },
    },
    {
      label: 'New Folder',
      icon: <FolderPlus className="w-4 h-4" />,
      onClick: () => {
        setCreateInPath(null);
        setIsCreatingFolder(true);
      },
    },
    { label: '', separator: true, onClick: () => {} },
    {
      label: 'Refresh',
      icon: <RefreshCw className="w-4 h-4" />,
      onClick: refreshFileTree,
    },
    { label: '', separator: true, onClick: () => {} },
    {
      label: 'Reveal in Finder',
      icon: <ExternalLink className="w-4 h-4" />,
      onClick: handleRevealInFinder,
    },
  ];

  const handleEmptySpaceContextMenu = (e: React.MouseEvent) => {
    // Only show if clicking on the container, not on a file item
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.explorer-empty-area')) {
      emptySpaceContextMenu.open(e);
    }
  };

  return (
    <Panel
      title="Explorer"
      className="h-full border-r border-border-primary"
      actions={
        projectPath ? (
          <>
            <IconButton size="sm" onClick={() => setIsCreatingFile(true)} title="New File">
              <FilePlus className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton size="sm" onClick={() => setIsCreatingFolder(true)} title="New Folder">
              <FolderPlus className="w-3.5 h-3.5" />
            </IconButton>
            <IconButton size="sm" onClick={collapseAllFolders} title="Collapse All">
              <ChevronsDownUp className="w-3.5 h-3.5" />
            </IconButton>
          </>
        ) : null
      }
    >
      {fileTree.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <button
            onClick={handleOpenFolder}
            className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-bg-hover transition-colors"
          >
            <FolderOpen className="w-8 h-8 text-text-muted" />
            <span className="text-sm text-text-secondary">Open Folder</span>
          </button>
        </div>
      ) : (
        <div
          className="py-1 h-full flex flex-col"
          onContextMenu={handleEmptySpaceContextMenu}
        >
          {projectPath && (
            <div className="px-3 py-1.5 text-xs font-medium text-text-muted uppercase tracking-wider truncate min-h-[24px] leading-4">
              {projectPath.split('/').pop()}
            </div>
          )}
          {(isCreatingFile || isCreatingFolder) && (
            <div className="flex items-center gap-1 px-2 py-0.5">
              <span className="w-4" />
              {isCreatingFolder ? (
                <FolderPlus className="w-4 h-4 text-accent-warning" />
              ) : (
                <FilePlus className="w-4 h-4 text-text-muted" />
              )}
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => handleNewItemKeyDown(e, isCreatingFolder)}
                onBlur={() => {
                  setIsCreatingFile(false);
                  setIsCreatingFolder(false);
                  setNewItemName('');
                }}
                placeholder={isCreatingFolder ? 'folder name' : 'file name'}
                className="flex-1 bg-bg-secondary border border-border-primary rounded px-1.5 py-0.5 text-sm text-text-primary outline-none focus:border-accent-primary"
                autoFocus
              />
            </div>
          )}
          <div className="flex-1">
            {fileTree.map((file) => (
              <FileTreeItem
                key={file.path}
                file={file}
                depth={0}
                isSelected={selectedPaths.has(file.path)}
                selectedPaths={selectedPaths}
                onSelect={handleSelectFile}
                onToggle={handleToggleFolder}
                onNewFile={handleContextNewFile}
                onNewFolder={handleContextNewFolder}
                onRename={handleRename}
                onDelete={handleDelete}
                renamingPath={renamingPath}
                renameValue={renameValue}
                onRenameValueChange={setRenameValue}
                onRenameSubmit={handleRenameSubmit}
                onRenameKeyDown={handleRenameKeyDown}
              />
            ))}
          </div>
          {/* Empty space area for context menu */}
          <div className="explorer-empty-area flex-1 min-h-[50px]" />

          {emptySpaceContextMenu.isOpen && (
            <ContextMenu
              x={emptySpaceContextMenu.x}
              y={emptySpaceContextMenu.y}
              items={emptySpaceMenuItems}
              onClose={emptySpaceContextMenu.close}
            />
          )}
        </div>
      )}
    </Panel>
  );
}
