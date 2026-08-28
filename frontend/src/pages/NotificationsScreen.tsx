import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from '../components';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../toast/ToastContext';
import { ApiError, fetchNotifications, markNotificationRead, type AppNotification } from '../lib/api';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function NotificationsScreen() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchNotifications(token)
      .then((res) => setNotifications(res.notifications))
      .catch(() => showToast('Could not load your notifications.', 'error'))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return null;

  async function dismiss(notification: AppNotification) {
    if (notification.read) return;
    setDismissingId(notification.id);
    try {
      await markNotificationRead(token!, notification.id);
      setNotifications((current) =>
        current.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
      );
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
    <main className="mx-auto max-w-3xl px-8 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-body">Notifications</h1>
        <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>

      {isLoading && <p className="text-text-secondary">Loading your notifications…</p>}
      {!isLoading && notifications.length === 0 && (
        <p className="text-text-secondary">No notifications yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {notifications.map((notification) => (
          <Card key={notification.id} className={notification.read ? 'opacity-70' : undefined}>
            <p className="text-sm font-medium text-text-body">{notification.message}</p>
            <p className="mt-1 text-xs text-text-secondary">{formatDateTime(notification.createdAt)}</p>

            {!notification.read && notification.type === 'buddy_cancellation_refund' && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" tone="blue" disabled={dismissingId === notification.id} onClick={() => bookAgain(notification)}>
                  Book another session
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
                <Button variant="secondary" size="sm" disabled={dismissingId === notification.id} onClick={() => dismiss(notification)}>
                  Dismiss
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </main>
  );
}
