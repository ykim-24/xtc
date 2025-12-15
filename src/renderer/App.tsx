import { ThemeProvider } from "@/themes";
import { MainLayout } from "@/components/layout";
import { WelcomeScreen } from "@/components/welcome";
import { UpdateNotification } from "@/components/ui";
import { QuestionsModal } from "@/components/linear/QuestionsModal";
import { StartWorkPanel } from "@/components/linear/StartWorkPanel";
import { useSettingsStore, useStartWorkStore } from "@/stores";

export function App() {
  const hasCompletedOnboarding = useSettingsStore(
    (state) => state.hasCompletedOnboarding
  );

  const questionsModalSessionId = useStartWorkStore(
    (state) => state.questionsModalSessionId
  );
  const questionsSession = useStartWorkStore((state) =>
    questionsModalSessionId ? state.sessions[questionsModalSessionId] : null
  );
  const activeSessionPanelId = useStartWorkStore(
    (state) => state.activeSessionPanelId
  );
  const panelSession = useStartWorkStore((state) =>
    activeSessionPanelId ? state.sessions[activeSessionPanelId] : null
  );
  const closeQuestionsModal = useStartWorkStore(
    (state) => state.closeQuestionsModal
  );
  const closeSessionPanel = useStartWorkStore(
    (state) => state.closeSessionPanel
  );
  const minimizeSession = useStartWorkStore((state) => state.minimizeSession);
  const setAdditionalContext = useStartWorkStore(
    (state) => state.setAdditionalContext
  );
  const addLog = useStartWorkStore((state) => state.addLog);
  const setNeedsInput = useStartWorkStore((state) => state.setNeedsInput);
  const setHasUnansweredQuestions = useStartWorkStore(
    (state) => state.setHasUnansweredQuestions
  );
  const openSessionPanel = useStartWorkStore((state) => state.openSessionPanel);

  const handleQuestionsSubmit = (answers: Record<string, string>) => {
    if (!questionsModalSessionId || !questionsSession) return;

    const sessionId = questionsModalSessionId;

    // Mark questions as answered
    setHasUnansweredQuestions(sessionId, false);
    closeQuestionsModal();

    // Format answers as additional context
    const answeredQuestions = questionsSession.questions
      .filter((q) => answers[q.id]?.trim())
      .map((q) => `Q: ${q.question}\nA: ${answers[q.id]}`)
      .join("\n\n");

    if (answeredQuestions) {
      addLog(sessionId, { type: "success", message: "Answers received" });
      setAdditionalContext(sessionId, answeredQuestions);
    }

    // Continue with plan approval
    addLog(sessionId, { type: "info", message: "" });
    addLog(sessionId, { type: "prompt", message: "Approve this plan? (y/n)" });
    setNeedsInput(sessionId, true);

    // Open the session panel so user can respond
    openSessionPanel(sessionId);
  };

  const handleFigureItOut = () => {
    if (!questionsModalSessionId) return;

    const sessionId = questionsModalSessionId;

    // Mark questions as answered (figured out)
    setHasUnansweredQuestions(sessionId, false);
    closeQuestionsModal();
    addLog(sessionId, {
      type: "info",
      message: "No additional context provided - Claude will figure it out",
    });

    // Continue with plan approval
    addLog(sessionId, { type: "info", message: "" });
    addLog(sessionId, { type: "prompt", message: "Approve this plan? (y/n)" });
    setNeedsInput(sessionId, true);

    // Open the session panel so user can respond
    openSessionPanel(sessionId);
  };

  const handleCloseSessionPanel = () => {
    // Minimize the session so it shows as an indicator
    if (activeSessionPanelId) {
      minimizeSession(activeSessionPanelId);
    }
    closeSessionPanel();
  };

  const handleMinimizeSessionPanel = () => {
    if (activeSessionPanelId) {
      minimizeSession(activeSessionPanelId);
      closeSessionPanel();
    }
  };

  return (
    <ThemeProvider>
      {!hasCompletedOnboarding && <WelcomeScreen />}
      <MainLayout />
      <UpdateNotification />

      {/* Questions Modal - rendered at root level to show on any page */}
      {questionsSession && (
        <QuestionsModal
          isOpen={!!questionsModalSessionId}
          onClose={closeQuestionsModal}
          questions={questionsSession.questions}
          issueIdentifier={questionsSession.issueIdentifier}
          onSubmit={handleQuestionsSubmit}
          onFigureItOut={handleFigureItOut}
        />
      )}

      {/* Session Panel - rendered at root level to show on any page */}
      {activeSessionPanelId && panelSession && (
        <StartWorkPanel
          isOpen={true}
          onClose={handleCloseSessionPanel}
          onMinimize={handleMinimizeSessionPanel}
          issue={{
            id: panelSession.issueId,
            identifier: panelSession.issueIdentifier,
            title: panelSession.issueTitle,
            description: panelSession.issueDescription || "",
            priority: 0,
            state: { id: "", name: "", color: "#888", type: "unstarted" },
            labels: { nodes: [] },
            project: null,
            assignee: null,
            creator: null,
            dueDate: null,
            estimate: null,
            parent: null,
            children: { nodes: [] },
            comments: { nodes: [] },
            attachments: { nodes: [] },
            createdAt: "",
            updatedAt: "",
            branchName: panelSession.branchName,
          }}
          sessionId={activeSessionPanelId}
        />
      )}
    </ThemeProvider>
  );
}
