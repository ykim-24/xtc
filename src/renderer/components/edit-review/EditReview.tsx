import { useEffect } from 'react';
import { Check, X, ChevronDown, ChevronRight, FileCode } from 'lucide-react';
import { Button } from '@/components/ui';
import { useEditsStore } from '@/stores';
import { useState } from 'react';

export function EditReview() {
  const {
    pendingEdits,
    isLoading,
    approveEdit,
    rejectEdit,
    approveAll,
    rejectAll,
  } = useEditsStore();

  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Auto-expand files when edits change
  useEffect(() => {
    const filePaths = new Set(pendingEdits.map((e) => e.filePath));
    setExpandedFiles(filePaths);
  }, [pendingEdits]);

  const toggleFile = (filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  // Group edits by file
  const editsByFile = pendingEdits.reduce((acc, edit) => {
    if (!acc[edit.filePath]) {
      acc[edit.filePath] = [];
    }
    acc[edit.filePath].push(edit);
    return acc;
  }, {} as Record<string, typeof pendingEdits>);

  if (pendingEdits.length === 0) {
    return (
      <div className="flex flex-col h-full bg-bg-primary">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
          <h2 className="text-lg font-semibold text-text-primary">Edit Review</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
          <FileCode className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-sm">No pending edits</p>
          <p className="text-xs mt-1">Edits from Claude will appear here for review</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Edit Review</h2>
          <p className="text-sm text-text-secondary">
            {pendingEdits.length} pending {pendingEdits.length === 1 ? 'edit' : 'edits'} across {Object.keys(editsByFile).length} {Object.keys(editsByFile).length === 1 ? 'file' : 'files'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={rejectAll} disabled={isLoading}>
            Reject All
          </Button>
          <Button variant="primary" onClick={approveAll} disabled={isLoading}>
            Accept All
          </Button>
        </div>
      </div>

      {/* Edits list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Object.entries(editsByFile).map(([filePath, fileEdits]) => (
          <FileEdits
            key={filePath}
            filePath={filePath}
            edits={fileEdits}
            isExpanded={expandedFiles.has(filePath)}
            onToggle={() => toggleFile(filePath)}
            onApprove={approveEdit}
            onReject={rejectEdit}
          />
        ))}
      </div>
    </div>
  );
}

interface FileEditsProps {
  filePath: string;
  edits: { id: string; filePath: string; originalContent: string; newContent: string; description: string }[];
  isExpanded: boolean;
  onToggle: () => void;
  onApprove: (id: string) => Promise<boolean>;
  onReject: (id: string) => Promise<boolean>;
}

function FileEdits({ filePath, edits, isExpanded, onToggle, onApprove, onReject }: FileEditsProps) {
  const fileName = filePath.split('/').pop() || filePath;

  return (
    <div className="border border-border-primary rounded-lg overflow-hidden">
      {/* File header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 bg-bg-secondary hover:bg-bg-tertiary transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-muted" />
        )}
        <span className="text-sm font-medium text-text-primary">{fileName}</span>
        <span className="text-xs text-text-muted">({edits.length} {edits.length === 1 ? 'edit' : 'edits'})</span>
        <span className="flex-1" />
        <span className="text-xs text-text-muted truncate max-w-48">{filePath}</span>
      </button>

      {/* Edits */}
      {isExpanded && (
        <div className="divide-y divide-border-secondary">
          {edits.map((edit) => (
            <EditItem
              key={edit.id}
              edit={edit}
              onApprove={() => onApprove(edit.id)}
              onReject={() => onReject(edit.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface EditItemProps {
  edit: { id: string; originalContent: string; newContent: string; description: string };
  onApprove: () => void;
  onReject: () => void;
}

function EditItem({ edit, onApprove, onReject }: EditItemProps) {
  return (
    <div className="p-3 space-y-2">
      {/* Description */}
      {edit.description && (
        <div className="px-3 py-2 bg-bg-tertiary rounded text-sm text-text-secondary italic border-l-2 border-accent-primary">
          {edit.description}
        </div>
      )}

      {/* Diff */}
      <div className="font-mono text-xs overflow-x-auto rounded border border-border-secondary">
        {/* Original content */}
        <div className="bg-red-950/20">
          {edit.originalContent.split('\n').map((line, i) => (
            <div key={`old-${i}`} className="px-3 py-0.5 text-red-400">
              <span className="select-none text-text-muted mr-3">-</span>
              {line || ' '}
            </div>
          ))}
        </div>
        {/* New content */}
        <div className="bg-green-950/20">
          {edit.newContent.split('\n').map((line, i) => (
            <div key={`new-${i}`} className="px-3 py-0.5 text-green-400">
              <span className="select-none text-text-muted mr-3">+</span>
              {line || ' '}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onReject}>
          <X className="w-4 h-4 mr-1" />
          Reject
        </Button>
        <Button variant="primary" size="sm" onClick={onApprove}>
          <Check className="w-4 h-4 mr-1" />
          Accept
        </Button>
      </div>
    </div>
  );
}
