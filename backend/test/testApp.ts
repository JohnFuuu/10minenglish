import { createApp } from '../src/app.js';
import type { EmailMessage, EmailSender } from '../src/services/email.js';
import type { GoogleProfile, GoogleTokenVerifier } from '../src/services/googleAuth.js';
import type { FacebookAuthClient, FacebookProfile } from '../src/services/facebookAuth.js';
import type {
  StripeCheckoutSession,
  StripeCheckoutStatus,
  StripeClient,
} from '../src/services/stripeClient.js';
import type { PoliClient, PoliTransaction, PoliTransactionStatus } from '../src/services/poliClient.js';
import type { MediaStorage } from '../src/services/mediaStorage.js';

export class FakeEmailSender implements EmailSender {
  sent: EmailMessage[] = [];

  async send(message: EmailMessage) {
    this.sent.push(message);
  }
}

export class FakeGoogleTokenVerifier implements GoogleTokenVerifier {
  private profiles = new Map<string, GoogleProfile>();

  registerToken(token: string, profile: GoogleProfile) {
    this.profiles.set(token, profile);
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    const profile = this.profiles.get(idToken);
    if (!profile) throw new Error('invalid token');
    return profile;
  }
}

export class FakeFacebookAuthClient implements FacebookAuthClient {
  private profiles = new Map<string, FacebookProfile>();

  // Test helper — the profile Facebook would return for this one-time code.
  registerCode(code: string, profile: FacebookProfile) {
    this.profiles.set(code, profile);
  }

  async exchangeCode(code: string): Promise<FacebookProfile> {
    const profile = this.profiles.get(code);
    if (!profile) throw new Error('invalid code');
    return profile;
  }
}

export class FakeStripeClient implements StripeClient {
  private sessionCounter = 0;
  private statuses = new Map<string, StripeCheckoutStatus>();

  async createCheckoutSession(): Promise<StripeCheckoutSession> {
    this.sessionCounter += 1;
    const id = `fake_stripe_session_${this.sessionCounter}`;
    this.statuses.set(id, 'unpaid');
    return { id, url: `https://checkout.stripe.test/${id}` };
  }

  async getCheckoutSessionStatus(sessionId: string): Promise<StripeCheckoutStatus> {
    return this.statuses.get(sessionId) ?? 'unpaid';
  }

  // Test helper — simulates the User completing (or failing) checkout.
  setStatus(sessionId: string, status: StripeCheckoutStatus) {
    this.statuses.set(sessionId, status);
  }
}

export class FakePoliClient implements PoliClient {
  private tokenCounter = 0;
  private statuses = new Map<string, PoliTransactionStatus>();

  async initiateTransaction(): Promise<PoliTransaction> {
    this.tokenCounter += 1;
    const token = `fake_poli_token_${this.tokenCounter}`;
    this.statuses.set(token, 'pending');
    return { token, navigateUrl: `https://poli.test/pay/${token}` };
  }

  async getTransactionStatus(token: string): Promise<PoliTransactionStatus> {
    return this.statuses.get(token) ?? 'pending';
  }

  // Test helper — simulates the User completing (or failing) the bank transfer.
  setStatus(token: string, status: PoliTransactionStatus) {
    this.statuses.set(token, status);
  }
}

export class FakeMediaStorage implements MediaStorage {
  uploaded: { key: string; contentType: string }[] = [];

  async upload({ key, contentType }: { key: string; body: Buffer; contentType: string }) {
    this.uploaded.push({ key, contentType });
    return { url: `https://fake-r2.test/${key}` };
  }
}

export function createTestApp() {
  const emailSender = new FakeEmailSender();
  const googleTokenVerifier = new FakeGoogleTokenVerifier();
  const facebookAuthClient = new FakeFacebookAuthClient();
  const stripeClient = new FakeStripeClient();
  const poliClient = new FakePoliClient();
  const mediaStorage = new FakeMediaStorage();
  const app = createApp({ emailSender, googleTokenVerifier, facebookAuthClient, stripeClient, poliClient, mediaStorage });
  return { app, emailSender, googleTokenVerifier, facebookAuthClient, stripeClient, poliClient, mediaStorage };
}
