import { useEffect, useState } from 'react';

interface PixelGlobeOfDeathProps {
  className?: string;
  size?: number;
}

// Globe of Death - bikers riding in a spherical cage on a stand
export function PixelMotorcyclists({ className, size = 120 }: PixelGlobeOfDeathProps) {
  const [frame, setFrame] = useState(0);
  const totalFrames = 24;

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % totalFrames);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  // Sphere center and radius
  const cx = 60;
  const cy = 45;
  const radius = 32;

  // Biker positions - they ride along the inside of the sphere
  // Both complete exactly 1 full loop per animation cycle
  const angle1 = (frame / totalFrames) * Math.PI * 2;
  const angle2 = ((frame + totalFrames / 2) / totalFrames) * Math.PI * 2; // Offset by half, same speed

  // Biker 1 - horizontal loop
  const biker1X = cx + Math.cos(angle1) * (radius - 4);
  const biker1Y = cy + Math.sin(angle1) * (radius - 4);
  const biker1InFront = Math.sin(angle1) > 0;
  const biker1Scale = 0.8 + 0.4 * ((Math.sin(angle1) + 1) / 2);

  // Biker 2 - tilted loop (same speed, different plane)
  const tilt = 0.3;
  const biker2X = cx + Math.cos(angle2) * (radius - 5);
  const biker2Y = cy + Math.sin(angle2) * Math.cos(tilt) * (radius - 5) + Math.cos(angle2) * Math.sin(tilt) * 10;
  const biker2InFront = Math.sin(angle2) * Math.cos(tilt) + Math.cos(angle2) * Math.sin(tilt) * 0.3 > 0;
  const biker2Scale = 0.7 + 0.3 * ((Math.sin(angle2) + 1) / 2);

  return (
    <svg
      viewBox="0 0 120 100"
      width={size}
      height={size * (100 / 120)}
      className={className}
      shapeRendering="crispEdges"
    >
      {/* Bikers in back */}
      {!biker1InFront && (
        <g transform={`translate(${biker1X - 5}, ${biker1Y - 5}) scale(${biker1Scale})`} opacity={0.5}>
          <PixelBiker color="#3b82f6" flipped={Math.cos(angle1) < 0} />
        </g>
      )}
      {!biker2InFront && (
        <g transform={`translate(${biker2X - 5}, ${biker2Y - 5}) scale(${biker2Scale})`} opacity={0.5}>
          <PixelBiker color="#f59e0b" flipped={Math.cos(angle2 * 1.2) < 0} />
        </g>
      )}

      {/* Bikers in front */}
      {biker1InFront && (
        <g transform={`translate(${biker1X - 5}, ${biker1Y - 5}) scale(${biker1Scale})`}>
          <PixelBiker color="#3b82f6" flipped={Math.cos(angle1) < 0} />
        </g>
      )}
      {biker2InFront && (
        <g transform={`translate(${biker2X - 5}, ${biker2Y - 5}) scale(${biker2Scale})`}>
          <PixelBiker color="#f59e0b" flipped={Math.cos(angle2 * 1.2) < 0} />
        </g>
      )}

      {/* Motion trail lines for biker 1 */}
      <g>
        {[1, 2, 3, 4, 5, 6].map((i) => {
          const trailAngle = angle1 - i * 0.15;
          const prevAngle = angle1 - (i - 1) * 0.15;
          const tx1 = cx + Math.cos(prevAngle) * (radius - 4);
          const ty1 = cy + Math.sin(prevAngle) * (radius - 4);
          const tx2 = cx + Math.cos(trailAngle) * (radius - 4);
          const ty2 = cy + Math.sin(trailAngle) * (radius - 4);
          const inFront = Math.sin(trailAngle) > 0;
          const baseOpacity = inFront ? 0.8 : 0.3;
          return (
            <line
              key={`trail1-${i}`}
              x1={tx1}
              y1={ty1}
              x2={tx2}
              y2={ty2}
              stroke="#3b82f6"
              strokeWidth={3 - i * 0.4}
              strokeLinecap="round"
              opacity={baseOpacity * (1 - i / 7)}
            />
          );
        })}
      </g>

      {/* Motion trail lines for biker 2 */}
      <g>
        {[1, 2, 3, 4, 5, 6].map((i) => {
          const trailAngle = angle2 - i * 0.15;
          const prevAngle = angle2 - (i - 1) * 0.15;
          const tx1 = cx + Math.cos(prevAngle) * (radius - 5);
          const ty1 = cy + Math.sin(prevAngle) * Math.cos(tilt) * (radius - 5) + Math.cos(prevAngle) * Math.sin(tilt) * 10;
          const tx2 = cx + Math.cos(trailAngle) * (radius - 5);
          const ty2 = cy + Math.sin(trailAngle) * Math.cos(tilt) * (radius - 5) + Math.cos(trailAngle) * Math.sin(tilt) * 10;
          const inFront = Math.sin(trailAngle) * Math.cos(tilt) + Math.cos(trailAngle) * Math.sin(tilt) * 0.3 > 0;
          const baseOpacity = inFront ? 0.8 : 0.3;
          return (
            <line
              key={`trail2-${i}`}
              x1={tx1}
              y1={ty1}
              x2={tx2}
              y2={ty2}
              stroke="#f59e0b"
              strokeWidth={3 - i * 0.4}
              strokeLinecap="round"
              opacity={baseOpacity * (1 - i / 7)}
            />
          );
        })}
      </g>
    </svg>
  );
}

// Pixel art biker on motorcycle (10x10)
function PixelBiker({ color, flipped }: { color: string; flipped?: boolean }) {
  return (
    <g fill={color} transform={flipped ? 'scale(-1, 1) translate(-10, 0)' : undefined}>
      {/* Helmet */}
      <rect x="3" y="0" width="4" height="2" />
      <rect x="2" y="1" width="5" height="2" />
      {/* Visor */}
      <rect x="6" y="1" width="2" height="1" fill="#1f2937" />
      {/* Body leaning forward */}
      <rect x="4" y="3" width="3" height="2" />
      <rect x="5" y="5" width="3" height="2" />
      {/* Arms on handlebars */}
      <rect x="7" y="4" width="2" height="1" />
      {/* Motorcycle body */}
      <rect x="2" y="7" width="7" height="2" fill="#374151" />
      <rect x="1" y="6" width="2" height="2" fill="#374151" />
      {/* Engine */}
      <rect x="4" y="8" width="3" height="1" fill="#6b7280" />
      {/* Wheels */}
      <rect x="0" y="8" width="3" height="2" fill="#1f2937" />
      <rect x="7" y="8" width="3" height="2" fill="#1f2937" />
      {/* Wheel highlights */}
      <rect x="1" y="8" width="1" height="1" fill="#4b5563" />
      <rect x="8" y="8" width="1" height="1" fill="#4b5563" />
    </g>
  );
}
