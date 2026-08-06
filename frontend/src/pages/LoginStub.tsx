import { useNavigate } from 'react-router-dom';
import { Button } from '../components';
import { useAuth, type AccountRole } from '../auth/AuthContext';

// Placeholder until ticket #3 (signup/login) replaces this with real auth.
export function LoginStub() {
  const { login } = useAuth();
  const navigate = useNavigate();

  function handleLogin(role: AccountRole) {
    login(role);
    navigate('/dashboard');
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col items-center gap-4 px-8 py-24 text-center">
      <h1 className="text-2xl font-bold">10ME</h1>
      <p className="text-text-secondary">
        Real signup/login isn't built yet (ticket #3) — pick a role to preview
        the role-based dashboard routing.
      </p>
      <div className="flex w-full flex-col gap-2">
        <Button onClick={() => handleLogin('user')}>Continue as User</Button>
        <Button variant="secondary" onClick={() => handleLogin('buddy')}>
          Continue as Buddy
        </Button>
        <Button variant="secondary" onClick={() => handleLogin('admin')}>
          Continue as Admin
        </Button>
      </div>
    </main>
  );
}
