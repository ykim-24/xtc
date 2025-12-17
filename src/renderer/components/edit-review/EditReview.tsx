import { useEffect, useRef, useCallback, useMemo } from 'react';
import { Check, X, ChevronDown, ChevronRight, FileCode, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui';
import { useEditsStore } from '@/stores';
import { useState } from 'react';

// Helper to estimate line numbers for an edit (assumes edit starts at a specific line)
interface LineRange {
  editId: string;
  startLine: number;
  endLine: number;
  type: 'modified' | 'added' | 'deleted';
  linesChanged: number;
}

function getLineRangesForEdit(edit: { id: string; originalContent: string; newContent: string; lineNumber?: number }): LineRange {
  const originalLines = edit.originalContent.split('\n').length;
  const newLines = edit.newContent.split('\n').length;
  const startLine = edit.lineNumber || 1;

  let type: 'modified' | 'added' | 'deleted' = 'modified';
  if (originalLines === 0 || edit.originalContent.trim() === '') {
    type = 'added';
  } else if (newLines === 0 || edit.newContent.trim() === '') {
    type = 'deleted';
  }

  const endLine = startLine + Math.max(originalLines, newLines) - 1;

  return {
    editId: edit.id,
    startLine,
    endLine,
    type,
    linesChanged: Math.abs(newLines - originalLines) || Math.max(originalLines, newLines),
  };
}

// Diff line types
interface DiffLine {
  type: 'context' | 'added' | 'removed';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

// Simple diff algorithm using LCS to compute actual changes
function computeDiff(originalContent: string, newContent: string): DiffLine[] {
  const oldLines = originalContent.split('\n');
  const newLines = newContent.split('\n');

  // Build LCS table
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find diff
  const diff: DiffLine[] = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({
        type: 'context',
        content: oldLines[i - 1],
        oldLineNum: i,
        newLineNum: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({
        type: 'added',
        content: newLines[j - 1],
        newLineNum: j,
      });
      j--;
    } else {
      diff.unshift({
        type: 'removed',
        content: oldLines[i - 1],
        oldLineNum: i,
      });
      i--;
    }
  }

  return diff;
}

// Collapse context lines, showing only a few around changes
function collapseDiff(diff: DiffLine[], contextLines: number = 3): (DiffLine | { type: 'collapse'; count: number })[] {
  const result: (DiffLine | { type: 'collapse'; count: number })[] = [];
  let contextBuffer: DiffLine[] = [];
  let lastChangeIndex = -1;

  for (let i = 0; i < diff.length; i++) {
    const line = diff[i];

    if (line.type !== 'context') {
      // Flush context buffer with proper trimming
      if (contextBuffer.length > 0) {
        if (lastChangeIndex === -1) {
          // Before first change - show only last N context lines
          if (contextBuffer.length > contextLines) {
            result.push({ type: 'collapse', count: contextBuffer.length - contextLines });
          }
          result.push(...contextBuffer.slice(-contextLines));
        } else {
          // Between changes - show up to 2*N context lines
          if (contextBuffer.length > contextLines * 2) {
            result.push(...contextBuffer.slice(0, contextLines));
            result.push({ type: 'collapse', count: contextBuffer.length - contextLines * 2 });
            result.push(...contextBuffer.slice(-contextLines));
          } else {
            result.push(...contextBuffer);
          }
        }
        contextBuffer = [];
      }
      result.push(line);
      lastChangeIndex = result.length - 1;
    } else {
      contextBuffer.push(line);
    }
  }

  // Handle trailing context
  if (contextBuffer.length > 0) {
    if (contextBuffer.length > contextLines) {
      result.push(...contextBuffer.slice(0, contextLines));
      result.push({ type: 'collapse', count: contextBuffer.length - contextLines });
    } else {
      result.push(...contextBuffer);
    }
  }

  return result;
}

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
  const [expandedSidebarFiles, setExpandedSidebarFiles] = useState<Set<string>>(new Set());
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null);
  const editRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Compute line ranges for each edit grouped by file
  const editsByFileWithRanges = useMemo(() => {
    const grouped: Record<string, Array<{ edit: typeof pendingEdits[0]; range: LineRange }>> = {};

    pendingEdits.forEach((edit) => {
      if (!grouped[edit.filePath]) {
        grouped[edit.filePath] = [];
      }
      const range = getLineRangesForEdit(edit);
      grouped[edit.filePath].push({ edit, range });
    });

    return grouped;
  }, [pendingEdits]);

  // Toggle sidebar file expansion
  const toggleSidebarFile = (filePath: string) => {
    setExpandedSidebarFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  // Scroll to the selected edit
  const scrollToEdit = useCallback((editId: string) => {
    const element = editRefs.current.get(editId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setSelectedEditId(editId);
    }
  }, []);

  // Navigate to previous/next edit
  const navigateEdit = useCallback((direction: 'prev' | 'next') => {
    const currentIndex = pendingEdits.findIndex(e => e.id === selectedEditId);
    let newIndex: number;

    if (currentIndex === -1) {
      newIndex = direction === 'next' ? 0 : pendingEdits.length - 1;
    } else {
      newIndex = direction === 'next'
        ? Math.min(currentIndex + 1, pendingEdits.length - 1)
        : Math.max(currentIndex - 1, 0);
    }

    if (pendingEdits[newIndex]) {
      scrollToEdit(pendingEdits[newIndex].id);
    }
  }, [pendingEdits, selectedEditId, scrollToEdit]);

  // Auto-select first edit when edits change
  useEffect(() => {
    if (pendingEdits.length > 0 && !selectedEditId) {
      setSelectedEditId(pendingEdits[0].id);
      // Also expand that file in sidebar
      setExpandedSidebarFiles(new Set([pendingEdits[0].filePath]));
    }
  }, [pendingEdits, selectedEditId]);

  // When selecting an edit, expand its file in sidebar
  useEffect(() => {
    if (selectedEditId) {
      const edit = pendingEdits.find(e => e.id === selectedEditId);
      if (edit) {
        setExpandedSidebarFiles(prev => {
          const next = new Set(prev);
          next.add(edit.filePath);
          return next;
        });
      }
    }
  }, [selectedEditId, pendingEdits]);

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

  const currentEditIndex = pendingEdits.findIndex(e => e.id === selectedEditId);

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
          {/* Navigation buttons */}
          <div className="flex items-center gap-1 mr-2">
            <button
              onClick={() => navigateEdit('prev')}
              disabled={currentEditIndex <= 0}
              className="p-1.5 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed text-text-muted hover:text-text-primary transition-colors"
              title="Previous edit"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <span className="text-xs text-text-muted min-w-[50px] text-center">
              {currentEditIndex >= 0 ? currentEditIndex + 1 : 0} / {pendingEdits.length}
            </span>
            <button
              onClick={() => navigateEdit('next')}
              disabled={currentEditIndex >= pendingEdits.length - 1}
              className="p-1.5 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed text-text-muted hover:text-text-primary transition-colors"
              title="Next edit"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 ml-4 mr-2">
            <button
              onClick={rejectAll}
              disabled={isLoading}
              className="text-base text-text-muted hover:text-red-400 disabled:opacity-50 transition-colors"
            >
              [ reject all ]
            </button>
            <button
              onClick={approveAll}
              disabled={isLoading}
              className="text-base text-text-muted hover:text-blue-400 disabled:opacity-50 transition-colors"
            >
              [ accept all ]
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar navigation - grouped by file */}
        <div className="w-56 border-r border-border-primary overflow-y-auto bg-bg-secondary">
          <div className="p-2 text-xs text-text-muted border-b border-border-primary">
            Changes
          </div>
          {Object.entries(editsByFileWithRanges).map(([filePath, editsWithRanges]) => {
            const fileName = filePath.split('/').pop() || filePath;
            const isExpanded = expandedSidebarFiles.has(filePath);
            const hasSelectedEdit = editsWithRanges.some(e => e.edit.id === selectedEditId);

            return (
              <div key={filePath} className="border-b border-border-secondary">
                {/* File header */}
                <button
                  onClick={() => toggleSidebarFile(filePath)}
                  className={`
                    w-full text-left px-2 py-2 text-xs
                    transition-colors hover:bg-bg-hover flex items-center gap-1.5
                    ${hasSelectedEdit ? 'bg-accent-primary/5' : ''}
                  `}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
                  )}
                  <FileCode className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                  <span className="truncate text-text-primary font-medium">{fileName}</span>
                  <span className="text-text-muted ml-auto flex-shrink-0">
                    {editsWithRanges.length}
                  </span>
                </button>

                {/* Line ranges - shown when file is expanded */}
                {isExpanded && (
                  <div className="bg-bg-primary">
                    {editsWithRanges.map(({ edit, range }) => {
                      const isSelected = edit.id === selectedEditId;
                      return (
                        <button
                          key={edit.id}
                          onClick={() => scrollToEdit(edit.id)}
                          className={`
                            w-full text-left pl-7 pr-2 py-1.5 text-xs
                            transition-colors hover:bg-bg-hover
                            ${isSelected ? 'bg-accent-primary/10 border-l-2 border-l-accent-primary' : 'border-l-2 border-l-transparent'}
                          `}
                        >
                          <div className="flex items-center gap-2">
                            {/* Line range indicator */}
                            <span className={`
                              px-1.5 py-0.5 rounded text-[10px] font-mono
                              ${range.type === 'added' ? 'bg-green-500/20 text-green-400' :
                                range.type === 'deleted' ? 'bg-red-500/20 text-red-400' :
                                'bg-yellow-500/20 text-yellow-400'}
                            `}>
                              L{range.startLine}{range.startLine !== range.endLine ? `-${range.endLine}` : ''}
                            </span>
                            {/* Change type indicator */}
                            <span className={`
                              text-[10px]
                              ${range.type === 'added' ? 'text-green-400' :
                                range.type === 'deleted' ? 'text-red-400' :
                                'text-yellow-400'}
                            `}>
                              {range.type === 'added' ? '+' : range.type === 'deleted' ? '−' : '~'}
                              {range.linesChanged} lines
                            </span>
                          </div>
                          {edit.description && (
                            <div className="text-text-muted truncate mt-0.5 text-[10px]">
                              {edit.description.slice(0, 40)}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
              selectedEditId={selectedEditId}
              editRefs={editRefs}
            />
          ))}
        </div>
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
  selectedEditId: string | null;
  editRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

function FileEdits({ filePath, edits, isExpanded, onToggle, onApprove, onReject, selectedEditId, editRefs }: FileEditsProps) {
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
              isSelected={edit.id === selectedEditId}
              editRef={(el) => {
                if (el) editRefs.current.set(edit.id, el);
                else editRefs.current.delete(edit.id);
              }}
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
  isSelected: boolean;
  editRef: (el: HTMLDivElement | null) => void;
}

function EditItem({ edit, onApprove, onReject, isSelected, editRef }: EditItemProps) {
  // Compute diff with collapsed context
  const diff = useMemo(() => {
    const rawDiff = computeDiff(edit.originalContent, edit.newContent);
    return collapseDiff(rawDiff, 3);
  }, [edit.originalContent, edit.newContent]);

  return (
    <div ref={editRef} className={`space-y-2 transition-colors ${isSelected ? 'bg-accent-primary/5' : ''}`}>
      {/* Diff */}
      <div className="font-mono text-xs overflow-x-auto border-y border-border-secondary">
        {diff.map((line, i) => {
          if (line.type === 'collapse') {
            return (
              <div key={`collapse-${i}`} className="px-3 py-1 bg-bg-tertiary text-text-muted text-center border-y border-border-secondary">
                -- {line.count} unchanged lines --
              </div>
            );
          }

          const lineNum = line.type === 'removed' ? line.oldLineNum : line.newLineNum;

          return (
            <div
              key={`${line.type}-${i}`}
              className={`px-3 py-0.5 flex ${
                line.type === 'added' ? 'bg-green-950/30 text-green-400' :
                line.type === 'removed' ? 'bg-red-950/30 text-red-400' :
                'text-text-secondary'
              }`}
            >
              <span className="select-none text-text-muted w-8 flex-shrink-0 text-right pr-2">
                {lineNum}
              </span>
              <span className={`select-none w-4 flex-shrink-0 ${
                line.type === 'added' ? 'text-green-500' :
                line.type === 'removed' ? 'text-red-500' :
                'text-text-muted'
              }`}>
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              <span className="flex-1 whitespace-pre">{line.content || ' '}</span>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 px-4 pb-2">
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
