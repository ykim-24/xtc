import { useState, useEffect, useRef, useCallback } from "react";
import { useSettingsStore } from "@/stores";

type AnimationPhase = "fadein" | "dots" | "fading" | "input";

const GRID_COLS = 30;
const GRID_ROWS = 20;

export function WelcomeScreen() {
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<AnimationPhase>("dots");
  const [isExiting, setIsExiting] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [time, setTime] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setUserName, setHasCompletedOnboarding } = useSettingsStore();

  const startAnimation = useCallback(() => {
    setPhase("fadein");
    setAnimKey((k) => k + 1);
    setTime(0);

    // After fade in, show full dots
    const dotsTimer = setTimeout(() => {
      setPhase("dots");
    }, 1200);

    // Start fading out
    const fadeTimer = setTimeout(() => {
      setPhase("fading");
    }, 3500);

    // Show input after fade completes
    const inputTimer = setTimeout(() => {
      setPhase("input");
      setTimeout(() => inputRef.current?.focus(), 300);
    }, 5000);

    return () => {
      clearTimeout(dotsTimer);
      clearTimeout(fadeTimer);
      clearTimeout(inputTimer);
    };
  }, []);

  // Animate the wave
  useEffect(() => {
    if (phase !== "fadein" && phase !== "dots" && phase !== "fading") return;

    const interval = setInterval(() => {
      setTime((t) => t + 0.08);
    }, 30);

    return () => clearInterval(interval);
  }, [phase, animKey]);

  useEffect(() => {
    const cleanup = startAnimation();
    return cleanup;
  }, [startAnimation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      setIsExiting(true);
      setTimeout(() => {
        setUserName(name.trim());
        setHasCompletedOnboarding(true);
      }, 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && name.trim()) {
      handleSubmit(e);
    }
  };

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center
        transition-opacity duration-500
        ${isExiting ? "opacity-0" : "opacity-100"}
      `}
      style={{
        background: `
          radial-gradient(ellipse at 20% 80%, rgba(88, 166, 255, 0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(139, 92, 246, 0.06) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(16, 24, 32, 1) 0%, #0a0f14 100%)
        `,
      }}
    >
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
        }}
      />

      {/* Wavy Dot Grid */}
      {(phase === "fadein" || phase === "dots" || phase === "fading") && (
        <div
          key={animKey}
          className={`
            absolute inset-0 flex items-center justify-center overflow-hidden
            transition-opacity ease-out
            ${
              phase === "fadein"
                ? "opacity-0"
                : phase === "fading"
                ? "opacity-0"
                : "opacity-100"
            }
          `}
          style={{
            transitionDuration: phase === "fadein" ? "0ms" : "1s",
            animation:
              phase === "fadein" ? "fadeIn 1.2s ease-out forwards" : undefined,
          }}
        >
          <div className="relative w-full h-full">
            {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, i) => {
              const col = i % GRID_COLS;
              const row = Math.floor(i / GRID_COLS);

              // Position as percentage of screen
              const xPercent = (col / (GRID_COLS - 1)) * 130 - 15; // -15% to 115%
              const yPercent = (row / (GRID_ROWS - 1)) * 130 - 15;

              // Create wave effect
              const waveX = Math.sin(col * 0.3 + time) * 1.5;
              const waveY =
                Math.sin(row * 0.4 + time * 0.7) * 1.5 +
                Math.cos(col * 0.2 + time * 0.5) * 1;
              const scale =
                0.5 + (Math.sin(col * 0.2 + row * 0.2 + time * 1.2) + 1) * 0.4;
              const opacity =
                0.3 + (Math.sin(col * 0.15 + row * 0.15 + time) + 1) * 0.35;

              return (
                <div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-accent-primary"
                  style={{
                    left: `${xPercent + waveX}%`,
                    top: `${yPercent + waveY}%`,
                    transform: `translate(-50%, -50%) scale(${scale})`,
                    opacity,
                  }}
                />
              );
            })}
          </div>

          {/* Edge fade overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `
                radial-gradient(ellipse at center, transparent 30%, #0a0f14 80%)
              `,
            }}
          />
        </div>
      )}

      {/* Main content */}
      <div
        className={`
          relative flex flex-col items-center max-w-md w-full mx-8
          transition-all duration-700 ease-out
          ${
            phase === "input"
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8 pointer-events-none"
          }
        `}
      >
        {/* Inline text input */}
        <form onSubmit={handleSubmit} className="w-full">
          <div
            className="flex items-center justify-center gap-4 text-2xl font-light"
            style={{
              fontFamily: "SF Pro Display, Inter, system-ui, sans-serif",
            }}
          >
            <span className="text-text-secondary">[</span>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="what's your name?"
              className="
                bg-transparent text-text-primary placeholder:text-text-secondary
                border-none focus:outline-none
                text-2xl font-light w-56 text-left
              "
              style={{
                fontFamily: "SF Pro Display, Inter, system-ui, sans-serif",
              }}
              autoComplete="off"
              spellCheck={false}
            />
            <span className="text-text-secondary">]</span>

            <button
              type="submit"
              disabled={!name.trim()}
              className={`
                text-2xl font-light transition-all duration-300
                ${
                  name.trim()
                    ? "text-text-primary hover:text-accent-primary"
                    : "text-text-muted cursor-not-allowed"
                }
              `}
            >
              <span className="text-text-secondary">[</span>
              <span className="px-1">ok</span>
              <span className="text-text-secondary">]</span>
            </button>
          </div>
        </form>
      </div>

      {/* CSS for fade animation */}
      <style>{`
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
