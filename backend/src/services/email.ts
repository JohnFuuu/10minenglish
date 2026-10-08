import nodemailer from 'nodemailer';
import { brandedHtmlFromText } from './emailLayout.js';

export interface EmailMessage {
  to: string;
  subject: string;
  // Plain text — always sent, for clients that don't show HTML.
  body: string;
  // A custom HTML version; without one, the text is sent in the branded layout.
  html?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  // Text content (e.g. a calendar file); base64-encoded when sent.
  content: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

// Dev-only default: logs instead of delivering. Used whenever Resend isn't
// configured (see emailSenderFromEnv), so local dev needs no email account.
export const consoleEmailSender: EmailSender = {
  async send(message) {
    const attached = message.attachments?.length ? `\n[attached: ${message.attachments.map((a) => a.filename).join(', ')}]` : '';
    console.log(`[email] to=${message.to} subject="${message.subject}"\n${message.body}${attached}`);
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
        body: JSON.stringify({
          from,
          to: message.to,
          subject: message.subject,
          text: message.body,
          html: message.html ?? brandedHtmlFromText(message.subject, message.body),
          ...(message.attachments?.length
            ? {
                attachments: message.attachments.map((a) => ({
                  filename: a.filename,
                  content: Buffer.from(a.content, 'utf8').toString('base64'),
                  content_type: a.contentType,
                })),
              }
            : {}),
        }),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(`Resend refused email to ${message.to}: ${res.status} ${detail?.message ?? ''}`.trim());
      }
    },
  };
}

interface GmailConfig {
  user: string;
  // A Google "app password" (needs 2-Step Verification on the account), not
  // the account's normal password.
  appPassword: string;
  // Display name and address; Gmail sends from `user` regardless.
  from?: string;
  // Injected in tests; defaults to Gmail's SMTP server.
  transport?: { sendMail(mail: Record<string, unknown>): Promise<unknown> };
}

// Sends through a Gmail account over SMTP — the stopgap until there's a
// domain of our own to verify with Resend. Gmail caps a personal account at
// about 500 recipients a day.
export function createGmailEmailSender({ user, appPassword, from, transport }: GmailConfig): EmailSender {
  const smtp =
    transport ??
    nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass: appPassword } });
  return {
    async send(message) {
      await smtp.sendMail({
        from: from ?? `10 Minute English <${user}>`,
        to: message.to,
        subject: message.subject,
        text: message.body,
        html: message.html ?? brandedHtmlFromText(message.subject, message.body),
        ...(message.attachments?.length
          ? { attachments: message.attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, content: a.content })) }
          : {}),
      });
    },
  };
}

// The From for Gmail: EMAIL_FROM only when it is this Gmail address (e.g.
// "10ME <you@gmail.com>"). Anything else, like a leftover Resend sender,
// would be rewritten by Gmail and looks like spoofing to spam filters.
export function gmailFrom(user: string, emailFrom?: string): string | undefined {
  return emailFrom && emailFrom.toLowerCase().includes(user.toLowerCase()) ? emailFrom : undefined;
}

// One line for the startup log: where this process's email goes.
export function describeEmailSetup(env: Record<string, string | undefined> = process.env): string {
  const sender = emailSenderFromEnv(env);
  if (sender === consoleEmailSender) return 'Emails are logged here, not delivered.';
  return env.EMAIL_PROVIDER?.trim().toLowerCase() === 'gmail'
    ? `Sending email via Gmail as ${env.GMAIL_USER}.`
    : `Sending email via Resend from ${env.EMAIL_FROM}.`;
}

// Picks how this process sends email. EMAIL_PROVIDER chooses explicitly:
// "gmail" (GMAIL_USER + GMAIL_APP_PASSWORD), "resend" (RESEND_API_KEY +
// EMAIL_FROM — needs a verified domain to reach anyone but the account
// owner), or "console" (log only). Unset keeps the old behaviour: Resend when
// it's configured, the console logger when it isn't. Half a configuration is
// a deploy mistake, so it fails at boot rather than quietly logging emails
// nobody will ever receive.
export function emailSenderFromEnv(env: Record<string, string | undefined> = process.env): EmailSender {
  const provider = env.EMAIL_PROVIDER?.trim().toLowerCase() || undefined;
  if (provider === 'console') return consoleEmailSender;
  if (provider === 'gmail') {
    if (!env.GMAIL_USER) throw new Error('EMAIL_PROVIDER=gmail needs GMAIL_USER');
    if (!env.GMAIL_APP_PASSWORD) throw new Error('EMAIL_PROVIDER=gmail needs GMAIL_APP_PASSWORD');
    return createGmailEmailSender({
      user: env.GMAIL_USER,
      appPassword: env.GMAIL_APP_PASSWORD,
      from: gmailFrom(env.GMAIL_USER, env.EMAIL_FROM),
    });
  }
  if (provider !== undefined && provider !== 'resend') {
    throw new Error(`Unknown EMAIL_PROVIDER "${env.EMAIL_PROVIDER}" (use gmail, resend or console)`);
  }

  const { RESEND_API_KEY: apiKey, EMAIL_FROM: from } = env;
  if (!provider && !apiKey && !from) return consoleEmailSender;
  if (!apiKey) throw new Error('Resend needs RESEND_API_KEY');
  if (!from) throw new Error('Resend needs EMAIL_FROM');
  return createResendEmailSender({ apiKey, from });
}
