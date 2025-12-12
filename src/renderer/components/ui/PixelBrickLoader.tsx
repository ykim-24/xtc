import { useEffect, useState } from 'react';

interface PixelBrickLoaderProps {
  className?: string;
  size?: number;
}

interface Brick {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  settled: boolean;
  scale: number;
  delay: number;
  started: boolean;
}

const BRICK_COLOR = '#4b5563';

function createBricks(): Brick[] {
  const bricks: Brick[] = [];
  let id = 0;

  // Perfect square: 60x60, starting at (20, 10)
  const squareSize = 60;
  const startX = 20;
  const startY = 10;
  const brickHeight = 8;

  // Brick patterns for each row - widths must sum to 60
  const rows = [
    [20, 40],           // 2 bricks
    [15, 25, 20],       // 3 bricks
    [30, 30],           // 2 bricks
    [10, 20, 30],       // 3 bricks
    [25, 35],           // 2 bricks
    [20, 20, 20],       // 3 bricks
    [40, 20],           // 2 bricks
  ];

  rows.forEach((rowWidths, rowIndex) => {
    let x = startX;
    const y = startY + rowIndex * brickHeight + rowIndex; // +rowIndex for mortar gap

    rowWidths.forEach((width, colIndex) => {
      // More staggered delays - each brick waits longer
      const delay = (rowIndex * 4) + (colIndex * 8) + Math.floor(Math.random() * 5);

      bricks.push({
        id: id++,
        x,
        y,
        width,
        height: brickHeight,
        settled: false,
        scale: 0,
        delay,
        started: false,
      });

      x += width + 1; // 1px mortar gap
    });
  });

  return bricks;
}

export function PixelBrickLoader({ className, size = 100 }: PixelBrickLoaderProps) {
  const [bricks, setBricks] = useState<Brick[]>(() => createBricks());
  const [phase, setPhase] = useState<'building' | 'holding' | 'crumbling'>('building');
  const [tick, setTick] = useState(0);
  const [crumbleOffsets, setCrumbleOffsets] = useState<{ [id: number]: { y: number; rotation: number } }>({});

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);

      if (phase === 'building') {
        setBricks(prev => {
          const newBricks = prev.map(brick => {
            if (!brick.started && tick >= brick.delay) {
              return { ...brick, started: true };
            }
            if (!brick.started || brick.settled) return brick;

            const scaleSpeed = 0.15;
            const newScale = Math.min(brick.scale + scaleSpeed, 1);
            const settled = newScale >= 1;

            return { ...brick, scale: newScale, settled };
          });

          if (newBricks.every(b => b.settled)) {
            setTimeout(() => setPhase('holding'), 50);
          }

          return newBricks;
        });
      } else if (phase === 'holding') {
        setTimeout(() => {
          const offsets: { [id: number]: { y: number; rotation: number } } = {};
          bricks.forEach(b => {
            offsets[b.id] = { y: 0, rotation: 0 };
          });
          setCrumbleOffsets(offsets);
          setPhase('crumbling');
        }, 800);
      } else if (phase === 'crumbling') {
        setCrumbleOffsets(prev => {
          const newOffsets = { ...prev };
          let allFallen = true;

          Object.keys(newOffsets).forEach(id => {
            const numId = Number(id);
            const gravity = 3 + Math.random() * 3;
            newOffsets[numId] = {
              y: newOffsets[numId].y + gravity,
              rotation: newOffsets[numId].rotation + (Math.random() - 0.5) * 12,
            };
            if (newOffsets[numId].y < 100) {
              allFallen = false;
            }
          });

          if (allFallen) {
            setTimeout(() => {
              setBricks(createBricks());
              setCrumbleOffsets({});
              setTick(0);
              setPhase('building');
            }, 200);
          }

          return newOffsets;
        });
      }
    }, 50);

    return () => clearInterval(interval);
  }, [phase, bricks, tick]);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      shapeRendering="crispEdges"
    >
      {bricks.map(brick => {
        if (!brick.started && phase === 'building') return null;

        const offset = crumbleOffsets[brick.id] || { y: 0, rotation: 0 };
        const y = brick.y + offset.y;

        if (y > 110) return null;

        const centerX = brick.x + brick.width / 2;
        const centerY = y + brick.height / 2;
        const scale = phase === 'crumbling' ? 1 : brick.scale;

        // Scale from center of each brick
        const scaledWidth = brick.width * scale;
        const scaledHeight = brick.height * scale;
        const scaledX = brick.x + (brick.width - scaledWidth) / 2;
        const scaledY = y + (brick.height - scaledHeight) / 2;

        return (
          <rect
            key={brick.id}
            x={scaledX}
            y={scaledY}
            width={scaledWidth}
            height={scaledHeight}
            fill={BRICK_COLOR}
            transform={phase === 'crumbling' ? `rotate(${offset.rotation} ${centerX} ${centerY})` : undefined}
          />
        );
      })}
    </svg>
  );
}
