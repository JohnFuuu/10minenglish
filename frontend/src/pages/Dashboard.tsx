import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AdminDashboard } from './AdminDashboard';
import { BuddyDashboard } from './BuddyDashboard';
import { UserDashboard } from './UserDashboard';

export function Dashboard() {
  const { account } = useAuth();
  // RequireAuth (App.tsx) already guarantees a signed-in account by the time
  // this renders — this null check is just to satisfy the nullable type.
  if (!account) return null;
  if (!account.onboardingCompleted) return <Navigate to="/onboarding" replace />;

  switch (account.role) {
    case 'user':
      return <UserDashboard />;
    case 'buddy':
      return <BuddyDashboard />;
    case 'admin':
      return <AdminDashboard />;
    default:
      return <Navigate to="/login" replace />;
  }
}
