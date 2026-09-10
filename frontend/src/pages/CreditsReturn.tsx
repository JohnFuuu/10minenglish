import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PartyPopper } from 'lucide-react';
import { Button } from '../components';
import { useAuth } from '../auth/AuthContext';
import { confirmPoliPayment, confirmStripePayment } from '../lib/api';

export function CreditsReturn() {
  const { token, setCredits } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState<'checking' | 'succeeded' | 'failed'>('checking');
  const [credits, setCreditsState] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    const provider = searchParams.get('provider');

    async function confirm() {
      try {
        if (provider === 'stripe') {
          const sessionId = searchParams.get('session_id');
          if (!sessionId) throw new Error('missing session_id');
          const result = await confirmStripePayment(token!, sessionId);
          if (result.status === 'succeeded' && result.credits !== undefined) {
            setCredits(result.credits);
            setCreditsState(result.credits);
            setStatus('succeeded');
          } else {
            setStatus('failed');
          }
        } else if (provider === 'poli') {
          const poliToken = searchParams.get('token');
          if (!poliToken) throw new Error('missing token');
          const result = await confirmPoliPayment(token!, poliToken);
          if (result.status === 'succeeded' && result.credits !== undefined) {
            setCredits(result.credits);
            setCreditsState(result.credits);
            setStatus('succeeded');
          } else {
            setStatus('failed');
          }
        } else {
          setStatus('failed');
        }
      } catch {
        setStatus('failed');
      }
    }

    confirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <main className="mx-auto flex max-w-sm flex-col items-center gap-3 px-8 py-24 text-center">
      {status === 'checking' && <p className="text-text-secondary">Confirming your payment…</p>}
      {status === 'succeeded' && (
        <>
          <PartyPopper size={56} className="text-brand-primary" />
          <h1 className="font-display text-2xl font-black text-brand-primary">Credits added!</h1>
          <p className="text-sm font-bold text-text-heading">New balance: {credits} credits</p>
        </>
      )}
      {status === 'failed' && (
        <>
          <h1 className="text-2xl font-bold text-text-body">Payment failed</h1>
          <p className="text-sm text-text-secondary">
            No credits were added. Pick a pack again, or try the other payment method.
          </p>
        </>
      )}

      {/* A failed payment goes back to Buy Credits, not the Dashboard: the point
          is to retry with another pack or provider without hunting for the
          screen again. */}
      {status === 'failed' ? (
        <Button onClick={() => navigate('/credits')}>Back to Buy Credits</Button>
      ) : (
        <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
      )}
    </main>
  );
}
