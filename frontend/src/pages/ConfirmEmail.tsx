import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components';
import { toAccount, useAuth } from '../auth/AuthContext';
import { useToast } from '../toast/ToastContext';
import { confirmEmail, fetchMe } from '../lib/api';

export function ConfirmEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { account, setSession } = useAuth();
  const { showToast } = useToast();
  const [failed, setFailed] = useState(false);
  // The token is single-use, so a second request (StrictMode re-running the
  // effect) would fail and could overwrite the first one's success.
  const requestedToken = useRef<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setFailed(true);
      return;
    }
    if (requestedToken.current === token) return;
    requestedToken.current = token;

    // Confirming also signs them in — the link often opens in a different
    // browser from the one they signed up in — and lands them on the
    // Dashboard, ready to book or top up.
    confirmEmail(token)
      .then(async (result) => {
        setSession(result.token, toAccount(await fetchMe(result.token)));
        showToast('Email confirmed! You can now book lessons and buy credits.', 'success');
        navigate('/dashboard', { replace: true });
      })
      .catch(() => setFailed(true));
  }, [searchParams, setSession, showToast, navigate]);

  if (!failed) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-3 px-8 py-24 text-center">
        <p className="text-lg text-text-secondary">Confirming your email…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 px-8 py-24 text-center">
      <h1 className="text-2xl font-bold text-text-body">This link has expired</h1>
      <p className="text-base text-text-body">
        {account
          ? 'Go to your Dashboard to send yourself a new confirmation email.'
          : 'Log in, then send yourself a new confirmation email from your Dashboard.'}
      </p>
      <Button tone="blue" onClick={() => navigate(account ? '/dashboard' : '/login')}>
        {account ? 'Go to Dashboard' : 'Log in'}
      </Button>
    </main>
  );
}
