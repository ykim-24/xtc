interface PixelCrystalAltProps {
  status?: 'idle' | 'thinking';
}

// Alternative crystal - more geometric/angular with clear facet sections
// Inspired by classic RPG crystal items
const crystalPixels = [
  //                    Sharp top point
  [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,1,0,0,0,1,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,1,0,0,1,0,0,1,1,0,0,0,0,0,0,0],
  //                   Upper crown
  [0,0,0,0,0,0,1,1,0,0,1,1,1,0,0,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,1,1,0,1,1,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,0,0,1,1,0,0,0,1,1,0,0,1,1,0,0,0,0],
  [0,0,0,1,1,0,0,1,1,0,0,1,0,0,1,1,0,0,1,1,0,0,0],
  //                  Main body expands
  [0,0,1,1,0,0,1,1,0,0,1,1,1,0,0,1,1,0,0,1,1,0,0],
  [0,1,1,0,0,1,1,0,0,1,1,0,1,1,0,0,1,1,0,0,1,1,0],
  [1,1,0,0,1,1,0,0,1,1,0,0,0,1,1,0,0,1,1,0,0,1,1],
  //                   Widest point
  [1,0,0,1,1,0,0,1,1,0,0,1,0,0,1,1,0,0,1,1,0,0,1],
  [1,0,1,1,0,0,1,1,0,0,1,1,1,0,0,1,1,0,0,1,1,0,1],
  [1,0,0,1,1,0,0,1,1,0,0,1,0,0,1,1,0,0,1,1,0,0,1],
  //                  Lower body contracts
  [1,1,0,0,1,1,0,0,1,1,0,0,0,1,1,0,0,1,1,0,0,1,1],
  [0,1,1,0,0,1,1,0,0,1,1,0,1,1,0,0,1,1,0,0,1,1,0],
  [0,0,1,1,0,0,1,1,0,0,1,1,1,0,0,1,1,0,0,1,1,0,0],
  [0,0,0,1,1,0,0,1,1,0,0,1,0,0,1,1,0,0,1,1,0,0,0],
  //                  Lower section
  [0,0,0,0,1,1,0,0,1,1,0,0,0,1,1,0,0,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,1,1,0,1,1,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,0,0,1,1,1,0,0,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,1,0,0,1,0,0,1,1,0,0,0,0,0,0,0],
  //                  Bottom point
  [0,0,0,0,0,0,0,0,1,1,0,0,0,1,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
];

export function PixelCrystalAlt({ status = 'idle' }: PixelCrystalAltProps) {
  const pixelSize = 2;
  const width = crystalPixels[0].length * pixelSize;
  const height = crystalPixels.length * pixelSize;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="pixel-crystal-alt-container">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="pixel-crystal-alt"
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
                  fill="white"
                />
              );
            })
          )}
        </svg>
      </div>

      <div className="status-text-alt font-mono text-[10px] text-text-muted tracking-widest">
        [{status}]
      </div>

      <style>{`
        .pixel-crystal-alt-container {
          animation: floatAlt 3s ease-in-out infinite;
        }

        .pixel-crystal-alt {
          filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.2));
        }

        @keyframes floatAlt {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        .status-text-alt {
          text-transform: lowercase;
        }
      `}</style>
    </div>
  );
}
