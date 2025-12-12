import { useState, useEffect, useCallback } from 'react';
import { GitBranch, FolderOpen, Trash2, ExternalLink } from 'lucide-react';
import { useProjectStore } from '@/stores';
import { ContextMenu, useContextMenu, ContextMenuItem } from '@/components/ui';

interface Worktree {
  path: string;
  branch: string;
  isMain: boolean;
  isCurrent: boolean;
}

export function WorktreesPanel() {
  const { projectPath, setProjectPath } = useProjectStore();
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [mainRepoPath, setMainRepoPath] = useState<string | null>(null);
  const [contextMenuItems, setContextMenuItems] = useState<ContextMenuItem[]>([]);

  const contextMenu = useContextMenu();

  const loadWorktrees = useCallback(async () => {
    if (!projectPath) return;

    setIsLoading(true);
    try {
      const result = await window.electron?.git.worktree.list(projectPath);

      if (result?.success && result.worktrees) {
        // Find the main worktree path
        const main = result.worktrees.find(w => w.isMain);
        if (main) {
          setMainRepoPath(main.path);
        }

        // Mark which one is current
        const mapped = result.worktrees.map(w => ({
          ...w,
          isCurrent: w.path === projectPath,
        }));

        setWorktrees(mapped);
      }
    } catch (error) {
      console.error('Failed to load worktrees:', error);
    }
    setIsLoading(false);
  }, [projectPath]);

  // Load worktrees when project changes
  useEffect(() => {
    loadWorktrees();
  }, [loadWorktrees]);

  const handleSwitchWorktree = (worktree: Worktree) => {
    if (worktree.isCurrent) return;
    setProjectPath(worktree.path);
  };

  const handleRemoveWorktree = async (worktree: Worktree) => {
    if (worktree.isMain || worktree.isCurrent) return;

    // Need to run remove from the main repo path
    const repoPath = mainRepoPath || projectPath;
    if (!repoPath) return;

    const result = await window.electron?.git.worktree.remove(repoPath, worktree.path);
    if (result?.success) {
      loadWorktrees();
    }
  };

  const handleRevealInFinder = async (worktree: Worktree) => {
    await window.electron?.revealInFinder?.(worktree.path);
  };

  const handleContextMenu = (e: React.MouseEvent, worktree: Worktree) => {
    const items: ContextMenuItem[] = [
      {
        label: 'Open',
        icon: <FolderOpen className="w-4 h-4" />,
        onClick: () => handleSwitchWorktree(worktree),
        disabled: worktree.isCurrent,
      },
      {
        label: 'Reveal in Finder',
        icon: <ExternalLink className="w-4 h-4" />,
        onClick: () => handleRevealInFinder(worktree),
      },
    ];

    if (!worktree.isMain && !worktree.isCurrent) {
      items.push(
        { label: '', separator: true, onClick: () => {} },
        {
          label: 'Remove Worktree',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => handleRemoveWorktree(worktree),
          danger: true,
        }
      );
    }

    setContextMenuItems(items);
    contextMenu.open(e);
  };

  if (!projectPath) return null;

  // Don't show if there's only the main worktree
  if (worktrees.length <= 1) return null;

  return (
    <>
      <div className="border-t border-border-primary">
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-bg-tertiary"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <GitBranch className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
              Worktrees
            </span>
            <span className="text-xs text-text-muted">({worktrees.length})</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              loadWorktrees();
            }}
            className="text-[10px] font-mono text-text-muted hover:text-blue-400 transition-colors"
            title="Refresh worktrees"
          >
            [ refresh ]
          </button>
        </div>

        {/* Worktree list */}
        {isExpanded && (
          <div className="px-2 pb-2">
            {worktrees.map((worktree) => (
              <div
                key={worktree.path}
                className={`
                  flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer group
                  ${worktree.isCurrent
                    ? 'bg-accent-primary/20 text-accent-primary'
                    : 'hover:bg-bg-tertiary text-text-secondary hover:text-text-primary'
                  }
                `}
                onClick={() => handleSwitchWorktree(worktree)}
                onContextMenu={(e) => handleContextMenu(e, worktree)}
              >
                <GitBranch className="w-3 h-3 flex-shrink-0" />
                <span className="truncate flex-1 font-mono">
                  {worktree.branch || 'detached'}
                </span>
                {worktree.isMain && (
                  <span className="text-[10px] px-1 py-0.5 rounded bg-bg-quaternary text-text-muted">
                    main
                  </span>
                )}
                {worktree.isCurrent && (
                  <span className="text-[10px] px-1 py-0.5 rounded bg-accent-primary/30 text-accent-primary">
                    current
                  </span>
                )}
                {/* Delete button - only show for non-main, non-current worktrees */}
                {!worktree.isMain && !worktree.isCurrent && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveWorktree(worktree);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-opacity"
                    title="Remove worktree"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {contextMenu.isOpen && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={contextMenu.close}
        />
      )}
    </>
  );
}
