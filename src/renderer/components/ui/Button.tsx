import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-1',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          // Variants
          variant === 'primary' && 'bg-accent-primary text-white hover:bg-accent-secondary',
          variant === 'secondary' && 'bg-bg-tertiary text-text-primary hover:bg-bg-hover',
          variant === 'ghost' && 'bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary',
          variant === 'danger' && 'bg-accent-error text-white hover:opacity-90',
          // Sizes
          size === 'sm' && 'px-2 py-1 text-xs rounded-button',
          size === 'md' && 'px-3 py-1.5 text-sm rounded-button',
          size === 'lg' && 'px-4 py-2 text-base rounded-button',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
