import 'dotenv/config';
import { createApp } from './app.js';
import { connectToDatabase } from './db.js';
import { describeEmailSetup, emailSenderFromEnv } from './services/email.js';
import { REMINDER_LEAD_MINUTES } from './services/lessonReminders.js';
import { SWEEP_INTERVAL_MS, runAllSweeps } from './services/sweeps.js';
import { mockPoliClient, mockStripeClient } from './services/mockPaymentClients.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const PAYMENTS_MOCK = process.env.PAYMENTS_MOCK === 'true';

if (!MONGODB_URI) throw new Error('MONGODB_URI is not set');
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set');

async function main() {
  await connectToDatabase(MONGODB_URI!);
  const emailSender = emailSenderFromEnv();
  console.log(describeEmailSetup());
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

  // Reminders, lesson completion and the Buddy/tag reconciliation are
  // time-driven, not request-driven. Locally this process runs them on a
  // timer. On Cloud Run CPU pauses between requests, so SWEEP_MODE=scheduler
  // turns the timer off and Cloud Scheduler calls POST /internal/sweeps
  // every minute instead (see routes/sweeps.ts).
  if (process.env.SWEEP_MODE === 'scheduler') {
    console.log('SWEEP_MODE=scheduler — background jobs run when Cloud Scheduler calls POST /internal/sweeps.');
  } else {
    setInterval(() => {
      runAllSweeps(emailSender).then((r) => {
        if (r.strandedLessonsCancelled || r.membersCleanedOfDeletedTags) {
          console.log(`Reconciliation: cancelled ${r.strandedLessonsCancelled} stranded meeting(s), cleaned ${r.membersCleanedOfDeletedTags} member(s) of deleted tags.`);
        }
      });
    }, SWEEP_INTERVAL_MS);
    console.log(`Background jobs (reminders ${REMINDER_LEAD_MINUTES}min ahead, completion, reconciliation) every ${SWEEP_INTERVAL_MS / 1000}s.`);
  }
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
