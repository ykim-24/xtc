import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { FolderOpen, ChevronRight, Check, X, Minus, Square } from "lucide-react";
import { PixelGit } from "@/components/feature-sidebar/PixelIcons";
import { formatClaudeStream } from "@/services/claudeStreamFormatter";
import { useWorktreeStore } from "@/stores/worktreeStore";
import {
  useTestStore,
  useProjectStore,
  useStartWorkStore,
  type LogEntry,
  type PlanStep,
  type StartWorkStep,
  type PlanQuestion,
} from "@/stores";

// Standalone implementation runner that persists after modal closes
// This runs outside the React component lifecycle
async function runBackgroundImplementationDetached(
  projectPath: string,
  userContext: string,
  planSteps: Array<{ description: string; files?: string[] }>,
  issue: { identifier: string; title: string; description?: string },
  sessionId: string,
  appendOutput: (path: string, chunk: string) => void,
  complete: (path: string, success: boolean) => void
) {
  console.log(
    "[WorktreeImpl] Starting background implementation for:",
    projectPath
  );

  const ticketContext = `
Linear Ticket: ${issue.identifier}
Title: ${issue.title}
${issue.description ? `Description: ${issue.description}` : ""}
${userContext ? `\nAdditional Context from User:\n${userContext}` : ""}
`.trim();

  const planText = planSteps
    .map(
      (step, i) =>
        `Step ${i + 1}: ${step.description}${
          step.files?.length ? `\nFiles: ${step.files.join(", ")}` : ""
        }`
    )
    .join("\n\n");

  const implementPrompt = `You are implementing a feature based on a Linear ticket. Work in the current project directory.

TICKET:
${ticketContext}

APPROVED IMPLEMENTATION PLAN:
${planText}

INSTRUCTIONS:
1. Implement each step of the plan
2. Create or modify files as needed
3. Write clean, production-ready code
4. Follow existing code patterns in the project
5. Do NOT commit - just make the changes

Start implementing now. Work through each step methodically.`;

  try {
    console.log("[WorktreeImpl] Setting up stream listener...");

    // Verify session exists before starting
    const initialSession = useWorktreeStore.getState().sessions[projectPath];
    console.log(
      "[WorktreeImpl] Session check:",
      projectPath,
      "exists:",
      !!initialSession
    );

    // Set up stream listener BEFORE making the API call
    let chunkCount = 0;
    const unsubscribe = window.electron?.claude.onStream((chunk: string) => {
      chunkCount++;
      // Log first few chunks and then periodically
      if (chunkCount <= 3 || chunkCount % 20 === 0) {
        console.log(
          `[WorktreeImpl] Received chunk #${chunkCount}, length: ${
            chunk.length
          }, preview: ${chunk.substring(0, 100)}`
        );
      }
      appendOutput(projectPath, chunk);
    });

    console.log("[WorktreeImpl] Sending to Claude...");
    const result = await window.electron?.claude.send(
      implementPrompt,
      { activeFile: undefined, contextFiles: [] },
      projectPath
    );

    console.log(
      "[WorktreeImpl] Claude completed. Total chunks received:",
      chunkCount
    );
    unsubscribe?.();

    // Save the diff after implementation completes
    try {
      console.log("[WorktreeImpl] Saving worktree diff...");
      const diffResult = await window.electron?.git.worktree.saveDiff(
        projectPath,
        sessionId
      );
      if (diffResult?.success) {
        console.log(
          "[WorktreeImpl] Diff saved:",
          diffResult.path,
          "length:",
          diffResult.diffLength
        );
      } else {
        console.warn("[WorktreeImpl] Failed to save diff:", diffResult?.error);
      }
    } catch (diffError) {
      console.warn("[WorktreeImpl] Error saving diff:", diffError);
    }

    if (result?.success) {
      console.log("[WorktreeImpl] Success!");
      complete(projectPath, true);
    } else {
      console.log("[WorktreeImpl] Failed:", result?.error);
      complete(projectPath, false);
    }
  } catch (error) {
    console.error("[WorktreeImpl] Error:", error);
    complete(projectPath, false);
  }
}

// ASCII spinner frames (braille dots style)
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Component to display formatted Claude streaming output
 */
function StreamingOutput({ rawOutput }: { rawOutput: string }) {
  const formattedLines = useMemo(
    () => formatClaudeStream(rawOutput),
    [rawOutput]
  );

  // Get activity type colors
  const getLineColor = (type: string) => {
    switch (type) {
      case "file-read":
        return "text-blue-400";
      case "file-edit":
        return "text-yellow-400";
      case "file-write":
        return "text-green-400";
      case "command":
        return "text-purple-400";
      case "tool":
        return "text-cyan-400";
      case "error":
        return "text-red-400";
      case "thinking":
        return "text-text-muted";
      case "raw":
        return "text-text-secondary";
      default:
        return "text-text-secondary";
    }
  };

  const getLineIcon = (type: string) => {
    switch (type) {
      case "file-read":
        return "→";
      case "file-edit":
        return "~";
      case "file-write":
        return "+";
      case "command":
        return "$";
      case "tool":
        return "⚙";
      case "error":
        return "!";
      default:
        return "";
    }
  };

  // If no formatted lines, show raw output as fallback
  const displayLines = useMemo(() => {
    if (formattedLines.length > 0) {
      return formattedLines;
    }

    // Extract readable text from raw output as fallback
    if (rawOutput.trim()) {
      // Try to extract text content or show cleaned raw output
      const cleanOutput = rawOutput
        .replace(/\{"type":"[^"]*"[^}]*\}/g, "") // Remove small JSON objects
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "  ")
        .replace(/\\"/g, '"')
        .split("\n")
        .map((line) => line.trim())
        .filter(
          (line) =>
            line.length > 0 && !line.startsWith("{") && !line.startsWith("[")
        )
        .slice(-10);

      if (cleanOutput.length > 0) {
        return cleanOutput.map((content) => ({
          type: "raw" as const,
          content,
        }));
      }
    }

    return [];
  }, [formattedLines, rawOutput]);

  // Only show the last few activity lines to keep it concise
  const recentLines = displayLines.slice(-8);
  const hasMore = displayLines.length > 8;

  return (
    <div className="border-l-2 border-border-secondary pl-2 ml-1 space-y-0.5">
      {hasMore && (
        <div className="text-text-muted text-xs opacity-40">
          ... {displayLines.length - 8} more
        </div>
      )}
      {recentLines.length > 0 ? (
        <>
          {recentLines.map((line, i) => (
            <div
              key={i}
              className={`${getLineColor(
                line.type
              )} text-xs flex items-start gap-1.5`}
            >
              {line.type !== "text" && line.type !== "raw" && (
                <span className="opacity-60 w-3 text-center flex-shrink-0">
                  {getLineIcon(line.type)}
                </span>
              )}
              <span
                className={
                  line.type === "text" || line.type === "raw"
                    ? "whitespace-pre-wrap"
                    : ""
                }
              >
                {line.content}
              </span>
            </div>
          ))}
        </>
      ) : (
        <div className="text-text-muted text-xs">Waiting for Claude...</div>
      )}
      {/* Show working indicator */}
      <div className="text-text-muted opacity-60 flex items-center gap-1.5 mt-1">
        <AsciiSpinner className="text-cyan-400" />
        <span className="text-xs">working...</span>
      </div>
    </div>
  );
}

function AsciiSpinner({ className = "" }: { className?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return <span className={className}>{SPINNER_FRAMES[frame]}</span>;
}

interface StartWorkPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  issue: LinearIssueDetail;
  sessionId?: string; // If provided, use existing session
}

export function StartWorkPanel({
  isOpen,
  onClose,
  onMinimize,
  issue,
  sessionId: providedSessionId,
}: StartWorkPanelProps) {
  const [userInput, setUserInput] = useState("");
  const logsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    providedSessionId || null
  );

  // Store hooks
  const worktreeStore = useWorktreeStore();
  const { setMode } = useTestStore();
  const { setProjectPath } = useProjectStore();

  // Get store actions
  const store = useStartWorkStore();
  const session = currentSessionId ? store.sessions[currentSessionId] : null;

  // Derived state from session
  const logs = session?.logs || [];
  const currentStep = session?.currentStep || "repo-select";
  const selectedRepo = session?.selectedRepo || null;
  const worktreePath = session?.worktreePath || null;
  const planSteps = session?.planSteps || [];
  const questions = session?.questions || [];
  const streamingOutput = session?.streamingOutput || "";
  const needsInput = session?.needsInput || false;
  const isProcessing = session?.isProcessing || false;
  const branchName =
    session?.branchName ||
    issue.branchName ||
    `${issue.identifier.toLowerCase()}-${issue.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 30)}`;

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, streamingOutput]);

  // Focus input when awaiting
  useEffect(() => {
    if (needsInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [needsInput]);

  // Close modal if session was removed externally (e.g., from another panel)
  useEffect(() => {
    if (isOpen && currentSessionId && !session) {
      // Session was removed externally, close this modal
      onClose();
    }
  }, [isOpen, currentSessionId, session, onClose]);

  // Initialize session when opened
  useEffect(() => {
    if (!isOpen) return;

    // If we have a provided sessionId, use it
    if (providedSessionId) {
      setCurrentSessionId(providedSessionId);
      return;
    }

    // Check if there's already a session for this issue
    const existingSession = store.getSessionByIssueId(issue.id);
    if (existingSession) {
      setCurrentSessionId(existingSession.id);
      // Make sure it's not minimized
      store.restoreSession(existingSession.id);
      return;
    }

    // Create new session
    const newSessionId = store.createSession(
      issue.id,
      issue.identifier,
      issue.title,
      issue.description,
      issue.branchName || undefined
    );
    setCurrentSessionId(newSessionId);
  }, [
    isOpen,
    providedSessionId,
    issue.id,
    issue.identifier,
    issue.title,
    issue.description,
    issue.branchName,
  ]);

  // Handle minimize
  const handleMinimize = useCallback(() => {
    if (currentSessionId) {
      store.minimizeSession(currentSessionId);
    }
    onMinimize?.();
    onClose();
  }, [currentSessionId, store, onMinimize, onClose]);

  // Handle close - minimize if in progress, otherwise close
  const handleClose = useCallback(() => {
    if (currentSessionId && currentStep !== "complete") {
      handleMinimize();
    } else {
      onClose();
    }
  }, [currentSessionId, currentStep, handleMinimize, onClose]);

  // Handle stop session - kill Claude process and clean up
  const handleStop = useCallback(async () => {
    if (!currentSessionId) return;

    // Stop any running Claude process
    if (worktreePath) {
      await window.electron?.claude.stop(worktreePath);
    }

    // Remove the session from startWorkStore
    store.removeSession(currentSessionId);

    // Also update worktreeStore if there's a session there
    if (worktreePath) {
      worktreeStore.setSessionStatus(worktreePath, "stopped");
    }

    // Close the modal
    onClose();
  }, [currentSessionId, worktreePath, store, worktreeStore, onClose]);

  // Test flow to preview the UI
  const runTestFlow = async () => {
    if (!currentSessionId) return;

    store.setNeedsInput(currentSessionId, false);
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    store.addLog(currentSessionId, { type: "input", message: "[ browse... ]" });
    store.addLog(currentSessionId, {
      type: "info",
      message: "Selected: /Users/dev/myproject",
      indent: 1,
    });

    await delay(400);
    store.addLogs(currentSessionId, [
      { type: "info", message: "" },
      { type: "init", message: "Verifying git repository..." },
    ]);

    await delay(600);
    store.addLog(currentSessionId, {
      type: "success",
      message: "Valid git repository",
    });
    store.addLog(currentSessionId, {
      type: "info",
      message: "Current branch: main",
      indent: 1,
    });

    await delay(400);
    store.addLog(currentSessionId, { type: "info", message: "" });
    store.addLog(currentSessionId, {
      type: "init",
      message: "Checking existing worktrees...",
    });

    await delay(500);
    store.addLog(currentSessionId, {
      type: "init",
      message: `Creating worktree at: /Users/dev/${branchName}`,
    });
    store.addLog(currentSessionId, {
      type: "info",
      message: `Creating new branch: ${branchName}`,
      indent: 1,
    });

    await delay(700);
    store.addLog(currentSessionId, {
      type: "success",
      message: "Worktree created successfully",
    });
    store.setWorktreePath(currentSessionId, `/Users/dev/${branchName}`);

    await delay(400);
    store.addLogs(currentSessionId, [
      { type: "info", message: "" },
      { type: "init", message: "Analyzing ticket and codebase..." },
    ]);

    await delay(500);
    store.addLog(currentSessionId, {
      type: "success",
      message: "Ticket loaded",
    });
    store.addLog(currentSessionId, { type: "info", message: "" });
    store.addLog(currentSessionId, {
      type: "init",
      message: "Generating implementation plan...",
    });

    store.setProcessing(currentSessionId, true);
    await delay(1500);
    store.setProcessing(currentSessionId, false);

    store.addLog(currentSessionId, {
      type: "success",
      message: "Plan generated",
    });
    store.addLog(currentSessionId, { type: "info", message: "" });

    // Analysis
    store.addLog(currentSessionId, {
      type: "analysis",
      message:
        "┌─ Analysis ───────────────────────────────────────────────────",
    });
    store.addLog(currentSessionId, {
      type: "info",
      message: "  This ticket requires implementing a new feature for the",
    });
    store.addLog(currentSessionId, {
      type: "info",
      message: "  start work flow. The main changes will involve the Linear",
    });
    store.addLog(currentSessionId, {
      type: "info",
      message: "  panel and git worktree integration.",
    });
    store.addLog(currentSessionId, {
      type: "analysis",
      message:
        "└──────────────────────────────────────────────────────────────",
    });

    // Questions
    store.addLog(currentSessionId, { type: "info", message: "" });
    store.addLog(currentSessionId, {
      type: "warning",
      message:
        "┌─ Questions ──────────────────────────────────────────────────",
    });
    store.addLog(currentSessionId, {
      type: "warning",
      message: "  + What should happen if the worktree creation fails?",
    });
    store.addLog(currentSessionId, {
      type: "warning",
      message: "  + Should we support multiple repos per ticket?",
    });
    store.addLog(currentSessionId, {
      type: "warning",
      message:
        "└──────────────────────────────────────────────────────────────",
    });

    // Plan
    store.addLog(currentSessionId, { type: "info", message: "" });
    store.addLog(currentSessionId, {
      type: "plan",
      message:
        "┌─ Implementation Plan ────────────────────────────────────────",
    });
    store.addLog(currentSessionId, {
      type: "plan",
      message: "  Step 1: Update StartWorkPanel component",
    });
    store.addLog(currentSessionId, {
      type: "info",
      message: "    Add worktree creation and branch management logic",
    });
    store.addLog(currentSessionId, {
      type: "file",
      message: "    Files: src/renderer/components/linear/StartWorkPanel.tsx",
    });
    store.addLog(currentSessionId, { type: "info", message: "" });
    store.addLog(currentSessionId, {
      type: "plan",
      message: "  Step 2: Add git worktree handlers",
    });
    store.addLog(currentSessionId, {
      type: "info",
      message: "    Implement electron IPC handlers for worktree operations",
    });
    store.addLog(currentSessionId, {
      type: "file",
      message: "    Files: src/electron/main.ts",
    });
    store.addLog(currentSessionId, { type: "info", message: "" });
    store.addLog(currentSessionId, {
      type: "plan",
      message: "  Step 3: Wire up to LinearPanel",
    });
    store.addLog(currentSessionId, {
      type: "info",
      message: "    Connect the start work button to open the panel",
    });
    store.addLog(currentSessionId, {
      type: "file",
      message: "    Files: src/renderer/components/linear/LinearPanel.tsx",
    });
    store.addLog(currentSessionId, {
      type: "plan",
      message:
        "└──────────────────────────────────────────────────────────────",
    });

    store.addLog(currentSessionId, { type: "info", message: "" });
    store.addLog(currentSessionId, {
      type: "prompt",
      message: "Approve this plan? (y/n)",
    });

    store.setStep(currentSessionId, "plan-review");
    store.setNeedsInput(currentSessionId, true);
  };

  const handleSelectRepo = async () => {
    if (!currentSessionId) return;

    store.setNeedsInput(currentSessionId, false);
    store.addLog(currentSessionId, { type: "input", message: "[ browse... ]" });

    const folderPath = await window.electron?.openFolder();

    if (!folderPath) {
      store.addLogs(currentSessionId, [
        { type: "warning", message: "No folder selected" },
        { type: "prompt", message: "Select a repository to work in:" },
      ]);
      store.setNeedsInput(currentSessionId, true);
      return;
    }

    store.setSelectedRepo(currentSessionId, folderPath);
    store.addLog(currentSessionId, {
      type: "info",
      message: `Selected: ${folderPath}`,
      indent: 1,
    });
    store.setStep(currentSessionId, "repo-verify");

    // Verify it's a git repo
    store.addLogs(currentSessionId, [
      { type: "info", message: "" },
      { type: "init", message: "Verifying git repository..." },
    ]);

    const isRepoResult = await window.electron?.git.isRepo(folderPath);

    if (!isRepoResult?.isRepo) {
      store.addLogs(currentSessionId, [
        { type: "error", message: "Not a git repository" },
        { type: "prompt", message: "Select a different folder:" },
      ]);
      store.setSelectedRepo(currentSessionId, null);
      store.setStep(currentSessionId, "repo-select");
      store.setNeedsInput(currentSessionId, true);
      return;
    }

    store.addLog(currentSessionId, {
      type: "success",
      message: "Valid git repository",
    });

    // Get current branch info
    const branchResult = await window.electron?.git.branch(folderPath);
    if (branchResult?.success) {
      store.addLog(currentSessionId, {
        type: "info",
        message: `Current branch: ${branchResult.current}`,
        indent: 1,
      });
    }

    // Check if branch already exists (local or remote)
    const localBranchExists = branchResult?.all.includes(branchName);
    const remoteBranchExists = branchResult?.remotes.some((r: string) =>
      r.endsWith(`/${branchName}`)
    );
    const branchExists = localBranchExists || remoteBranchExists;

    store.addLog(currentSessionId, { type: "info", message: "" });

    // Setup worktree
    await setupWorktree(folderPath, branchExists, localBranchExists || false);
  };

  const setupWorktree = async (
    repoPath: string,
    branchExists: boolean,
    localBranchExists: boolean
  ) => {
    if (!currentSessionId) return;

    store.setStep(currentSessionId, "worktree-setup");
    store.setProcessing(currentSessionId, true);

    // Fetch latest from remote first
    store.addLog(currentSessionId, {
      type: "init",
      message: "Fetching latest from remote...",
    });
    const fetchResult = await window.electron?.git.fetch(repoPath);
    if (fetchResult?.success) {
      store.addLog(currentSessionId, {
        type: "success",
        message: "Remote updated",
      });
    } else {
      store.addLog(currentSessionId, {
        type: "warning",
        message: "Could not fetch (continuing anyway)",
      });
    }

    // Check existing worktrees
    store.addLog(currentSessionId, {
      type: "init",
      message: "Checking existing worktrees...",
    });
    const worktreeResult = await window.electron?.git.worktree.list(repoPath);

    if (worktreeResult?.success) {
      // Check if worktree for this branch already exists
      const existingWorktree = worktreeResult.worktrees.find(
        (w: { branch: string }) => w.branch === branchName
      );
      if (existingWorktree) {
        store.addLogs(currentSessionId, [
          {
            type: "success",
            message: `Worktree already exists for branch: ${branchName}`,
          },
          {
            type: "info",
            message: `Path: ${existingWorktree.path}`,
            indent: 1,
          },
        ]);
        store.setWorktreePath(currentSessionId, existingWorktree.path);

        // Start session in worktree store with "planning" status
        const ticketInfo = {
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          description: issue.description,
        };
        worktreeStore.startSession(existingWorktree.path, ticketInfo);
        worktreeStore.setSessionStatus(existingWorktree.path, "planning");

        // Set the worktree as the active project
        setProjectPath(existingWorktree.path);

        // Switch to worktrees panel
        setMode("worktrees");

        await analyzeAndPlan(existingWorktree.path);
        return;
      }
    }

    // Create worktree path
    const worktreeBasePath = `${repoPath}/../${branchName}`;
    store.addLog(currentSessionId, {
      type: "init",
      message: `Creating worktree at: ${worktreeBasePath}`,
    });

    let result;
    if (branchExists) {
      // If branch exists remotely but not locally, fetch first
      if (!localBranchExists) {
        store.addLog(currentSessionId, {
          type: "info",
          message: "Fetching remote branch...",
          indent: 1,
        });
        await window.electron?.git.fetch(repoPath);
      }
      // Checkout existing branch in new worktree
      store.addLog(currentSessionId, {
        type: "info",
        message: `Using existing branch: ${branchName}`,
        indent: 1,
      });
      result = await window.electron?.git.worktree.add(
        repoPath,
        worktreeBasePath,
        branchName,
        false
      );
    } else {
      // Create new branch in new worktree
      store.addLog(currentSessionId, {
        type: "info",
        message: `Creating new branch: ${branchName}`,
        indent: 1,
      });
      result = await window.electron?.git.worktree.add(
        repoPath,
        worktreeBasePath,
        branchName,
        true
      );
    }

    if (!result?.success) {
      store.addLog(currentSessionId, {
        type: "error",
        message: result?.error || "Failed to create worktree",
      });
      store.setProcessing(currentSessionId, false);
      store.setNeedsInput(currentSessionId, true);
      store.addLog(currentSessionId, {
        type: "prompt",
        message: "Try selecting a different repository?",
      });
      store.setStep(currentSessionId, "repo-select");
      return;
    }

    // Use the resolved path from the result (absolute path without ..)
    const resolvedWorktreePath = result.path || worktreeBasePath;

    store.addLog(currentSessionId, {
      type: "success",
      message: "Worktree created successfully",
    });
    store.setWorktreePath(currentSessionId, resolvedWorktreePath);

    // Start session in worktree store with "planning" status
    const ticketInfo = {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description,
    };
    worktreeStore.startSession(resolvedWorktreePath, ticketInfo);
    worktreeStore.setSessionStatus(resolvedWorktreePath, "planning");

    // Set the newly created worktree as the active project
    setProjectPath(resolvedWorktreePath);

    // Switch to worktrees panel
    setMode("worktrees");

    await analyzeAndPlan(resolvedWorktreePath);
  };

  const analyzeAndPlan = async (projectPath: string) => {
    if (!currentSessionId) return;

    store.setStep(currentSessionId, "analyze");
    store.addLogs(currentSessionId, [
      { type: "info", message: "" },
      { type: "init", message: "Analyzing ticket and codebase..." },
    ]);

    // Build the prompt for Claude to analyze and create a plan
    const ticketContext = `
Linear Ticket: ${issue.identifier}
Title: ${issue.title}
${
  issue.description
    ? `Description: ${issue.description}`
    : "No description provided"
}
${
  issue.labels.nodes.length > 0
    ? `Labels: ${issue.labels.nodes.map((l) => l.name).join(", ")}`
    : ""
}
${issue.project ? `Project: ${issue.project.name}` : ""}
${
  issue.parent
    ? `Parent Issue: ${issue.parent.identifier} - ${issue.parent.title}`
    : ""
}
${
  issue.children.nodes.length > 0
    ? `Sub-tasks:\n${issue.children.nodes
        .map((c) => `  - ${c.identifier}: ${c.title}`)
        .join("\n")}`
    : ""
}
${
  issue.comments.nodes.length > 0
    ? `Discussion:\n${issue.comments.nodes
        .map((c) => `  - ${c.user.name}: ${c.body}`)
        .join("\n")}`
    : ""
}
`.trim();

    store.setStep(currentSessionId, "planning");
    store.addLogs(currentSessionId, [
      { type: "success", message: "Ticket loaded" },
      { type: "info", message: "" },
      { type: "init", message: "Generating implementation plan..." },
      {
        type: "info",
        message: "Claude is analyzing the ticket and codebase...",
        indent: 1,
      },
    ]);

    // Send to Claude for analysis and planning
    const planPrompt = `You are helping a developer start work on a Linear ticket. Analyze this ticket and create a detailed implementation plan.

${ticketContext}

IMPORTANT: If the ticket is missing critical information needed to implement it properly, you MUST ask clarifying questions. Examples of what to ask about:
- Unclear acceptance criteria or expected behavior
- Missing technical details (API endpoints, data structures, etc.)
- Ambiguous requirements that could be interpreted multiple ways
- Missing context about existing code or architecture
- Edge cases that aren't addressed

Based on this ticket, provide:
1. A brief analysis of what needs to be done
2. Any questions or missing context that would help (ACTIVELY ask if anything is unclear - don't assume)
3. A step-by-step implementation plan

Format your response EXACTLY like this:
---ANALYSIS---
[Your 2-3 sentence analysis of the task]

---QUESTIONS---
[List specific clarifying questions you need answered before implementing. Ask about unclear requirements, missing technical details, or ambiguous specs. Only say "None" if the ticket is truly complete and unambiguous.]

---PLAN---
STEP 1: [Step title]
[Step description]
FILES: [comma-separated list of likely files to modify, or "TBD" if unknown]

STEP 2: [Step title]
[Step description]
FILES: [files]

[Continue with more steps as needed]
---END---`;

    try {
      // Use Claude to generate the plan
      const unsubscribe = window.electron?.claude.onStream((chunk: string) => {
        store.appendStreamingOutput(currentSessionId, chunk);
      });

      const result = await window.electron?.claude.send(
        planPrompt,
        { activeFile: undefined, contextFiles: [] },
        projectPath,
        { planOnly: true } // Read-only mode for planning - no file modifications
      );

      unsubscribe?.();
      store.clearStreamingOutput(currentSessionId);

      if (result?.success && result.response) {
        const response = result.response;

        // Parse the response
        const analysisMatch = response.match(
          /---ANALYSIS---\s*([\s\S]*?)(?=---QUESTIONS---|$)/
        );
        const questionsMatch = response.match(
          /---QUESTIONS---\s*([\s\S]*?)(?=---PLAN---|$)/
        );
        const planMatch = response.match(
          /---PLAN---\s*([\s\S]*?)(?=---END---|$)/
        );

        store.addLog(currentSessionId, {
          type: "success",
          message: "Plan generated",
        });
        store.addLog(currentSessionId, { type: "info", message: "" });

        // Show analysis
        if (analysisMatch) {
          store.addLog(currentSessionId, {
            type: "analysis",
            message:
              "┌─ Analysis ───────────────────────────────────────────────────",
          });
          const analysisText = analysisMatch[1].trim();
          const maxWidth = 60;

          // Word wrap analysis text
          analysisText.split("\n").forEach((paragraph) => {
            if (!paragraph.trim()) return;

            const words = paragraph.trim().split(" ");
            let currentLine = "";

            words.forEach((word) => {
              const testLine = currentLine ? `${currentLine} ${word}` : word;
              if (testLine.length > maxWidth) {
                if (currentLine)
                  store.addLog(currentSessionId, {
                    type: "info",
                    message: `  ${currentLine}`,
                  });
                currentLine = word;
              } else {
                currentLine = testLine;
              }
            });
            if (currentLine)
              store.addLog(currentSessionId, {
                type: "info",
                message: `  ${currentLine}`,
              });
          });
          store.addLog(currentSessionId, {
            type: "analysis",
            message:
              "└──────────────────────────────────────────────────────────────",
          });
        }

        // Show questions if any - open modal for user to answer
        if (questionsMatch) {
          const questionsText = questionsMatch[1].trim();
          if (
            questionsText.toLowerCase() !== "none" &&
            questionsText.length > 0
          ) {
            store.addLog(currentSessionId, { type: "info", message: "" });
            store.addLog(currentSessionId, {
              type: "warning",
              message: "Claude has questions - opening Q&A...",
            });

            // Parse questions into structured format
            // Handle numbered questions with potential sub-items
            const lines = questionsText.split("\n").filter((l) => l.trim());
            const parsedQuestions: PlanQuestion[] = [];
            let currentQuestion = "";
            let lastMainNumber = 0;

            for (const line of lines) {
              const trimmed = line.trim().replace(/\*\*/g, "");

              // Check if this line starts with a number
              const numberMatch = trimmed.match(/^(\d+)\.\s*(.*)/);

              if (numberMatch) {
                const num = parseInt(numberMatch[1], 10);
                const content = numberMatch[2];

                // Determine if this is a main question or sub-item
                // Main questions: number > lastMainNumber or it's the first one
                // Sub-items: number <= lastMainNumber (e.g., 3, 4 after 2)
                if (num > lastMainNumber || lastMainNumber === 0) {
                  // Save previous question if exists
                  if (currentQuestion.length > 5) {
                    parsedQuestions.push({
                      id: `q-${parsedQuestions.length}`,
                      question: currentQuestion,
                      answer: "",
                    });
                  }
                  currentQuestion = content;
                  lastMainNumber = num;
                } else {
                  // This is a sub-item, append to current question
                  currentQuestion += `\n  ${num}. ${content}`;
                }
              } else {
                // Non-numbered line - could be continuation or bullet point
                const cleanedLine = trimmed
                  .replace(/^[-+•]\s*/, "")
                  .replace(/^[a-z]\)\s*/i, ""); // Handle a), b) style

                if (cleanedLine.length > 0) {
                  if (currentQuestion) {
                    // Append to current question
                    currentQuestion += `\n  ${cleanedLine}`;
                  } else {
                    // Start new question
                    currentQuestion = cleanedLine;
                  }
                }
              }
            }

            // Don't forget the last question
            if (currentQuestion.length > 5) {
              parsedQuestions.push({
                id: `q-${parsedQuestions.length}`,
                question: currentQuestion,
                answer: "",
              });
            }

            // Store questions and plan steps
            store.setQuestions(currentSessionId, parsedQuestions);
            if (planMatch) {
              const steps = parsePlanSteps(planMatch[1]);
              store.setPlanSteps(currentSessionId, steps);
            }

            store.setStep(currentSessionId, "plan-review");
            store.setProcessing(currentSessionId, false);

            // Show the questions modal at root level
            store.openQuestionsModal(currentSessionId);
            return;
          }
        }

        // Show plan
        if (planMatch) {
          store.addLog(currentSessionId, { type: "info", message: "" });
          store.addLog(currentSessionId, {
            type: "plan",
            message:
              "┌─ Implementation Plan ────────────────────────────────────────",
          });

          const steps = parsePlanSteps(planMatch[1]);
          store.setPlanSteps(currentSessionId, steps);

          steps.forEach((step, i) => {
            store.addLog(currentSessionId, {
              type: "plan",
              message: `  Step ${i + 1}: ${step.description.split("\n")[0]}`,
            });
            step.description
              .split("\n")
              .slice(1)
              .forEach((line) => {
                if (line.trim())
                  store.addLog(currentSessionId, {
                    type: "info",
                    message: `    ${line.trim()}`,
                  });
              });
            if (
              step.files &&
              step.files.length > 0 &&
              step.files[0] !== "TBD"
            ) {
              store.addLog(currentSessionId, {
                type: "file",
                message: `    Files: ${step.files.join(", ")}`,
              });
            }
            store.addLog(currentSessionId, { type: "info", message: "" });
          });

          store.addLog(currentSessionId, {
            type: "plan",
            message:
              "└──────────────────────────────────────────────────────────────",
          });
          store.addLog(currentSessionId, { type: "info", message: "" });
          store.addLog(currentSessionId, {
            type: "prompt",
            message: "Approve this plan? (y/n)",
          });
          store.setStep(currentSessionId, "plan-review");
          store.setNeedsInput(currentSessionId, true);
        } else {
          // No structured response - show fallback
          showFallbackPlan();
        }
      } else {
        store.addLog(currentSessionId, {
          type: "error",
          message: "Failed to generate plan",
        });
        store.addLog(currentSessionId, {
          type: "info",
          message: result?.error || "Unknown error",
          indent: 1,
        });
        showFallbackPlan();
      }
    } catch (error) {
      store.addLog(currentSessionId, {
        type: "error",
        message: "Error generating plan",
      });
      showFallbackPlan();
    }

    store.setProcessing(currentSessionId, false);
  };

  const parsePlanSteps = (planText: string): PlanStep[] => {
    const steps: PlanStep[] = [];
    const stepRegex = /STEP\s+(\d+):\s*([^\n]+)\n([\s\S]*?)(?=STEP\s+\d+:|$)/gi;

    let match;
    while ((match = stepRegex.exec(planText)) !== null) {
      const description =
        match[2] + "\n" + match[3].replace(/FILES:.*$/gm, "").trim();
      const filesMatch = match[3].match(/FILES:\s*(.+)/i);
      const files = filesMatch
        ? filesMatch[1]
            .split(",")
            .map((f) => f.trim())
            .filter((f) => f && f !== "TBD")
        : [];

      steps.push({
        id: `step-${match[1]}`,
        description: description.trim(),
        files,
        status: "pending",
      });
    }

    return steps;
  };

  const showFallbackPlan = () => {
    if (!currentSessionId) return;

    store.addLogs(currentSessionId, [
      { type: "info", message: "" },
      { type: "warning", message: "Using basic plan structure:" },
      { type: "plan", message: "1. Review ticket requirements" },
      { type: "plan", message: "2. Identify affected files" },
      { type: "plan", message: "3. Implement changes" },
      { type: "plan", message: "4. Write tests" },
      { type: "plan", message: "5. Create PR" },
      { type: "info", message: "" },
      { type: "prompt", message: "Continue with setup? (y/n)" },
    ]);
    store.setStep(currentSessionId, "plan-review");
    store.setNeedsInput(currentSessionId, true);
  };

  const handlePlanApproval = async (approved: boolean) => {
    if (!currentSessionId) return;

    if (approved) {
      store.addLog(currentSessionId, {
        type: "success",
        message: "Plan approved!",
      });
      store.addLog(currentSessionId, { type: "info", message: "" });

      const currentWorktreePath =
        store.getSession(currentSessionId)?.worktreePath;
      const currentPlanSteps =
        store.getSession(currentSessionId)?.planSteps || [];

      if (currentWorktreePath) {
        // Capture values for use after modal closes
        const capturedPath = currentWorktreePath;
        const capturedPlanSteps = [...currentPlanSteps];
        const capturedIssue = {
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          description: issue.description,
        };

        // Switch from planning to running status
        worktreeStore.setSessionStatus(capturedPath, "running");

        // Switch to the worktree
        setProjectPath(capturedPath);

        // Navigate to worktrees page to see progress
        setMode("worktrees");

        // Remove from start work store (workflow complete)
        store.removeSession(currentSessionId);

        // Close modal
        onClose();

        // Run implementation in background
        setTimeout(() => {
          runBackgroundImplementationDetached(
            capturedPath,
            "",
            capturedPlanSteps,
            capturedIssue,
            capturedIssue.identifier, // Use ticket identifier as session ID for diff
            // Use arrow functions to ensure we always get the latest store state
            (path: string, chunk: string) => {
              useWorktreeStore
                .getState()
                .appendImplementationOutput(path, chunk);
            },
            (path: string, success: boolean) => {
              useWorktreeStore.getState().completeSession(path, success);
            }
          );
        }, 100);
      }
    } else {
      store.addLogs(currentSessionId, [
        { type: "info", message: "Plan rejected" },
        {
          type: "prompt",
          message: "Would you like to provide feedback for a new plan? (y/n)",
        },
      ]);
    }
  };

  const handleInputSubmit = async () => {
    if (!currentSessionId) return;

    const input = userInput.trim();
    setUserInput("");

    if (input) {
      store.addLog(currentSessionId, { type: "input", message: `> ${input}` });
    }

    store.setNeedsInput(currentSessionId, false);

    const currentAdditionalContext =
      store.getSession(currentSessionId)?.additionalContext || "";
    const currentWorktreePath =
      store.getSession(currentSessionId)?.worktreePath;
    const currentPlanSteps =
      store.getSession(currentSessionId)?.planSteps || [];

    if (currentStep === "plan-review") {
      // Check if this is context input or approval
      if (
        currentAdditionalContext === "" &&
        input &&
        input.toLowerCase() !== "y" &&
        input.toLowerCase() !== "n" &&
        input.toLowerCase() !== "yes" &&
        input.toLowerCase() !== "no"
      ) {
        // User provided context - start background work and navigate to worktrees
        store.setAdditionalContext(currentSessionId, input);

        if (currentWorktreePath) {
          // Capture values for use after modal closes
          const capturedPath = currentWorktreePath;
          const capturedContext = input;
          const capturedPlanSteps = [...currentPlanSteps];
          const capturedIssue = {
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description,
          };

          // Switch from planning to running status
          worktreeStore.setSessionStatus(capturedPath, "running");

          // Switch to the worktree
          setProjectPath(capturedPath);

          // Navigate to worktrees page
          setMode("worktrees");

          // Remove from start work store (workflow complete)
          store.removeSession(currentSessionId);

          // Close modal and continue work in background
          onClose();

          // Run implementation in background with direct store access
          setTimeout(() => {
            runBackgroundImplementationDetached(
              capturedPath,
              capturedContext,
              capturedPlanSteps,
              capturedIssue,
              capturedIssue.identifier, // Use ticket identifier as session ID for diff
              // Use arrow functions to ensure we always get the latest store state
              (path: string, chunk: string) => {
                useWorktreeStore
                  .getState()
                  .appendImplementationOutput(path, chunk);
              },
              (path: string, success: boolean) => {
                useWorktreeStore.getState().completeSession(path, success);
              }
            );
          }, 100);
        }
        return;
      }

      const isApproval =
        input.toLowerCase() === "y" ||
        input.toLowerCase() === "yes" ||
        input === "";
      await handlePlanApproval(isApproval);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (needsInput) {
        handleInputSubmit();
      }
    } else if (currentStep === "complete") {
      onClose();
    }
  };

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "init":
        return "text-cyan-400";
      case "info":
        return "text-text-muted";
      case "success":
        return "text-green-400";
      case "error":
        return "text-red-400";
      case "warning":
        return "text-yellow-400";
      case "prompt":
        return "text-purple-400";
      case "input":
        return "text-blue-400";
      case "analysis":
        return "text-emerald-400";
      case "plan":
        return "text-orange-400";
      case "file":
        return "text-blue-300";
      default:
        return "text-text-primary";
    }
  };

  const getLogPrefix = (type: LogEntry["type"]) => {
    switch (type) {
      case "init":
        return "[init]";
      case "success":
        return "[done]";
      case "error":
        return "[error]";
      case "prompt":
        return "[action]";
      default:
        return "";
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="w-[700px]">
      <div className="flex flex-col h-[600px]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-[#0d1117]">
          <div className="flex items-center gap-2">
            <PixelGit className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-mono text-text-primary">
              {issue.identifier}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {worktreePath && (
              <span className="text-xs text-green-400 font-mono">
                ✓ worktree ready
              </span>
            )}
            {/* Stop button */}
            <button
              onClick={handleStop}
              className="p-1 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors"
              title="Stop session"
            >
              <Square className="w-4 h-4" />
            </button>
            {/* Minimize button */}
            <button
              onClick={handleMinimize}
              className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-yellow-400 transition-colors"
              title="Minimize to tray"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Terminal Output */}
        <div
          className="flex-1 overflow-auto p-4 bg-[#0d1117] font-mono text-xs"
          onClick={() => currentStep === "complete" && onClose()}
        >
          <div className="space-y-0.5">
            {logs.map((log, i) => (
              <div
                key={i}
                className={`${getLogColor(log.type)} whitespace-pre`}
              >
                {"  ".repeat(log.indent || 0)}
                {getLogPrefix(log.type) && (
                  <span className="opacity-60">{getLogPrefix(log.type)} </span>
                )}
                {log.message}
              </div>
            ))}
            {streamingOutput && <StreamingOutput rawOutput={streamingOutput} />}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-border-primary bg-[#0d1117] p-3">
          {needsInput && currentStep === "repo-select" ? (
            <div className="flex gap-2">
              <button
                onClick={handleSelectRepo}
                className="flex items-center gap-1 text-xs font-mono text-text-muted hover:text-blue-400 transition-colors"
              >
                [ <FolderOpen className="w-3 h-3" /> browse 4 repos ]
              </button>
            </div>
          ) : needsInput ? (
            <div className="flex items-center gap-2">
              <ChevronRight className="w-3 h-3 text-purple-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none text-xs font-mono text-text-primary placeholder-text-muted"
                placeholder={
                  currentStep === "plan-review"
                    ? "y/n or provide feedback..."
                    : "Type your response..."
                }
                autoFocus
              />
              {currentStep === "plan-review" && (
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setUserInput("y");
                      handleInputSubmit();
                    }}
                    className="p-1 rounded hover:bg-green-500/20 text-green-400 transition-colors"
                    title="Approve"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setUserInput("n");
                      handleInputSubmit();
                    }}
                    className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                    title="Reject"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : currentStep === "complete" ? (
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="text-xs font-mono text-text-muted hover:text-green-400 transition-colors"
              >
                [ close ]
              </button>
            </div>
          ) : (
            <div className="text-xs text-text-muted font-mono flex items-center gap-1">
              <AsciiSpinner className="text-cyan-400" />
              Processing...
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
