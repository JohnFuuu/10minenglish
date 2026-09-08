import type { EmailSender } from './email.js';

export const EMAIL_CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000;

function frontendUrl(): string {
  return process.env.FRONTEND_URL ?? 'http://localhost:5173';
}

// Used by signup, resend-confirmation, and the profile email-change flow, so
// every confirmation link is built and worded the same way.
export async function sendConfirmationEmail(
  emailSender: EmailSender,
  to: string,
  token: string,
  intro = 'Confirm your email',
): Promise<void> {
  await emailSender.send({
    to,
    subject: 'Confirm your 10ME email',
    body: `${intro}: ${frontendUrl()}/confirm-email?token=${token}`,
  });
}
