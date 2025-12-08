import { ChevronRight, ChevronDown, Folder, FolderOpen, FilePlus, FolderPlus, Copy, Clipboard, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { ProjectFile } from '@/stores/projectStore';
import { ContextMenu, useContextMenu, ContextMenuItem } from '@/components/ui';
import { FileIcon } from '@/utils/fileIcons';

interface FileTreeItemProps {
  file: ProjectFile;
  depth: number;
  isSelected: boolean;
  selectedPaths?: Set<string>;
  onSelect: (path: string, event?: React.MouseEvent) => void;
  onToggle: (path: string) => void;
  onNewFile?: (parentPath: string) => void;
  onNewFolder?: (parentPath: string) => void;
  onRename?: (path: string) => void;
  onDelete?: (path: string) => void;
  renamingPath?: string | null;
  renameValue?: string;
  onRenameValueChange?: (value: string) => void;
  onRenameSubmit?: () => void;
  onRenameKeyDown?: (e: React.KeyboardEvent) => void;
}

export function FileTreeItem({
  file,
  depth,
  isSelected,
  selectedPaths,
  onSelect,
  onToggle,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  renamingPath,
  renameValue,
  onRenameValueChange,
  onRenameSubmit,
  onRenameKeyDown,
}: FileTreeItemProps) {
  const isDirectory = file.type === 'directory';
  const isExpanded = file.expanded;
  const contextMenu = useContextMenu();

  const handleClick = (e: React.MouseEvent) => {
    if (isDirectory) {
      onToggle(file.path);
    } else {
      onSelect(file.path, e);
    }
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(file.path);
  };

  const handleCopyRelativePath = () => {
    // Get relative path from project root
    const parts = file.path.split('/');
    // Assuming project path is everything before the file/folder in the tree
    const relativePath = file.name; // Simplified - could be enhanced
    navigator.clipboard.writeText(relativePath);
  };

  const handleRevealInFinder = () => {
    window.electron?.revealInFinder?.(file.path);
  };

  const handleDelete = async () => {
    if (onDelete) {
      onDelete(file.path);
    }
  };

  const FolderIcon = isExpanded ? FolderOpen : Folder;

  // Build context menu items
  const contextMenuItems: ContextMenuItem[] = [];

  if (isDirectory) {
    contextMenuItems.push(
      {
        label: 'New File',
        icon: <FilePlus className="w-4 h-4" />,
        onClick: () => onNewFile?.(file.path),
      },
      {
        label: 'New Folder',
        icon: <FolderPlus className="w-4 h-4" />,
        onClick: () => onNewFolder?.(file.path),
      },
      { label: '', separator: true, onClick: () => {} }
    );
  }

  contextMenuItems.push(
    {
      label: 'Copy Path',
      icon: <Copy className="w-4 h-4" />,
      shortcut: '⌥⌘C',
      onClick: handleCopyPath,
    },
    {
      label: 'Copy Relative Path',
      icon: <Clipboard className="w-4 h-4" />,
      shortcut: '⇧⌥⌘C',
      onClick: handleCopyRelativePath,
    },
    { label: '', separator: true, onClick: () => {} },
    {
      label: 'Reveal in Finder',
      icon: <ExternalLink className="w-4 h-4" />,
      onClick: handleRevealInFinder,
    },
    { label: '', separator: true, onClick: () => {} },
    {
      label: 'Rename',
      icon: <Pencil className="w-4 h-4" />,
      shortcut: 'Enter',
      onClick: () => onRename?.(file.path),
    },
    {
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      shortcut: '⌘⌫',
      onClick: handleDelete,
      danger: true,
    }
  );

  const isRenaming = renamingPath === file.path;

  return (
    <>
      {isRenaming ? (
        <div
          className={clsx(
            'w-full flex items-center gap-1 pr-2 py-0.5 text-sm',
            'bg-bg-active text-text-primary'
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {isDirectory && (
            <span className="flex-shrink-0 w-4">
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </span>
          )}
          {!isDirectory && <span className="w-4" />}
          {isDirectory ? (
            <FolderIcon className="w-4 h-4 flex-shrink-0 text-accent-warning" />
          ) : (
            <FileIcon fileName={file.name} className="w-4 h-4 flex-shrink-0" />
          )}
          <input
            type="text"
            value={renameValue || ''}
            onChange={(e) => onRenameValueChange?.(e.target.value)}
            onKeyDown={onRenameKeyDown}
            onBlur={onRenameSubmit}
            className="flex-1 bg-bg-secondary border border-border-primary rounded px-1 py-0.5 text-sm text-text-primary outline-none focus:border-accent-primary"
            autoFocus
          />
        </div>
      ) : (
        <button
          onClick={handleClick}
          onContextMenu={contextMenu.open}
          data-path={file.path}
          className={clsx(
            'w-full flex items-center gap-1 pr-2 py-0.5 text-left text-sm transition-colors',
            isSelected ? 'bg-bg-active text-text-primary' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {isDirectory && (
            <span className="flex-shrink-0 w-4">
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </span>
          )}
          {!isDirectory && <span className="w-4" />}
          {isDirectory ? (
            <FolderIcon className="w-4 h-4 flex-shrink-0 text-accent-warning" />
          ) : (
            <FileIcon fileName={file.name} className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="truncate flex-1 text-left">{file.name}</span>
        </button>
      )}

      {contextMenu.isOpen && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={contextMenu.close}
        />
      )}

      {isDirectory && isExpanded && file.children && (
        <div>
          {file.children.map((child) => (
            <FileTreeItem
              key={child.path}
              file={child}
              depth={depth + 1}
              isSelected={selectedPaths?.has(child.path) ?? false}
              selectedPaths={selectedPaths}
              onSelect={onSelect}
              onToggle={onToggle}
              onNewFile={onNewFile}
              onNewFolder={onNewFolder}
              onRename={onRename}
              onDelete={onDelete}
              renamingPath={renamingPath}
              renameValue={renameValue}
              onRenameValueChange={onRenameValueChange}
              onRenameSubmit={onRenameSubmit}
              onRenameKeyDown={onRenameKeyDown}
            />
          ))}
        </div>
      )}
    </>
  );
}
