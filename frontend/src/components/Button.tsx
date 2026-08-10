import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

type ButtonVariant = 'primary' | 'secondary';
type ButtonSize = 'sm' | 'md';
// Green is the default brand tone (dashboard, in-app actions). Blue is used
// specifically for auth-flow CTAs, matching the exported AuthScreen pattern.
type ButtonTone = 'green' | 'blue';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  tone?: ButtonTone;
}

// "Pressable" style: depth comes from a thick bottom border, not a shadow.
// On press, the button shifts down and the bottom border thins out.
const base =
  'inline-flex items-center justify-center rounded-md font-bold uppercase tracking-wide transition-transform active:translate-y-0.5 disabled:cursor-not-allowed disabled:active:translate-y-0';

const variantToneClasses: Record<ButtonVariant, Record<ButtonTone, string>> = {
  primary: {
    green:
      'border-2 border-b-[3px] border-brand-primary-border bg-brand-primary text-text-inverse active:border-b active:border-brand-primary-border disabled:border-border disabled:bg-border disabled:text-text-secondary',
    blue: 'border-2 border-b-[3px] border-brand-secondary-border bg-brand-secondary text-text-inverse active:border-b active:border-brand-secondary-border disabled:border-border disabled:bg-border disabled:text-text-secondary',
  },
  secondary: {
    green:
      'border-2 border-b-[3px] border-accent-lime bg-bg-surface text-brand-primary active:border-b disabled:border-border disabled:text-text-secondary',
    blue: 'border-2 border-b-[3px] border-brand-secondary bg-bg-surface text-brand-secondary active:border-b disabled:border-border disabled:text-text-secondary',
  },
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  tone = 'green',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(base, variantToneClasses[variant][tone], sizeClasses[size], className)}
      {...props}
    />
  );
}
