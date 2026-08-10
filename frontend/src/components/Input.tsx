import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

type InputVariant = 'bordered' | 'filled';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  variant?: InputVariant;
  right?: ReactNode;
}

const variantClasses: Record<InputVariant, string> = {
  // Default — used on card/dashboard-style forms.
  bordered: 'border-2 bg-bg-surface',
  // Used on the auth screens (signup/login/forgot-password), matching the
  // exported AuthScreen pattern: no visible border, filled gray background.
  filled: 'border-0 bg-[#f0f0f0]',
};

export function Input({ error, variant = 'bordered', right, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          'flex items-center gap-2 rounded-md px-4 transition-colors',
          variant === 'filled' ? 'h-14' : '',
          variantClasses[variant],
          variant === 'bordered' && (error ? 'border-error' : 'border-border'),
          variant === 'bordered' && 'focus-within:border-brand-secondary',
        )}
      >
        <input
          className={cn(
            'w-full flex-1 bg-transparent py-3 text-sm font-medium text-text-body outline-none placeholder:text-text-secondary',
            className,
          )}
          {...props}
        />
        {right}
      </div>
      {error && <span className="text-xs font-bold text-error">{error}</span>}
    </div>
  );
}
