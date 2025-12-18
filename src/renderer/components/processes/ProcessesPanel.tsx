import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, X, Cpu, TerminalIcon } from 'lucide-react';
import { IconButton } from '@/components/ui';

interface TerminalProcess {
  id: string;
  pid: number;
}

export function ProcessesPanel() {
  const [processes, setProcesses] = useState<TerminalProcess[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadProcesses = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.electron?.terminal.list();
      if (result?.success && result.sessions) {
        setProcesses(result.sessions);
      }
    } catch (error) {
      console.error('Failed to load processes:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount and periodically refresh
  useEffect(() => {
    loadProcesses();
    const interval = setInterval(loadProcesses, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [loadProcesses]);

  const killProcess = async (id: string) => {
    try {
      await window.electron?.terminal.kill(id);
      // Refresh the list
      loadProcesses();
    } catch (error) {
      console.error('Failed to kill process:', error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-text-secondary" />
          <span className="text-sm font-medium text-text-primary">Processes</span>
          <span className="text-xs text-text-muted">({processes.length})</span>
        </div>
        <IconButton
          size="sm"
          onClick={loadProcesses}
          disabled={isLoading}
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </IconButton>
      </div>

      {/* Process List */}
      <div className="flex-1 overflow-y-auto p-4">
        {processes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <TerminalIcon className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No active terminal processes</p>
            <p className="text-xs mt-1">Terminal processes will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {processes.map((proc, index) => (
              <div
                key={proc.id}
                className="flex items-center justify-between p-3 bg-bg-secondary rounded border border-border-primary hover:border-border-secondary transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-bg-tertiary flex items-center justify-center">
                    <TerminalIcon className="w-4 h-4 text-text-secondary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-text-primary">
                      Terminal {index + 1}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      <span className="font-mono">PID: {proc.pid}</span>
                      <span className="text-text-tertiary">•</span>
                      <span className="font-mono text-[10px] text-text-tertiary truncate max-w-[120px]">
                        {proc.id.substring(0, 8)}...
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => killProcess(proc.id)}
                  className="p-2 opacity-0 group-hover:opacity-100 hover:bg-accent-error/20 rounded transition-all"
                  title="Kill process"
                >
                  <X className="w-4 h-4 text-accent-error" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border-primary text-[10px] text-text-muted">
        Terminal processes are managed by XTC. Kill processes carefully to avoid data loss.
      </div>
    </div>
  );
}
