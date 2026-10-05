import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../components';
import { useAuth } from '../auth/AuthContext';

// The first screen a visitor sees. Many Users are older and arrive without
// an account (or a Google login), so instead of landing on Log in with a
// small "Sign up" link at the bottom, they get one obvious choice up front.
export function Welcome() {
  const { account, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) return null;
  if (account) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex h-[45vh] min-h-[280px] items-center justify-center bg-bg-surface px-10 py-6">
        <img src="/logo.png" alt="10 Minute English" className="h-full w-full object-contain" />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-4 px-5 pb-10">
        <Button size="lg" onClick={() => navigate('/signup')}>
          I'm new here
        </Button>
        <Button size="lg" variant="secondary" tone="blue" onClick={() => navigate('/login')}>
          I have an account
        </Button>
      </div>
    </div>
  );
}
