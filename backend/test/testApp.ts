import { createApp } from '../src/app.js';
import type { EmailMessage, EmailSender } from '../src/services/email.js';
import type { GoogleProfile, GoogleTokenVerifier } from '../src/services/googleAuth.js';

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

export function createTestApp() {
  const emailSender = new FakeEmailSender();
  const googleTokenVerifier = new FakeGoogleTokenVerifier();
  const app = createApp({ emailSender, googleTokenVerifier });
  return { app, emailSender, googleTokenVerifier };
}
