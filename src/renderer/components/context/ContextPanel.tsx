import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Panel, IconButton } from '@/components/ui';
import { useContextStore } from '@/stores';

export function ContextPanel() {
  const { contextFiles, toggleContextFile, removeContextFile, getTotalTokens } = useContextStore();

  const totalTokens = getTotalTokens();

  const handleAddFile = async () => {
    if (!window.electron?.dialog) return;

    const result = await window.electron.dialog.openFile({
      multiple: true,
      filters: [{ name: 'All Files', extensions: ['*'] }],
    });

    if (result?.filePaths && result.filePaths.length > 0) {
      for (const filePath of result.filePaths) {
        // Skip if already in context
        if (contextFiles.some((f) => f.path === filePath)) continue;

        // Read file content
        const fileResult = await window.electron.readFile(filePath);
        if (fileResult?.success && fileResult.content) {
          const fileName = filePath.split('/').pop() || filePath;
          useContextStore.getState().addContextFile({
            path: filePath,
            name: fileName,
            content: fileResult.content,
          });
        }
      }
    }
  };

  return (
    <Panel
      title="Context"
      className="h-full border-r border-border-primary"
      actions={
        <IconButton size="sm" onClick={handleAddFile} title="Add file">
          <Plus className="w-3.5 h-3.5" />
        </IconButton>
      }
    >
      <div className="flex flex-col h-full font-mono">
        {/* File list */}
        <div className="flex-1 overflow-auto px-2 pt-2 space-y-0.5">
          {contextFiles.length === 0 ? (
            <p className="text-[11px] text-text-muted py-2 text-center">
              -- empty --
            </p>
          ) : (
            contextFiles.map((file) => (
              <ContextFileItem
                key={file.path}
                file={file}
                onToggle={() => toggleContextFile(file.path)}
                onRemove={() => removeContextFile(file.path)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-2">
          <div className="px-2 text-[10px] text-text-muted text-right">
(~{totalTokens.toLocaleString()})
          </div>
        </div>
      </div>
    </Panel>
  );
}

interface ContextFileItemProps {
  file: {
    path: string;
    name: string;
    included: boolean;
    tokenEstimate: number;
  };
  onToggle: () => void;
  onRemove: () => void;
}

function ContextFileItem({ file, onToggle, onRemove }: ContextFileItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-bg-hover text-[11px]"
    >
      <button
        onClick={onToggle}
        className="flex-1 flex items-center gap-1.5 text-left min-w-0"
      >
        <span className={`shrink-0 ${file.included ? 'text-accent-success' : 'text-text-muted'}`}>
          {file.included ? '[*]' : '[ ]'}
        </span>
        <span className="flex-1 text-text-primary truncate min-w-0">
          {file.name}
        </span>
        <span className="text-text-muted shrink-0">
          ~{file.tokenEstimate}
        </span>
      </button>
      {isHovered && (
        <button
          onClick={onRemove}
          className="flex-shrink-0 p-0.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent-error transition-colors"
          title="Remove from context"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
