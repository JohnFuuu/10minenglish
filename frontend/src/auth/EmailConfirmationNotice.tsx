import { useState } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '../components';
import { resendConfirmation } from '../lib/api';
import { useToast } from '../toast/ToastContext';
import { useAuth } from './AuthContext';

// Shown to a signed-in User who hasn't clicked their confirmation link yet —
// as a Dashboard banner, and in place of Book Lesson / Buy Credits, which the
// backend refuses until they confirm. `action` finishes the sentence
// "Then you can …".
export function EmailConfirmationNotice({ action }: { action: string }) {
  const { account, refreshAccount } = useAuth();
  const { showToast } = useToast();
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [isChecking, setIsChecking] = useState(false);

  if (!account) return null;

  async function handleResend() {
    setResendStatus('sending');
    try {
      await resendConfirmation(account!.email);
      setResendStatus('sent');
    } catch {
      setResendStatus('idle');
      showToast('Could not send the email. Please try again.', 'error');
    }
  }

  // Clicking the link signs them in wherever it opens — often a different
  // tab or browser — so this tab needs a nudge to notice.
  async function handleCheckAgain() {
    setIsChecking(true);
    try {
      await refreshAccount();
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border-2 border-b-4 border-warning bg-bg-surface p-4">
      <div className="flex items-start gap-3">
        <Mail size={28} className="mt-0.5 shrink-0 text-warning" />
        <div className="flex flex-col gap-1">
          <p className="text-lg font-bold text-text-body">Please confirm your email</p>
          <p className="text-base text-text-body">
            We sent a link to <span className="font-bold">{account.email}</span>. Tap it, then you can {action}.
          </p>
        </div>
      </div>

      {resendStatus === 'sent' ? (
        <p className="text-base font-bold text-success">New email sent — check your inbox.</p>
      ) : (
        <Button variant="secondary" tone="blue" onClick={handleResend} disabled={resendStatus === 'sending'}>
          Send the email again
        </Button>
      )}
      <button
        type="button"
        onClick={handleCheckAgain}
        disabled={isChecking}
        className="text-sm font-bold text-brand-secondary"
      >
        I've confirmed it — check again
      </button>
    </div>
  );
}
