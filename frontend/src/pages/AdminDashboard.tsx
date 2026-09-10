import { useCallback, useEffect, useState } from 'react';
import { Button, Input } from '../components';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../toast/ToastContext';
import {
  ApiError,
  adminUpdateCreditPackPrice,
  fetchAdminBuddies,
  fetchCreditPacks,
  provisionBuddy,
  setBuddyActive,
  type AdminBuddy,
  type CreditPack,
} from '../lib/api';

function CreditPackPricing() {
  const { token } = useAuth();
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [editingSize, setEditingSize] = useState<number | null>(null);
  const [draftPrice, setDraftPrice] = useState('');
  const [saved, setSaved] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchCreditPacks(token).then((res) => setPacks(res.packs));
  }, [token]);

  function startEdit(pack: CreditPack) {
    setEditingSize(pack.size);
    setDraftPrice((pack.priceCents / 100).toFixed(2));
  }

  async function saveEdit(size: number) {
    const priceCents = Math.round(Number(draftPrice) * 100);
    if (Number.isNaN(priceCents) || priceCents < 0) return;
    const updated = await adminUpdateCreditPackPrice(token!, size, priceCents);
    setPacks((prev) => prev.map((p) => (p.size === size ? updated : p)));
    setEditingSize(null);
    setSaved(size);
    setTimeout(() => setSaved(null), 2000);
  }

  return (
    <section className="mb-10">
      <h2 className="mb-1 inline-block rounded-md bg-accent-lime-light px-3 py-1 text-sm font-bold uppercase tracking-wide text-success">
        Credit pack pricing
      </h2>
      <p className="mb-4 text-sm font-medium text-text-secondary">Edit prices without a code deploy.</p>

      <div className="flex flex-col gap-3">
        {packs.map((pack) => (
          <div
            key={pack.size}
            className="flex items-center justify-between rounded-md border-2 border-b-4 border-border-strong bg-bg-surface p-4"
          >
            <p className="font-bold text-text-heading">{pack.size} credits</p>
            {editingSize === pack.size ? (
              <div className="flex items-center gap-2">
                <Input
                  className="w-24 text-right"
                  value={draftPrice}
                  onChange={(e) => setDraftPrice(e.target.value)}
                />
                <Button size="sm" onClick={() => saveEdit(pack.size)}>
                  Save
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {saved === pack.size && <span className="text-xs font-bold text-success">Saved!</span>}
                <span className="font-bold text-text-heading">${(pack.priceCents / 100).toFixed(2)} NZD</span>
                <Button variant="secondary" size="sm" onClick={() => startEdit(pack)}>
                  Edit
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function BuddyRoster({ refreshKey }: { refreshKey: number }) {
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
      setBuddies((prev) => prev.map((b) => (b.id === buddy.id ? { ...b, active: updated.active } : b)));
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
      <h2 className="mb-1 inline-block rounded-md bg-accent-lime-light px-3 py-1 text-sm font-bold uppercase tracking-wide text-success">
        Buddy roster
      </h2>
      <p className="mb-4 text-sm font-medium text-text-secondary">
        Deactivating takes a Buddy out of rotation and cancels their upcoming lessons, refunding
        each User.
      </p>

      {buddies.length === 0 && <p className="text-sm text-text-secondary">No buddies yet.</p>}

      <div className="flex flex-col gap-3">
        {buddies.map((buddy) => (
          <div
            key={buddy.id}
            className="flex items-center justify-between gap-3 rounded-md border-2 border-b-4 border-border-strong bg-bg-surface p-4"
          >
            <div className="min-w-0">
              <p className="truncate font-bold text-text-heading">{buddy.name ?? buddy.email}</p>
              <p className="truncate text-xs font-bold uppercase tracking-wide text-text-secondary">
                {buddy.active ? 'Active' : 'Inactive'}
                {buddy.active && !buddy.hasZoomLink && ' · no zoom link yet'}
              </p>
            </div>

            {confirmingId === buddy.id ? (
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" disabled={busyId === buddy.id} onClick={() => toggle(buddy)}>
                  Confirm
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setConfirmingId(null)}>
                  Keep
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled={busyId === buddy.id}
                onClick={() => (buddy.active ? setConfirmingId(buddy.id) : toggle(buddy))}
              >
                {buddy.active ? 'Deactivate' : 'Activate'}
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function AdminDashboard() {
  const { token, logout } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Bumped after provisioning so the roster below picks up the new Buddy.
  const [rosterKey, setRosterKey] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    setIsSubmitting(true);

    try {
      const buddy = await provisionBuddy(token!, { name, email, password });
      setCreated(buddy.email);
      setRosterKey((k) => k + 1);
      setName('');
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? 'That email is already registered.'
          : 'Something went wrong. Please check the details and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-2xl font-black text-text-heading">Admin</h1>
        <Button variant="secondary" size="sm" onClick={logout}>
          Log out
        </Button>
      </div>

      <div className="mb-6 flex items-center gap-2 rounded-md border-2 border-warning bg-warning/10 px-3 py-2">
        <span>⚠️</span>
        <p className="text-xs font-bold uppercase tracking-wide text-text-body">
          Changes take effect immediately
        </p>
      </div>

      <CreditPackPricing />

      <BuddyRoster refreshKey={rosterKey} />

      <section>
        <h2 className="mb-1 inline-block rounded-md bg-accent-lime-light px-3 py-1 text-sm font-bold uppercase tracking-wide text-success">
          Add Buddy account
        </h2>
        <p className="mb-5 text-sm font-medium text-text-secondary">
          Buddies cannot self-register — use this form to create their account.
        </p>

        {created && (
          <div className="mb-4 rounded-md border-2 border-accent-lime bg-accent-lime-light px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-success">
              Account created for {created}.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Starter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm font-bold text-error">{error}</p>}
          <Button type="submit" disabled={isSubmitting}>
            Create Buddy Account
          </Button>
        </form>
      </section>
    </main>
  );
}
