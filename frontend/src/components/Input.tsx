import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';

type InputVariant = 'bordered' | 'filled';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  variant?: InputVariant;
  right?: ReactNode;
  // Visible field title, rendered above the input and properly associated
  // via htmlFor/id — unlike a placeholder, it stays put once the user
  // starts typing. Falls back to a generated id if the caller doesn't pass
  // one of their own.
  label?: string;
}

const variantClasses: Record<InputVariant, string> = {
  // Default — used on card/dashboard-style forms.
  bordered: 'border-2 bg-bg-surface',
  // Used on the auth screens (signup/login/forgot-password), matching the
  // exported AuthScreen pattern: no visible border, filled gray background.
  filled: 'border-0 bg-[#f0f0f0]',
};

export const FIELD_LABEL_CLASS = 'text-xs font-bold uppercase tracking-wide text-text-secondary';

export function Input({ error, variant = 'bordered', right, label, id, className = '', ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className={FIELD_LABEL_CLASS}>
          {label}
        </label>
      )}
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
          id={inputId}
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
