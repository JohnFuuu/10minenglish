// Facebook's redirect ("manual") login flow, browser side. Kept in step with
// backend/src/services/facebookAuth.ts — same API version, and the backend
// builds the identical redirect URI from FRONTEND_URL when it trades the code
// in, so this app must be served from that origin.
const GRAPH_API_VERSION = 'v25.0';
const LOGIN_DIALOG_URL = `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`;
const STATE_STORAGE_KEY = '10me.facebookOAuthState';

export const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID as string | undefined;

export function facebookRedirectUri(): string {
  return `${window.location.origin}/auth/facebook/callback`;
}

// Sends the whole page to Facebook's login dialog; Facebook sends it back to
// /auth/facebook/callback. A full redirect (not a popup) because popups are
// often blocked on phones and inside Facebook/Messenger's in-app browser.
export function startFacebookLogin(): void {
  if (!FACEBOOK_APP_ID) return;
  // Proves the callback is answering a login this browser started, not a
  // link someone else crafted (CSRF).
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_STORAGE_KEY, state);

  const url = new URL(LOGIN_DIALOG_URL);
  url.search = new URLSearchParams({
    client_id: FACEBOOK_APP_ID,
    redirect_uri: facebookRedirectUri(),
    state,
    response_type: 'code',
    scope: 'public_profile,email',
  }).toString();
  window.location.assign(url.toString());
}

// One-shot: the stored state is cleared whether or not it matches.
export function consumeFacebookState(returned: string | null): boolean {
  const expected = sessionStorage.getItem(STATE_STORAGE_KEY);
  sessionStorage.removeItem(STATE_STORAGE_KEY);
  return expected !== null && returned === expected;
}
