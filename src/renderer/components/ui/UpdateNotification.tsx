import { useState, useEffect } from 'react';

interface UpdateInfo {
  version: string;
  releaseNotes?: string | { version: string; note: string }[] | null;
}

export function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    // Listen for update events from main process
    const handleUpdateAvailable = (_event: unknown, info: UpdateInfo) => {
      setIsDownloading(true);
    };

    const handleUpdateDownloaded = (_event: unknown, info: UpdateInfo) => {
      setUpdateInfo(info);
      setIsDownloading(false);
      setIsVisible(true);
    };

    // Subscribe to IPC events
    window.electron?.onUpdateAvailable?.(handleUpdateAvailable);
    window.electron?.onUpdateDownloaded?.(handleUpdateDownloaded);

    return () => {
      // Cleanup would go here if we had unsubscribe methods
    };
  }, []);

  const handleRestart = () => {
    window.electron?.restartAndUpdate?.();
  };

  const handleLater = () => {
    setIsVisible(false);
  };

  if (!isVisible || !updateInfo) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative max-w-md w-full mx-4 p-8 rounded-xl border border-border-primary"
        style={{
          background: `
            radial-gradient(ellipse at 20% 80%, rgba(88, 166, 255, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(59, 130, 246, 0.06) 0%, transparent 50%),
            #0d1117
          `,
        }}
      >
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 rounded-xl opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative">
          {/* Spinning Wireframe Cube */}
          <div className="flex justify-center mb-6">
            <div className="cube-scene">
              <div className="cube-wireframe">
                <div className="cube-face front" />
                <div className="cube-face back" />
                <div className="cube-face right" />
                <div className="cube-face left" />
                <div className="cube-face top" />
                <div className="cube-face bottom" />
              </div>
            </div>
          </div>

          {/* Title */}
          <h2
            className="text-xl font-light text-center text-text-primary mb-2"
            style={{ fontFamily: 'SF Pro Display, Inter, system-ui, sans-serif' }}
          >
            Update Ready
          </h2>

          {/* Version info */}
          <p className="text-center text-text-secondary text-sm mb-4">
            Version <span className="text-accent-primary font-mono">{updateInfo.version}</span> has been downloaded
          </p>

          {/* Changelog */}
          {updateInfo.releaseNotes && (
            <div className="mb-6 max-h-32 overflow-y-auto">
              <p className="text-xs text-text-muted mb-2 text-center">What's new:</p>
              <div 
                className="text-sm text-text-secondary bg-black/20 rounded-lg p-3 text-left"
                style={{ fontFamily: 'SF Pro Text, Inter, system-ui, sans-serif' }}
              >
                {typeof updateInfo.releaseNotes === 'string' ? (
                  <div 
                    className="prose prose-sm prose-invert max-w-none [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:space-y-1 [&>p]:mb-2"
                    dangerouslySetInnerHTML={{ __html: updateInfo.releaseNotes }}
                  />
                ) : (
                  <ul className="list-disc pl-4 space-y-1">
                    {updateInfo.releaseNotes.map((note, i) => (
                      <li key={i}>{typeof note === 'string' ? note : note.note}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div
            className="flex items-center justify-center gap-6 text-lg font-light"
            style={{ fontFamily: 'SF Pro Display, Inter, system-ui, sans-serif' }}
          >
            <button
              onClick={handleLater}
              className="text-text-muted hover:text-text-secondary transition-colors"
            >
              <span className="text-text-secondary/60">[</span>
              <span className="px-2">later</span>
              <span className="text-text-secondary/60">]</span>
            </button>

            <button
              onClick={handleRestart}
              className="text-text-primary hover:text-accent-primary transition-colors"
            >
              <span className="text-text-secondary">[</span>
              <span className="px-2">restart now</span>
              <span className="text-text-secondary">]</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cube animation styles */}
      <style>{`
        .cube-scene {
          width: 40px;
          height: 40px;
          perspective: 200px;
        }
        
        .cube-wireframe {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          animation: cube-spin 4s linear infinite;
        }
        
        .cube-face {
          position: absolute;
          width: 40px;
          height: 40px;
          border: 1.5px solid var(--color-accent-primary);
          background: transparent;
          opacity: 0.6;
        }
        
        .cube-face.front  { transform: translateZ(20px); }
        .cube-face.back   { transform: rotateY(180deg) translateZ(20px); }
        .cube-face.right  { transform: rotateY(90deg) translateZ(20px); }
        .cube-face.left   { transform: rotateY(-90deg) translateZ(20px); }
        .cube-face.top    { transform: rotateX(90deg) translateZ(20px); }
        .cube-face.bottom { transform: rotateX(-90deg) translateZ(20px); }
        
        @keyframes cube-spin {
          0% {
            transform: rotateX(-20deg) rotateY(0deg);
          }
          100% {
            transform: rotateX(-20deg) rotateY(360deg);
          }
        }
      `}</style>
    </div>
  );
}

