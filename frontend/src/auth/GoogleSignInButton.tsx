import { useEffect, useRef } from 'react';
import { GoogleIcon } from './AuthPrimitives';

interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void;
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void;
          renderButton(
            parent: HTMLElement,
            options: { width?: number; text?: string; size?: 'large' | 'medium' | 'small' },
          ): void;
        };
      };
    };
  }
}

// Google's Identity Services button only offers a handful of Google-branded
// looks (theme/shape/size) — there's no supported way to make its text match
// this app's own button font/weight/case. So this chrome (shared with the
// disabled placeholder below) is rendered on top, purely for looks, while
// Google's real button sits beneath it at full size, made invisible with
// opacity-0 so its actual click target still receives the click.
const CHROME_CLASSES =
  'flex h-[52px] w-full items-center justify-center gap-2 rounded-md border-2 border-border bg-bg-surface text-xs font-bold uppercase tracking-wide text-text-body';

// Requires a real Google Cloud OAuth Client ID (VITE_GOOGLE_CLIENT_ID) — this
// code can't fabricate one. Degrades to a disabled placeholder without it.
export function GoogleSignInButton({ onCredential }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Callers pass an inline handler that's a new function on every render (see
  // Login.tsx, Signup.tsx). Reading it through a ref, rather than depending on
  // it directly, keeps the script/button below mounted exactly once instead of
  // reloading the Google script and re-rendering the button on every keystroke
  // of an unrelated field.
  const onCredentialRef = useRef(onCredential);
  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !containerRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      if (!window.google || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onCredentialRef.current(response.credential),
      });
      // Match the width of the sibling inputs/buttons instead of a fixed
      // pixel value — renderButton takes a number, not '100%', so measure
      // the (already flex-stretched) container instead of hardcoding one.
      window.google.accounts.id.renderButton(containerRef.current, {
        width: containerRef.current.offsetWidth,
        text: 'continue_with',
        size: 'large',
      });
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <button
        type="button"
        disabled
        title="Google sign-in isn't configured (VITE_GOOGLE_CLIENT_ID missing)"
        className={`${CHROME_CLASSES} cursor-not-allowed opacity-60`}
      >
        <GoogleIcon />
        Google
      </button>
    );
  }

  return (
    <div className="relative h-[52px] w-full">
      <div aria-hidden="true" className={`${CHROME_CLASSES} pointer-events-none absolute inset-0`}>
        <GoogleIcon />
        Google
      </div>
      {/* Google's real, functional button — invisible, but on top so its
          click target (not ours) is what actually receives the click. */}
      <div ref={containerRef} className="absolute inset-0 flex items-center justify-center opacity-0" />
    </div>
  );
}
