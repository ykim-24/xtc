import { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react';

interface ImageViewerProps {
  filePath: string;
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.avif'];

// Map extensions to MIME types
const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
};

export function isImageFile(filePath: string): boolean {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
  return IMAGE_EXTENSIONS.includes(ext);
}

export function ImageViewer({ filePath }: ImageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [initialZoom, setInitialZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false); // True after smart zoom is calculated
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  // Pan state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [initialPan, setInitialPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Reset state when file changes
    setZoom(1);
    setInitialZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setError(null);
    setDimensions(null);
    setIsLoading(true);
    setIsReady(false);
    setImageUrl(null);

    // Load image as base64
    const loadImage = async () => {
      try {
        // Check if the API exists
        if (!window.electron?.readImageFile) {
          setError('Image loading not available - restart the app');
          setIsLoading(false);
          return;
        }

        const result = await window.electron.readImageFile(filePath);
        console.log('Image load result:', result?.success, result?.error);

        if (result?.success && result.data) {
          const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'));
          const mimeType = MIME_TYPES[ext] || 'image/png';
          setImageUrl(`data:${mimeType};base64,${result.data}`);
        } else {
          setError(result?.error || 'Failed to load image');
        }
      } catch (err) {
        console.error('Image load error:', err);
        setError(`Failed to load image: ${err}`);
      }
      setIsLoading(false);
    };

    loadImage();
  }, [filePath]);

  const handleZoomIn = () => setZoom(z => Math.min(5, z + 0.25));
  const handleZoomOut = () => setZoom(z => Math.max(0.1, z - 0.25));
  const handleRotate = () => setRotation(r => (r + 90) % 360);
  const handleReset = () => {
    setZoom(initialZoom);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.min(Math.max(0.1, z + delta), 5));
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
    setInitialPan({ ...pan });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    setPan({
      x: initialPan.x + dx,
      y: initialPan.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    setDimensions({ width: imgWidth, height: imgHeight });

    // Calculate smart zoom to fit image in container
    const container = containerRef.current;
    if (container) {
      const containerWidth = container.clientWidth - 32; // padding
      const containerHeight = container.clientHeight - 32;

      // Calculate zoom to fit
      const zoomToFitWidth = containerWidth / imgWidth;
      const zoomToFitHeight = containerHeight / imgHeight;
      let smartZoom = Math.min(zoomToFitWidth, zoomToFitHeight);

      // Clamp between 0.1 and 1 (don't zoom in by default, only zoom out if needed)
      smartZoom = Math.min(1, Math.max(0.1, smartZoom));

      // Round to nice value
      smartZoom = Math.round(smartZoom * 100) / 100;

      setZoom(smartZoom);
      setInitialZoom(smartZoom);
    }
    // Mark as ready after smart zoom is set
    setIsReady(true);
  };

  const handleImageError = () => {
    setError('Failed to load image');
  };

  const fileName = filePath.split('/').pop() || filePath;

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-primary bg-bg-secondary">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-text-primary">{fileName}</span>
          {dimensions && (
            <span className="text-xs text-text-muted">
              {dimensions.width} × {dimensions.height}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-text-muted w-12 text-center font-mono">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-border-primary mx-1" />
          <button
            onClick={handleRotate}
            className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            title="Rotate"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
            title="Reset view"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-hidden flex items-center justify-center p-4 bg-[#1a1a2e] ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {error ? (
          <div className="text-red-400 text-sm">{error}</div>
        ) : isLoading ? (
          <div className="text-text-muted text-sm">Loading...</div>
        ) : imageUrl ? (
          <div
            className={`${isPanning || !isReady ? '' : 'transition-transform duration-100'} ${isReady ? 'opacity-100' : 'opacity-0'}`}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            }}
          >
            <img
              src={imageUrl}
              alt={fileName}
              onLoad={handleImageLoad}
              onError={handleImageError}
              className="max-w-none"
              style={{
                imageRendering: zoom > 2 ? 'pixelated' : 'auto',
              }}
              draggable={false}
            />
          </div>
        ) : null}
      </div>

      {/* Footer info */}
      <div className="px-4 py-1 border-t border-border-primary bg-bg-secondary text-xs text-text-muted font-mono flex justify-between">
        <span className="truncate">{filePath}</span>
        <span className="text-text-muted/50 ml-4 flex-shrink-0">Scroll to zoom • Drag to pan</span>
      </div>
    </div>
  );
}
