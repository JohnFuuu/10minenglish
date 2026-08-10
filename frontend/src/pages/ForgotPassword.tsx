import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../components';
import { BackArrow } from '../auth/AuthPrimitives';
import { forgotPassword } from '../lib/api';

export function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    await forgotPassword(email);
    setIsSubmitting(false);
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <BackArrow onPress={() => navigate('/login')} />

      <div className="flex flex-1 flex-col justify-center gap-5 px-5 pb-8">
        {submitted ? (
          <div className="text-center">
            <div className="mb-5 text-6xl">📬</div>
            <h1 className="mb-2 text-2xl font-bold text-text-body">Check your inbox</h1>
            <p className="text-sm font-medium text-text-secondary">
              If an account exists for{' '}
              <span className="font-bold text-brand-secondary">{email}</span>, we've sent a reset
              link.
            </p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="mt-8 text-xs font-bold uppercase tracking-wide text-brand-secondary"
            >
              ← Back to log in
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-center text-2xl font-bold text-text-body">Forgot password?</h1>
            <p className="text-center text-sm font-medium text-text-secondary">
              Enter your email and we'll send a reset link.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <Input
                variant="filled"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" tone="blue" disabled={isSubmitting}>
                Send Reset Link
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
