import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Panel } from '@/components/ui';
import { ChatInput } from './ChatInput';
import { PixelCube } from './PixelCube';
import { useChatStore, useProjectStore, useContextStore, useEditsStore, useSettingsStore, useTestStore } from '@/stores';
import { parseEditsFromResponse, createPendingEditsFromParsed } from '@/utils/editParser';

export function ChatPanel() {
  const {
    isLoading,
    error,
    claudeInstalled,
    addMessage,
    appendToMessage,
    finishStreaming,
    setLoading,
    setError,
    setClaudeInstalled,
    setStreamingMessageId,
    setResultStatus,
    setLastPrompt,
    setCurrentActivity,
  } = useChatStore();

  const { projectPath, openFiles, activeFilePath } = useProjectStore();
  const { contextFiles, addContextFile } = useContextStore();
  const { setPendingEdits } = useEditsStore();
  const { autoApproveEdits } = useSettingsStore();
  const { mode, setMode, setPreviousMode } = useTestStore();

  // Check if Claude CLI is installed on mount
  useEffect(() => {
    const checkClaude = async () => {
      if (!window.electron?.claude) {
        setClaudeInstalled(false);
        return;
      }
      const installed = await window.electron.claude.checkInstalled();
      setClaudeInstalled(installed ?? false);
    };
    checkClaude();
  }, [setClaudeInstalled]);

  // Set up streaming listener
  useEffect(() => {
    if (!window.electron?.claude) return;

    const unsubscribe = window.electron.claude.onStream((chunk) => {
      const currentStreamingId = useChatStore.getState().streamingMessageId;
      if (currentStreamingId) {
        appendToMessage(currentStreamingId, chunk);
      }
    });

    return unsubscribe;
  }, [appendToMessage]);

  // Set up activity listener
  useEffect(() => {
    if (!window.electron?.claude) return;

    const unsubscribe = window.electron.claude.onActivity((activity) => {
      setCurrentActivity(activity);
    });

    return unsubscribe;
  }, [setCurrentActivity]);

  const handleSend = async (content: string, fileMappings: Map<string, string>) => {
    // Set loading immediately
    setLoading(true);
    setError(null);
    setCurrentActivity('thinking');

    if (!window.electron?.claude) {
      setError('Electron API not available');
      setLoading(false);
      return;
    }

    // Add user message
    addMessage({ role: 'user', content });

    // Parse @mentions from the message and resolve to full paths
    const mentionRegex = /@(\S+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      const name = match[1];
      const fullPath = fileMappings.get(name) || name;
      mentions.push(fullPath);
    }

    // Read mentioned files and add to context
    const mentionedFiles: { path: string; content: string }[] = [];
    for (const filePath of mentions) {
      try {
        const result = await window.electron?.readFile(filePath);
        if (result?.success && result.content) {
          const fileName = filePath.split('/').pop() || filePath;
          mentionedFiles.push({ path: filePath, content: result.content });
          // Add to context panel
          addContextFile({ path: filePath, name: fileName, content: result.content });
        }
      } catch {
        // File not found or unreadable, skip
      }
    }

    // Build context
    const activeFile = openFiles.find((f) => f.path === activeFilePath);
    const context: {
      activeFile?: { path: string; content: string };
      contextFiles?: { path: string; content: string }[];
    } = {};

    if (activeFile) {
      context.activeFile = {
        path: activeFile.path,
        content: activeFile.content,
      };
    }

    // Add context panel files (only included ones) + mentioned files
    const includedContextFiles = contextFiles.filter((f) => f.included);
    const allContextFiles = [
      ...includedContextFiles.map((f) => ({ path: f.path, content: f.content })),
      ...mentionedFiles,
    ];

    if (allContextFiles.length > 0) {
      context.contextFiles = allContextFiles;
    }

    // Build debug prompt for display (rules are now in CLAUDE.md, read by Claude CLI)
    let debugPrompt = '';
    if (context.activeFile) {
      debugPrompt += `[ACTIVE FILE: ${context.activeFile.path}]\n\`\`\`\n${context.activeFile.content}\n\`\`\`\n\n`;
    }
    if (context.contextFiles && context.contextFiles.length > 0) {
      debugPrompt += '[CONTEXT FILES]\n';
      for (const file of context.contextFiles) {
        debugPrompt += `${file.path}:\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
      }
    }
    debugPrompt += `[USER MESSAGE]\n${content}`;
    setLastPrompt(debugPrompt);

    // Create placeholder for assistant response
    const assistantMessageId = addMessage({
      role: 'assistant',
      content: '',
      isStreaming: true,
    });
    setStreamingMessageId(assistantMessageId);

    // Send to Claude
    const result = await window.electron.claude.send(content, context, projectPath);

    if (result.success) {
      finishStreaming(assistantMessageId);
      setCurrentActivity(null);
      setResultStatus('ok');
      setTimeout(() => setResultStatus(null), 2500);

      // Parse response for file edits (only if not auto-approving)
      if (!autoApproveEdits) {
        // Small delay to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 100));
        const assistantMessage = useChatStore.getState().messages.find(m => m.id === assistantMessageId);
        console.log('[EditParser] Message content length:', assistantMessage?.content?.length);
        if (assistantMessage?.content) {
          const parsedEdits = parseEditsFromResponse(assistantMessage.content, projectPath);
          console.log('[EditParser] Parsed edits:', parsedEdits);
          if (parsedEdits.length > 0) {
            const pendingEdits = await createPendingEditsFromParsed(
              parsedEdits,
              (path) => window.electron!.readFile(path)
            );
            console.log('[EditParser] Pending edits:', pendingEdits);
            setPendingEdits(pendingEdits);

            // Save current mode and switch to home to show the diff viewer
            if (mode !== 'home') {
              setPreviousMode(mode);
              setMode('home');
            }
          }
        }
      }
    } else {
      setError(result.error || 'Failed to get response from Claude');
      setCurrentActivity(null);
      setResultStatus('error');
      setTimeout(() => setResultStatus(null), 2500);
      // Remove the empty assistant message on error
      useChatStore.setState((state) => ({
        messages: state.messages.filter((m) => m.id !== assistantMessageId),
      }));
    }
  };

  // Show error if Claude is not installed
  if (claudeInstalled === false) {
    return (
      <Panel className="h-full border-l border-border-primary">
        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
          <AlertCircle className="w-8 h-8 text-accent-warning mb-2" />
          <p className="text-sm text-text-secondary mb-1">Claude CLI not found</p>
          <p className="text-xs text-text-muted mb-4">
            Install Claude CLI to use the chat feature
          </p>
          <a
            href="https://github.com/anthropics/claude-cli"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent-primary hover:underline"
          >
            Installation instructions
          </a>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      className="h-full border-l border-border-primary"
    >
      <div className="flex flex-col h-full">
        {/* Error banner */}
        {error && (
          <div className="px-3 py-2 bg-accent-error/10 border-b border-accent-error/20 text-accent-error text-xs">
            {error}
          </div>
        )}

        {/* Mascot */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-bg-primary">
          <PixelCube />
        </div>

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </Panel>
  );
}
