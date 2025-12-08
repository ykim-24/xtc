import { useTestStore } from '@/stores/testStore';

export function TestSummaryBar() {
  const { testFiles, isRunning } = useTestStore();
  const summary = useTestStore((state) => state.getSummary());

  if (testFiles.length === 0 && !isRunning) {
    return null;
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="flex items-center px-4 py-2 bg-bg-secondary border-b border-border-primary text-xs">
      <div className="flex items-center gap-1">
        <span className="text-green-500">{summary.passed} passed</span>
        <span className="text-text-muted">/</span>
        <span className="text-red-500">{summary.failed} failed</span>
        <span className="text-text-muted">/</span>
        <span className="text-text-muted">{summary.skipped} skipped</span>
      </div>
      <div className="text-text-muted ml-auto">
        {formatDuration(summary.duration)}
      </div>
    </div>
  );
}
