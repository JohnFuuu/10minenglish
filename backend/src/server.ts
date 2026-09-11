import 'dotenv/config';
import { createApp } from './app.js';
import { connectToDatabase } from './db.js';
import { consoleEmailSender } from './services/email.js';
import {
  REMINDER_LEAD_MINUTES,
  REMINDER_SWEEP_INTERVAL_MS,
  sendDueLessonReminders,
} from './services/lessonReminders.js';
import { COMPLETION_SWEEP_INTERVAL_MS, completeDueLessons } from './services/lessonCompletion.js';
import { mockPoliClient, mockStripeClient } from './services/mockPaymentClients.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const PAYMENTS_MOCK = process.env.PAYMENTS_MOCK === 'true';

if (!MONGODB_URI) throw new Error('MONGODB_URI is not set');
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set');

async function main() {
  await connectToDatabase(MONGODB_URI!);
  const emailSender = consoleEmailSender;
  const app = createApp(
    PAYMENTS_MOCK
      ? { emailSender, stripeClient: mockStripeClient, poliClient: mockPoliClient }
      : { emailSender },
  );
  if (PAYMENTS_MOCK) {
    console.log('PAYMENTS_MOCK=true — Stripe/POLi checkout will auto-succeed, no real provider calls.');
  }
  app.listen(PORT, () => {
    console.log(`10ME backend listening on port ${PORT}`);
  });

  // Reminders are time-scheduled rather than request-driven, so the server
  // sweeps for them itself. Swap this for an external scheduler calling
  // sendDueLessonReminders if the app is ever run as more than one instance.
  // Uses the same emailSender passed into createApp above, so there is one
  // place — not two — that decides how this process sends email.
  setInterval(() => {
    sendDueLessonReminders({ emailSender }).catch((err) => {
      console.error('Lesson reminder sweep failed', err);
    });
  }, REMINDER_SWEEP_INTERVAL_MS);
  console.log(`Lesson reminders sweeping every ${REMINDER_SWEEP_INTERVAL_MS / 1000}s, ${REMINDER_LEAD_MINUTES}min ahead of each lesson.`);

  // Same rationale as the reminder sweep above: there's no external signal
  // for "the Zoom call ended", so completion is driven by this timer instead
  // of a request.
  setInterval(() => {
    completeDueLessons().catch((err) => {
      console.error('Lesson completion sweep failed', err);
    });
  }, COMPLETION_SWEEP_INTERVAL_MS);
  console.log(`Lesson completion sweeping every ${COMPLETION_SWEEP_INTERVAL_MS / 1000}s.`);
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
