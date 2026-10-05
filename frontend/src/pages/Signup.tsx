import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
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
  const [linkResent, setLinkResent] = useState(false);
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
      // Signed straight in — they confirm their email later, before booking
      // or buying credits (the Dashboard reminds them).
      const result = await signup({ name: form.name, email: form.email, password: form.password });
      const me = await fetchMe(result.token);
      setSession(result.token, toAccount(me));
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.message === 'EMAIL_NOT_CONFIRMED') {
        // They signed up before but never confirmed; the backend has just
        // sent a fresh link.
        setLinkResent(true);
      } else if (err instanceof ApiError && err.status === 409) {
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
      navigate('/dashboard');
    } catch {
      setError('Google sign-in failed.');
    }
  }

  if (linkResent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-8 text-center">
        <MailCheck size={56} className="mx-auto text-brand-primary" />
        <h1 className="text-2xl font-bold text-text-body">You already started signing up</h1>
        <p className="text-base font-medium text-text-body">
          We've sent a new confirmation link to{' '}
          <span className="font-bold text-brand-secondary">{form.email}</span>. Tap it to finish setting up your
          account, or log in with the password you chose.
        </p>
        <Button tone="blue" className="mt-6 w-full" onClick={() => navigate('/login')}>
          Log in
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <BackArrow onPress={() => navigate('/')} />

      <div className="flex-1 px-5 pb-8">
        <h1 className="mb-5 text-center text-2xl font-bold text-text-body">Create your profile</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <Input
              variant="filled"
              label="Name"
              placeholder="Name"
              value={form.name}
              onChange={updateField('name')}
              required
            />
            <Input
              variant="filled"
              type="email"
              label="Email"
              placeholder="Email"
              value={form.email}
              onChange={updateField('email')}
              required
            />
            <Input
              variant="filled"
              type={showPassword ? 'text' : 'password'}
              label="Password"
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
              label="Confirm password"
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
