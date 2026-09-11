import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

interface PageHeaderProps {
  title: ReactNode;
  right?: ReactNode;
  // Most pages' <main> carries no padding of its own, so the header
  // supplies px-5 pb-2 pt-8 by default. A few pages (Profile, Availability)
  // already put padding on <main> itself — those pass their own vertical-only
  // spacing here instead of double-padding horizontally.
  className?: string;
}

// Every persistent-tab screen (Buddies/Lessons/Alerts/Profile, on both the
// User and Buddy side) leads with this so the brand mark shows up
// consistently, not just on the Dashboard.
export function PageHeader({ title, right, className = 'px-5 pb-2 pt-8' }: PageHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-2">
        <img src="/logo.png" alt="" className="h-11 w-11 shrink-0" />
        <h1 className="truncate font-display text-2xl font-black text-text-heading">{title}</h1>
      </div>
      {right}
    </div>
  );
}
