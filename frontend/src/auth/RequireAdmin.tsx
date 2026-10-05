import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

// For /admin/* tabs. Anyone else is sent to their own Dashboard — the
// backend refuses non-Admins regardless; this just avoids showing them an
// Admin screen full of failed requests.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { account, isLoading } = useAuth();

  if (isLoading) return null;
  if (!account) return <Navigate to="/login" replace />;
  if (account.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
