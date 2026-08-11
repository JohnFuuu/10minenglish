import { useState } from 'react';
import { Button, Input } from '../components';
import { useAuth } from '../auth/AuthContext';
import { ApiError, provisionBuddy } from '../lib/api';

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

      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-text-secondary">
        Add Buddy account
      </p>
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
    </main>
  );
}
