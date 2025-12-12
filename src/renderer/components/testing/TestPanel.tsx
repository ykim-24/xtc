import { useEffect } from 'react';
import { useTestStore } from '@/stores/testStore';
import { useProjectStore } from '@/stores';
import { TestTree } from './TestTree';
import { TestDetails } from './TestDetails';
import { TestSummaryBar } from './TestSummaryBar';

const frameworkNames: Record<string, string> = {
  jest: 'Jest',
  vitest: 'Vitest',
  mocha: 'Mocha',
  playwright: 'Playwright',
  cypress: 'Cypress',
};

export function TestPanel() {
  const { isRunning, setRunning, setTestFiles, testFiles, detectTests, setError, setOutput, isDetecting, selectedFramework, setSelectedFramework } = useTestStore();
  const { projectPath } = useProjectStore();

  // Auto-detect tests when panel mounts or framework changes
  useEffect(() => {
    if (projectPath && selectedFramework) {
      detectTests(projectPath);
    }
  }, [projectPath, detectTests, selectedFramework]);

  const handleRunAll = async () => {
    if (!projectPath || isRunning) return;

    setRunning(true);
    setError(null); // Clear previous errors
    setOutput(null); // Clear previous output

    // Set all files and tests to 'running' status
    const currentFiles = useTestStore.getState().testFiles;
    setTestFiles(currentFiles.map(f => ({
      ...f,
      status: 'running' as const,
      tests: f.tests.map(t => ({ ...t, status: 'running' as const }))
    })));

    try {
      const result = await window.electron?.runTests?.(projectPath, undefined, undefined, selectedFramework || undefined);

      // Always save the raw output
      if (result?.output) {
        setOutput(result.output);
      }

      if (result?.success && result.testFiles) {
        setTestFiles(result.testFiles);
      } else {
        // Reset to pending if failed
        const latestFiles = useTestStore.getState().testFiles;
        setTestFiles(latestFiles.map(f => ({
          ...f,
          status: 'pending' as const,
          tests: f.tests.map(t => ({ ...t, status: 'pending' as const }))
        })));
        // Set error message from result
        if (result?.error) {
          setError(result.error);
        } else if (!result?.success) {
          setError('Tests failed to run. Check the console for details.');
        }
      }
    } catch (err) {
      console.error('Failed to run tests:', err);
      setError(err instanceof Error ? err.message : 'Failed to run tests');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedFramework(null)}
            className="text-xs text-text-muted hover:text-text-primary transition-colors font-mono"
            title="Back to framework selection"
          >
            [ back ]
          </button>
          <span className="text-text-muted">/</span>
          <h2 className="text-sm font-medium text-text-primary">
            {selectedFramework ? frameworkNames[selectedFramework] : 'Tests'}
          </h2>
        </div>
        <button
          onClick={handleRunAll}
          disabled={isRunning || !projectPath || testFiles.length === 0}
          className="text-xs font-mono text-text-secondary hover:text-accent-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-text-secondary transition-colors"
        >
          {isRunning ? '[ ◌ running... ]' : '[ ▶ run all ]'}
        </button>
      </div>

      {/* Summary */}
      <TestSummaryBar />

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Test tree */}
        <div className="w-1/2 border-r border-border-primary overflow-auto">
          {testFiles.length > 0 ? (
            <TestTree />
          ) : (
            <div className="flex items-center justify-center h-full text-text-muted text-sm">
              {isDetecting ? 'Detecting tests...' : isRunning ? 'Running tests...' : '-- no test file --'}
            </div>
          )}
        </div>

        {/* Right: Test details */}
        <div className="w-1/2 overflow-auto">
          <TestDetails />
        </div>
      </div>
    </div>
  );
}
