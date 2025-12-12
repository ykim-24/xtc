import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { clsx } from "clsx";
import {
  useTestStore,
  TestFramework,
  DetectedFramework,
} from "@/stores/testStore";
import { useProjectStore } from "@/stores";
import {
  PixelJest,
  PixelVitest,
  PixelMocha,
  PixelPlaywright,
  PixelCypress,
  PixelTests,
} from "@/components/feature-sidebar/PixelIcons";

const frameworkInfo: Record<TestFramework, { name: string }> = {
  jest: { name: "Jest" },
  vitest: { name: "Vitest" },
  mocha: { name: "Mocha" },
  playwright: { name: "Playwright" },
  cypress: { name: "Cypress" },
};

const frameworkIcons: Record<
  TestFramework,
  React.FC<{ className?: string }>
> = {
  jest: PixelJest,
  vitest: PixelVitest,
  mocha: PixelMocha,
  playwright: PixelPlaywright,
  cypress: PixelCypress,
};

export function TestFrameworkSelector() {
  const {
    availableFrameworks,
    isDetectingFrameworks,
    detectFrameworks,
    setSelectedFramework,
  } = useTestStore();
  const { projectPath } = useProjectStore();

  useEffect(() => {
    if (projectPath) {
      detectFrameworks(projectPath);
    }
  }, [projectPath, detectFrameworks]);

  const detectedFrameworks = availableFrameworks.filter((f) => f.detected);

  const handleSelect = (framework: DetectedFramework) => {
    setSelectedFramework(framework.id);
  };

  // Don't show header when no frameworks found or still detecting
  const showHeader = detectedFrameworks.length > 0;

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header - only show when frameworks are detected */}
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
          <h2 className="text-sm font-medium text-text-primary">
            Test Frameworks
          </h2>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {isDetectingFrameworks ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Detecting test frameworks...</span>
          </div>
        ) : detectedFrameworks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted">
            <PixelTests className="w-8 h-8" />
            <span className="text-sm">-- no test framework found --</span>
          </div>
        ) : (
          <div className="flex-1 w-full flex flex-col">
            {/* Icons grid - top left */}
            <div className="flex flex-wrap gap-1 p-4">
              {detectedFrameworks.map((framework) => {
                const info = frameworkInfo[framework.id];
                const Icon = frameworkIcons[framework.id];
                return (
                  <button
                    key={framework.id}
                    onClick={() => handleSelect(framework)}
                    className={clsx(
                      "aspect-square flex flex-col items-center justify-center p-4 rounded-lg border transition-all",
                      "bg-bg-secondary border-border-primary",
                      "hover:border-accent-primary hover:bg-bg-hover group",
                      "w-24"
                    )}
                  >
                    <Icon className="w-8 h-8 text-text-muted group-hover:text-accent-primary transition-colors" />
                    <span className="mt-2 text-xs font-medium text-text-primary">
                      {info.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Bottom right text */}
            <div className="p-4 text-right">
              <span className="text-xs text-text-muted">
                {detectedFrameworks.length} framework
                {detectedFrameworks.length > 1 ? "s" : ""} detected
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
