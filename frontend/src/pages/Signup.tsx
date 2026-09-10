import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../components';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';
import { BackArrow, LegalText, OrDivider } from '../auth/AuthPrimitives';
import { PasswordVisibilityToggle } from '../auth/PasswordVisibilityToggle';
import { toAccount, useAuth } from '../auth/AuthContext';
import { ApiError, fetchMe, loginWithGoogle, signup } from '../lib/api';

export function Signup() {
  const { setSession } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signup({ name: form.name, email: form.email, password: form.password });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('That email is already registered.');
      } else {
        setError('Something went wrong. Please check your details and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleCredential(idToken: string) {
    setError(null);
    try {
      const result = await loginWithGoogle(idToken);
      const me = await fetchMe(result.token);
      setSession(result.token, toAccount(me));
      navigate(me.onboardingCompleted ? '/dashboard' : '/onboarding');
    } catch {
      setError('Google sign-in failed.');
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="text-6xl">📬</div>
        <h1 className="text-2xl font-bold text-text-body">Check your inbox</h1>
        <p className="text-sm font-medium text-text-secondary">
          We've sent a confirmation link to{' '}
          <span className="font-bold text-brand-secondary">{form.email}</span>
        </p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-8 text-xs font-bold uppercase tracking-wide text-brand-secondary"
        >
          ← Back to log in
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <BackArrow onPress={() => navigate('/login')} />

      <div className="flex-1 px-5 pb-8">
        <h1 className="mb-5 text-center text-2xl font-bold text-text-body">Create your profile</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <Input
              variant="filled"
              placeholder="Name"
              value={form.name}
              onChange={updateField('name')}
              required
            />
            <Input
              variant="filled"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={updateField('email')}
              required
            />
            <Input
              variant="filled"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={form.password}
              onChange={updateField('password')}
              required
              right={
                <PasswordVisibilityToggle
                  visible={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                />
              }
            />
            <Input
              variant="filled"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm password"
              value={form.confirmPassword}
              onChange={updateField('confirmPassword')}
              required
            />
          </div>

          {error && <p className="text-center text-sm font-bold text-error">{error}</p>}

          <Button type="submit" tone="blue" disabled={isSubmitting}>
            Create Account
          </Button>

          <OrDivider />

          <GoogleSignInButton onCredential={handleGoogleCredential} />

          <LegalText action="signing up" />
        </form>
      </div>

      <div className="px-5 pb-8 text-center">
        <span className="text-sm font-bold text-text-body">Have an account? </span>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="text-sm font-bold text-brand-secondary"
        >
          LOG IN
        </button>
      </div>
    </div>
  );
}
