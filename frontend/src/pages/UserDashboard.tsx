import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, NavItem } from '../components';
import { fetchNotifications } from '../lib/api';

export function UserDashboard() {
  const { account, logout, token } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    fetchNotifications(token).then((res) => setUnreadCount(res.unreadCount));
  }, [token]);

  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-body">Dashboard</h1>
        <Button variant="secondary" size="sm" onClick={logout}>
          Log out
        </Button>
      </div>

      <NavItem
        label="Notifications"
        badge={unreadCount > 0 ? <Badge count={unreadCount} /> : undefined}
        onClick={() => navigate('/notifications')}
        className="mb-6"
      />

      <div className="mb-6 flex items-center justify-between rounded-md border-2 border-b-[5px] border-brand-primary-border bg-brand-primary p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-accent-lime-light">Your credits</p>
          <p className="font-display text-4xl font-black text-text-inverse">{account?.credits ?? 0}</p>
          <p className="text-xs font-bold text-accent-lime-light">lessons available</p>
        </div>
        <Button onClick={() => navigate('/credits')}>Buy Credits</Button>
      </div>

      <Button
        size="md"
        tone="blue"
        className="mb-6 w-full"
        onClick={() => navigate((account?.credits ?? 0) > 0 ? '/book' : '/credits')}
      >
        Book a Lesson
      </Button>

      <Button variant="secondary" size="md" className="mb-6 w-full" onClick={() => navigate('/lessons')}>
        My Lessons
      </Button>

      <Button variant="secondary" size="md" className="mb-6 w-full" onClick={() => navigate('/profile')}>
        My Profile
      </Button>

      <p className="text-text-secondary">More of the Dashboard — buddies directory — built out in later tickets.</p>
    </main>
  );
}
