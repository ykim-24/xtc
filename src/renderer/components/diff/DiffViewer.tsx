import { useMemo } from 'react';
import { Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { PendingEdit } from '@/stores/editsStore';
import { FileIcon } from '@/utils/fileIcons';

interface DiffViewerProps {
  edit: PendingEdit;
  onAccept: () => void;
  onReject: () => void;
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
  onPrev,
  onNext,
  currentIndex = 0,
  totalCount = 1,
}: DiffViewerProps) {
  const fileName = edit.filePath.split('/').pop() || edit.filePath;
  const isNewFile = !edit.originalContent;

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

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary border-b border-border-primary">
        <div className="flex items-center gap-3">
          <FileIcon fileName={fileName} className="w-5 h-5" />
          <div>
            <div className="text-sm font-medium text-text-primary">{fileName}</div>
            <div className="text-xs text-text-muted">{edit.filePath}</div>
          </div>
          <div className="flex items-center gap-2 ml-4">
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

        <div className="flex items-center gap-2">
          {/* Navigation */}
          {totalCount > 1 && (
            <div className="flex items-center gap-1 mr-4">
              <button
                onClick={onPrev}
                disabled={currentIndex === 0}
                className="p-1 rounded hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-text-muted">
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
      <div className="flex-1 overflow-auto font-mono text-xs">
        <table className="w-full border-collapse">
          <tbody>
            {diffLines.map((line, idx) => (
              <tr
                key={idx}
                className={
                  line.type === 'added'
                    ? 'bg-green-500/10'
                    : line.type === 'removed'
                    ? 'bg-red-500/10'
                    : ''
                }
              >
                {/* Old line number */}
                <td className="w-12 px-2 py-0 text-right text-text-muted select-none border-r border-border-primary bg-bg-secondary/50">
                  {line.type !== 'added' ? line.oldLineNum : ''}
                </td>
                {/* New line number */}
                <td className="w-12 px-2 py-0 text-right text-text-muted select-none border-r border-border-primary bg-bg-secondary/50">
                  {line.type !== 'removed' ? line.newLineNum : ''}
                </td>
                {/* Sign */}
                <td className={`w-6 px-1 py-0 text-center select-none ${
                  line.type === 'added' ? 'text-green-400' : line.type === 'removed' ? 'text-red-400' : 'text-text-muted'
                }`}>
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                </td>
                {/* Content */}
                <td className={`px-2 py-0 whitespace-pre ${
                  line.type === 'added' ? 'text-green-300' : line.type === 'removed' ? 'text-red-300' : 'text-text-primary'
                }`}>
                  {line.content || ' '}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
