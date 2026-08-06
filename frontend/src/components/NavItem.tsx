import type { ReactNode } from 'react';

interface NavItemProps {
  label: string;
  active?: boolean;
  badge?: ReactNode;
  onClick?: () => void;
}

export function NavItem({ label, active = false, badge, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex w-full items-center justify-between rounded-md px-4 py-3 text-sm font-medium transition-colors',
        active
          ? 'bg-brand-primary/10 text-brand-primary'
          : 'text-text-secondary hover:bg-bg-page',
      ].join(' ')}
    >
      <span>{label}</span>
      {badge}
    </button>
  );
}
