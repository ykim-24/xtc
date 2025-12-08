import { Plus, Pencil, Check, Circle } from 'lucide-react';
import { Panel, IconButton } from '@/components/ui';
import { usePatternsStore, Pattern } from '@/stores';

export function PatternsPanel() {
  const { patterns, togglePattern } = usePatternsStore();

  const handleCreate = () => {
    // TODO: Open pattern creation modal
    console.log('Create pattern');
  };

  const handleEdit = () => {
    // TODO: Open patterns editor
    console.log('Edit patterns');
  };

  return (
    <Panel
      title="Patterns"
      className="h-full border-l border-t border-border-primary"
      actions={
        <>
          <IconButton size="sm" onClick={handleEdit} title="Edit patterns">
            <Pencil className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton size="sm" onClick={handleCreate} title="Add pattern">
            <Plus className="w-3.5 h-3.5" />
          </IconButton>
        </>
      }
    >
      <div className="p-2 space-y-1">
        {patterns.length === 0 ? (
          <p className="text-xs text-text-muted p-2 text-center">
            No patterns defined. Open a project to auto-detect patterns.
          </p>
        ) : (
          patterns.map((pattern) => (
            <PatternItem
              key={pattern.id}
              pattern={pattern}
              onToggle={() => togglePattern(pattern.id)}
            />
          ))
        )}
      </div>
    </Panel>
  );
}

interface PatternItemProps {
  pattern: Pattern;
  onToggle: () => void;
}

function PatternItem({ pattern, onToggle }: PatternItemProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-hover transition-colors text-left"
    >
      {pattern.isActive ? (
        <Check className="w-4 h-4 flex-shrink-0 text-accent-success" />
      ) : (
        <Circle className="w-4 h-4 flex-shrink-0 text-text-muted" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary truncate">{pattern.name}</div>
        {pattern.isAutoDetected && (
          <span className="text-xs text-text-muted">Auto-detected</span>
        )}
      </div>
    </button>
  );
}
