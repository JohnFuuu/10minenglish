import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AdminDashboard } from './AdminDashboard';
import { BuddyDashboard } from './BuddyDashboard';
import { UserDashboard } from './UserDashboard';

export function Dashboard() {
  const { account, isLoading } = useAuth();
  if (isLoading) return null;
  if (!account) return <Navigate to="/login" replace />;
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
