import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

interface NavItemProps {
  label: string;
  active?: boolean;
  badge?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function NavItem({ label, active = false, badge, onClick, className = '' }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-md px-4 py-3 text-xs font-bold uppercase tracking-wide transition-colors',
        active ? 'text-brand-primary' : 'text-text-secondary hover:text-text-body',
        className,
      )}
    >
      <span>{label}</span>
      {badge}
    </button>
  );
}
