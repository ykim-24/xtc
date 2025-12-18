import { useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { TitleBar } from './TitleBar';
import { Explorer } from '@/components/explorer/Explorer';
import { ContextPanel } from '@/components/context/ContextPanel';
import { RulesPanel } from '@/components/rules/RulesPanel';
import { EditorArea } from '@/components/editor/EditorArea';
import { ChatPanel, ResponsePanel } from '@/components/chat';
import { SkillsPanel } from '@/components/skills/SkillsPanel';
import { TerminalPanel } from '@/components/terminal';
import { DebugPanel } from '@/components/debug';
import { FeatureSidebar } from '@/components/feature-sidebar';
import { TestPanel, TestFrameworkSelector } from '@/components/testing';
import { GitPanel } from '@/components/git';
import { LinearPanel } from '@/components/linear/LinearPanel';
import { MinimizedSessionIndicators } from '@/components/linear/MinimizedSessionIndicators';
import { WorktreeGraph } from '@/components/worktrees';
import { EditReview } from '@/components/edit-review';
import { useSettingsStore, useTestStore, useEditsStore } from '@/stores';

export function MainLayout() {
  const { explorerVisible, chatVisible, terminalVisible, debugVisible } = useSettingsStore();
  const { mode, selectedFramework, setMode, setPreviousMode } = useTestStore();
  const { pendingEdits, addPendingEdit, updatePendingEdit, clearPendingEdits } = useEditsStore();
  const hasPendingEdits = pendingEdits.length > 0;

  // Listen for pending edits from backend (Claude's file changes detected via git)
  useEffect(() => {
    // Clear any stale pending edits from previous sessions on mount
    // Edits should only come from new conversations, not persist across restarts
    clearPendingEdits();

    // Listen for new pending edits from backend
    const unsubscribeAdd = window.electron?.claude?.onPendingEditAdded((edit) => {
      addPendingEdit(edit);
      // Switch to home mode to show the diff viewer
      const currentMode = useTestStore.getState().mode;
      if (currentMode !== 'home') {
        setPreviousMode(currentMode);
        setMode('home');
      }
    });

    // Listen for updated pending edits (when user provides feedback on existing diff)
    const unsubscribeUpdate = window.electron?.claude?.onPendingEditUpdated((edit) => {
      updatePendingEdit(edit);
    });

    return () => {
      unsubscribeAdd?.();
      unsubscribeUpdate?.();
    };
  }, [addPendingEdit, updatePendingEdit, clearPendingEdits, setMode, setPreviousMode]);

  const isHomeMode = mode === 'home';
  const isTestsMode = mode === 'tests';
  const isGitMode = mode === 'git';
  const isLinearMode = mode === 'linear';
  const isWorktreesMode = mode === 'worktrees';
  const showFrameworkSelector = isTestsMode && !selectedFramework;

  return (
    <div className="flex flex-col h-screen bg-bg-primary text-text-primary">
      <TitleBar />

      <div className="flex flex-1 min-h-0">
        {/* Feature Sidebar - always visible */}
        <FeatureSidebar />

        {/* Main content area */}
        <PanelGroup direction="horizontal" className="flex-1" autoSaveId="main-layout">
          {/* Left Sidebar - Explorer (only in home mode) */}
          {isHomeMode && explorerVisible && (
            <Panel id="explorer" order={1} defaultSize={18} minSize={12} maxSize={30}>
              <Explorer />
            </Panel>
          )}
          {isHomeMode && explorerVisible && (
            <PanelResizeHandle className="w-1 bg-border-primary hover:bg-accent-primary transition-colors" />
          )}

          {/* Center - Editor + Terminal (home mode) or TestPanel (tests mode) or GitPanel (git mode) or LinearPanel or Worktrees */}
          <Panel id="center" order={2} defaultSize={isTestsMode || isGitMode || isLinearMode || isWorktreesMode ? 68 : 50} minSize={30}>
            <div className="h-full relative">
              {/* Home mode content */}
              <div className={`h-full ${isHomeMode ? '' : 'hidden'}`}>
                {terminalVisible ? (
                  <PanelGroup direction="vertical" autoSaveId="editor-terminal">
                    <Panel id="editor" defaultSize={70} minSize={30}>
                      {/* Show EditReview or EditorArea based on pending edits */}
                      {hasPendingEdits ? <EditReview /> : <EditorArea />}
                    </Panel>
                    <PanelResizeHandle className="h-1 bg-border-primary hover:bg-accent-primary transition-colors" />
                    <Panel id="terminal" defaultSize={30} minSize={15}>
                      <TerminalPanel />
                    </Panel>
                  </PanelGroup>
                ) : hasPendingEdits ? (
                  <EditReview />
                ) : (
                  <EditorArea />
                )}
              </div>
              {/* Tests mode content */}
              <div className={`h-full ${isTestsMode ? '' : 'hidden'}`}>
                {showFrameworkSelector ? <TestFrameworkSelector /> : <TestPanel />}
              </div>
              {/* Git mode content - always mounted so reviews can run in background */}
              <div className={`h-full ${isGitMode ? '' : 'hidden'}`}>
                <GitPanel />
              </div>
              {/* Linear mode content */}
              <div className={`h-full ${isLinearMode ? '' : 'hidden'}`}>
                <LinearPanel />
              </div>
              {/* Worktrees mode content */}
              <div className={`h-full ${isWorktreesMode ? '' : 'hidden'}`}>
                <WorktreeGraph />
              </div>
            </div>
          </Panel>

          {/* Right Sidebar - Chat, Response, Context, Rules, Skills */}
          {chatVisible && (
            <PanelResizeHandle className="w-1 bg-border-primary hover:bg-accent-primary transition-colors" />
          )}
          {chatVisible && (
            <Panel id="chat-sidebar" order={3} defaultSize={32} minSize={22} maxSize={50}>
              <PanelGroup direction="vertical" autoSaveId="chat-panels">
                {/* Chat Input */}
                <Panel id="chat-input" defaultSize={30} minSize={20}>
                  <ChatPanel />
                </Panel>

                <PanelResizeHandle className="h-1 bg-border-primary hover:bg-accent-primary transition-colors" />

                {/* Response */}
                <Panel id="response" defaultSize={35} minSize={15}>
                  <ResponsePanel />
                </Panel>

                <PanelResizeHandle className="h-1 bg-border-primary hover:bg-accent-primary transition-colors" />

                {/* Context */}
                <Panel id="context" defaultSize={12} minSize={8}>
                  <ContextPanel />
                </Panel>

                <PanelResizeHandle className="h-1 bg-border-primary hover:bg-accent-primary transition-colors" />

                {/* Rules & Skills side by side */}
                <Panel id="rules-skills" defaultSize={20} minSize={12}>
                  <PanelGroup direction="horizontal" autoSaveId="rules-skills">
                    <Panel id="rules" defaultSize={50} minSize={30}>
                      <RulesPanel />
                    </Panel>
                    <PanelResizeHandle className="w-1 bg-border-primary hover:bg-accent-primary transition-colors" />
                    <Panel id="skills" defaultSize={50} minSize={30}>
                      <SkillsPanel />
                    </Panel>
                  </PanelGroup>
                </Panel>
              </PanelGroup>
            </Panel>
          )}

          {/* Debug Panel - Far Right */}
          {debugVisible && (
            <PanelResizeHandle className="w-1 bg-border-primary hover:bg-accent-primary transition-colors" />
          )}
          {debugVisible && (
            <Panel id="debug" order={4} defaultSize={25} minSize={15} maxSize={40}>
              <DebugPanel />
            </Panel>
          )}
        </PanelGroup>
      </div>

      {/* Minimized StartWork session indicators */}
      <MinimizedSessionIndicators />
    </div>
  );
}
