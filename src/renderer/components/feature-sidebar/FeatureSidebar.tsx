import { useEffect } from 'react';
import { Circle, Triangle, GitBranch } from 'lucide-react';
import { clsx } from 'clsx';
import { useTestStore } from '@/stores/testStore';

export function FeatureSidebar() {
  const { mode, setMode } = useTestStore();

  const items = [
    { id: 'home' as const, icon: Circle, label: 'Home', shortcut: '1' },
    { id: 'tests' as const, icon: Triangle, label: 'Tests', shortcut: '2' },
    { id: 'git' as const, icon: GitBranch, label: 'Git', shortcut: '3' },
  ];

  // Keyboard shortcuts: Cmd+1, Cmd+2, Cmd+3
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
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setMode]);

  return (
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
    </div>
  );
}
