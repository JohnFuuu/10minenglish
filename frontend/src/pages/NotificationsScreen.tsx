import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellOff } from 'lucide-react';
import { BottomNav, Button, NAV_CLEARANCE_CLASS } from '../components';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../toast/ToastContext';
import { ApiError, fetchNotifications, markNotificationRead, type AppNotification } from '../lib/api';
import { formatDateTime } from '../lib/formatDateTime';
import { readSessionCache, writeSessionCache } from '../lib/sessionCache';

const NOTIFICATIONS_CACHE_KEY = '10me.cache.notifications';

// Cartoon icon tile per real notification type (backend/src/models/Notification.ts).
const TYPE_CONFIG: Record<string, { bg: string; icon: React.ReactNode }> = {
  lesson_reminder: {
    bg: '#fff3cd',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" fill="#ff9600" />
        <circle cx="12" cy="12" r="7" fill="#ffffff" />
        <line x1="12" y1="12" x2="12" y2="7" stroke="#ff9600" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="12" y1="12" x2="16" y2="14" stroke="#ff9600" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="12" cy="12" r="1.2" fill="#ff9600" />
      </svg>
    ),
  },
  lesson_rescheduled: {
    bg: '#d7ffb8',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="16" rx="3" fill="#58cc02" />
        <rect x="3" y="5" width="18" height="6" rx="3" fill="#46a302" />
        <rect x="8" y="3" width="2.5" height="4" rx="1.2" fill="#3c3c3c" />
        <rect x="13.5" y="3" width="2.5" height="4" rx="1.2" fill="#3c3c3c" />
        <polyline points="8,15 11,18 16,12" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  buddy_cancellation_refund: {
    bg: '#fee2e2',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" fill="#ff4b4b" />
        <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="15.5" y1="8.5" x2="8.5" y2="15.5" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
  },
};

const DEFAULT_TYPE_CONFIG = {
  bg: '#f0f0f0',
  icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" fill="#afafaf" />
      <circle cx="12" cy="8" r="1.2" fill="#ffffff" />
      <rect x="11" y="11" width="2" height="6" rx="1" fill="#ffffff" />
    </svg>
  ),
};

// Module-level cache (not React state), seeded from sessionStorage, so
// re-entering this screen — via BottomNav or a hard page reload — shows the
// last known list immediately instead of flashing back to a loading state.
// Refetched silently in the background.
let notificationsCache: AppNotification[] | null = readSessionCache<AppNotification[]>(
  NOTIFICATIONS_CACHE_KEY,
);
function setNotificationsCache(next: AppNotification[]) {
  notificationsCache = next;
  writeSessionCache(NOTIFICATIONS_CACHE_KEY, next);
}

export function NotificationsScreen() {
  const { token, account } = useAuth();
  // BottomNav renders the right tab set for User/Buddy on its own and
  // renders nothing for Admin (no tab set of its own) — so Admin needs an
  // explicit way back, same as before it had a bottom nav to rely on.
  const showBottomNav = account?.role === 'user' || account?.role === 'buddy';
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AppNotification[]>(notificationsCache ?? []);
  const [isLoading, setIsLoading] = useState(notificationsCache === null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchNotifications(token)
      .then((res) => {
        setNotificationsCache(res.notifications);
        setNotifications(res.notifications);
      })
      .catch(() => showToast('Could not load your notifications.', 'error'))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function dismiss(notification: AppNotification) {
    if (notification.read) return;
    setDismissingId(notification.id);
    try {
      await markNotificationRead(token!, notification.id);
      setNotifications((current) => {
        const next = current.map((n) => (n.id === notification.id ? { ...n, read: true } : n));
        setNotificationsCache(next);
        return next;
      });
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not update this notification.', 'error');
    } finally {
      setDismissingId(null);
    }
  }

  async function bookAgain(notification: AppNotification) {
    await dismiss(notification);
    navigate('/book');
  }

  return (
    <main className={`mx-auto max-w-3xl ${showBottomNav ? NAV_CLEARANCE_CLASS : ''}`}>
      <div className="flex items-center justify-between px-5 pb-2 pt-8">
        <h1 className="font-display text-2xl font-black text-text-heading">
          {unreadCount > 0 ? `Alerts (${unreadCount})` : 'Alerts'}
        </h1>
        {!showBottomNav && (
          <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2 px-5">
        {isLoading && <p className="text-text-secondary">Loading your notifications…</p>}

        {!isLoading && notifications.length === 0 && (
          <div className="py-16 text-center">
            <BellOff size={40} className="mx-auto mb-3 text-text-secondary" />
            <p className="text-sm font-bold uppercase tracking-widest text-text-secondary">All caught up!</p>
          </div>
        )}

        {!isLoading &&
          notifications.map((notification) => {
            const cfg = TYPE_CONFIG[notification.type] ?? DEFAULT_TYPE_CONFIG;
            return (
              <div
                key={notification.id}
                className={
                  notification.read
                    ? 'rounded-md border-2 border-b-[3px] border-border bg-bg-surface p-4'
                    : 'rounded-md border-2 border-b-[3px] border-accent-lime bg-success-bg/40 p-4'
                }
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border-2 border-border"
                    style={{ background: cfg.bg }}
                  >
                    {cfg.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold leading-snug text-text-body">{notification.message}</p>
                      {!notification.read && (
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-primary" />
                      )}
                    </div>
                    <p className="mt-1.5 text-xs font-bold uppercase tracking-widest text-text-secondary">
                      {formatDateTime(notification.createdAt)}
                    </p>

                    {!notification.read && notification.type === 'buddy_cancellation_refund' && (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" disabled={dismissingId === notification.id} onClick={() => bookAgain(notification)}>
                          Book another lesson
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={dismissingId === notification.id}
                          onClick={() => dismiss(notification)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    )}

                    {!notification.read && notification.type !== 'buddy_cancellation_refund' && (
                      <div className="mt-3">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={dismissingId === notification.id}
                          onClick={() => dismiss(notification)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {showBottomNav && <BottomNav unreadCount={unreadCount} />}
    </main>
  );
}
