import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge } from './Badge';

const ACTIVE = '#58cc02';
const INACTIVE = '#777777';

interface NavTab {
  path: string;
  label: string;
  icon: (active: boolean) => ReactNode;
}

const TABS: NavTab[] = [
  {
    path: '/dashboard',
    label: 'HOME',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    path: '/buddies',
    label: 'BUDDIES',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    path: '/lessons',
    label: 'LESSONS',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    path: '/notifications',
    label: 'ALERTS',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    path: '/profile',
    label: 'PROFILE',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

interface BottomNavProps {
  unreadCount?: number;
}

// Persistent tab bar, shared across the signed-in User screens it appears on.
// Pages that render this need bottom padding (see NAV_CLEARANCE_CLASS) so
// their own content doesn't sit underneath the fixed bar.
export const NAV_CLEARANCE_CLASS = 'pb-24';

export function BottomNav({ unreadCount = 0 }: BottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-border bg-bg-surface pb-[env(safe-area-inset-bottom,12px)]">
      <div className="mx-auto flex max-w-3xl items-center justify-around px-2 pt-2">
        {TABS.map((tab) => {
          const active = location.pathname.startsWith(tab.path);
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => navigate(tab.path)}
              className="relative flex flex-col items-center gap-0.5 px-2 py-1"
            >
              <span className="relative flex">
                {tab.icon(active)}
                {tab.path === '/notifications' && unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2">
                    <Badge count={unreadCount} />
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] font-bold tracking-widest ${active ? 'text-brand-primary' : 'text-text-secondary'}`}
              >
                {tab.label}
              </span>
              {active && <span className="absolute bottom-0 h-0.5 w-5 rounded-full bg-brand-primary" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
