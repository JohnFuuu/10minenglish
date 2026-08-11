import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components';

export function UserDashboard() {
  const { account, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-body">Dashboard</h1>
        <Button variant="secondary" size="sm" onClick={logout}>
          Log out
        </Button>
      </div>

      <div className="mb-6 flex items-center justify-between rounded-md border-2 border-b-[5px] border-brand-primary-border bg-brand-primary p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-accent-lime-light">Your credits</p>
          <p className="font-display text-4xl font-black text-text-inverse">{account?.credits ?? 0}</p>
          <p className="text-xs font-bold text-accent-lime-light">lessons available</p>
        </div>
        <Button onClick={() => navigate('/credits')}>Buy Credits</Button>
      </div>

      <p className="text-text-secondary">More of the Dashboard — booking, lessons, buddies — built out in later tickets.</p>
    </main>
  );
}
