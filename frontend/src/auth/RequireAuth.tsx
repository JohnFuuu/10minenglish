import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

// Every protected route goes through here instead of each page checking
// `token`/`account` itself — several pages (Lessons, Notifications,
// BookLesson) used to just render null when signed out, leaving a blank
// page instead of sending the visitor to /login.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { account, isLoading } = useAuth();

  if (isLoading) return null;
  if (!account) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
