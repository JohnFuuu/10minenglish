export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

// Dev-only default: logs instead of delivering. Swap for a real provider
// (SES, SendGrid, etc.) at deploy time by passing a different EmailSender
// into createApp.
export const consoleEmailSender: EmailSender = {
  async send(message) {
    console.log(`[email] to=${message.to} subject="${message.subject}"\n${message.body}`);
  },
};
