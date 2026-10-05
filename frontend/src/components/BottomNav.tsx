import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const ACTIVE = '#58cc02';
const INACTIVE = '#777777';

interface NavTab {
  path: string;
  label: string;
  icon: (active: boolean) => ReactNode;
}

const HOME_ICON = (active: boolean) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const BUDDIES_ICON = (active: boolean) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const LESSONS_ICON = (active: boolean) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const AVAILABILITY_ICON = (active: boolean) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15.5 14" />
  </svg>
);

const PROFILE_ICON = (active: boolean) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const TAGS_ICON = (active: boolean) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const BUDDY_ROSTER_ICON = (active: boolean) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <polyline points="17 11 19 13 23 9" />
  </svg>
);

const PRICING_ICON = (active: boolean) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const AUDIT_ICON = (active: boolean) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="13" y2="16" />
  </svg>
);

const USER_TABS: NavTab[] = [
  { path: '/dashboard', label: 'HOME', icon: HOME_ICON },
  { path: '/buddies', label: 'BUDDIES', icon: BUDDIES_ICON },
  { path: '/lessons', label: 'LESSONS', icon: LESSONS_ICON },
  { path: '/profile', label: 'PROFILE', icon: PROFILE_ICON },
];

const BUDDY_TABS: NavTab[] = [
  { path: '/dashboard', label: 'HOME', icon: HOME_ICON },
  { path: '/teaching', label: 'TEACHING', icon: LESSONS_ICON },
  { path: '/availability', label: 'AVAILABILITY', icon: AVAILABILITY_ICON },
  { path: '/profile', label: 'PROFILE', icon: PROFILE_ICON },
];

// Grouped by job: finding/tagging members (home), managing the tag list,
// Buddy accounts, Credit Pack prices, and the history of Admin changes.
const ADMIN_TABS: NavTab[] = [
  { path: '/dashboard', label: 'MEMBERS', icon: BUDDIES_ICON },
  { path: '/admin/tags', label: 'TAGS', icon: TAGS_ICON },
  { path: '/admin/buddies', label: 'BUDDIES', icon: BUDDY_ROSTER_ICON },
  { path: '/admin/pricing', label: 'PRICING', icon: PRICING_ICON },
  { path: '/admin/audit', label: 'AUDIT LOG', icon: AUDIT_ICON },
];

const TABS_BY_ROLE: Record<string, NavTab[]> = { user: USER_TABS, buddy: BUDDY_TABS, admin: ADMIN_TABS };

// Persistent tab bar, shared across the signed-in screens it appears on.
// Pages that render this need bottom padding (see NAV_CLEARANCE_CLASS) so
// their own content doesn't sit underneath the fixed bar.
export const NAV_CLEARANCE_CLASS = 'pb-24';

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { account } = useAuth();

  const tabs = account ? TABS_BY_ROLE[account.role] : undefined;
  if (!tabs) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-border bg-bg-surface pb-[env(safe-area-inset-bottom,12px)]">
      <div className="mx-auto flex max-w-3xl items-center justify-around px-2 pt-2">
        {tabs.map((tab) => {
          const active = location.pathname.startsWith(tab.path);
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => navigate(tab.path)}
              className="relative flex flex-col items-center gap-0.5 px-2 py-1"
            >
              <span className="relative flex">{tab.icon(active)}</span>
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
