import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center rounded transition-colors',
          'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
          'focus:outline-none focus:ring-2 focus:ring-accent-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          size === 'sm' && 'p-1',
          size === 'md' && 'p-1.5',
          size === 'lg' && 'p-2',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
