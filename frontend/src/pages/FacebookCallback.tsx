import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components';
import { toAccount, useAuth } from '../auth/AuthContext';
import { consumeFacebookState } from '../auth/facebookLogin';
import { fetchMe, loginWithFacebook } from '../lib/api';

type Failure = 'cancelled' | 'failed';

const FAILURE_COPY: Record<Failure, { title: string; message: string }> = {
  cancelled: {
    title: 'Facebook sign-in cancelled',
    message: 'No problem — you can log in another way.',
  },
  failed: {
    title: "Facebook sign-in didn't work",
    message: 'Please try again, or log in another way.',
  },
};

// Where Facebook's login page sends the browser back to, with either a
// one-time `code` or an `error` (e.g. the person pressed Cancel).
export function FacebookCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [failure, setFailure] = useState<Failure | null>(null);
  // The code is single-use, so a second request (StrictMode re-running the
  // effect) would fail and could overwrite the first one's success.
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const stateMatches = consumeFacebookState(searchParams.get('state'));
    if (searchParams.get('error')) {
      setFailure('cancelled');
      return;
    }
    const code = searchParams.get('code');
    if (!code || !stateMatches) {
      setFailure('failed');
      return;
    }

    loginWithFacebook(code)
      .then(async (result) => {
        setSession(result.token, toAccount(await fetchMe(result.token)));
        // Dashboard itself decides whether to bounce to /onboarding.
        navigate('/dashboard', { replace: true });
      })
      .catch(() => setFailure('failed'));
  }, [searchParams, setSession, navigate]);

  if (!failure) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-3 px-8 py-24 text-center">
        <p className="text-lg text-text-secondary">Signing you in with Facebook…</p>
      </main>
    );
  }

  const { title, message } = FAILURE_COPY[failure];
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 px-8 py-24 text-center">
      <h1 className="text-2xl font-bold text-text-body">{title}</h1>
      <p className="text-base text-text-body">{message}</p>
      <Button size="lg" tone="blue" onClick={() => navigate('/login', { replace: true })}>
        Back to log in
      </Button>
    </main>
  );
}
