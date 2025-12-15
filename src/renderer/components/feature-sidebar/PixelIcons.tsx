// 8-bit pixel art style icons for the feature sidebar

interface PixelIconProps {
  className?: string;
}

// Home icon - pixelated hollow circle
export function PixelHome({ className }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges">
      {/* Top arc */}
      <rect x="5" y="0" width="6" height="2" />
      <rect x="3" y="1" width="2" height="2" />
      <rect x="11" y="1" width="2" height="2" />
      <rect x="2" y="2" width="2" height="2" />
      <rect x="12" y="2" width="2" height="2" />
      {/* Left side */}
      <rect x="1" y="3" width="2" height="2" />
      <rect x="0" y="5" width="2" height="6" />
      <rect x="1" y="11" width="2" height="2" />
      {/* Right side */}
      <rect x="13" y="3" width="2" height="2" />
      <rect x="14" y="5" width="2" height="6" />
      <rect x="13" y="11" width="2" height="2" />
      {/* Bottom arc */}
      <rect x="2" y="12" width="2" height="2" />
      <rect x="12" y="12" width="2" height="2" />
      <rect x="3" y="13" width="2" height="2" />
      <rect x="11" y="13" width="2" height="2" />
      <rect x="5" y="14" width="6" height="2" />
    </svg>
  );
}

// Tests icon - pixel art flask/beaker
export function PixelTests({ className }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges">
      {/* Flask top */}
      <rect x="6" y="1" width="4" height="1" />
      <rect x="6" y="2" width="4" height="1" />
      <rect x="7" y="3" width="2" height="1" />
      <rect x="7" y="4" width="2" height="1" />
      {/* Flask body expanding */}
      <rect x="6" y="5" width="4" height="1" />
      <rect x="5" y="6" width="6" height="1" />
      <rect x="4" y="7" width="8" height="1" />
      <rect x="3" y="8" width="10" height="1" />
      <rect x="3" y="9" width="10" height="1" />
      {/* Liquid */}
      <rect x="3" y="10" width="10" height="1" />
      <rect x="3" y="11" width="10" height="1" />
      <rect x="4" y="12" width="8" height="1" />
      <rect x="5" y="13" width="6" height="1" />
      {/* Bubbles */}
      <rect x="5" y="10" width="1" height="1" fillOpacity="0.5" />
      <rect x="9" y="11" width="1" height="1" fillOpacity="0.5" />
      <rect x="7" y="9" width="1" height="1" fillOpacity="0.5" />
    </svg>
  );
}

// Git icon - pixel art branch with clear nodes
export function PixelGit({ className }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges">
      {/* Main vertical line */}
      <rect x="5" y="3" width="2" height="11" />

      {/* Top circle node */}
      <rect x="4" y="1" width="4" height="1" />
      <rect x="3" y="2" width="6" height="2" />
      <rect x="4" y="4" width="4" height="1" />

      {/* Branch line going right */}
      <rect x="7" y="7" width="3" height="2" />

      {/* Branch circle node (right) */}
      <rect x="10" y="6" width="4" height="1" />
      <rect x="9" y="7" width="6" height="2" />
      <rect x="10" y="9" width="4" height="1" />

      {/* Bottom circle node */}
      <rect x="4" y="11" width="4" height="1" />
      <rect x="3" y="12" width="6" height="2" />
      <rect x="4" y="14" width="4" height="1" />
    </svg>
  );
}

// Plus icon - pixel art plus sign
export function PixelPlus({ className }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges">
      {/* Vertical bar */}
      <rect x="7" y="3" width="2" height="10" />
      {/* Horizontal bar */}
      <rect x="3" y="7" width="10" height="2" />
    </svg>
  );
}

// Jest icon - pixel art jester hat with bells
export function PixelJest({ className }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges">
      {/* Left bell */}
      <rect x="0" y="0" width="2" height="2" />
      {/* Right bell */}
      <rect x="14" y="0" width="2" height="2" />
      {/* Middle bell */}
      <rect x="7" y="1" width="2" height="2" />

      {/* Left prong */}
      <rect x="1" y="2" width="2" height="3" />
      <rect x="2" y="5" width="2" height="2" />

      {/* Right prong */}
      <rect x="13" y="2" width="2" height="3" />
      <rect x="12" y="5" width="2" height="2" />

      {/* Middle prong */}
      <rect x="7" y="3" width="2" height="2" />
      <rect x="6" y="5" width="4" height="2" />

      {/* Hat base / headband */}
      <rect x="3" y="7" width="10" height="2" />

      {/* Face area */}
      <rect x="4" y="9" width="8" height="5" />

      {/* Eyes */}
      <rect x="5" y="10" width="2" height="2" fillOpacity="0" />
      <rect x="9" y="10" width="2" height="2" fillOpacity="0" />

      {/* Smile */}
      <rect x="6" y="13" width="4" height="1" fillOpacity="0" />
    </svg>
  );
}

// Playwright icon - pixel art theater masks (comedy/tragedy)
export function PixelPlaywright({ className }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} shapeRendering="crispEdges">
      {/* Happy mask (left, front) - built with individual rows to leave eye holes */}
      <g fill="currentColor">
        {/* Top of mask */}
        <rect x="1" y="1" width="6" height="1" />
        <rect x="0" y="2" width="8" height="1" />
        <rect x="0" y="3" width="8" height="1" />
        {/* Row with eyes - leave gaps */}
        <rect x="0" y="4" width="1" height="2" />
        <rect x="3" y="4" width="2" height="2" />
        <rect x="7" y="4" width="1" height="2" />
        {/* Row with smile */}
        <rect x="0" y="6" width="2" height="1" />
        <rect x="3" y="6" width="2" height="1" />
        <rect x="6" y="6" width="2" height="1" />
        {/* Bottom with smile curve */}
        <rect x="0" y="7" width="3" height="1" />
        <rect x="5" y="7" width="3" height="1" />
        <rect x="1" y="8" width="6" height="1" />
        <rect x="2" y="9" width="4" height="1" />

        {/* Sad mask (right, behind) - built with rows to leave eye holes */}
        {/* Top of mask */}
        <rect x="9" y="5" width="6" height="1" />
        <rect x="8" y="6" width="8" height="1" />
        <rect x="8" y="7" width="8" height="1" />
        {/* Row with eyes - leave gaps */}
        <rect x="8" y="8" width="1" height="2" />
        <rect x="11" y="8" width="2" height="2" />
        <rect x="15" y="8" width="1" height="2" />
        {/* Row with frown */}
        <rect x="8" y="10" width="2" height="1" />
        <rect x="14" y="10" width="2" height="1" />
        {/* Bottom with frown curve */}
        <rect x="8" y="11" width="3" height="1" />
        <rect x="13" y="11" width="3" height="1" />
        <rect x="9" y="12" width="6" height="1" />
        <rect x="10" y="13" width="4" height="1" />
      </g>
    </svg>
  );
}

// Vitest icon - pixel art lightning bolt / V
export function PixelVitest({ className }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges">
      {/* V shape with lightning */}
      <rect x="1" y="1" width="2" height="2" />
      <rect x="2" y="3" width="2" height="2" />
      <rect x="3" y="5" width="2" height="2" />
      <rect x="4" y="7" width="2" height="2" />
      <rect x="5" y="9" width="2" height="2" />
      <rect x="6" y="11" width="2" height="2" />
      <rect x="7" y="13" width="2" height="2" />
      {/* Right side of V */}
      <rect x="13" y="1" width="2" height="2" />
      <rect x="12" y="3" width="2" height="2" />
      <rect x="11" y="5" width="2" height="2" />
      <rect x="10" y="7" width="2" height="2" />
      <rect x="9" y="9" width="2" height="2" />
      <rect x="8" y="11" width="2" height="2" />
    </svg>
  );
}

// Mocha icon - pixel art coffee cup
export function PixelMocha({ className }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges">
      {/* Steam */}
      <rect x="4" y="1" width="1" height="1" />
      <rect x="5" y="2" width="1" height="1" />
      <rect x="7" y="1" width="1" height="1" />
      <rect x="8" y="2" width="1" height="1" />
      <rect x="10" y="1" width="1" height="1" />
      <rect x="11" y="2" width="1" height="1" />
      {/* Cup rim */}
      <rect x="2" y="4" width="10" height="1" />
      {/* Cup body */}
      <rect x="2" y="5" width="10" height="1" />
      <rect x="2" y="6" width="10" height="1" />
      <rect x="2" y="7" width="10" height="1" />
      <rect x="2" y="8" width="10" height="1" />
      <rect x="2" y="9" width="10" height="1" />
      <rect x="3" y="10" width="8" height="1" />
      <rect x="3" y="11" width="8" height="1" />
      <rect x="4" y="12" width="6" height="1" />
      {/* Handle */}
      <rect x="12" y="5" width="2" height="1" />
      <rect x="13" y="6" width="2" height="1" />
      <rect x="13" y="7" width="2" height="1" />
      <rect x="13" y="8" width="2" height="1" />
      <rect x="12" y="9" width="2" height="1" />
    </svg>
  );
}

// Cypress icon - pixel art cypress tree / C
export function PixelCypress({ className }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges">
      {/* C shape */}
      <rect x="5" y="1" width="8" height="2" />
      <rect x="3" y="2" width="4" height="2" />
      <rect x="2" y="4" width="3" height="2" />
      <rect x="1" y="6" width="3" height="4" />
      <rect x="2" y="10" width="3" height="2" />
      <rect x="3" y="12" width="4" height="2" />
      <rect x="5" y="13" width="8" height="2" />
      {/* Inner curve cutout - using background */}
      <rect x="5" y="5" width="6" height="6" fillOpacity="0" />
    </svg>
  );
}

// Tree icon - pixel art tree with cloud-like foliage (3 connected circles)
export function PixelTree({ className }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges">
      {/* Cloud-like foliage made of 3 overlapping circles */}

      {/* Left ball */}
      <rect x="1" y="2" width="2" height="1" />
      <rect x="0" y="3" width="4" height="3" />
      <rect x="1" y="6" width="2" height="1" />

      {/* Right ball */}
      <rect x="11" y="2" width="2" height="1" />
      <rect x="10" y="3" width="4" height="3" />
      <rect x="11" y="6" width="2" height="1" />

      {/* Center ball (overlapping, slightly higher) */}
      <rect x="5" y="0" width="4" height="1" />
      <rect x="4" y="1" width="6" height="4" />
      <rect x="5" y="5" width="4" height="1" />

      {/* Fill in gaps between circles to make connected cloud shape */}
      <rect x="3" y="3" width="2" height="3" />
      <rect x="9" y="3" width="2" height="3" />

      {/* Trunk - flared wider at bottom, thicker at top */}
      <rect x="5" y="6" width="4" height="2" />
      <rect x="5" y="8" width="4" height="2" />
      <rect x="4" y="10" width="6" height="2" />

      {/* Roots spreading out */}
      <rect x="2" y="12" width="3" height="2" />
      <rect x="9" y="12" width="3" height="2" />
      <rect x="4" y="12" width="6" height="2" />
      <rect x="1" y="14" width="2" height="1" />
      <rect x="11" y="14" width="2" height="1" />
    </svg>
  );
}

// Linear icon - circle with 3 diagonal lines (top-left to bottom-right)
export function PixelLinear({ className }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges">
      {/* Circular border */}
      <rect x="5" y="0" width="6" height="1" />
      <rect x="3" y="1" width="2" height="1" />
      <rect x="11" y="1" width="2" height="1" />
      <rect x="2" y="2" width="1" height="1" />
      <rect x="13" y="2" width="1" height="1" />
      <rect x="1" y="3" width="1" height="2" />
      <rect x="14" y="3" width="1" height="2" />
      <rect x="0" y="5" width="1" height="6" />
      <rect x="15" y="5" width="1" height="6" />
      <rect x="1" y="11" width="1" height="2" />
      <rect x="14" y="11" width="1" height="2" />
      <rect x="2" y="13" width="1" height="1" />
      <rect x="13" y="13" width="1" height="1" />
      <rect x="3" y="14" width="2" height="1" />
      <rect x="11" y="14" width="2" height="1" />
      <rect x="5" y="15" width="6" height="1" />

      {/* 3 diagonal lines - top-left to bottom-right, starting from bottom */}
      {/* Line 1 (bottom-left, shortest) */}
      <rect x="2" y="10" width="2" height="2" />
      <rect x="4" y="12" width="2" height="2" />

      {/* Line 2 (middle) */}
      <rect x="2" y="6" width="2" height="2" />
      <rect x="4" y="8" width="2" height="2" />
      <rect x="6" y="10" width="2" height="2" />
      <rect x="8" y="12" width="2" height="2" />

      {/* Line 3 (top-right, longest) */}
      <rect x="4" y="2" width="2" height="2" />
      <rect x="6" y="4" width="2" height="2" />
      <rect x="8" y="6" width="2" height="2" />
      <rect x="10" y="8" width="2" height="2" />
      <rect x="12" y="10" width="2" height="2" />
    </svg>
  );
}

// Datadog icon - simplified dog face
export function PixelDatadog({ className }: PixelIconProps) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" shapeRendering="crispEdges">
      {/* Dog head outline */}
      <rect x="4" y="1" width="8" height="1" />
      <rect x="3" y="2" width="1" height="1" />
      <rect x="12" y="2" width="1" height="1" />
      <rect x="2" y="3" width="1" height="3" />
      <rect x="13" y="3" width="1" height="3" />

      {/* Ears */}
      <rect x="1" y="4" width="1" height="3" />
      <rect x="14" y="4" width="1" height="3" />
      <rect x="0" y="5" width="1" height="2" />
      <rect x="15" y="5" width="1" height="2" />

      {/* Face sides */}
      <rect x="2" y="6" width="1" height="4" />
      <rect x="13" y="6" width="1" height="4" />

      {/* Eyes */}
      <rect x="5" y="5" width="2" height="2" />
      <rect x="9" y="5" width="2" height="2" />

      {/* Snout */}
      <rect x="6" y="8" width="4" height="1" />
      <rect x="5" y="9" width="6" height="1" />
      <rect x="7" y="10" width="2" height="1" />

      {/* Nose */}
      <rect x="7" y="7" width="2" height="1" />

      {/* Bottom of face */}
      <rect x="3" y="10" width="2" height="1" />
      <rect x="11" y="10" width="2" height="1" />
      <rect x="4" y="11" width="8" height="1" />

      {/* Chin/neck */}
      <rect x="5" y="12" width="6" height="1" />
      <rect x="6" y="13" width="4" height="1" />
    </svg>
  );
}
