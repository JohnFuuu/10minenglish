import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../components';
import { useAuth, type AccountRole } from '../auth/AuthContext';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';
import { BackArrow, LegalText, OrDivider } from '../auth/AuthPrimitives';
import { PasswordVisibilityToggle } from '../auth/PasswordVisibilityToggle';
import { ApiError, fetchMe, login, loginWithGoogle, resendConfirmation } from '../lib/api';

export function Login() {
  const { setSession } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsConfirmation(false);
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      const me = await fetchMe(result.token);
      setSession(result.token, {
        id: me.id,
        role: me.role as AccountRole,
        onboardingCompleted: me.onboardingCompleted,
        credits: me.credits,
        isNZLocated: me.isNZLocated,
      });
      navigate(me.onboardingCompleted ? '/dashboard' : '/onboarding');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setNeedsConfirmation(true);
      } else if (err instanceof ApiError && err.status === 423) {
        setError('Too many failed attempts — your account is locked for 15 minutes.');
      } else {
        setError('Incorrect email or password.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    await resendConfirmation(email);
    setResendStatus('sent');
  }

  async function handleGoogleCredential(idToken: string) {
    setError(null);
    try {
      const result = await loginWithGoogle(idToken);
      const me = await fetchMe(result.token);
      setSession(result.token, {
        id: me.id,
        role: me.role as AccountRole,
        onboardingCompleted: me.onboardingCompleted,
        credits: me.credits,
        isNZLocated: me.isNZLocated,
      });
      navigate(me.onboardingCompleted ? '/dashboard' : '/onboarding');
    } catch {
      setError('Google sign-in failed.');
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <BackArrow onPress={() => navigate('/signup')} />

      <div className="flex flex-1 flex-col justify-center gap-5 px-5 pb-8">
        <h1 className="text-center text-2xl font-bold text-text-body">Log in</h1>

        {needsConfirmation ? (
          <div className="flex flex-col gap-3">
            <p className="text-center text-sm text-text-secondary">
              Please confirm your email before logging in.
            </p>
            {resendStatus === 'sent' ? (
              <p className="text-center text-sm font-bold text-success">
                Confirmation email resent — check your inbox.
              </p>
            ) : (
              <Button variant="secondary" tone="blue" onClick={handleResend}>
                Resend confirmation email
              </Button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <Input
                variant="filled"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                variant="filled"
                type={showPassword ? 'text' : 'password'}
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

            <Button type="submit" tone="blue" disabled={isSubmitting}>
              Log In
            </Button>

            <OrDivider />

            <GoogleSignInButton onCredential={handleGoogleCredential} />

            <LegalText action="signing in" />
          </form>
        )}
      </div>

      <div className="px-5 pb-8 text-center">
        <span className="text-sm font-bold text-text-body">Don't have an account? </span>
        <button
          type="button"
          onClick={() => navigate('/signup')}
          className="text-sm font-bold text-brand-secondary"
        >
          SIGN UP
        </button>
      </div>
    </div>
  );
}
