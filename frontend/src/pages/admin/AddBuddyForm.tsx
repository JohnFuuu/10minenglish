import { useState } from 'react';
import { Button, Input } from '../../components';
import { useAuth } from '../../auth/AuthContext';
import { ApiError, provisionBuddy } from '../../lib/api';

// Buddies can't self-register; an Admin creates their account here.
export function AddBuddyForm({ onCreated }: { onCreated: () => void }) {
  const { token } = useAuth();
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
      onCreated();
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
        <Input
          label="Full name"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          type="email"
          label="Email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          label="Starter password"
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
  );
}
