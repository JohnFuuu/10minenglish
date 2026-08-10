import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components';

function StubShell({ title }: { title: string }) {
  const { logout } = useAuth();
  return (
    <main className="mx-auto max-w-3xl px-8 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{title}</h1>
        <Button variant="secondary" size="sm" onClick={logout}>
          Log out
        </Button>
      </div>
      <p className="text-text-secondary">
        Stub dashboard — built out in later tickets.
      </p>
    </main>
  );
}

export function Dashboard() {
  const { account } = useAuth();
  if (!account) return <Navigate to="/login" replace />;

  switch (account.role) {
    case 'user':
      return <StubShell title="User Dashboard" />;
    case 'buddy':
      return <StubShell title="Buddy Dashboard" />;
    case 'admin':
      return <StubShell title="Admin Dashboard" />;
    default:
      return <Navigate to="/login" replace />;
  }
}
