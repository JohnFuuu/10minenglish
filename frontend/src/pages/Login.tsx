import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../components';
import { toAccount, useAuth } from '../auth/AuthContext';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';
import { BackArrow, LegalText, OrDivider } from '../auth/AuthPrimitives';
import { PasswordVisibilityToggle } from '../auth/PasswordVisibilityToggle';
import { ApiError, fetchMe, login, loginWithGoogle } from '../lib/api';

export function Login() {
  const { setSession } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      const me = await fetchMe(result.token);
      setSession(result.token, toAccount(me));
      // Dashboard itself decides whether to bounce to /onboarding (User-only).
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.status === 423) {
        setError('Too many failed attempts — your account is locked for 15 minutes.');
      } else {
        setError('Incorrect email or password.');
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

  return (
    <div className="flex min-h-screen flex-col">
      <div className="relative flex h-[45vh] min-h-[280px] items-center justify-center bg-bg-surface px-10 py-6">
        <img src="/logo.png" alt="10 Minute English" className="h-full w-full object-contain" />
        <div className="absolute right-0 top-0">
          <BackArrow onPress={() => navigate('/')} />
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-5 px-5 pb-8">
        {/* Visually removed — the logo and LOG IN button make the page's
            purpose obvious — but kept for screen readers as the page title. */}
        <h1 className="sr-only">Log in</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <Input
              variant="filled"
              type="email"
              label="Email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              variant="filled"
              type={showPassword ? 'text' : 'password'}
              label="Password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              right={
                <PasswordVisibilityToggle
                  visible={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                />
              }
            />
          </div>

          {error && <p className="text-center text-sm font-bold text-error">{error}</p>}

          <button
            type="button"
            onClick={() => navigate('/forgot-password')}
            className="text-right text-xs font-bold tracking-wide text-brand-secondary"
          >
            Forgot password?
          </button>

          <div className="flex gap-3">
            <Button type="submit" tone="blue" disabled={isSubmitting} className="flex-1">
              Log In
            </Button>
            <Button type="button" variant="secondary" tone="blue" onClick={() => navigate('/signup')} className="flex-1">
              Sign Up
            </Button>
          </div>

          <OrDivider />

          <GoogleSignInButton onCredential={handleGoogleCredential} />

          <LegalText action="signing in" />
        </form>
      </div>
    </div>
  );
}
