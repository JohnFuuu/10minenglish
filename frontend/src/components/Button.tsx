import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const base =
  'inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-primary text-text-inverse hover:bg-brand-primary-hover disabled:bg-brand-primary/40',
  secondary:
    'border-[1.5px] border-brand-primary bg-bg-surface text-brand-primary hover:bg-brand-primary/5 disabled:border-border disabled:text-text-secondary',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-1 text-xs',
  md: 'px-6 py-2 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={[base, variantClasses[variant], sizeClasses[size], className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}
