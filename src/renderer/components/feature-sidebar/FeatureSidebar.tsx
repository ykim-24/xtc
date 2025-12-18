import { useEffect, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { useTestStore } from '@/stores/testStore';
import { AddFeatureModal } from './AddFeatureModal';
import { PixelHome, PixelTests, PixelGit, PixelPlus, PixelLinear, PixelTree, PixelCpu } from './PixelIcons';

type SidebarMode = 'home' | 'tests' | 'git' | 'linear' | 'worktrees' | 'processes';

interface SidebarItem {
  id: SidebarMode;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut: string;
}

const baseItems: SidebarItem[] = [
  { id: 'home', icon: PixelHome, label: 'Home', shortcut: '1' },
  { id: 'tests', icon: PixelTests, label: 'Tests', shortcut: '2' },
  { id: 'git', icon: PixelGit, label: 'Git', shortcut: '3' },
  { id: 'worktrees', icon: PixelTree, label: 'Worktrees', shortcut: '4' },
  { id: 'processes', icon: PixelCpu, label: 'Processes', shortcut: '6' },
];

export function FeatureSidebar() {
  const { mode, setMode } = useTestStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connectedIntegrations, setConnectedIntegrations] = useState<Set<string>>(new Set());

  const loadIntegrations = useCallback(async () => {
    const connected = new Set<string>();

    // Check Linear
    const linearKey = await window.electron?.store.get('linear_api_key');
    if (linearKey?.success && linearKey.data) {
      connected.add('linear');
    }

    setConnectedIntegrations(connected);
  }, []);

  // Load integrations on mount
  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  // Build items list with connected integrations
  const items: SidebarItem[] = [
    ...baseItems,
    ...(connectedIntegrations.has('linear') ? [{ id: 'linear' as SidebarMode, icon: PixelLinear, label: 'Linear', shortcut: '5' }] : []),
  ];

  // Keyboard shortcuts: Cmd+1, Cmd+2, Cmd+3, Cmd+4, Cmd+5, Cmd+6
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        const key = e.key;
        if (key === '1') {
          e.preventDefault();
          setMode('home');
        } else if (key === '2') {
          e.preventDefault();
          setMode('tests');
        } else if (key === '3') {
          e.preventDefault();
          setMode('git');
        } else if (key === '4') {
          e.preventDefault();
          setMode('worktrees');
        } else if (key === '5' && connectedIntegrations.has('linear')) {
          e.preventDefault();
          setMode('linear');
        } else if (key === '6') {
          e.preventDefault();
          setMode('processes');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setMode, connectedIntegrations]);

  const handleIntegrationChange = () => {
    loadIntegrations();
  };

  return (
    <>
      <div className="flex flex-col items-center py-2 bg-bg-secondary border-r border-border-primary w-12">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = mode === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setMode(item.id)}
              className={clsx(
                'w-10 h-10 flex items-center justify-center rounded mb-1 transition-colors',
                isActive
                  ? 'bg-bg-active text-accent-primary'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              )}
              title={`${item.label} (⌘${item.shortcut})`}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}

        {/* Spacer to push + button to bottom */}
        <div className="flex-1" />

        {/* Add Feature Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded mb-1 transition-colors text-text-secondary hover:bg-bg-hover hover:text-text-primary"
          title="Add Feature"
        >
          <PixelPlus className="w-5 h-5" />
        </button>
      </div>

      <AddFeatureModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onIntegrationChange={handleIntegrationChange}
      />
    </>
  );
}
