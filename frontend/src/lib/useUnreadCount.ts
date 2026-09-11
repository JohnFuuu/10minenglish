import { useEffect, useState } from 'react';
import { fetchNotifications } from './api';

// Every persistent-tab screen except NotificationsScreen itself (which
// already derives its own unread count from the full list it fetches) needs
// this just to feed BottomNav's badge — was the identical
// `useState(0)` + `useEffect` pair hand-copied into 8 files.
export function useUnreadCount(token: string | null): number {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    fetchNotifications(token).then((res) => setUnreadCount(res.unreadCount));
  }, [token]);

  return unreadCount;
}
