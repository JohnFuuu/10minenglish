import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components';
import { SectionHeading } from './SectionHeading';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import { fetchAdminBuddies, setBuddyActive, type AdminBuddy } from '../../lib/api';

export function BuddyRoster({ refreshKey }: { refreshKey: number }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [buddies, setBuddies] = useState<AdminBuddy[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
      setConfirmingId(null);
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

  return (
    <section className="mb-10">
      <SectionHeading>Buddy roster</SectionHeading>
      <p className="mb-4 text-sm font-medium text-text-secondary">
        Deactivating takes a Buddy out of rotation and cancels their upcoming lessons, refunding
        each User.
      </p>

      {buddies.length === 0 && <p className="text-sm text-text-secondary">No buddies yet.</p>}

      {/* One compact panel with divider rows (not a card per Buddy), so a
          long roster stays scannable. */}
      {buddies.length > 0 && (
        <ul className="divide-y-2 divide-border overflow-hidden rounded-md border-2 border-b-4 border-border-strong bg-bg-surface">
          {buddies.map((buddy) => (
            <li key={buddy.id} className="px-4 py-2.5">
              {confirmingId === buddy.id ? (
                // Deactivating cancels and refunds every upcoming Lesson, so the
                // prompt says exactly what will happen before anything does.
                <div className="flex flex-col gap-2 rounded-md bg-warning/10 px-2 py-2">
                  <p className="text-sm font-bold text-text-body">
                    Deactivate {buddy.name ?? buddy.email}?{' '}
                    {buddy.upcomingLessons === 0
                      ? 'They have no upcoming lessons.'
                      : `Their ${buddy.upcomingLessons} upcoming lesson${buddy.upcomingLessons === 1 ? '' : 's'} will be cancelled and each User refunded.`}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" tone="red" disabled={busyId === buddy.id} onClick={() => toggle(buddy)}>
                      Deactivate
                    </Button>
                    <Button variant="secondary" size="sm" disabled={busyId === buddy.id} onClick={() => setConfirmingId(null)}>
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
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId === buddy.id}
                    onClick={() => (buddy.active ? setConfirmingId(buddy.id) : toggle(buddy))}
                  >
                    {buddy.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
