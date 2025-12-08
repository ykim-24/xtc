import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronDown, FileCode, Play } from 'lucide-react';
import { clsx } from 'clsx';
import { useTestStore, TestResult, TestStatus, TestFile } from '@/stores/testStore';
import { useProjectStore } from '@/stores';

// ASCII spinner frames (braille dots style like npm)
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

function AsciiSpinner() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="w-3.5 flex items-center justify-center text-accent-primary font-mono text-xs">
      {SPINNER_FRAMES[frame]}
    </span>
  );
}

function StatusIcon({ status }: { status: TestStatus }) {
  const baseClass = "w-3.5 flex items-center justify-center font-mono text-xs";
  switch (status) {
    case 'passed':
      return <span className={`${baseClass} text-green-500`}>✓</span>;
    case 'failed':
      return <span className={`${baseClass} text-red-500`}>✗</span>;
    case 'skipped':
      return <span className={`${baseClass} text-yellow-500`}>○</span>;
    case 'running':
      return <AsciiSpinner />;
    default:
      return <span className={`${baseClass} text-text-muted`}>○</span>;
  }
}

// Tree node structure for nested describes
interface TreeNode {
  name: string;
  type: 'describe' | 'test';
  test?: TestResult;
  children: TreeNode[];
  status: TestStatus;
}

// Build a tree from flat test list using ancestorTitles
function buildTestTree(tests: TestResult[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const test of tests) {
    let currentLevel = root;

    // Navigate/create describe blocks
    for (const ancestor of test.ancestorTitles) {
      let describeNode = currentLevel.find(n => n.type === 'describe' && n.name === ancestor);
      if (!describeNode) {
        describeNode = {
          name: ancestor,
          type: 'describe',
          children: [],
          status: 'pending',
        };
        currentLevel.push(describeNode);
      }
      currentLevel = describeNode.children;
    }

    // Add the test as a leaf node
    currentLevel.push({
      name: test.name,
      type: 'test',
      test,
      children: [],
      status: test.status,
    });
  }

  // Calculate status for describe blocks (failed > running > passed > pending)
  function calculateStatus(nodes: TreeNode[]): void {
    for (const node of nodes) {
      if (node.type === 'describe' && node.children.length > 0) {
        calculateStatus(node.children);
        const childStatuses = node.children.map(c => c.status);
        if (childStatuses.includes('failed')) {
          node.status = 'failed';
        } else if (childStatuses.includes('running')) {
          node.status = 'running';
        } else if (childStatuses.every(s => s === 'passed')) {
          node.status = 'passed';
        } else if (childStatuses.every(s => s === 'skipped')) {
          node.status = 'skipped';
        } else {
          node.status = 'pending';
        }
      }
    }
  }

  calculateStatus(root);
  return root;
}

// Count tests in a tree node
function countTests(node: TreeNode): { passed: number; failed: number; total: number } {
  if (node.type === 'test') {
    return {
      passed: node.status === 'passed' ? 1 : 0,
      failed: node.status === 'failed' ? 1 : 0,
      total: 1,
    };
  }
  const result = { passed: 0, failed: 0, total: 0 };
  for (const child of node.children) {
    const childCount = countTests(child);
    result.passed += childCount.passed;
    result.failed += childCount.failed;
    result.total += childCount.total;
  }
  return result;
}

// Collect all tests from a tree node (recursively)
function collectTests(node: TreeNode): TestResult[] {
  if (node.type === 'test' && node.test) {
    return [node.test];
  }
  const tests: TestResult[] = [];
  for (const child of node.children) {
    tests.push(...collectTests(child));
  }
  return tests;
}

interface TestLeafProps {
  test: TestResult;
  onRunTest: (test: TestResult) => void;
  isRunning: boolean;
  isLast: boolean;
  depth: number;
}

function TestLeaf({ test, onRunTest, isRunning, isLast, depth }: TestLeafProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { selectedTestId, setSelectedTest } = useTestStore();
  const isSelected = selectedTestId === test.id;
  const isThisRunning = isRunning && test.status === 'running';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTest(test.id);
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTest(test.id);
    onRunTest(test);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      className={clsx(
        'w-full flex items-center py-1 pr-2 text-left text-xs transition-colors cursor-pointer',
        isSelected ? 'bg-bg-active text-text-primary' : 'text-text-secondary hover:bg-bg-hover'
      )}
    >
      {/* Horizontal branch */}
      <div className="flex-shrink-0 mr-2" style={{ width: '12px', height: '1px', backgroundColor: '#1E3A5F' }} />
      <span className="flex items-center gap-2 flex-1 min-w-0">
        <StatusIcon status={test.status} />
        <span className="truncate flex-1">{test.name}</span>
      </span>
      {isHovered && !isThisRunning && (
        <button
          onClick={handlePlay}
          className="flex-shrink-0 p-0.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent-primary transition-colors"
          title="Run this test"
        >
          <Play className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

interface DescribeBlockProps {
  node: TreeNode;
  onRunTest: (test: TestResult) => void;
  onRunDescribe: (node: TreeNode, describePath: string[]) => void;
  isRunning: boolean;
  isLast: boolean;
  depth: number;
  expandedDescribes: Set<string>;
  toggleDescribe: (path: string) => void;
  pathPrefix: string;
  ancestorPath: string[];
}

function DescribeBlock({ node, onRunTest, onRunDescribe, isRunning, isLast, depth, expandedDescribes, toggleDescribe, pathPrefix, ancestorPath }: DescribeBlockProps) {
  const [isHovered, setIsHovered] = useState(false);
  const path = pathPrefix ? `${pathPrefix}::${node.name}` : node.name;
  const isExpanded = expandedDescribes.has(path);
  const counts = useMemo(() => countTests(node), [node]);
  const isThisRunning = isRunning && node.status === 'running';
  const currentPath = [...ancestorPath, node.name];

  const handleToggle = () => {
    toggleDescribe(path);
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isExpanded) {
      toggleDescribe(path);
    }
    onRunDescribe(node, currentPath);
  };

  return (
    <div>
      {/* Describe header */}
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleToggle}
        className="w-full flex items-center py-1 pr-2 text-left text-xs text-text-primary hover:bg-bg-hover cursor-pointer"
      >
        {/* Horizontal branch */}
        <div className="flex-shrink-0 mr-1" style={{ width: '12px', height: '1px', backgroundColor: '#1E3A5F' }} />
        {isExpanded ? (
          <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
        )}
        <StatusIcon status={node.status} />
        <span className="truncate flex-1 ml-1">{node.name}</span>
        {isHovered && !isThisRunning ? (
          <button
            onClick={handlePlay}
            className="flex-shrink-0 p-0.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent-primary transition-colors"
            title="Run tests in this group"
          >
            <Play className="w-3 h-3" />
          </button>
        ) : (
          <span className="text-text-muted text-[10px]">
            {counts.passed}/{counts.total}
          </span>
        )}
      </div>

      {/* Children */}
      {isExpanded && (
        <div className="relative" style={{ marginLeft: '21px' }}>
          {/* Vertical connecting line */}
          <div
            className="absolute"
            style={{
              left: '0px',
              top: '0px',
              width: '1px',
              height: 'calc(100% - 12px)',
              backgroundColor: '#1E3A5F'
            }}
          />
          {node.children.map((child, index) => (
            <TreeNodeRenderer
              key={child.type === 'test' ? child.test?.id : `${path}::${child.name}`}
              node={child}
              onRunTest={onRunTest}
              onRunDescribe={onRunDescribe}
              isRunning={isRunning}
              isLast={index === node.children.length - 1}
              depth={depth + 1}
              expandedDescribes={expandedDescribes}
              toggleDescribe={toggleDescribe}
              pathPrefix={path}
              ancestorPath={currentPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TreeNodeRendererProps {
  node: TreeNode;
  onRunTest: (test: TestResult) => void;
  onRunDescribe: (node: TreeNode, describePath: string[]) => void;
  isRunning: boolean;
  isLast: boolean;
  depth: number;
  expandedDescribes: Set<string>;
  toggleDescribe: (path: string) => void;
  pathPrefix: string;
  ancestorPath: string[];
}

function TreeNodeRenderer({ node, onRunTest, onRunDescribe, isRunning, isLast, depth, expandedDescribes, toggleDescribe, pathPrefix, ancestorPath }: TreeNodeRendererProps) {
  if (node.type === 'test' && node.test) {
    return (
      <TestLeaf
        test={node.test}
        onRunTest={onRunTest}
        isRunning={isRunning}
        isLast={isLast}
        depth={depth}
      />
    );
  }

  return (
    <DescribeBlock
      node={node}
      onRunTest={onRunTest}
      onRunDescribe={onRunDescribe}
      isRunning={isRunning}
      isLast={isLast}
      depth={depth}
      expandedDescribes={expandedDescribes}
      toggleDescribe={toggleDescribe}
      pathPrefix={pathPrefix}
      ancestorPath={ancestorPath}
    />
  );
}

interface FileItemProps {
  file: TestFile;
  onRunFile: (file: TestFile) => void;
  onRunTest: (test: TestResult) => void;
  onRunDescribe: (filePath: string, node: TreeNode, describePath: string[]) => void;
  isRunning: boolean;
}

function FileItem({ file, onRunFile, onRunTest, onRunDescribe, isRunning }: FileItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [expandedDescribes, setExpandedDescribes] = useState<Set<string>>(new Set());
  const { toggleFileExpanded, setSelectedTest } = useTestStore();
  const isThisRunning = isRunning && file.status === 'running';

  // Build tree structure from tests
  const testTree = useMemo(() => buildTestTree(file.tests), [file.tests]);

  // Auto-expand all describes on first render
  useEffect(() => {
    if (file.expanded && expandedDescribes.size === 0) {
      const allPaths = new Set<string>();
      function collectPaths(nodes: TreeNode[], prefix: string) {
        for (const node of nodes) {
          if (node.type === 'describe') {
            const path = prefix ? `${prefix}::${node.name}` : node.name;
            allPaths.add(path);
            collectPaths(node.children, path);
          }
        }
      }
      collectPaths(testTree, '');
      if (allPaths.size > 0) {
        setExpandedDescribes(allPaths);
      }
    }
  }, [file.expanded, testTree]);

  const toggleDescribe = (path: string) => {
    setExpandedDescribes(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleToggle = () => {
    toggleFileExpanded(file.path);
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!file.expanded) {
      toggleFileExpanded(file.path);
    }
    if (file.tests.length > 0) {
      setSelectedTest(file.tests[0].id);
    }
    onRunFile(file);
  };

  return (
    <div>
      {/* File header */}
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleToggle}
        className="w-full flex items-center gap-2 py-1.5 px-2 text-left text-xs text-text-primary hover:bg-bg-hover cursor-pointer"
      >
        {file.expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
        )}
        <StatusIcon status={file.status} />
        <FileCode className="w-3.5 h-3.5 text-text-muted" />
        <span className="truncate flex-1">{file.name}</span>
        {isHovered && !isThisRunning ? (
          <button
            onClick={handlePlay}
            className="flex-shrink-0 p-0.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent-primary transition-colors"
            title="Run this file"
          >
            <Play className="w-3 h-3" />
          </button>
        ) : (
          <span className="text-text-muted">
            {file.tests.filter((t) => t.status === 'passed').length}/{file.tests.length}
          </span>
        )}
      </div>

      {/* Test tree */}
      {file.expanded && (
        <div className="relative" style={{ marginLeft: '15px' }}>
          {/* Vertical connecting line */}
          <div
            className="absolute"
            style={{
              left: '0px',
              top: '0px',
              width: '1px',
              height: 'calc(100% - 12px)',
              backgroundColor: '#1E3A5F'
            }}
          />
          {testTree.map((node, index) => (
            <TreeNodeRenderer
              key={node.type === 'test' ? node.test?.id : node.name}
              node={node}
              onRunTest={onRunTest}
              onRunDescribe={(n, path) => onRunDescribe(file.path, n, path)}
              isRunning={isRunning}
              isLast={index === testTree.length - 1}
              depth={1}
              expandedDescribes={expandedDescribes}
              toggleDescribe={toggleDescribe}
              pathPrefix=""
              ancestorPath={[]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TestTree() {
  const { testFiles, isRunning, setRunning, setTestFiles, setError, setOutput, selectedFramework } = useTestStore();
  const { projectPath } = useProjectStore();

  const handleRunFile = async (file: TestFile) => {
    if (!projectPath || isRunning) return;

    setRunning(true);
    setError(null);
    setOutput(null);

    const currentFiles = useTestStore.getState().testFiles;
    setTestFiles(currentFiles.map(f =>
      f.path === file.path
        ? { ...f, status: 'running' as const, tests: f.tests.map(t => ({ ...t, status: 'running' as const })) }
        : f
    ));

    try {
      const result = await window.electron?.runTests?.(projectPath, file.path, undefined, selectedFramework || undefined);

      if (result?.output) {
        setOutput(result.output);
      }

      if (result?.success && result.testFiles && result.testFiles.length > 0) {
        const latestFiles = useTestStore.getState().testFiles;
        const resultFile = result.testFiles[0];

        setTestFiles(latestFiles.map(f =>
          f.path === file.path
            ? { ...resultFile, expanded: f.expanded }
            : f
        ));
      } else {
        const latestFiles = useTestStore.getState().testFiles;
        setTestFiles(latestFiles.map(f =>
          f.path === file.path
            ? { ...f, status: 'pending' as const, tests: f.tests.map(t => ({ ...t, status: 'pending' as const })) }
            : f
        ));
        if (result?.error) {
          setError(result.error);
        }
      }
    } catch (err) {
      console.error('Failed to run file:', err);
      setError(err instanceof Error ? err.message : 'Failed to run file');
    } finally {
      setRunning(false);
    }
  };

  const handleRunTest = async (test: TestResult) => {
    if (!projectPath || isRunning) return;

    setRunning(true);
    setError(null);
    setOutput(null);

    const currentFiles = useTestStore.getState().testFiles;
    setTestFiles(currentFiles.map(f =>
      f.path === test.filePath
        ? {
            ...f,
            status: 'running' as const,
            tests: f.tests.map(t => t.id === test.id ? { ...t, status: 'running' as const } : t)
          }
        : f
    ));

    try {
      const result = await window.electron?.runTests?.(projectPath, test.filePath, test.name, selectedFramework || undefined);
      const latestFiles = useTestStore.getState().testFiles;

      if (result?.output) {
        setOutput(result.output);
      }

      if (result?.success && result.testFiles && result.testFiles.length > 0) {
        const resultFile = result.testFiles[0];
        let resultTest = resultFile.tests.find(t => t.fullName === test.fullName);
        if (!resultTest) {
          resultTest = resultFile.tests.find(t => t.name === test.name);
        }
        if (!resultTest) {
          resultTest = resultFile.tests.find(t => t.status === 'passed' || t.status === 'failed');
        }
        if (!resultTest) {
          resultTest = resultFile.tests[0];
        }

        if (!resultTest) {
          console.warn('[TestTree] No result test found in response');
          setTestFiles(latestFiles.map(f =>
            f.path === test.filePath
              ? { ...f, status: 'pending' as const, tests: f.tests.map(t => t.id === test.id ? { ...t, status: 'pending' as const } : t) }
              : f
          ));
          if (result?.error) {
            setError(result.error);
          }
          return;
        }

        setTestFiles(latestFiles.map(f => {
          if (f.path === test.filePath) {
            const updatedTests = f.tests.map(t =>
              t.id === test.id
                ? { ...t, status: resultTest!.status, errorMessage: resultTest!.errorMessage, stackTrace: resultTest!.stackTrace, duration: resultTest!.duration }
                : t
            );
            const fileStatus = updatedTests.some(t => t.status === 'failed') ? 'failed'
              : updatedTests.every(t => t.status === 'passed') ? 'passed'
              : 'pending';
            return { ...f, tests: updatedTests, status: fileStatus as TestStatus };
          }
          return f;
        }));
      } else {
        setTestFiles(latestFiles.map(f =>
          f.path === test.filePath
            ? {
                ...f,
                status: 'pending' as const,
                tests: f.tests.map(t => t.id === test.id ? { ...t, status: 'pending' as const } : t)
              }
            : f
        ));
        if (result?.error) {
          setError(result.error);
        }
      }
    } catch (err) {
      console.error('Failed to run test:', err);
      setError(err instanceof Error ? err.message : 'Failed to run test');
    } finally {
      setRunning(false);
    }
  };

  const handleRunDescribe = async (filePath: string, node: TreeNode, describePath: string[]) => {
    if (!projectPath || isRunning) return;

    // Collect all tests in this describe block
    const testsToRun = collectTests(node);
    if (testsToRun.length === 0) return;

    setRunning(true);
    setError(null);
    setOutput(null);

    // Set all tests in this describe to 'running' status
    const testIds = new Set(testsToRun.map(t => t.id));
    const currentFiles = useTestStore.getState().testFiles;
    setTestFiles(currentFiles.map(f =>
      f.path === filePath
        ? {
            ...f,
            status: 'running' as const,
            tests: f.tests.map(t => testIds.has(t.id) ? { ...t, status: 'running' as const } : t)
          }
        : f
    ));

    try {
      // Build the test name pattern for Jest (matches all tests under this describe)
      const testNamePattern = describePath.join(' ');
      const result = await window.electron?.runTests?.(projectPath, filePath, testNamePattern, selectedFramework || undefined);
      const latestFiles = useTestStore.getState().testFiles;

      if (result?.output) {
        setOutput(result.output);
      }

      if (result?.success && result.testFiles && result.testFiles.length > 0) {
        const resultFile = result.testFiles[0];

        setTestFiles(latestFiles.map(f => {
          if (f.path === filePath) {
            const updatedTests = f.tests.map(t => {
              if (!testIds.has(t.id)) return t;
              // Find matching result by fullName or name
              let resultTest = resultFile.tests.find(rt => rt.fullName === t.fullName);
              if (!resultTest) {
                resultTest = resultFile.tests.find(rt => rt.name === t.name);
              }
              if (resultTest) {
                return { ...t, status: resultTest.status, errorMessage: resultTest.errorMessage, stackTrace: resultTest.stackTrace, duration: resultTest.duration };
              }
              return { ...t, status: 'pending' as const };
            });
            const fileStatus = updatedTests.some(t => t.status === 'failed') ? 'failed'
              : updatedTests.every(t => t.status === 'passed') ? 'passed'
              : 'pending';
            return { ...f, tests: updatedTests, status: fileStatus as TestStatus };
          }
          return f;
        }));
      } else {
        // Reset tests to pending on failure
        setTestFiles(latestFiles.map(f =>
          f.path === filePath
            ? {
                ...f,
                status: 'pending' as const,
                tests: f.tests.map(t => testIds.has(t.id) ? { ...t, status: 'pending' as const } : t)
              }
            : f
        ));
        if (result?.error) {
          setError(result.error);
        }
      }
    } catch (err) {
      console.error('Failed to run describe block:', err);
      setError(err instanceof Error ? err.message : 'Failed to run tests');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="py-1">
      {testFiles.map((file) => (
        <FileItem
          key={file.path}
          file={file}
          onRunFile={handleRunFile}
          onRunTest={handleRunTest}
          onRunDescribe={handleRunDescribe}
          isRunning={isRunning}
        />
      ))}
    </div>
  );
}
