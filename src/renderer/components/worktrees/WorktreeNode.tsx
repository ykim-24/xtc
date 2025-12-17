import { GitBranch } from "lucide-react";

export type WorktreeStatus = "idle" | "planning" | "running" | "success" | "error" | "stopped";

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
  const isAnimating = status === "planning" || status === "running";
  const strokeColor = status === "planning" ? "#eab308" : "#3b82f6";
  const bgStrokeColor = status === "planning" ? "#422006" : "#1e3a5f";

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
        ${status === "success" ? "worktree-node-success" : ""}
        ${status === "error" ? "worktree-node-error" : ""}
        ${status === "stopped" ? "worktree-node-stopped" : ""}
        ${status === "idle" ? "worktree-node-idle" : ""}
        ${!isAnimating && isSelected ? "ring-2 ring-accent-primary ring-offset-2 ring-offset-bg-primary" : ""}
      `}
      >
        {/* SVG traveling border for planning/running states */}
        {isAnimating && (
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 128 128"
          >
            {/* Background border */}
            <rect
              x="2"
              y="2"
              width="124"
              height="124"
              rx="8"
              fill="none"
              stroke={bgStrokeColor}
              strokeWidth="4"
            />
            {/* Animated traveling line - perimeter is ~496 (124*4) */}
            <rect
              x="2"
              y="2"
              width="124"
              height="124"
              rx="8"
              fill="none"
              stroke={strokeColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="80 416"
              style={{
                animation: 'dash-travel-lg 1s linear infinite',
              }}
            />
          </svg>
        )}

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

/* CSS for static borders - planning/running now use SVG animation */
export const worktreeNodeStyles = `
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

  /* Solid orange border for stopped */
  .worktree-node-stopped {
    border: 2px solid #f97316;
    box-shadow: 0 0 10px rgba(249, 115, 22, 0.3);
  }

  /* Default idle border */
  .worktree-node-idle {
    border: 2px solid var(--border-primary, #374151);
  }
`;
