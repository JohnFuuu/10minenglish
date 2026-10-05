import { useCallback, useEffect, useState } from 'react';
import { HelpCircle, Trash2 } from 'lucide-react';
import { Button } from '../../components';
import { SectionHeading } from './SectionHeading';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import { fetchAdminBuddies, removeBuddy, setBuddyActive, type AdminBuddy } from '../../lib/api';

export function BuddyRoster({ refreshKey }: { refreshKey: number }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [buddies, setBuddies] = useState<AdminBuddy[]>([]);
  // Which row is asking "are you sure?", and about what — one at a time.
  const [confirming, setConfirming] = useState<{ id: string; action: 'deactivate' | 'remove' } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!showHelp) return;
    const closeOnEscape = (e: KeyboardEvent) => e.key === 'Escape' && setShowHelp(false);
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [showHelp]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetchAdminBuddies(token);
      setBuddies(res.buddies);
    } catch {
      showToast('Could not load the buddy list.', 'error');
    }
  }, [token, showToast]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function toggle(buddy: AdminBuddy) {
    if (!token) return;
    setBusyId(buddy.id);
    try {
      const updated = await setBuddyActive(token, buddy.id, !buddy.active);
      setBuddies((prev) =>
        prev.map((b) =>
          b.id === buddy.id ? { ...b, active: updated.active, upcomingLessons: updated.active ? b.upcomingLessons : 0 } : b,
        ),
      );
      setConfirming(null);
      showToast(
        updated.active
          ? `${buddy.name ?? buddy.email} is bookable again.`
          : `${buddy.name ?? buddy.email} deactivated — ${updated.cancelledLessons} upcoming lesson(s) cancelled and refunded.`,
        'success',
      );
    } catch {
      showToast('Could not update that buddy.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(buddy: AdminBuddy) {
    if (!token) return;
    setBusyId(buddy.id);
    try {
      const { cancelledLessons } = await removeBuddy(token, buddy.id);
      setBuddies((prev) => prev.filter((b) => b.id !== buddy.id));
      setConfirming(null);
      showToast(
        cancelledLessons === 0
          ? `${buddy.name ?? buddy.email} removed.`
          : `${buddy.name ?? buddy.email} removed. ${cancelledLessons} upcoming lesson(s) cancelled and refunded.`,
        'success',
      );
    } catch {
      showToast('Could not remove that buddy.', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center gap-1.5">
        <SectionHeading className="mb-0">Buddy roster</SectionHeading>
        <button
          type="button"
          aria-label="What's the difference between Deactivate and Remove?"
          aria-expanded={showHelp}
          aria-controls="buddy-roster-help"
          onClick={() => setShowHelp((open) => !open)}
          className={`flex h-7 w-7 items-center justify-center rounded-full ${showHelp ? 'text-brand-secondary' : 'text-text-secondary'}`}
        >
          <HelpCircle size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Two actions that look alike but differ in how final they are —
          explained on demand rather than always taking up space. */}
      {showHelp && (
        <div
          id="buddy-roster-help"
          className="mb-4 flex flex-col gap-1 rounded-md bg-brand-secondary/10 px-3 py-2 text-sm font-medium text-text-body"
        >
          <p>
            <span className="font-bold">Deactivate</span> pauses a Buddy (e.g. on holiday): their upcoming lessons are
            cancelled and refunded, but they can still sign in, and you can reactivate them any time.
          </p>
          <p>
            <span className="font-bold">Remove</span> is for a Buddy who has left for good: they also lose access and
            leave this list, while past lessons keep their name.
          </p>
        </div>
      )}

      {buddies.length === 0 && <p className="text-sm text-text-secondary">No buddies yet.</p>}

      {/* One compact panel with divider rows (not a card per Buddy), so a
          long roster stays scannable. */}
      {buddies.length > 0 && (
        <ul className="divide-y-2 divide-border overflow-hidden rounded-md border-2 border-b-4 border-border-strong bg-bg-surface">
          {buddies.map((buddy) => (
            <li key={buddy.id} className="px-4 py-2.5">
              {confirming?.id === buddy.id ? (
                // Both actions cancel and refund every upcoming Lesson (removal
                // also locks the Buddy out for good), so the prompt says
                // exactly what will happen before anything does.
                <div className="flex flex-col gap-2 rounded-md bg-warning/10 px-2 py-2">
                  <p className="text-sm font-bold text-text-body">
                    {confirming.action === 'remove'
                      ? `Remove ${buddy.name ?? buddy.email}? They'll lose access, and `
                      : `Deactivate ${buddy.name ?? buddy.email}? `}
                    {buddy.upcomingLessons === 0
                      ? confirming.action === 'remove'
                        ? 'they have no upcoming lessons.'
                        : 'They have no upcoming lessons.'
                      : `${confirming.action === 'remove' ? 'their' : 'Their'} ${buddy.upcomingLessons} upcoming lesson${buddy.upcomingLessons === 1 ? '' : 's'} will be cancelled and each User refunded.`}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      tone="red"
                      disabled={busyId === buddy.id}
                      onClick={() => (confirming.action === 'remove' ? remove(buddy) : toggle(buddy))}
                    >
                      {confirming.action === 'remove' ? 'Remove' : 'Deactivate'}
                    </Button>
                    <Button variant="secondary" size="sm" disabled={busyId === buddy.id} onClick={() => setConfirming(null)}>
                      Keep
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 shrink-0 rounded-full ${buddy.active ? 'bg-brand-primary' : 'bg-border-strong/40'}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-text-heading">{buddy.name ?? buddy.email}</p>
                      <p className="truncate text-xs text-text-secondary">
                        {buddy.active ? 'Active' : 'Inactive'}
                        {buddy.active && !buddy.hasMeetingLink && ' · no meeting link yet'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busyId === buddy.id}
                      onClick={() => (buddy.active ? setConfirming({ id: buddy.id, action: 'deactivate' }) : toggle(buddy))}
                    >
                      {buddy.active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <button
                      type="button"
                      aria-label={`Remove ${buddy.name ?? buddy.email}`}
                      disabled={busyId === buddy.id}
                      onClick={() => setConfirming({ id: buddy.id, action: 'remove' })}
                      className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-b-[3px] border-error text-error"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
