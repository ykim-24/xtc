import { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={clsx(
          'w-full px-3 py-1.5 text-sm',
          'bg-bg-tertiary text-text-primary placeholder:text-text-muted',
          'border border-border-primary rounded-input',
          'focus:outline-none focus:ring-1 focus:ring-accent-primary focus:border-accent-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
