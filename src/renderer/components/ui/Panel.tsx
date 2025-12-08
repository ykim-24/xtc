import { HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  actions?: React.ReactNode;
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ className, title, collapsible, collapsed, onToggleCollapse, actions, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'flex flex-col bg-bg-secondary border-border-primary',
          className
        )}
        {...props}
      >
        {title && (
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-secondary">
            <button
              className={clsx(
                'text-xs font-semibold uppercase tracking-wider text-text-secondary',
                collapsible && 'cursor-pointer hover:text-text-primary'
              )}
              onClick={collapsible ? onToggleCollapse : undefined}
            >
              {title}
            </button>
            {actions && <div className="flex items-center gap-1">{actions}</div>}
          </div>
        )}
        {!collapsed && <div className="flex-1 overflow-auto">{children}</div>}
      </div>
    );
  }
);

Panel.displayName = 'Panel';
