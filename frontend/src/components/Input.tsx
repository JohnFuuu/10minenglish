import type { InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export function Input({ error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      <input
        className={cn(
          'w-full rounded-md border bg-bg-surface px-4 py-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-secondary',
          'focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15',
          'disabled:cursor-not-allowed disabled:bg-bg-page disabled:text-text-secondary',
          error ? 'border-error' : 'border-border',
          className,
        )}
        {...props}
      />
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  );
}
