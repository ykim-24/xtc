import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Plus, X, TerminalIcon } from 'lucide-react';
import { IconButton } from '@/components/ui';
import { useProjectStore } from '@/stores';
import '@xterm/xterm/css/xterm.css';

interface TerminalTab {
  id: string;
  name: string;
}

interface TerminalInstance {
  xterm: XTerm;
  fitAddon: FitAddon;
  element: HTMLDivElement;
}

export function TerminalPanel() {
  const { projectPath } = useProjectStore();
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const terminalInstancesRef = useRef<Map<string, TerminalInstance>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Create xterm instance for a terminal
  const createXtermInstance = useCallback((terminalId: string): TerminalInstance => {
    const element = document.createElement('div');
    element.style.position = 'absolute';
    element.style.top = '0';
    element.style.left = '0';
    element.style.right = '0';
    element.style.bottom = '0';
    element.style.display = 'none';

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Monaco, "Cascadia Code", "Fira Code", monospace',
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    // Add web links support (cmd+click to open URLs)
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      // Open link in default browser
      window.electron?.openExternal?.(uri);
    });
    xterm.loadAddon(webLinksAddon);

    // Handle input - capture terminalId in closure
    xterm.onData((data) => {
      window.electron?.terminal.write(terminalId, data);
    });

    return { xterm, fitAddon, element };
  }, []);

  // Create a new terminal
  const createTerminal = useCallback(async () => {
    if (!window.electron?.terminal) return;

    const result = await window.electron.terminal.create(projectPath || undefined);
    if (!result.success || !result.id) return;

    const tabId = result.id;

    // Create xterm instance
    const instance = createXtermInstance(tabId);
    terminalInstancesRef.current.set(tabId, instance);

    // Append element to container
    if (containerRef.current) {
      containerRef.current.appendChild(instance.element);
      instance.xterm.open(instance.element);

      // Delay fit to ensure container has proper dimensions
      // This fixes positioning issues in production builds
      requestAnimationFrame(() => {
        setTimeout(() => {
          instance.fitAddon.fit();
          // Send initial size to PTY
          window.electron?.terminal.resize(tabId, instance.xterm.cols, instance.xterm.rows);
        }, 50);
      });
    }

    setTabs((prev) => {
      const newTab: TerminalTab = {
        id: tabId,
        name: `Terminal ${prev.length + 1}`,
      };
      return [...prev, newTab];
    });
    setActiveTabId(tabId);
  }, [projectPath, createXtermInstance]);

  // Close a terminal
  const closeTerminal = useCallback(async (tabId: string) => {
    await window.electron?.terminal.kill(tabId);

    const instance = terminalInstancesRef.current.get(tabId);
    if (instance) {
      instance.xterm.dispose();
      instance.element.remove();
      terminalInstancesRef.current.delete(tabId);
    }

    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId);
      return newTabs;
    });

    setActiveTabId((currentActive) => {
      if (currentActive === tabId) {
        const remainingTabs = [...terminalInstancesRef.current.keys()];
        return remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1] : null;
      }
      return currentActive;
    });
  }, []);

  // Show/hide terminals based on active tab
  useEffect(() => {
    terminalInstancesRef.current.forEach((instance, id) => {
      if (id === activeTabId) {
        instance.element.style.display = 'block';
        instance.fitAddon.fit();
        instance.xterm.focus();
      } else {
        instance.element.style.display = 'none';
      }
    });
  }, [activeTabId]);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (activeTabId) {
        const instance = terminalInstancesRef.current.get(activeTabId);
        if (instance) {
          instance.fitAddon.fit();
          window.electron?.terminal.resize(activeTabId, instance.xterm.cols, instance.xterm.rows);
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [activeTabId]);

  // Listen for terminal data
  useEffect(() => {
    if (!window.electron?.terminal) return;

    const unsubscribeData = window.electron.terminal.onData(({ id, data }) => {
      const instance = terminalInstancesRef.current.get(id);
      if (instance) {
        instance.xterm.write(data);
      }
    });

    const unsubscribeExit = window.electron.terminal.onExit(({ id }) => {
      closeTerminal(id);
    });

    return () => {
      unsubscribeData();
      unsubscribeExit();
    };
  }, [closeTerminal]);

  // Create first terminal on mount (with guard against StrictMode double-mount)
  useEffect(() => {
    if (initializedRef.current) return;

    // In production, window.electron may not be ready immediately
    // Retry a few times with delay, and wait for container to be ready
    const tryCreate = (attempts = 0) => {
      if (initializedRef.current) return;

      if (window.electron?.terminal && containerRef.current) {
        initializedRef.current = true;
        // Small delay to ensure layout is stable
        setTimeout(() => {
          createTerminal();
        }, 100);
      } else if (attempts < 20) {
        // Retry up to 20 times with 100ms delay (2 seconds total)
        setTimeout(() => tryCreate(attempts + 1), 100);
      }
    };

    // Start with a small delay to let the component mount fully
    setTimeout(() => tryCreate(), 50);

    // Cleanup on unmount
    return () => {
      terminalInstancesRef.current.forEach((instance, id) => {
        window.electron?.terminal.kill(id);
        instance.xterm.dispose();
      });
      terminalInstancesRef.current.clear();
    };
  }, []); // Empty deps - only run on mount

  // Change directory when project path changes
  useEffect(() => {
    if (!projectPath || !activeTabId) return;
    window.electron?.terminal.write(activeTabId, `cd "${projectPath}" && clear\r`);
  }, [projectPath]);

  return (
    <div className="h-full flex flex-col border-t border-border-primary bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-secondary flex-shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Terminal
        </span>
        <IconButton size="sm" onClick={createTerminal} title="New Terminal">
          <Plus className="w-3.5 h-3.5" />
        </IconButton>
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-border-primary bg-bg-secondary flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
                activeTabId === tab.id
                  ? 'bg-bg-tertiary text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <TerminalIcon className="w-3 h-3" />
              <span>{tab.name}</span>
              <X
                className="w-3 h-3 ml-1 hover:text-accent-error"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTerminal(tab.id);
                }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Terminal container - holds all terminal elements */}
      <div ref={containerRef} className="flex-1 min-h-0 p-1 overflow-hidden relative" />

      {/* Empty state */}
      {tabs.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted">
          <TerminalIcon className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">No terminal</p>
          <button
            onClick={createTerminal}
            className="text-xs text-accent-primary hover:underline mt-1"
          >
            Create terminal
          </button>
        </div>
      )}
    </div>
  );
}
