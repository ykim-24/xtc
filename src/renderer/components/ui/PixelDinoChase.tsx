import dinoGif from '@/assets/dino.gif';

interface PixelDinoChaseProps {
  className?: string;
  size?: number;
}

export function PixelDinoChase({ className, size = 120 }: PixelDinoChaseProps) {
  return (
    <img
      src={dinoGif}
      alt="Loading..."
      width={size}
      className={className}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
