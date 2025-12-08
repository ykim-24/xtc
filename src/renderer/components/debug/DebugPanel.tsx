import { Panel } from '@/components/ui';
import { useChatStore } from '@/stores';

export function DebugPanel() {
  const { lastPrompt } = useChatStore();

  return (
    <Panel
      title="Debug"
      className="h-full border-l border-border-primary"
    >
      <div className="h-full overflow-auto p-2 font-mono text-[10px] text-text-secondary">
        {lastPrompt ? (
          <pre className="whitespace-pre-wrap break-words">{lastPrompt}</pre>
        ) : (
          <p className="text-text-muted text-center py-4">-- no prompt sent --</p>
        )}
      </div>
    </Panel>
  );
}
