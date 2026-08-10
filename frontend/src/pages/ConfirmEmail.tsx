import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { confirmEmail } from '../lib/api';

export function ConfirmEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'checking' | 'confirmed' | 'failed'>('checking');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('failed');
      return;
    }

    confirmEmail(token)
      .then(() => setStatus('confirmed'))
      .catch(() => setStatus('failed'));
  }, [searchParams]);

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-3 px-8 py-24 text-center">
      {status === 'checking' && <p className="text-text-secondary">Confirming your email…</p>}
      {status === 'confirmed' && (
        <>
          <h1 className="text-2xl font-bold">Email confirmed</h1>
          <p className="text-text-secondary">You can now log in.</p>
        </>
      )}
      {status === 'failed' && (
        <>
          <h1 className="text-2xl font-bold">Link invalid or expired</h1>
          <p className="text-text-secondary">Request a new confirmation email from the login page.</p>
        </>
      )}
      <Link to="/login" className="text-brand-primary">
        Back to login
      </Link>
    </main>
  );
}
