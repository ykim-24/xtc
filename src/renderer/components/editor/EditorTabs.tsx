import { X, Copy, Clipboard, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { useProjectStore, OpenFile } from '@/stores';
import { ContextMenu, useContextMenu, ContextMenuItem } from '@/components/ui';

export function EditorTabs() {
  const { openFiles, activeFilePath, setActiveFile, closeFile } = useProjectStore();

  const closeOtherFiles = (keepPath: string) => {
    openFiles.forEach((file) => {
      if (file.path !== keepPath) {
        closeFile(file.path);
      }
    });
  };

  const closeAllFiles = () => {
    openFiles.forEach((file) => {
      closeFile(file.path);
    });
  };

  const closeFilesToRight = (fromPath: string) => {
    const index = openFiles.findIndex((f) => f.path === fromPath);
    if (index === -1) return;

    openFiles.slice(index + 1).forEach((file) => {
      closeFile(file.path);
    });
  };

  if (openFiles.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center bg-bg-secondary border-b border-border-primary overflow-x-auto">
      {openFiles.map((file, index) => (
        <Tab
          key={file.path}
          file={file}
          isActive={file.path === activeFilePath}
          onSelect={() => setActiveFile(file.path)}
          onClose={() => closeFile(file.path)}
          onCloseOthers={() => closeOtherFiles(file.path)}
          onCloseAll={closeAllFiles}
          onCloseToRight={() => closeFilesToRight(file.path)}
          isLast={index === openFiles.length - 1}
        />
      ))}
    </div>
  );
}

interface TabProps {
  file: OpenFile;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
  onCloseToRight: () => void;
  isLast: boolean;
}

function Tab({ file, isActive, onSelect, onClose, onCloseOthers, onCloseAll, onCloseToRight, isLast }: TabProps) {
  const contextMenu = useContextMenu();

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(file.path);
  };

  const handleCopyRelativePath = () => {
    // Get filename as relative path (simplified)
    navigator.clipboard.writeText(file.name);
  };

  const handleRevealInFinder = () => {
    window.electron?.revealInFinder?.(file.path);
  };

  const contextMenuItems: ContextMenuItem[] = [
    {
      label: 'Close',
      shortcut: '⌘W',
      onClick: onClose,
    },
    {
      label: 'Close Others',
      onClick: onCloseOthers,
    },
    {
      label: 'Close All',
      onClick: onCloseAll,
    },
    {
      label: 'Close to the Right',
      onClick: onCloseToRight,
      disabled: isLast,
    },
    { label: '', separator: true, onClick: () => {} },
    {
      label: 'Copy Path',
      icon: <Copy className="w-4 h-4" />,
      onClick: handleCopyPath,
    },
    {
      label: 'Copy Relative Path',
      icon: <Clipboard className="w-4 h-4" />,
      onClick: handleCopyRelativePath,
    },
    { label: '', separator: true, onClick: () => {} },
    {
      label: 'Reveal in Finder',
      icon: <ExternalLink className="w-4 h-4" />,
      onClick: handleRevealInFinder,
    },
  ];

  return (
    <>
      <div
        onClick={onSelect}
        onContextMenu={contextMenu.open}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 border-r border-border-secondary cursor-pointer group min-w-0',
          isActive
            ? 'bg-bg-primary text-text-primary'
            : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
        )}
      >
        {file.isDirty && (
          <span className="w-2 h-2 rounded-full bg-accent-primary flex-shrink-0" />
        )}
        <span className="text-sm truncate max-w-32">{file.name}</span>
        <button
          onClick={handleClose}
          className={clsx(
            'p-0.5 rounded hover:bg-bg-hover flex-shrink-0',
            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <X className="w-3 h-3" />
        </button>
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
