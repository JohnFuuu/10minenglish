import { useState } from 'react';
import { Button } from '../../components';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import { awardMemberCredits, type AdminMember } from '../../lib/api';

// Matches the backend's cap on a single award (MAX_CREDIT_AWARD).
const MAX_AWARD = 100;
const FIELD = 'rounded-md border-2 border-border bg-bg-surface px-3 py-2 text-sm text-text-body';

// Part of an open Member list row: grant credits with a reason, behind an
// "are you sure?" step since credits are worth money.
export function AwardCreditsForm({ member, onAwarded }: { member: AdminMember; onAwarded: (updated: AdminMember) => void }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const credits = Number(amount);
  const valid = Number.isInteger(credits) && credits >= 1 && credits <= MAX_AWARD && reason.trim() !== '';
  const name = member.name ?? member.email ?? 'this member';
  const creditsLabel = `${credits} credit${credits === 1 ? '' : 's'}`;

  async function award() {
    if (!token) return;
    setBusy(true);
    try {
      const updated = await awardMemberCredits(token, member.id, credits, reason.trim());
      onAwarded(updated);
      showToast(`${creditsLabel} awarded to ${name}. Balance now ${updated.credits}.`, 'success');
      setAmount('');
      setReason('');
      setConfirming(false);
    } catch {
      showToast('Could not award those credits.', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-2 rounded-md bg-warning/10 px-2 py-2">
        <p className="text-sm font-bold text-text-body">
          Award {creditsLabel} to {name}? Their balance goes from {member.credits} to {member.credits + credits}.
        </p>
        <p className="text-xs text-text-secondary">Reason: {reason.trim()}</p>
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={award}>
            Award
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) setConfirming(true);
      }}
    >
      <div className="flex gap-2">
        <input
          aria-label="Credits to award"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_AWARD}
          step={1}
          placeholder="Credits"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`${FIELD} w-24 shrink-0`}
        />
        <input
          aria-label="Reason"
          placeholder="Reason (e.g. hardship grant)"
          maxLength={200}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={`${FIELD} min-w-0 flex-1`}
        />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={!valid}>
        Award credits
      </Button>
      <p className="text-xs text-text-secondary">Up to {MAX_AWARD} at a time. The member is notified and sees your reason, so word it for them.</p>
    </form>
  );
}
