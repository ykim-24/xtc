import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Settings, RefreshCw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { WorktreeNode, WorktreeStatus } from './WorktreeNode';
import { WorktreeNodePanel } from './WorktreeNodePanel';
import { useProjectStore, useTestStore } from '@/stores';
import { useWorktreeStore } from '@/stores/worktreeStore';
import { PixelTree } from '@/components/feature-sidebar/PixelIcons';

interface Worktree {
  path: string;
  branch: string;
  isMain: boolean;
  isCurrent: boolean;
  mergeBase?: string; // The branch this was created from
}

interface GraphNode {
  id: string;
  worktree: Worktree;
  x: number;
  y: number;
  parentId?: string;
}

interface GraphEdge {
  from: string;
  to: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

type LayoutDirection = 'vertical' | 'horizontal';

const NODE_WIDTH = 128;
const NODE_HEIGHT = 128;
const NODE_GAP_X = 100;
const NODE_GAP_Y = 120;

export function WorktreeGraph() {
  const { projectPath } = useProjectStore();
  const { mode } = useTestStore();
  const { sessions, getSessionStatus } = useWorktreeStore();
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutDirection>('vertical');
  const [showSettings, setShowSettings] = useState(false);
  const lastModeRef = useRef(mode);

  // Pan and zoom state
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [initialPan, setInitialPan] = useState({ x: 0, y: 0 });

  const loadWorktrees = useCallback(async (silent = false) => {
    if (!projectPath) return;

    if (!silent) {
      setIsLoading(true);
    }
    try {
      const result = await window.electron?.git.worktree.list(projectPath);

      if (result?.success && result.worktrees) {
        // Mark which one is current
        const mapped = result.worktrees.map(w => ({
          ...w,
          isCurrent: w.path === projectPath,
        }));

        setWorktrees(mapped);
      }
    } catch (error) {
      console.error('Failed to load worktrees:', error);
    }
    if (!silent) {
      setIsLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    loadWorktrees();
  }, [loadWorktrees]);

  // Refresh when switching to worktrees tab (silent - no loading state)
  useEffect(() => {
    if (mode === 'worktrees' && lastModeRef.current !== 'worktrees') {
      loadWorktrees(true); // Silent refresh
    }
    lastModeRef.current = mode;
  }, [mode, loadWorktrees]);

  // Build graph layout
  const { nodes, edges } = useMemo(() => {
    if (worktrees.length === 0) {
      return { nodes: [], edges: [] };
    }

    const graphNodes: GraphNode[] = [];
    const graphEdges: GraphEdge[] = [];

    // Find main worktree
    const mainWorktree = worktrees.find(w => w.isMain);
    const otherWorktrees = worktrees.filter(w => !w.isMain);

    // Position main node at top center (or left for horizontal)
    if (mainWorktree) {
      const mainNode: GraphNode = {
        id: mainWorktree.path,
        worktree: mainWorktree,
        x: layout === 'vertical' ? 0 : 0,
        y: layout === 'vertical' ? 0 : 0,
      };
      graphNodes.push(mainNode);

      // Position other worktrees below (or to the right for horizontal)
      otherWorktrees.forEach((wt, index) => {
        const offset = index - (otherWorktrees.length - 1) / 2;

        const node: GraphNode = {
          id: wt.path,
          worktree: wt,
          x: layout === 'vertical'
            ? offset * (NODE_WIDTH + NODE_GAP_X)
            : NODE_WIDTH + NODE_GAP_X,
          y: layout === 'vertical'
            ? NODE_HEIGHT + NODE_GAP_Y
            : offset * (NODE_HEIGHT + NODE_GAP_Y),
          parentId: mainWorktree.path,
        };
        graphNodes.push(node);

        // Create edge from main to this node
        graphEdges.push({
          from: mainWorktree.path,
          to: wt.path,
          // Vertical: connect from bottom-center to top-center
          // Horizontal: connect from right-center to left-center
          fromX: layout === 'vertical'
            ? mainNode.x + NODE_WIDTH / 2
            : mainNode.x + NODE_WIDTH,
          fromY: layout === 'vertical'
            ? mainNode.y + NODE_HEIGHT
            : mainNode.y + NODE_HEIGHT / 2,
          toX: layout === 'vertical'
            ? node.x + NODE_WIDTH / 2
            : node.x,
          toY: layout === 'vertical'
            ? node.y
            : node.y + NODE_HEIGHT / 2,
        });
      });
    }

    return { nodes: graphNodes, edges: graphEdges };
  }, [worktrees, layout]);

  // Calculate graph dimensions
  const graphBounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };

    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);

    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs) + NODE_WIDTH;
    const maxY = Math.max(...ys) + NODE_HEIGHT;

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [nodes]);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start panning if clicking on empty space (not a node)
    if ((e.target as HTMLElement).closest('.worktree-node-container')) return;

    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
    setInitialPan({ ...pan });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning) return;

    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;

    setPan({
      x: initialPan.x + dx,
      y: initialPan.y + dy,
    });
  }, [isPanning, panStart, initialPan]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Zoom handlers
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.min(Math.max(0.25, z + delta), 2));
  }, []);

  const handleZoomIn = () => setZoom(z => Math.min(2, z + 0.25));
  const handleZoomOut = () => setZoom(z => Math.max(0.25, z - 0.25));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Attach mouse event listeners
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Attach wheel listener to container using callback ref pattern
  // This ensures the listener is attached when the element is available
  const wheelListenerRef = useRef<HTMLDivElement | null>(null);

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    // Remove listener from previous node
    if (wheelListenerRef.current) {
      wheelListenerRef.current.removeEventListener('wheel', handleWheel);
    }

    // Update refs
    containerRef.current = node;
    wheelListenerRef.current = node;

    // Add listener to new node
    if (node) {
      node.addEventListener('wheel', handleWheel, { passive: false });
    }
  }, [handleWheel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wheelListenerRef.current) {
        wheelListenerRef.current.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleWheel]);

  const handleNodeClick = (nodeId: string) => {
    setSelectedNodeId(selectedNodeId === nodeId ? null : nodeId);
  };

  const selectedWorktree = worktrees.find(w => w.path === selectedNodeId);

  if (!projectPath) {
    return (
      <div className="h-full flex items-center justify-center bg-bg-primary">
        <div className="text-center text-text-muted">
          <PixelTree className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-sm">Open a project to view worktrees</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary bg-bg-secondary">
        <div className="flex items-center gap-3">
          <PixelTree className="w-5 h-5 text-green-400" />
          <span className="text-sm font-medium text-text-primary">Worktree Graph</span>
          <span className="text-xs text-text-muted px-2 py-0.5 bg-bg-tertiary rounded">
            {worktrees.length} worktree{worktrees.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadWorktrees}
            className="text-xs font-mono text-text-muted hover:text-text-primary transition-colors"
            disabled={isLoading}
          >
            {isLoading ? '[ ... ]' : '[ refresh ]'}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded hover:bg-bg-hover transition-colors ${showSettings ? 'text-accent-primary' : 'text-text-muted hover:text-text-primary'}`}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings dropdown */}
      {showSettings && (
        <div className="px-4 py-2 border-b border-border-primary bg-bg-secondary/50 flex items-center gap-4">
          <span className="text-xs text-text-muted">Layout:</span>
          <button
            onClick={() => setLayout('vertical')}
            className={`text-xs font-mono ${layout === 'vertical' ? 'text-accent-primary' : 'text-text-secondary hover:text-text-primary'}`}
          >
            [ vertical ]
          </button>
          <button
            onClick={() => setLayout('horizontal')}
            className={`text-xs font-mono ${layout === 'horizontal' ? 'text-accent-primary' : 'text-text-secondary hover:text-text-primary'}`}
          >
            [ horizontal ]
          </button>
        </div>
      )}

      {/* Graph area */}
      <div
        ref={setContainerRef}
        className={`flex-1 overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
      >
        {isLoading && worktrees.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="w-6 h-6 text-text-muted animate-spin" />
          </div>
        ) : worktrees.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-text-muted">
              <p className="text-sm">No worktrees found</p>
              <p className="text-xs mt-1">This repo only has the main worktree</p>
            </div>
          </div>
        ) : (
          <div
            className="relative w-full h-full"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isPanning ? 'none' : 'transform 0.1s ease-out',
            }}
          >
            {/* Center the graph */}
            <div
              className="absolute"
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className="relative"
                style={{
                  width: graphBounds.width + 100,
                  height: graphBounds.height + 100,
                }}
              >
                {/* SVG for edges */}
                <svg
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    width: graphBounds.width + 100,
                    height: graphBounds.height + 100,
                  }}
                >
                  {edges.map((edge, i) => {
                    const offsetX = 50 - graphBounds.minX;
                    const offsetY = 50 - graphBounds.minY;

                    const x1 = edge.fromX + offsetX;
                    const y1 = edge.fromY + offsetY;
                    const x2 = edge.toX + offsetX;
                    const y2 = edge.toY + offsetY;

                    // Create a 90-degree angled path (L-shaped)
                    const midY = (y1 + y2) / 2;
                    const midX = (x1 + x2) / 2;

                    return (
                      <path
                        key={i}
                        d={layout === 'vertical'
                          ? `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`
                          : `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`
                        }
                        fill="none"
                        stroke="var(--color-border-secondary, #4b5563)"
                        strokeWidth="2"
                        strokeDasharray="6 4"
                      />
                    );
                  })}
                </svg>

                {/* Nodes */}
                {nodes.map((node) => {
                  const offsetX = 50 - graphBounds.minX;
                  const offsetY = 50 - graphBounds.minY;
                  const session = sessions[node.worktree.path];
                  const status: WorktreeStatus = session ? getSessionStatus(node.worktree.path) : 'idle';

                  return (
                    <div
                      key={node.id}
                      className="absolute worktree-node-container"
                      style={{
                        left: node.x + offsetX,
                        top: node.y + offsetY,
                      }}
                    >
                      <WorktreeNode
                        id={node.id}
                        branch={node.worktree.branch}
                        path={node.worktree.path}
                        isMain={node.worktree.isMain}
                        isCurrent={node.worktree.isCurrent}
                        status={status}
                        isSelected={selectedNodeId === node.id}
                        onClick={() => handleNodeClick(node.id)}
                        linearTicket={session?.linearTicket}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Help text - hidden when detail panel is open */}
      {!selectedWorktree && (
        <div className="absolute bottom-4 left-4 text-[10px] text-text-muted pointer-events-none">
          Scroll to zoom • Drag to pan • Click node for details
        </div>
      )}

      {/* Map controls - fixed bottom right (hidden when detail panel open) */}
      <div className={`absolute bottom-4 right-4 flex flex-col rounded-lg bg-bg-secondary border border-border-primary overflow-hidden shadow-lg transition-opacity ${selectedWorktree ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <button
          onClick={handleZoomIn}
          className="w-9 h-9 hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors flex items-center justify-center"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="h-px bg-border-primary" />
        <div className="w-9 h-7 text-[10px] text-text-muted flex items-center justify-center font-mono">
          {Math.round(zoom * 100)}%
        </div>
        <div className="h-px bg-border-primary" />
        <button
          onClick={handleZoomOut}
          className="w-9 h-9 hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors flex items-center justify-center"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="h-px bg-border-primary" />
        <button
          onClick={handleResetView}
          className="w-9 h-9 hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors flex items-center justify-center"
          title="Reset view"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Node detail panel */}
      {selectedWorktree && (
        <WorktreeNodePanel
          worktree={selectedWorktree}
          onClose={() => setSelectedNodeId(null)}
          onDeleted={() => {
            setSelectedNodeId(null);
            loadWorktrees();
          }}
        />
      )}
    </div>
  );
}
