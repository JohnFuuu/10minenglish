import { FACEBOOK_APP_ID, startFacebookLogin } from './facebookLogin';

// Same look as GoogleSignInButton's chrome, so the two sit together as a pair.
const CHROME_CLASSES =
  'flex h-[52px] w-full items-center justify-center gap-2 rounded-md border-2 border-border bg-bg-surface text-xs font-bold uppercase tracking-wide text-text-body';

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        fill="#ffffff"
        d="M15.12 12.75l.39-2.53h-2.43V8.58c0-.69.34-1.37 1.43-1.37h1.1V5.06s-1-.17-1.96-.17c-2 0-3.3 1.21-3.3 3.4v1.93H8.12v2.53h2.23V19a8.9 8.9 0 0 0 2.73 0v-6.25h2.04z"
      />
    </svg>
  );
}

// Requires a Meta app ID (VITE_FACEBOOK_APP_ID). Degrades to a disabled
// placeholder without it, like the Google button.
export function FacebookSignInButton() {
  if (!FACEBOOK_APP_ID) {
    return (
      <button
        type="button"
        disabled
        title="Facebook sign-in isn't configured (VITE_FACEBOOK_APP_ID missing)"
        className={`${CHROME_CLASSES} cursor-not-allowed opacity-60`}
      >
        <FacebookIcon />
        Facebook
      </button>
    );
  }

  return (
    <button type="button" onClick={startFacebookLogin} className={CHROME_CLASSES}>
      <FacebookIcon />
      Facebook
    </button>
  );
}
