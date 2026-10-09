import { describe, expect, it } from 'vitest';
import {
  consoleEmailSender,
  createGmailEmailSender,
  createResendEmailSender,
  describeEmailSetup,
  emailSenderFromEnv,
  gmailFrom,
} from '../../src/services/email.js';

// Stands in for the network: records what would have been sent to Resend and
// answers with a canned response.
function fakeFetch(response: { status: number; body: unknown }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(response.body), { status: response.status });
  };
  return { calls, fetchFn: fetchFn as typeof fetch };
}

const message = { to: 'sarah@example.com', subject: 'Confirm your 10ME email', body: 'Confirm: https://x/confirm' };

describe('Resend email sender', () => {
  it('sends the message through the Resend API from the configured address', async () => {
    const { calls, fetchFn } = fakeFetch({ status: 200, body: { id: 'email_1' } });
    const sender = createResendEmailSender({ apiKey: 're_test', from: '10ME <hello@10me.test>', fetchFn });

    await sender.send(message);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.resend.com/emails');
    expect(calls[0].init.method).toBe('POST');
    expect(new Headers(calls[0].init.headers).get('Authorization')).toBe('Bearer re_test');
    const sent = JSON.parse(String(calls[0].init.body));
    expect(sent).toMatchObject({
      from: '10ME <hello@10me.test>',
      to: 'sarah@example.com',
      subject: 'Confirm your 10ME email',
      text: 'Confirm: https://x/confirm',
    });
    // Plain-text emails are sent in the 10 Minute English layout too, links made clickable.
    expect(sent.html).toContain('10 Minute English');
    expect(sent.html).toContain('<a href="https://x/confirm"');
  });

  it('sends a message’s own HTML when it has one', async () => {
    const { calls, fetchFn } = fakeFetch({ status: 200, body: { id: 'email_1' } });
    const sender = createResendEmailSender({ apiKey: 're_test', from: 'hello@10me.test', fetchFn });

    await sender.send({ ...message, html: '<p>custom</p>' });

    expect(JSON.parse(String(calls[0].init.body)).html).toBe('<p>custom</p>');
  });

  it('sends attachments base64-encoded with their content type', async () => {
    const { calls, fetchFn } = fakeFetch({ status: 200, body: { id: 'email_1' } });
    const sender = createResendEmailSender({ apiKey: 're_test', from: 'hello@10me.test', fetchFn });

    await sender.send({ ...message, attachments: [{ filename: 'meeting.ics', contentType: 'text/calendar', content: 'BEGIN:VCALENDAR' }] });

    expect(JSON.parse(String(calls[0].init.body)).attachments).toEqual([
      { filename: 'meeting.ics', content: Buffer.from('BEGIN:VCALENDAR').toString('base64'), content_type: 'text/calendar' },
    ]);
  });

  it('rejects with the status and Resend error message when delivery is refused', async () => {
    const { fetchFn } = fakeFetch({ status: 403, body: { name: 'validation_error', message: 'The 10me.test domain is not verified.' } });
    const sender = createResendEmailSender({ apiKey: 're_test', from: 'hello@10me.test', fetchFn });

    await expect(sender.send(message)).rejects.toThrow(/403.*domain is not verified/);
  });
});

describe('emailSenderFromEnv', () => {
  it('falls back to logging to the console when Resend is not configured', () => {
    expect(emailSenderFromEnv({})).toBe(consoleEmailSender);
  });

  it('uses Resend when both the API key and from address are set', () => {
    const sender = emailSenderFromEnv({ RESEND_API_KEY: 're_test', EMAIL_FROM: 'hello@10me.test' });

    expect(sender).not.toBe(consoleEmailSender);
  });

  it('refuses a half-configured setup instead of silently not sending', () => {
    expect(() => emailSenderFromEnv({ RESEND_API_KEY: 're_test' })).toThrow(/EMAIL_FROM/);
    expect(() => emailSenderFromEnv({ EMAIL_FROM: 'hello@10me.test' })).toThrow(/RESEND_API_KEY/);
  });
});

describe('Gmail email sender', () => {
  function fakeTransport() {
    const sent: Record<string, unknown>[] = [];
    return { sent, transport: { sendMail: async (mail: Record<string, unknown>) => void sent.push(mail) } };
  }

  it('sends from the Gmail account, as text plus branded HTML, with attachments', async () => {
    const { sent, transport } = fakeTransport();
    const sender = createGmailEmailSender({ user: 'tenme@gmail.com', appPassword: 'x', transport });

    await sender.send({ ...message, attachments: [{ filename: 'meeting.ics', contentType: 'text/calendar; method=PUBLISH', content: 'BEGIN:VCALENDAR' }] });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      from: '10 Minute English <tenme@gmail.com>',
      to: 'sarah@example.com',
      subject: 'Confirm your 10ME email',
      text: 'Confirm: https://x/confirm',
      attachments: [{ filename: 'meeting.ics', contentType: 'text/calendar; method=PUBLISH', content: 'BEGIN:VCALENDAR' }],
    });
    expect(String(sent[0].html)).toContain('10 Minute English');
  });

  it('uses a custom From name when given', async () => {
    const { sent, transport } = fakeTransport();
    const sender = createGmailEmailSender({ user: 'tenme@gmail.com', appPassword: 'x', from: '10ME Team <tenme@gmail.com>', transport });

    await sender.send(message);

    expect(sent[0].from).toBe('10ME Team <tenme@gmail.com>');
  });
});

describe('EMAIL_PROVIDER switch', () => {
  it('gmail: uses EMAIL_FROM only when it is the Gmail address', () => {
    expect(gmailFrom('tenme@gmail.com', 'onboarding@resend.dev')).toBeUndefined();
    expect(gmailFrom('tenme@gmail.com', '10ME Team <TenMe@gmail.com>')).toBe('10ME Team <TenMe@gmail.com>');
    expect(gmailFrom('tenme@gmail.com')).toBeUndefined();
  });

  it('describes the setup for the startup log', () => {
    expect(describeEmailSetup({ EMAIL_PROVIDER: 'gmail', GMAIL_USER: 'tenme@gmail.com', GMAIL_APP_PASSWORD: 'p' })).toBe('Sending email via Gmail as tenme@gmail.com.');
    expect(describeEmailSetup({})).toBe('Emails are logged here, not delivered.');
  });

  it('gmail: needs GMAIL_USER and GMAIL_APP_PASSWORD, and ignores Resend settings', () => {
    expect(emailSenderFromEnv({ EMAIL_PROVIDER: 'gmail', GMAIL_USER: 'a@gmail.com', GMAIL_APP_PASSWORD: 'p', RESEND_API_KEY: 're_x' })).not.toBe(consoleEmailSender);
    expect(() => emailSenderFromEnv({ EMAIL_PROVIDER: 'gmail', GMAIL_USER: 'a@gmail.com' })).toThrow(/GMAIL_APP_PASSWORD/);
    expect(() => emailSenderFromEnv({ EMAIL_PROVIDER: 'gmail', GMAIL_APP_PASSWORD: 'p' })).toThrow(/GMAIL_USER/);
  });

  it('resend: needs its key and from address', () => {
    expect(emailSenderFromEnv({ EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_x', EMAIL_FROM: 'a@b.test' })).not.toBe(consoleEmailSender);
    expect(() => emailSenderFromEnv({ EMAIL_PROVIDER: 'resend' })).toThrow(/RESEND_API_KEY/);
  });

  it('console: logs only, even with providers configured', () => {
    expect(emailSenderFromEnv({ EMAIL_PROVIDER: 'console', RESEND_API_KEY: 're_x', EMAIL_FROM: 'a@b.test' })).toBe(consoleEmailSender);
  });

  it('refuses an unknown provider', () => {
    expect(() => emailSenderFromEnv({ EMAIL_PROVIDER: 'pigeon' })).toThrow(/EMAIL_PROVIDER/);
  });
});
