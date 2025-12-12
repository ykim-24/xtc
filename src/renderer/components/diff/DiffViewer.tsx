import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Check, X, ChevronLeft, ChevronRight, Send, Sparkles } from 'lucide-react';
import { PendingEdit } from '@/stores/editsStore';
import { FileIcon } from '@/utils/fileIcons';

interface DiffViewerProps {
  edit: PendingEdit;
  onAccept: () => void;
  onReject: () => void;
  onRequestFix?: (selectedLines: string[], feedback: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

// Simple line-by-line diff algorithm
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const diff: DiffLine[] = [];

  // Use LCS-based diff for better results
  const lcs = computeLCS(oldLines, newLines);

  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (lcsIdx < lcs.length && oldIdx < oldLines.length && oldLines[oldIdx] === lcs[lcsIdx]) {
      if (newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx]) {
        // Line is unchanged
        diff.push({
          type: 'unchanged',
          content: oldLines[oldIdx],
          oldLineNum: oldIdx + 1,
          newLineNum: newIdx + 1,
        });
        oldIdx++;
        newIdx++;
        lcsIdx++;
      } else {
        // Line was added in new
        diff.push({
          type: 'added',
          content: newLines[newIdx],
          newLineNum: newIdx + 1,
        });
        newIdx++;
      }
    } else if (lcsIdx < lcs.length && newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx]) {
      // Line was removed from old
      diff.push({
        type: 'removed',
        content: oldLines[oldIdx],
        oldLineNum: oldIdx + 1,
      });
      oldIdx++;
    } else if (oldIdx < oldLines.length && (lcsIdx >= lcs.length || oldLines[oldIdx] !== lcs[lcsIdx])) {
      // Line was removed
      diff.push({
        type: 'removed',
        content: oldLines[oldIdx],
        oldLineNum: oldIdx + 1,
      });
      oldIdx++;
    } else if (newIdx < newLines.length) {
      // Line was added
      diff.push({
        type: 'added',
        content: newLines[newIdx],
        newLineNum: newIdx + 1,
      });
      newIdx++;
    }
  }

  return diff;
}

// Compute Longest Common Subsequence
function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

export function DiffViewer({
  edit,
  onAccept,
  onReject,
  onRequestFix,
  onPrev,
  onNext,
  currentIndex = 0,
  totalCount = 1,
}: DiffViewerProps) {
  const fileName = edit.filePath.split('/').pop() || edit.filePath;
  const isNewFile = !edit.originalContent;

  // Line selection state
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackPosition, setFeedbackPosition] = useState<{ top: number; left: number } | null>(null);
  const feedbackRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

  // Calculate selected lines from start/end
  const selectedLines = useMemo(() => {
    if (selectionStart === null) return new Set<number>();
    const end = selectionEnd ?? selectionStart;
    const start = Math.min(selectionStart, end);
    const finish = Math.max(selectionStart, end);
    const lines = new Set<number>();
    for (let i = start; i <= finish; i++) {
      lines.add(i);
    }
    return lines;
  }, [selectionStart, selectionEnd]);

  // Reset selection when edit changes (including when content is updated via feedback)
  useEffect(() => {
    setSelectionStart(null);
    setSelectionEnd(null);
    setFeedback('');
    setShowFeedback(false);
    setFeedbackPosition(null);
  }, [edit.id, edit.newContent]);

  // Focus feedback input when shown
  useEffect(() => {
    if (showFeedback && feedbackRef.current) {
      feedbackRef.current.focus();
    }
  }, [showFeedback]);

  // Position the feedback box near selected lines
  const updateFeedbackPosition = useCallback(() => {
    if (selectionStart === null || !containerRef.current) return;

    const end = selectionEnd ?? selectionStart;
    const lastLineIdx = Math.max(selectionStart, end);
    const lineEl = lineRefs.current.get(lastLineIdx);

    if (lineEl) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const lineRect = lineEl.getBoundingClientRect();

      setFeedbackPosition({
        top: lineRect.bottom - containerRect.top + containerRef.current.scrollTop + 4,
        left: 80, // Offset from line numbers
      });
    }
  }, [selectionStart, selectionEnd]);

  // Update position when selection changes
  useEffect(() => {
    if (showFeedback) {
      updateFeedbackPosition();
    }
  }, [showFeedback, updateFeedbackPosition]);

  const diffLines = useMemo(() => {
    if (isNewFile) {
      // For new files, show all lines as added
      return edit.newContent.split('\n').map((line, idx) => ({
        type: 'added' as const,
        content: line,
        newLineNum: idx + 1,
      }));
    }
    return computeDiff(edit.originalContent, edit.newContent);
  }, [edit.originalContent, edit.newContent, isNewFile]);

  const stats = useMemo(() => {
    const added = diffLines.filter(l => l.type === 'added').length;
    const removed = diffLines.filter(l => l.type === 'removed').length;
    return { added, removed };
  }, [diffLines]);

  // Handle line number mouse down - start selection
  const handleLineMouseDown = (idx: number, event: React.MouseEvent) => {
    event.preventDefault();

    if (event.shiftKey && selectionStart !== null) {
      // Shift+click: extend selection
      setSelectionEnd(idx);
    } else {
      // Start new selection
      setSelectionStart(idx);
      setSelectionEnd(null);
      setIsDragging(true);
      setShowFeedback(false);
    }
  };

  // Handle mouse enter during drag
  const handleLineMouseEnter = (idx: number) => {
    if (isDragging) {
      setSelectionEnd(idx);
    }
  };

  // Handle mouse up - end selection
  const handleMouseUp = useCallback(() => {
    if (isDragging && selectionStart !== null) {
      setIsDragging(false);
      setShowFeedback(true);
      updateFeedbackPosition();
    }
  }, [isDragging, selectionStart, updateFeedbackPosition]);

  // Global mouse up listener
  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  // Get selected lines content for feedback
  const getSelectedLinesContent = (): string[] => {
    return Array.from(selectedLines)
      .sort((a, b) => a - b)
      .map(idx => {
        const line = diffLines[idx];
        const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
        return `${prefix} ${line.content}`;
      });
  };

  // Handle sending feedback
  const handleSendFeedback = () => {
    if (onRequestFix && (selectedLines.size > 0 || feedback.trim())) {
      onRequestFix(getSelectedLinesContent(), feedback.trim());
      clearSelection();
    }
  };

  // Clear selection
  const clearSelection = () => {
    setSelectionStart(null);
    setSelectionEnd(null);
    setFeedback('');
    setShowFeedback(false);
    setFeedbackPosition(null);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && showFeedback) {
      clearSelection();
    }
  }, [showFeedback]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary border-b border-border-primary gap-2 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <FileIcon fileName={fileName} className="w-5 h-5 flex-shrink-0" />
          <div className="min-w-0 max-w-[300px]">
            <div className="text-sm font-medium text-text-primary truncate">{fileName}</div>
            <div className="text-xs text-text-muted truncate" dir="rtl" title={edit.filePath}>{edit.filePath}</div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isNewFile ? (
              <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">NEW FILE</span>
            ) : (
              <>
                <span className="text-xs text-green-400">+{stats.added}</span>
                <span className="text-xs text-red-400">-{stats.removed}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Navigation */}
          {totalCount > 1 && (
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={onPrev}
                disabled={currentIndex === 0}
                className="p-1 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-text-muted whitespace-nowrap">
                {currentIndex + 1} / {totalCount}
              </span>
              <button
                onClick={onNext}
                disabled={currentIndex === totalCount - 1}
                className="p-1 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Actions */}
          <button
            onClick={onReject}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors"
          >
            <X className="w-4 h-4" />
            Reject
          </button>
          <button
            onClick={onAccept}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 rounded transition-colors"
          >
            <Check className="w-4 h-4" />
            Accept
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div ref={containerRef} className="flex-1 overflow-auto font-mono text-xs relative">
        <table className="w-full border-collapse">
          <tbody>
            {diffLines.map((line, idx) => {
              const isSelected = selectedLines.has(idx);
              return (
                <tr
                  key={idx}
                  ref={(el) => {
                    if (el) lineRefs.current.set(idx, el);
                  }}
                  onMouseEnter={() => handleLineMouseEnter(idx)}
                  className={`transition-colors ${
                    isSelected
                      ? 'bg-accent-primary/20'
                      : line.type === 'added'
                      ? 'bg-green-500/10'
                      : line.type === 'removed'
                      ? 'bg-red-500/10'
                      : ''
                  }`}
                >
                  {/* Line number gutter - clickable for selection */}
                  <td
                    onMouseDown={(e) => handleLineMouseDown(idx, e)}
                    className={`w-16 px-2 py-0 text-right select-none border-r cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-accent-primary/30 border-accent-primary/50'
                        : 'bg-bg-secondary/50 border-border-primary hover:bg-accent-primary/10'
                    }`}
                  >
                    <span className={`${isSelected ? 'text-accent-primary' : 'text-text-muted'}`}>
                      {line.type !== 'added' && line.oldLineNum}
                      {line.type !== 'added' && line.type !== 'removed' && ' '}
                      {line.type !== 'removed' && line.newLineNum}
                    </span>
                  </td>
                  {/* Sign */}
                  <td className={`w-6 px-1 py-0 text-center select-none ${
                    isSelected ? 'text-accent-primary' : line.type === 'added' ? 'text-green-400' : line.type === 'removed' ? 'text-red-400' : 'text-text-muted'
                  }`}>
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </td>
                  {/* Content */}
                  <td className={`px-2 py-0 whitespace-pre ${
                    isSelected ? 'text-text-primary' : line.type === 'added' ? 'text-green-300' : line.type === 'removed' ? 'text-red-300' : 'text-text-primary'
                  }`}>
                    {line.content || ' '}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Floating feedback input - Cursor style */}
        {showFeedback && feedbackPosition && (
          <div
            className="absolute z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            style={{
              top: feedbackPosition.top,
              left: feedbackPosition.left,
              right: 16,
            }}
          >
            <div className="bg-bg-secondary border border-accent-primary/50 rounded-lg shadow-xl shadow-black/20 overflow-hidden">
              {/* Selected lines preview */}
              <div className="px-3 py-2 bg-bg-tertiary border-b border-border-primary">
                <div className="flex items-center gap-2 text-[10px] text-text-muted">
                  <Sparkles className="w-3 h-3 text-accent-primary" />
                  <span>{selectedLines.size} line{selectedLines.size !== 1 ? 's' : ''} selected</span>
                </div>
              </div>

              {/* Input */}
              <div className="p-2">
                <textarea
                  ref={feedbackRef}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Describe the issue and how to fix it..."
                  className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-primary rounded-md resize-none outline-none focus:border-accent-primary text-text-primary placeholder:text-text-muted"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSendFeedback();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      clearSelection();
                    }
                  }}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between px-3 py-2 bg-bg-tertiary border-t border-border-primary">
                <span className="text-[10px] text-text-muted">
                  {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}↵ send · esc cancel
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={clearSelection}
                    className="px-2 py-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendFeedback}
                    disabled={!feedback.trim()}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-accent-primary hover:bg-accent-primary/80 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                  >
                    <Send className="w-3 h-3" />
                    Fix
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selection hint in footer */}
      <div className="border-t border-border-primary bg-bg-secondary px-4 py-1.5 flex items-center justify-between">
        <span className="text-[10px] text-text-muted">
          Click line numbers to select · Drag for range · Shift+click to extend
        </span>
        {selectedLines.size > 0 && !showFeedback && (
          <button
            onClick={() => {
              setShowFeedback(true);
              updateFeedbackPosition();
            }}
            className="text-[10px] text-accent-primary hover:underline"
          >
            Add comment
          </button>
        )}
      </div>
    </div>
  );
}
