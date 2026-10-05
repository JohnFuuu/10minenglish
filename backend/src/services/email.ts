export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

// Dev-only default: logs instead of delivering. Used whenever Resend isn't
// configured (see emailSenderFromEnv), so local dev needs no email account.
export const consoleEmailSender: EmailSender = {
  async send(message) {
    console.log(`[email] to=${message.to} subject="${message.subject}"\n${message.body}`);
  },
};

const RESEND_API_URL = 'https://api.resend.com/emails';

interface ResendConfig {
  apiKey: string;
  // e.g. "10 Minute English <hello@our-domain>" — the domain must be verified
  // in Resend, or every send is refused.
  from: string;
  fetchFn?: typeof fetch;
}

export function createResendEmailSender({ apiKey, from, fetchFn = fetch }: ResendConfig): EmailSender {
  return {
    async send(message) {
      const res = await fetchFn(RESEND_API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: message.to, subject: message.subject, text: message.body }),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(`Resend refused email to ${message.to}: ${res.status} ${detail?.message ?? ''}`.trim());
      }
    },
  };
}

// Picks how this process sends email: Resend when it's configured, the console
// logger when it isn't. Half a configuration is a deploy mistake, so it fails
// at boot rather than quietly logging emails nobody will ever receive.
export function emailSenderFromEnv(env: Record<string, string | undefined> = process.env): EmailSender {
  const { RESEND_API_KEY: apiKey, EMAIL_FROM: from } = env;
  if (!apiKey && !from) return consoleEmailSender;
  if (!apiKey) throw new Error('EMAIL_FROM is set but RESEND_API_KEY is not');
  if (!from) throw new Error('RESEND_API_KEY is set but EMAIL_FROM is not');
  return createResendEmailSender({ apiKey, from });
}
