import { useState } from 'react';
import { Button, Input } from '../../components';
import { SectionHeading } from './SectionHeading';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../lib/api';

interface NewAccountFormProps {
  heading: string;
  description: string;
  submitLabel: string;
  // Creates the account and resolves with its email.
  create: (token: string, payload: { name: string; email: string; password: string }) => Promise<{ email: string }>;
  onCreated: (email: string) => void;
  onCancel: () => void;
}

// Name / email / starter-password form for accounts an Admin creates on
// someone's behalf (Buddies, other Admins) — neither can self-register.
export function NewAccountForm({ heading, description, submitLabel, create, onCreated, onCancel }: NewAccountFormProps) {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const account = await create(token!, { name, email, password });
      onCreated(account.email);
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
    <section className="mb-8">
      <SectionHeading>{heading}</SectionHeading>
      <p className="mb-5 text-sm font-medium text-text-secondary">{description}</p>

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
          {submitLabel}
        </Button>
        <button type="button" onClick={onCancel} className="text-sm font-bold text-text-secondary">
          Cancel
        </button>
      </form>
    </section>
  );
}
