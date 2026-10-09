import { useState } from 'react';
import { Mail } from 'lucide-react';
import { Button, Input } from '../components';
import { ApiError, resendConfirmation, updateProfile } from '../lib/api';
import { useToast } from '../toast/ToastContext';
import { useAuth } from './AuthContext';

// Shown to a signed-in User without a confirmed email — as a Dashboard banner,
// and in place of Book Lesson / Buy Credits, which the backend refuses until
// they confirm. `action` finishes the sentence "Then you can …".
//
// Most such Users signed up with a password and just need to click the link
// already sent. A Facebook sign-up that shared no email has nowhere for that
// link to go, so they first add an address here (held as pending until its
// link is clicked — the same path as changing email on the Profile screen).
export function EmailConfirmationNotice({ action }: { action: string }) {
  const { account, token, refreshAccount } = useAuth();
  const { showToast } = useToast();
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [isChecking, setIsChecking] = useState(false);
  const [isChangingAddress, setIsChangingAddress] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  if (!account || !token) return null;

  // Where the confirmation link went (or will go).
  const linkAddress = account.email ?? account.pendingEmail;
  const needsAddress = !linkAddress || isChangingAddress;

  async function handleAddEmail(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setIsAdding(true);
    try {
      await updateProfile(token!, { email: newEmail });
      await refreshAccount();
      setIsChangingAddress(false);
      setResendStatus('idle');
    } catch (err) {
      setAddError(
        err instanceof ApiError && err.status === 409
          ? 'That email already has an account. Please log in with it instead.'
          : "We couldn't send a link to that address. Please check it and try again.",
      );
    } finally {
      setIsAdding(false);
    }
  }

  async function handleResend() {
    setResendStatus('sending');
    try {
      // An address still pending (never confirmed) isn't on the account yet,
      // so resubmitting it is what issues a fresh link.
      if (account!.email) await resendConfirmation(account!.email);
      else await updateProfile(token!, { email: account!.pendingEmail! });
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
          {needsAddress ? (
            <>
              <p className="text-lg font-bold text-text-body">Add your email</p>
              <p className="text-base text-text-body">
                We'll send your meeting links and reminders there. Then you can {action}.
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-text-body">Please confirm your email</p>
              <p className="text-base text-text-body">
                We sent a link to <span className="font-bold">{linkAddress}</span>. Tap it, then you can {action}.
              </p>
            </>
          )}
        </div>
      </div>

      {needsAddress ? (
        <form onSubmit={handleAddEmail} className="flex flex-col gap-3">
          <Input
            variant="filled"
            type="email"
            label="Email"
            placeholder="you@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />
          {addError && <p className="text-base font-bold text-error">{addError}</p>}
          <Button type="submit" tone="blue" disabled={isAdding}>
            {isAdding ? 'Sending…' : 'Send confirmation link'}
          </Button>
          {isChangingAddress && (
            <button
              type="button"
              onClick={() => setIsChangingAddress(false)}
              className="text-sm font-bold text-text-secondary"
            >
              Cancel
            </button>
          )}
        </form>
      ) : (
        <>
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
          {!account.email && (
            <button
              type="button"
              onClick={() => {
                setNewEmail('');
                setAddError(null);
                setIsChangingAddress(true);
              }}
              className="text-sm font-bold text-text-secondary"
            >
              Use a different email
            </button>
          )}
        </>
      )}
    </div>
  );
}
