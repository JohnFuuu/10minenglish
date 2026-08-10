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
          renderButton(parent: HTMLElement, options: { width?: number; text?: string }): void;
        };
      };
    };
  }
}

// Requires a real Google Cloud OAuth Client ID (VITE_GOOGLE_CLIENT_ID) — this
// code can't fabricate one. Degrades to a disabled placeholder without it.
export function GoogleSignInButton({ onCredential }: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !containerRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      if (!window.google || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => onCredential(response.credential),
      });
      window.google.accounts.id.renderButton(containerRef.current, { width: 320, text: 'continue_with' });
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [onCredential]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <button
        type="button"
        disabled
        title="Google sign-in isn't configured (VITE_GOOGLE_CLIENT_ID missing)"
        className="flex h-[52px] w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border-2 border-border bg-bg-surface text-xs font-bold uppercase tracking-wide text-text-body opacity-60"
      >
        <GoogleIcon />
        Google
      </button>
    );
  }

  return <div ref={containerRef} />;
}
