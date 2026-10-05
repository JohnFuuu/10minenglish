import { createHmac } from 'node:crypto';

// Meta's manual-login guide documents this version; v25.0 is supported until
// July 2028. Bump it (and re-test) before then.
const GRAPH_API_VERSION = 'v25.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface FacebookProfile {
  facebookId: string;
  name?: string;
  // Missing when the account was made with a phone number, or the person
  // declined to share it.
  email?: string;
}

// Unlike Google's sign-in button, which hands the browser a self-verifying ID
// token, Facebook's redirect flow hands back a one-time code that only proves
// anything once the backend trades it in with the app secret.
export interface FacebookAuthClient {
  exchangeCode(code: string): Promise<FacebookProfile>;
}

interface FacebookAuthConfig {
  appId: string;
  appSecret: string;
  // Must match, character for character, the redirect_uri the browser was
  // sent to Facebook with, and one listed under Valid OAuth Redirect URIs.
  redirectUri: string;
  fetchFn?: typeof fetch;
}

async function readGraphResponse<T>(res: Response, step: string): Promise<T> {
  const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!res.ok || !body) {
    throw new Error(`Facebook ${step} failed: ${res.status} ${body?.error?.message ?? ''}`.trim());
  }
  return body;
}

export function createFacebookAuthClient({
  appId,
  appSecret,
  redirectUri,
  fetchFn = fetch,
}: FacebookAuthConfig): FacebookAuthClient {
  return {
    async exchangeCode(code) {
      const exchangeUrl = new URL(`${GRAPH_URL}/oauth/access_token`);
      exchangeUrl.search = new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      }).toString();
      const { access_token: accessToken } = await readGraphResponse<{ access_token: string }>(
        await fetchFn(exchangeUrl),
        'code exchange',
      );

      // appsecret_proof ties the call to our app secret, so a leaked user
      // token alone can't be replayed against our app.
      const meUrl = new URL(`${GRAPH_URL}/me`);
      meUrl.search = new URLSearchParams({
        fields: 'id,name,email',
        access_token: accessToken,
        appsecret_proof: createHmac('sha256', appSecret).update(accessToken).digest('hex'),
      }).toString();
      const me = await readGraphResponse<{ id: string; name?: string; email?: string }>(
        await fetchFn(meUrl),
        'profile lookup',
      );

      return { facebookId: me.id, name: me.name, email: me.email };
    },
  };
}

// Real implementation, configured from the environment on first use (like
// realGoogleTokenVerifier), so the server still boots without Facebook set up.
export const realFacebookAuthClient: FacebookAuthClient = {
  async exchangeCode(code) {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) throw new Error('FACEBOOK_APP_ID / FACEBOOK_APP_SECRET is not set');
    const frontendUrl = (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/+$/, '');
    return createFacebookAuthClient({
      appId,
      appSecret,
      redirectUri: `${frontendUrl}/auth/facebook/callback`,
    }).exchangeCode(code);
  },
};
