import { useEffect, useState } from 'react';
import { Button, Input } from '../components';
import { useAuth } from '../auth/AuthContext';
import {
  ApiError,
  adminUpdateCreditPackPrice,
  fetchCreditPacks,
  provisionBuddy,
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

export function AdminDashboard() {
  const { token, logout } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    setIsSubmitting(true);

    try {
      const buddy = await provisionBuddy(token!, { name, email, password });
      setCreated(buddy.email);
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
        <h1 className="text-2xl font-bold text-text-body">Admin</h1>
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
