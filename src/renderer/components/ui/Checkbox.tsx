import { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, checked, ...props }, ref) => {
    return (
      <label className={clsx('inline-flex items-center gap-2 cursor-pointer', className)}>
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            checked={checked}
            className="sr-only peer"
            {...props}
          />
          <div
            className={clsx(
              'w-4 h-4 rounded border transition-colors',
              'border-border-primary bg-bg-tertiary',
              'peer-checked:bg-accent-primary peer-checked:border-accent-primary',
              'peer-focus:ring-2 peer-focus:ring-accent-primary peer-focus:ring-offset-1'
            )}
          >
            {checked && (
              <Check className="w-3 h-3 text-white absolute top-0.5 left-0.5" />
            )}
          </div>
        </div>
        {label && <span className="text-sm text-text-primary">{label}</span>}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
