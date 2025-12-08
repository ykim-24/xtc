interface PixelCrystalProps {
  status?: 'idle' | 'thinking';
}

// Crystal inspired by reference - elongated with multiple facets
// Using 2 for outline, 1 for inner facet lines
const crystalPixels = [
  //                         Top point
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,2,0,1,0,2,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,2,0,1,0,1,0,2,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,2,0,1,0,1,0,1,0,2,0,0,0,0,0,0,0,0,0,0],
  //                       Upper facets
  [0,0,0,0,0,0,0,0,0,2,0,1,0,1,0,1,0,1,0,2,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,2,0,1,0,1,0,1,0,1,0,1,0,2,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,2,0,1,0,1,0,0,0,0,0,1,0,1,0,2,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,2,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,2,0,0,0,0,0,0],
  //                     Main body - widest part
  [0,0,0,0,0,2,0,1,0,1,0,0,1,0,1,0,1,0,0,1,0,1,0,2,0,0,0,0,0],
  [0,0,0,0,2,0,1,0,1,0,0,1,0,1,0,1,0,1,0,0,1,0,1,0,2,0,0,0,0],
  [0,0,0,2,0,1,0,1,0,0,1,0,1,0,0,0,1,0,1,0,0,1,0,1,0,2,0,0,0],
  [0,0,2,0,1,0,1,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0,1,0,1,0,2,0,0],
  [0,2,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,2,0],
  [2,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,2],
  //                       Center line
  [2,1,0,1,0,0,1,0,1,0,0,1,0,1,0,1,0,1,0,0,1,0,1,0,0,1,0,1,2],
  [2,0,1,0,0,1,0,1,0,0,1,0,1,0,1,0,1,0,1,0,0,1,0,1,0,0,1,0,2],
  //                      Lower body
  [0,2,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,0,1,0,1,0,2,0],
  [0,0,2,0,1,0,0,1,0,1,0,0,1,0,1,0,1,0,0,1,0,1,0,0,1,0,2,0,0],
  [0,0,0,2,0,1,0,1,0,0,1,0,1,0,0,0,1,0,1,0,0,1,0,1,0,2,0,0,0],
  [0,0,0,0,2,0,1,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0,1,0,2,0,0,0,0],
  [0,0,0,0,0,2,0,1,0,1,0,0,1,0,1,0,1,0,0,1,0,1,0,2,0,0,0,0,0],
  //                     Lower facets
  [0,0,0,0,0,0,2,0,1,0,0,1,0,1,0,1,0,1,0,0,1,0,2,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,2,0,1,0,1,0,0,0,0,0,1,0,1,0,2,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,2,0,1,0,1,0,1,0,1,0,1,0,2,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,2,0,1,0,1,0,1,0,1,0,2,0,0,0,0,0,0,0,0,0],
  //                       Bottom point
  [0,0,0,0,0,0,0,0,0,0,2,0,1,0,1,0,1,0,2,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,2,0,1,0,1,0,2,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,2,0,1,0,2,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// 4-pointed star sparkles like in reference
const sparkles = [
  { x: -45, y: -35, size: 'large', delay: 0 },
  { x: 50, y: -20, size: 'medium', delay: 0.6 },
  { x: -40, y: 45, size: 'small', delay: 1.2 },
  { x: 45, y: 50, size: 'medium', delay: 0.3 },
];

function Sparkle({ size, className, style }: { size: 'small' | 'medium' | 'large'; className?: string; style?: React.CSSProperties }) {
  const dims = size === 'large' ? 16 : size === 'medium' ? 12 : 8;
  const thick = size === 'large' ? 4 : size === 'medium' ? 3 : 2;

  return (
    <svg width={dims} height={dims} viewBox={`0 0 ${dims} ${dims}`} className={className} style={style}>
      {/* Vertical line */}
      <rect x={(dims - thick) / 2} y={0} width={thick} height={dims} fill="white" />
      {/* Horizontal line */}
      <rect x={0} y={(dims - thick) / 2} width={dims} height={thick} fill="white" />
    </svg>
  );
}

export function PixelCrystal({ status = 'idle' }: PixelCrystalProps) {
  const pixelSize = 2;
  const width = crystalPixels[0].length * pixelSize;
  const height = crystalPixels.length * pixelSize;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="pixel-crystal-container relative">
        {/* Sparkles */}
        {sparkles.map((sparkle, i) => (
          <div
            key={i}
            className="sparkle absolute"
            style={{
              left: `calc(50% + ${sparkle.x}px)`,
              top: `calc(50% + ${sparkle.y}px)`,
              animationDelay: `${sparkle.delay}s`,
            }}
          >
            <Sparkle size={sparkle.size as 'small' | 'medium' | 'large'} />
          </div>
        ))}

        {/* Crystal */}
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="pixel-crystal"
          style={{ imageRendering: 'pixelated' }}
        >
          {crystalPixels.map((row, y) =>
            row.map((pixel, x) => {
              if (pixel === 0) return null;
              return (
                <rect
                  key={`${x}-${y}`}
                  x={x * pixelSize}
                  y={y * pixelSize}
                  width={pixelSize}
                  height={pixelSize}
                  fill={pixel === 2 ? 'white' : 'rgba(255,255,255,0.4)'}
                />
              );
            })
          )}
        </svg>
      </div>

      <div className="status-text font-mono text-[10px] text-text-muted tracking-widest">
        [{status}]
      </div>

      <style>{`
        .pixel-crystal-container {
          animation: float 3s ease-in-out infinite;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 140px;
          height: 160px;
        }

        .pixel-crystal {
          filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.25));
        }

        .sparkle {
          animation: sparkle 2.5s ease-in-out infinite;
          opacity: 0;
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        @keyframes sparkle {
          0%, 100% {
            opacity: 0;
            transform: scale(0.5);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }

        .status-text {
          text-transform: lowercase;
        }
      `}</style>
    </div>
  );
}
