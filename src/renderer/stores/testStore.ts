import { create } from 'zustand';

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'running' | 'pending';

export type TestFramework = 'jest' | 'vitest' | 'mocha' | 'playwright' | 'cypress';

export interface DetectedFramework {
  id: TestFramework;
  name: string;
  detected: boolean;
  configFile?: string;
}

export interface TestResult {
  id: string;
  name: string;
  fullName: string;
  status: TestStatus;
  duration?: number;
  filePath: string;
  line?: number;
  errorMessage?: string;
  stackTrace?: string;
  ancestorTitles: string[]; // describe blocks
}

export interface TestFile {
  path: string;
  name: string;
  tests: TestResult[];
  status: TestStatus;
  expanded: boolean;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

type AppMode = 'home' | 'tests' | 'git' | 'linear' | 'worktrees' | 'processes';

interface TestState {
  // App mode
  mode: AppMode;
  previousMode: AppMode | null; // Track mode before edit review
  setMode: (mode: AppMode) => void;
  setPreviousMode: (mode: AppMode | null) => void;
  restorePreviousMode: () => void;

  // Framework selection
  selectedFramework: TestFramework | null;
  availableFrameworks: DetectedFramework[];
  isDetectingFrameworks: boolean;
  setSelectedFramework: (framework: TestFramework | null) => void;
  detectFrameworks: (projectPath: string) => Promise<void>;

  // Test data
  testFiles: TestFile[];
  selectedTestId: string | null;
  isRunning: boolean;
  isDetecting: boolean;
  lastRunTime: number | null;
  lastError: string | null;
  lastOutput: string | null;

  // Actions
  setTestFiles: (files: TestFile[]) => void;
  setSelectedTest: (testId: string | null) => void;
  setRunning: (running: boolean) => void;
  setDetecting: (detecting: boolean) => void;
  setError: (error: string | null) => void;
  setOutput: (output: string | null) => void;
  toggleFileExpanded: (filePath: string) => void;
  clearTests: () => void;
  detectTests: (projectPath: string) => Promise<void>;

  // Computed
  getSummary: () => TestSummary;
  getSelectedTest: () => TestResult | null;
}

export const useTestStore = create<TestState>((set, get) => ({
  mode: 'home',
  previousMode: null,
  setMode: (mode) => set({ mode }),
  setPreviousMode: (previousMode) => set({ previousMode }),
  restorePreviousMode: () => {
    const { previousMode } = get();
    if (previousMode) {
      set({ mode: previousMode, previousMode: null });
    }
  },

  // Framework selection
  selectedFramework: null,
  availableFrameworks: [],
  isDetectingFrameworks: false,
  setSelectedFramework: (selectedFramework) => set({ selectedFramework, testFiles: [], selectedTestId: null }),
  detectFrameworks: async (projectPath: string) => {
    if (!projectPath) return;
    set({ isDetectingFrameworks: true });
    try {
      const result = await window.electron?.detectTestFrameworks?.(projectPath);
      if (result?.frameworks) {
        set({ availableFrameworks: result.frameworks });
      }
    } catch (err) {
      console.error('Failed to detect test frameworks:', err);
    } finally {
      set({ isDetectingFrameworks: false });
    }
  },

  testFiles: [],
  selectedTestId: null,
  isRunning: false,
  isDetecting: false,
  lastRunTime: null,
  lastError: null,
  lastOutput: null,

  setTestFiles: (testFiles) => set({ testFiles, lastRunTime: Date.now(), lastError: null }),

  setSelectedTest: (selectedTestId) => set({ selectedTestId }),

  setRunning: (isRunning) => set({ isRunning }),

  setDetecting: (isDetecting) => set({ isDetecting }),

  setError: (lastError) => set({ lastError }),

  setOutput: (lastOutput) => set({ lastOutput }),

  toggleFileExpanded: (filePath) => set((state) => ({
    testFiles: state.testFiles.map((f) =>
      f.path === filePath ? { ...f, expanded: !f.expanded } : f
    ),
  })),

  clearTests: () => set({ testFiles: [], selectedTestId: null, lastRunTime: null }),

  detectTests: async (projectPath: string) => {
    if (!projectPath) return;
    const { selectedFramework } = get();
    set({ isDetecting: true, lastError: null });
    try {
      const result = await window.electron?.detectTests?.(projectPath, selectedFramework || undefined);
      if (result?.success && result.testFiles) {
        const currentFiles = get().testFiles;

        // Merge new test files with existing state (preserve expanded, status, results)
        const mergedFiles = result.testFiles.map((newFile) => {
          const existingFile = currentFiles.find((f) => f.path === newFile.path);
          if (!existingFile) return newFile;

          // Preserve expanded state
          const mergedTests = newFile.tests.map((newTest) => {
            const existingTest = existingFile.tests.find((t) => t.id === newTest.id);
            if (!existingTest) return newTest;
            // Preserve status, duration, error info from last run
            return {
              ...newTest,
              status: existingTest.status,
              duration: existingTest.duration,
              errorMessage: existingTest.errorMessage,
              stackTrace: existingTest.stackTrace,
            };
          });

          return {
            ...newFile,
            expanded: existingFile.expanded,
            status: existingFile.status,
            tests: mergedTests,
          };
        });

        set({ testFiles: mergedFiles });
      } else if (result?.error) {
        set({ lastError: result.error });
      }
    } catch (err) {
      console.error('Failed to detect tests:', err);
      set({ lastError: err instanceof Error ? err.message : 'Failed to detect tests' });
    } finally {
      set({ isDetecting: false });
    }
  },

  getSummary: () => {
    const { testFiles } = get();
    const allTests = testFiles.flatMap((f) => f.tests);
    return {
      total: allTests.length,
      passed: allTests.filter((t) => t.status === 'passed').length,
      failed: allTests.filter((t) => t.status === 'failed').length,
      skipped: allTests.filter((t) => t.status === 'skipped').length,
      duration: allTests.reduce((acc, t) => acc + (t.duration || 0), 0),
    };
  },

  getSelectedTest: () => {
    const { testFiles, selectedTestId } = get();
    if (!selectedTestId) return null;
    for (const file of testFiles) {
      const test = file.tests.find((t) => t.id === selectedTestId);
      if (test) return test;
    }
    return null;
  },
}));
