import { describe, expect, it } from 'vitest';
import { consoleEmailSender, createResendEmailSender, emailSenderFromEnv } from '../../src/services/email.js';

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

    await sender.send({ ...message, attachments: [{ filename: 'lesson.ics', contentType: 'text/calendar', content: 'BEGIN:VCALENDAR' }] });

    expect(JSON.parse(String(calls[0].init.body)).attachments).toEqual([
      { filename: 'lesson.ics', content: Buffer.from('BEGIN:VCALENDAR').toString('base64'), content_type: 'text/calendar' },
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
