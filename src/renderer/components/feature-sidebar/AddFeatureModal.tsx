import { useState, useRef, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { PixelLinear } from './PixelIcons';

interface AddFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIntegrationChange?: () => void;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface LogEntry {
  type: 'init' | 'info' | 'success' | 'error' | 'warn';
  message: string;
}

const integrations: Integration[] = [
  {
    id: 'linear',
    name: 'Linear',
    description: 'Issue tracking and project management',
    icon: PixelLinear,
  },
];

export function AddFeatureModal({ isOpen, onClose, onIntegrationChange }: AddFeatureModalProps) {
  const [phase, setPhase] = useState<'list' | 'connect' | 'disconnect'>('list');
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedIntegrations, setConnectedIntegrations] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Focus input when entering connect phase
  useEffect(() => {
    if (phase === 'connect' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [phase]);

  // Load connected integrations on open
  useEffect(() => {
    if (isOpen) {
      loadConnectedIntegrations();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPhase('list');
      setSelectedIntegration(null);
      setApiKey('');
      setLogs([]);
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [isOpen]);

  const loadConnectedIntegrations = async () => {
    const connected = new Set<string>();

    // Check Linear
    const linearKey = await window.electron?.store.get('linear_api_key');
    if (linearKey?.success && linearKey.data) {
      connected.add('linear');
    }

    setConnectedIntegrations(connected);
  };

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [...prev, { type, message }]);
  };

  const handleConnect = (integration: Integration) => {
    setSelectedIntegration(integration);
    setPhase('connect');
    setLogs([
      { type: 'init', message: `connecting to ${integration.name.toLowerCase()}...` },
      { type: 'info', message: 'enter your api key below' },
    ]);
  };

  const handleDisconnect = (integration: Integration) => {
    setSelectedIntegration(integration);
    setPhase('disconnect');
    setLogs([
      { type: 'init', message: `disconnecting ${integration.name.toLowerCase()}...` },
    ]);
  };

  const confirmDisconnect = async () => {
    if (!selectedIntegration) return;

    setIsConnecting(true);
    addLog('info', 'removing api key...');

    await window.electron?.store.delete(`${selectedIntegration.id}_api_key`);

    addLog('success', 'api key removed');
    addLog('success', `${selectedIntegration.name.toLowerCase()} disconnected`);

    setConnectedIntegrations(prev => {
      const next = new Set(prev);
      next.delete(selectedIntegration.id);
      return next;
    });

    setIsConnecting(false);
    setIsConnected(true);
    onIntegrationChange?.();
  };

  const handleKeySubmit = async () => {
    if (!apiKey.trim() || isConnecting) return;

    setIsConnecting(true);
    addLog('info', 'validating api key...');

    // Test the Linear API via main process
    const result = await window.electron?.linear.test(apiKey.trim());

    if (result?.success && result.user) {
      const { name, email } = result.user;
      addLog('success', 'authenticated');
      addLog('info', `user: ${name} <${email}>`);

      // Store the API key
      await window.electron?.store.set('linear_api_key', apiKey.trim());
      addLog('success', 'api key saved');
      addLog('success', 'linear connected');

      setIsConnected(true);
      setConnectedIntegrations(prev => new Set([...prev, 'linear']));
      onIntegrationChange?.();
    } else {
      addLog('error', 'authentication failed');
      addLog('warn', result?.error || 'invalid api key');
    }

    setIsConnecting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleKeySubmit();
    } else if (e.key === 'Escape') {
      setPhase('list');
    }
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'init': return 'text-cyan-400';
      case 'info': return 'text-text-muted';
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      default: return 'text-text-primary';
    }
  };

  const getLogPrefix = (type: LogEntry['type']) => {
    switch (type) {
      case 'init': return '[init]';
      case 'info': return '[info]';
      case 'success': return '[ok]';
      case 'error': return '[error]';
      case 'warn': return '[warn]';
      default: return '>';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Integrations" className="w-[480px]">
      {phase === 'list' ? (
        <div className="p-4">
          <p className="text-text-secondary text-sm mb-4">
            Connect external services to enhance your workflow.
          </p>
          <div className="space-y-2">
            {integrations.map((integration) => {
              const Icon = integration.icon;
              const isIntegrationConnected = connectedIntegrations.has(integration.id);
              return (
                <button
                  key={integration.id}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary hover:bg-bg-hover transition-colors text-left"
                  onClick={() => isIntegrationConnected ? handleDisconnect(integration) : handleConnect(integration)}
                >
                  <div className={`w-10 h-10 flex items-center justify-center rounded-lg ${isIntegrationConnected ? 'bg-green-500/20' : 'bg-bg-secondary'}`}>
                    <Icon className={`w-6 h-6 ${isIntegrationConnected ? 'text-green-400' : 'text-text-primary'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="text-text-primary font-medium">{integration.name}</div>
                    <div className="text-text-secondary text-sm">{integration.description}</div>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${isIntegrationConnected ? 'bg-green-500/20 text-green-400' : 'bg-bg-secondary text-text-secondary'}`}>
                    {isIntegrationConnected ? 'Connected' : 'Connect'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : phase === 'disconnect' ? (
        <div className="flex flex-col h-[200px]">
          {/* Terminal output */}
          <div
            ref={logContainerRef}
            className="flex-1 overflow-auto p-4 bg-[#0d1117] font-mono text-xs"
          >
            <div className="space-y-1">
              {logs.map((log, i) => (
                <div key={i} className={getLogColor(log.type)}>
                  <span className="opacity-60">{getLogPrefix(log.type)}</span>{' '}
                  {log.message}
                </div>
              ))}
            </div>
          </div>

          {/* Confirm area */}
          <div className="border-t border-border-primary bg-[#161b22] p-3">
            {isConnected ? (
              <div className="flex items-center justify-between">
                <span className="text-green-400 text-xs font-mono">
                  ✓ {selectedIntegration?.name} disconnected
                </span>
                <button
                  onClick={onClose}
                  className="text-xs font-mono text-accent-primary hover:text-accent-primary/80 transition-colors"
                >
                  [ done ]
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-text-muted text-xs font-mono">
                  disconnect {selectedIntegration?.name.toLowerCase()}?
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPhase('list')}
                    className="text-xs font-mono text-text-muted hover:text-text-primary transition-colors"
                  >
                    [ cancel ]
                  </button>
                  <button
                    onClick={confirmDisconnect}
                    disabled={isConnecting}
                    className="text-xs font-mono text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    [ confirm ]
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-[300px]">
          {/* Terminal output */}
          <div
            ref={logContainerRef}
            className="flex-1 overflow-auto p-4 bg-[#0d1117] font-mono text-xs"
          >
            <div className="space-y-1">
              {logs.map((log, i) => (
                <div key={i} className={getLogColor(log.type)}>
                  <span className="opacity-60">{getLogPrefix(log.type)}</span>{' '}
                  {log.message}
                </div>
              ))}
              {isConnecting && (
                <div className="text-text-muted animate-pulse">
                  <span className="opacity-60">...</span>
                </div>
              )}
            </div>
          </div>

          {/* Input area */}
          <div className="border-t border-border-primary bg-[#161b22] p-3">
            {isConnected ? (
              <div className="flex items-center justify-between">
                <span className="text-green-400 text-xs font-mono">
                  ✓ {selectedIntegration?.name} connected
                </span>
                <button
                  onClick={onClose}
                  className="text-xs font-mono text-accent-primary hover:text-accent-primary/80 transition-colors"
                >
                  [ done ]
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-xs font-mono">[</span>
                <span className="text-cyan-400 text-xs font-mono">key</span>
                <span className="text-text-muted text-xs font-mono">]</span>
                <input
                  ref={inputRef}
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="paste api key here"
                  disabled={isConnecting}
                  className="flex-1 bg-transparent border-none outline-none text-xs font-mono text-text-primary placeholder:text-text-muted/50 disabled:opacity-50"
                />
                <button
                  onClick={handleKeySubmit}
                  disabled={!apiKey.trim() || isConnecting}
                  className="text-xs font-mono text-accent-primary hover:text-accent-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  [ enter ]
                </button>
              </div>
            )}
          </div>

          {/* Back button */}
          {!isConnected && (
            <div className="border-t border-border-primary bg-bg-secondary px-3 py-2">
              <button
                onClick={() => setPhase('list')}
                className="text-xs font-mono text-text-muted hover:text-text-primary transition-colors"
              >
                [ back ]
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
