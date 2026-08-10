import { OAuth2Client } from 'google-auth-library';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name?: string;
}

export interface GoogleTokenVerifier {
  verify(idToken: string): Promise<GoogleProfile>;
}

// Real implementation — requires GOOGLE_CLIENT_ID to be set (create a
// Google Cloud OAuth Client ID and put it in the environment; this code
// can't fabricate real Google credentials).
export const realGoogleTokenVerifier: GoogleTokenVerifier = {
  async verify(idToken: string): Promise<GoogleProfile> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not set');

    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new Error('Invalid Google token payload');
    }
    return { googleId: payload.sub, email: payload.email, name: payload.name };
  },
};
