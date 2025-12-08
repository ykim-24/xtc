import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, ExternalLink, Save, Terminal } from 'lucide-react';
import { useTestStore } from '@/stores/testStore';
import { useProjectStore } from '@/stores';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

export function TestDetails() {
  const selectedTest = useTestStore((state) => state.getSelectedTest());
  const { isRunning, setRunning, setTestFiles, setMode, lastError, setError, lastOutput, setOutput, selectedFramework } = useTestStore();
  const { openFile, projectPath } = useProjectStore();
  const [fileContent, setFileContent] = useState<string>('');
  const [fullFileContent, setFullFileContent] = useState<string>('');
  const [testRange, setTestRange] = useState<{ startLine: number; endLine: number } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const originalContent = useRef<string>('');

  // Resizable output panel
  const [outputHeight, setOutputHeight] = useState(150);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newHeight = containerRect.bottom - e.clientY;
      setOutputHeight(Math.max(50, Math.min(400, newHeight)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Find test line by searching for the test name in the file content
  const findTestLineByName = (content: string, testName: string): number | null => {
    const lines = content.split('\n');
    // Escape special regex characters in test name
    const escapedName = testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match patterns like: it('name', test('name', it.skip('name', test.skip('name', xit('name', xtest('name'
    const patterns = [
      new RegExp(`\\b(it|test|xit|xtest)(\\.skip)?\\s*\\(\\s*['"\`]${escapedName}['"\`]`),
      new RegExp(`\\b(it|test|xit|xtest)(\\.skip)?\\s*\\(\\s*['"\`].*${escapedName}.*['"\`]`), // Partial match
    ];

    for (let i = 0; i < lines.length; i++) {
      for (const pattern of patterns) {
        if (pattern.test(lines[i])) {
          return i + 1; // Return 1-indexed line number
        }
      }
    }
    return null;
  };

  // Extract just the test block from the file content
  const extractTestBlock = (content: string, testLine: number): { code: string; startLine: number; endLine: number } => {
    const lines = content.split('\n');
    if (testLine < 1 || testLine > lines.length) {
      return { code: content, startLine: 1, endLine: lines.length };
    }

    const startIdx = testLine - 1; // 0-indexed
    let braceCount = 0;
    let started = false;
    let endIdx = startIdx;

    // Find the opening of the test (look for opening brace/paren)
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      for (const char of line) {
        if (char === '(' || char === '{') {
          braceCount++;
          started = true;
        } else if (char === ')' || char === '}') {
          braceCount--;
        }
      }
      endIdx = i;
      if (started && braceCount === 0) {
        break;
      }
    }

    const testCode = lines.slice(startIdx, endIdx + 1).join('\n');
    return { code: testCode, startLine: testLine, endLine: endIdx + 1 };
  };

  const loadFile = async (forceRefindLine = false) => {
    if (!selectedTest?.filePath) return;

    const result = await window.electron?.readFile(selectedTest.filePath);
    if (result?.success && result.content) {
      setFullFileContent(result.content);

      // Determine the test line - either use stored line or find it by name
      let testLine = selectedTest.line;

      // If file changed or forceRefindLine, search for the test by name
      if (forceRefindLine || !testLine) {
        const foundLine = findTestLineByName(result.content, selectedTest.name);
        if (foundLine) {
          testLine = foundLine;
        }
      }

      if (testLine) {
        const { code, startLine, endLine } = extractTestBlock(result.content, testLine);
        setFileContent(code);
        originalContent.current = code;
        setTestRange({ startLine, endLine });
      } else {
        setFileContent(result.content);
        originalContent.current = result.content;
        setTestRange(null);
      }
      setIsDirty(false);
    }
  };

  // Load file content when test is selected
  useEffect(() => {
    loadFile();
  }, [selectedTest?.id, selectedTest?.filePath, selectedTest?.line, selectedTest?.name]);

  // Listen for edit approvals to refresh the file
  useEffect(() => {
    if (!selectedTest?.filePath) return;

    const checkForChanges = async () => {
      const result = await window.electron?.readFile(selectedTest.filePath);
      if (result?.success && result.content && result.content !== fullFileContent && !isDirty) {
        // File changed externally - re-find the test line by name since line numbers may have shifted
        loadFile(true);
      }
    };

    // Poll for changes every 2 seconds (simple approach)
    const interval = setInterval(checkForChanges, 2000);
    return () => clearInterval(interval);
  }, [selectedTest?.filePath, selectedTest?.name, fullFileContent, isDirty]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Disable TypeScript/JavaScript diagnostics for this editor
    // since it doesn't have access to node_modules types
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });

    // Add Cmd+S / Ctrl+S keybinding to save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setFileContent(value);
      setIsDirty(value !== originalContent.current);
    }
  };

  const handleSave = async () => {
    if (!selectedTest?.filePath || !isDirty) return;

    setIsSaving(true);
    try {
      let contentToSave = fileContent;

      // If we're editing just a test block, merge it back into the full file
      if (testRange && fullFileContent) {
        const lines = fullFileContent.split('\n');
        const before = lines.slice(0, testRange.startLine - 1);
        const after = lines.slice(testRange.endLine);
        contentToSave = [...before, fileContent, ...after].join('\n');
      }

      const result = await window.electron?.writeFile(selectedTest.filePath, contentToSave);
      if (result?.success) {
        originalContent.current = fileContent;
        setFullFileContent(contentToSave);
        setIsDirty(false);
      }
    } catch (err) {
      console.error('Failed to save file:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Get language from file extension
  const getLanguage = (filePath: string) => {
    const ext = filePath.split('.').pop() || '';
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      go: 'go',
      rs: 'rust',
    };
    return languageMap[ext] || 'plaintext';
  };

  if (!selectedTest) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[11px] text-text-muted">-- no test selected --</p>
      </div>
    );
  }

  const handleGoToFile = async () => {
    if (!selectedTest.filePath) return;

    // Read file content and open it
    const result = await window.electron?.readFile(selectedTest.filePath);
    if (result?.success && result.content) {
      const fileName = selectedTest.filePath.split('/').pop() || selectedTest.filePath;
      const ext = fileName.split('.').pop() || '';
      const languageMap: Record<string, string> = {
        ts: 'typescript',
        tsx: 'typescript',
        js: 'javascript',
        jsx: 'javascript',
        py: 'python',
        go: 'go',
        rs: 'rust',
      };

      openFile({
        path: selectedTest.filePath,
        name: fileName,
        content: result.content,
        language: languageMap[ext] || 'plaintext',
        isDirty: false,
      });

      // Switch to home mode to show the editor
      setMode('home');
    }
  };

  const handleRerun = async () => {
    if (!projectPath || isRunning) return;

    setRunning(true);
    setError(null); // Clear previous errors
    setOutput(null); // Clear previous output

    // Set this test to running status
    const currentFiles = useTestStore.getState().testFiles;
    setTestFiles(currentFiles.map(f =>
      f.path === selectedTest.filePath
        ? {
            ...f,
            status: 'running' as const,
            tests: f.tests.map(t => t.id === selectedTest.id ? { ...t, status: 'running' as const } : t)
          }
        : f
    ));

    try {
      const result = await window.electron?.runTests?.(projectPath, selectedTest.filePath, selectedTest.name, selectedFramework || undefined);
      const latestFiles = useTestStore.getState().testFiles;

      // Always save the raw output
      if (result?.output) {
        setOutput(result.output);
      }

      if (result?.success && result.testFiles && result.testFiles.length > 0) {
        const resultFile = result.testFiles[0];
        let resultTest = resultFile.tests.find(t => t.fullName === selectedTest.fullName);
        if (!resultTest) {
          resultTest = resultFile.tests.find(t => t.name === selectedTest.name);
        }
        if (!resultTest) {
          resultTest = resultFile.tests.find(t => t.status === 'passed' || t.status === 'failed');
        }
        if (!resultTest) {
          resultTest = resultFile.tests[0];
        }

        // Guard against empty tests array
        if (!resultTest) {
          setTestFiles(latestFiles.map(f =>
            f.path === selectedTest.filePath
              ? { ...f, status: 'pending' as const, tests: f.tests.map(t => t.id === selectedTest.id ? { ...t, status: 'pending' as const } : t) }
              : f
          ));
          if (result?.error) {
            setError(result.error);
          } else {
            setError('No test results found. The test may have failed to run.');
          }
          return;
        }

        setTestFiles(latestFiles.map(f => {
          if (f.path === selectedTest.filePath) {
            const updatedTests = f.tests.map(t =>
              t.id === selectedTest.id
                ? { ...t, status: resultTest.status, errorMessage: resultTest.errorMessage, stackTrace: resultTest.stackTrace, duration: resultTest.duration }
                : t
            );
            const fileStatus = updatedTests.some(t => t.status === 'failed') ? 'failed'
              : updatedTests.every(t => t.status === 'passed') ? 'passed'
              : 'pending';
            return { ...f, tests: updatedTests, status: fileStatus as const };
          }
          return f;
        }));
      } else {
        setTestFiles(latestFiles.map(f =>
          f.path === selectedTest.filePath
            ? {
                ...f,
                status: 'pending' as const,
                tests: f.tests.map(t => t.id === selectedTest.id ? { ...t, status: 'pending' as const } : t)
              }
            : f
        ));
        // Set error message from result
        if (result?.error) {
          setError(result.error);
        }
      }
    } catch (err) {
      console.error('Failed to rerun test:', err);
      setError(err instanceof Error ? err.message : 'Failed to run test');
    } finally {
      setRunning(false);
    }
  };

  // Convert ANSI escape codes to React elements with proper styling
  const ansiToReact = (text: string): React.ReactNode[] => {
    const ansiColors: Record<string, string> = {
      '30': '#000', '31': '#ef4444', '32': '#22c55e', '33': '#eab308',
      '34': '#3b82f6', '35': '#a855f7', '36': '#06b6d4', '37': '#e5e5e5',
      '90': '#737373', '91': '#f87171', '92': '#4ade80', '93': '#facc15',
      '94': '#60a5fa', '95': '#c084fc', '96': '#22d3ee', '97': '#fff',
    };

    const parts: React.ReactNode[] = [];
    let currentStyle: React.CSSProperties = {};
    let key = 0;

    // Split by ANSI escape sequences
    const regex = /\u001b\[([\d;]*)m/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before this escape sequence
      if (match.index > lastIndex) {
        const textContent = text.slice(lastIndex, match.index);
        if (textContent) {
          parts.push(<span key={key++} style={{ ...currentStyle }}>{textContent}</span>);
        }
      }

      // Parse the escape codes
      const codes = match[1].split(';');
      for (const code of codes) {
        if (code === '0' || code === '') {
          currentStyle = {};
        } else if (code === '1') {
          currentStyle = { ...currentStyle, fontWeight: 'bold' };
        } else if (code === '2') {
          currentStyle = { ...currentStyle, opacity: 0.7 };
        } else if (code === '4') {
          currentStyle = { ...currentStyle, textDecoration: 'underline' };
        } else if (code === '22') {
          const { fontWeight, ...rest } = currentStyle;
          currentStyle = rest;
        } else if (code === '24') {
          const { textDecoration, ...rest } = currentStyle;
          currentStyle = rest;
        } else if (code === '39') {
          const { color, ...rest } = currentStyle;
          currentStyle = rest;
        } else if (ansiColors[code]) {
          currentStyle = { ...currentStyle, color: ansiColors[code] };
        }
      }

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(<span key={key++} style={{ ...currentStyle }}>{text.slice(lastIndex)}</span>);
    }

    return parts;
  };

  // Format the test runner output (extract readable parts from Jest JSON)
  const formatOutput = (output: string): React.ReactNode => {
    // Try to parse as Jest JSON output
    let json = null;

    // First try parsing the whole output
    try {
      json = JSON.parse(output.trim());
    } catch {
      // Try to find JSON starting with { and containing testResults
      const startIdx = output.indexOf('{"num');
      if (startIdx !== -1) {
        try {
          json = JSON.parse(output.slice(startIdx));
        } catch {
          // Still failed
        }
      }
    }

    if (json && json.testResults) {
      const elements: React.ReactNode[] = [];
      let key = 0;

      // Add summary line
      const { numFailedTestSuites = 0, numPassedTestSuites = 0, numFailedTests = 0, numPassedTests = 0, numTotalTestSuites = 0, numTotalTests = 0 } = json;

      elements.push(
        <div key={key++}>
          Test Suites: {numFailedTestSuites > 0 && <span className="text-red-500">{numFailedTestSuites} failed, </span>}
          {numPassedTestSuites > 0 && <span className="text-green-500">{numPassedTestSuites} passed, </span>}
          {numTotalTestSuites} total
        </div>
      );
      elements.push(
        <div key={key++}>
          Tests:       {numFailedTests > 0 && <span className="text-red-500">{numFailedTests} failed, </span>}
          {numPassedTests > 0 && <span className="text-green-500">{numPassedTests} passed, </span>}
          {numTotalTests} total
        </div>
      );
      elements.push(<div key={key++}>&nbsp;</div>);

      // Extract error messages from test results
      for (const result of json.testResults) {
        if (result.status === 'failed' && result.name) {
          elements.push(
            <div key={key++} className="text-red-500 font-bold">
              FAIL {result.name.split('/').pop()}
            </div>
          );
        }
        if (result.message) {
          elements.push(<div key={key++}>{ansiToReact(result.message)}</div>);
        }
      }

      return <>{elements}</>;
    }

    // Fallback: convert ANSI codes in raw output
    return ansiToReact(output);
  };

  // Parse clickable stack trace lines
  const parseStackTrace = (stackTrace: string) => {
    const lines = stackTrace.split('\n');
    return lines.map((line, index) => {
      // Match patterns like "at Object.<anonymous> (/path/to/file.ts:10:5)"
      const match = line.match(/\((.+):(\d+):(\d+)\)/) || line.match(/at\s+(.+):(\d+):(\d+)/);
      if (match) {
        const [, filePath, lineNum] = match;
        return (
          <div
            key={index}
            className="cursor-pointer hover:text-accent-primary"
            onClick={() => {
              // TODO: Open file at line
              console.log('Go to:', filePath, lineNum);
            }}
          >
            {line}
          </div>
        );
      }
      return <div key={index}>{line}</div>;
    });
  };

  const statusConfig = {
    passed: { label: 'PASSED', text: 'text-green-500' },
    failed: { label: 'FAILED', text: 'text-red-500' },
    running: { label: 'RUNNING', text: 'text-blue-500' },
    skipped: { label: 'SKIPPED', text: 'text-yellow-500' },
    pending: { label: 'INIT', text: 'text-gray-400' },
  };

  const status = statusConfig[selectedTest.status] || statusConfig.pending;

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      <div className="p-4 flex-shrink-0">
        {/* Header with status and actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className={`font-medium ${status.text}`}>[{status.label}]</span>
            {selectedTest.duration !== undefined && (
              <span className="text-text-muted">{selectedTest.duration}ms</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isDirty && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1 px-2 py-1 text-xs text-accent-primary hover:bg-bg-hover rounded transition-colors disabled:opacity-50"
                title="Save changes"
              >
                <Save className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={handleRerun}
              disabled={isRunning}
              className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors disabled:opacity-50"
              title="Re-run test"
            >
              <Play className="w-3 h-3" />
            </button>
            <button
              onClick={handleGoToFile}
              className="flex items-center gap-1 px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
              title="Go to file"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Test name */}
        <div className="mb-4">
          <div className="text-xs text-text-muted mb-1">
            {selectedTest.ancestorTitles.join(' > ')}
          </div>
          <h3 className="text-sm font-medium text-text-primary">{selectedTest.name}</h3>
        </div>

        {/* Error message - disabled for now */}
        {/* {selectedTest.errorMessage && (
          <div className="mb-4">
            <div className="text-xs text-text-muted mb-1">Error</div>
            <pre className="p-3 bg-bg-secondary rounded text-xs text-red-400 overflow-auto whitespace-pre-wrap max-h-32">
              {ansiToReact(selectedTest.errorMessage)}
            </pre>
          </div>
        )} */}

        {/* Stack trace - disabled for now */}
        {/* {selectedTest.stackTrace && (
          <div className="mb-4">
            <div className="text-xs text-text-muted mb-1">Stack Trace</div>
            <pre className="p-3 bg-bg-secondary rounded text-xs text-text-secondary overflow-auto max-h-32" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent', resize: 'none' }}>
              {ansiToReact(selectedTest.stackTrace)}
            </pre>
          </div>
        )} */}

      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0 border-t border-border-primary">
        <Editor
          height="100%"
          language={getLanguage(selectedTest.filePath)}
          value={fileContent}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
        />
      </div>

      {/* Test runner output - always visible */}
      <div className="flex-shrink-0 flex flex-col" style={{ height: outputHeight }}>
        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className={`h-1 cursor-ns-resize hover:bg-accent-primary transition-colors ${isResizing ? 'bg-accent-primary' : 'bg-border-primary'}`}
        />
        {/* Header */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-muted bg-bg-secondary border-b border-border-primary">
          <Terminal className="w-3.5 h-3.5" />
          <span>Output</span>
        </div>
        {/* Content */}
        <div className="flex-1 p-3 bg-[#1a1a1a] text-xs text-gray-300 overflow-auto whitespace-pre-wrap font-mono">
          {lastOutput ? formatOutput(lastOutput) : <span className="text-text-muted">Run a test to see output</span>}
        </div>
      </div>
    </div>
  );
}
