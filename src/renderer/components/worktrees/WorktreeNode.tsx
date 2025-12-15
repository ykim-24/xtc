import { GitBranch } from "lucide-react";

export type WorktreeStatus = "idle" | "planning" | "running" | "success" | "error";

interface WorktreeNodeProps {
  id: string;
  branch: string;
  path: string;
  isMain: boolean;
  isCurrent: boolean;
  status: WorktreeStatus;
  isSelected: boolean;
  onClick: () => void;
  linearTicket?: {
    identifier: string;
    title: string;
  };
}

export function WorktreeNode({
  branch,
  isMain,
  isCurrent,
  status,
  isSelected,
  onClick,
  linearTicket,
}: WorktreeNodeProps) {
  return (
    <div
      onClick={onClick}
      className={`
        relative cursor-pointer transition-all duration-200
        ${isSelected ? "scale-105" : "hover:scale-102"}
      `}
    >
      {/* Animated border container */}
      <div
        className={`
        relative w-32 h-32 rounded-lg
        ${status === "planning" ? "worktree-node-planning" : ""}
        ${status === "running" ? "worktree-node-running" : ""}
        ${status === "success" ? "worktree-node-success" : ""}
        ${status === "error" ? "worktree-node-error" : ""}
        ${status === "idle" ? "worktree-node-idle" : ""}
        ${
          isSelected
            ? "ring-2 ring-accent-primary ring-offset-2 ring-offset-bg-primary"
            : ""
        }
      `}
      >
        {/* Inner content */}
        <div
          className={`
          absolute inset-[2px] rounded-md bg-bg-secondary
          flex flex-col items-center justify-center gap-1 p-2
          ${isCurrent ? "bg-accent-primary/10" : ""}
        `}
        >
          <GitBranch
            className={`w-4 h-4 ${
              isCurrent ? "text-accent-primary" : "text-text-muted"
            }`}
          />
          <span
            className={`
            text-xs font-mono truncate max-w-full px-1
            ${isCurrent ? "text-accent-primary" : "text-text-primary"}
          `}
          >
            {branch || "detached"}
          </span>
          {isMain && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-bg-tertiary text-text-muted">
              main
            </span>
          )}
          {linearTicket && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 truncate max-w-full">
              {linearTicket.identifier}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* CSS for animated borders - add to your global styles or use styled-components */
export const worktreeNodeStyles = `
  /* Spinning yellow border for planning state */
  .worktree-node-planning {
    background: linear-gradient(90deg, #eab308, #facc15, #eab308);
    background-size: 200% 100%;
    animation: worktree-spin 1.5s linear infinite;
  }

  .worktree-node-planning::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 0.5rem;
    padding: 2px;
    background: conic-gradient(from 0deg, #eab308, #facc15, #fde047, #facc15, #eab308);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: worktree-border-spin 2s linear infinite;
  }

  /* Spinning blue border for running state */
  .worktree-node-running {
    background: linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6);
    background-size: 200% 100%;
    animation: worktree-spin 1.5s linear infinite;
  }

  .worktree-node-running::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 0.5rem;
    padding: 2px;
    background: conic-gradient(from 0deg, #3b82f6, #60a5fa, #93c5fd, #60a5fa, #3b82f6);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    animation: worktree-border-spin 2s linear infinite;
  }

  @keyframes worktree-border-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Solid green border for success */
  .worktree-node-success {
    border: 2px solid #22c55e;
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.3);
  }

  /* Solid red border for error */
  .worktree-node-error {
    border: 2px solid #ef4444;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
  }

  /* Default idle border */
  .worktree-node-idle {
    border: 2px solid var(--border-primary, #374151);
  }
`;
