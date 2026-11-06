import { useEffect, useState } from 'react';
import { fetchNotifications } from './api';

// The bell badge's count. Returns the setter too, so the Messages pop-up can
// keep the badge in step as messages are read or deleted.
export function useUnreadCount(token: string | null): [number, (count: number) => void] {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    fetchNotifications(token).then((res) => setUnreadCount(res.unreadCount));
  }, [token]);

  return [unreadCount, setUnreadCount];
}
