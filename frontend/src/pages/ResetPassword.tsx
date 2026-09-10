import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button, Input } from '../components';
import { BackArrow } from '../auth/AuthPrimitives';
import { PasswordVisibilityToggle } from '../auth/PasswordVisibilityToggle';
import { ApiError, resetPassword } from '../lib/api';

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 400
          ? 'This reset link is invalid or has expired.'
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <BackArrow onPress={() => navigate('/login')} />

      <div className="flex flex-1 flex-col justify-center gap-5 px-5 pb-8">
        {done ? (
          <div className="text-center">
            <CheckCircle2 size={56} className="mx-auto mb-5 text-success" />
            <h1 className="mb-2 text-2xl font-bold text-text-body">Password updated</h1>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-xs font-bold uppercase tracking-wide text-brand-secondary"
            >
              Log in
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-center text-2xl font-bold text-text-body">Choose a new password</h1>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <Input
                variant="filled"
                type={showPassword ? 'text' : 'password'}
                label="New password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                right={
                  <PasswordVisibilityToggle
                    visible={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                  />
                }
              />
              {error && <p className="text-center text-sm font-bold text-error">{error}</p>}
              <Button type="submit" tone="blue" disabled={isSubmitting}>
                Reset Password
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
