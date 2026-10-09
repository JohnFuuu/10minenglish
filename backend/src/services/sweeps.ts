import type { EmailSender } from './email.js';
import { reconcileBuddyState } from './buddyReconciliation.js';
import { completeDueLessons } from './lessonCompletion.js';
import { sendDueLessonReminders } from './lessonReminders.js';

// How often the time-driven jobs should run — every sweep is idempotent, so
// running one late or twice is harmless.
export const SWEEP_INTERVAL_MS = 60_000;

export interface SweepResult {
  remindersSent: number;
  lessonsCompleted: number;
  strandedLessonsCancelled: number;
  membersCleanedOfDeletedTags: number;
  errors: string[];
}

// Runs every time-driven job once: pre-lesson reminders, marking finished
// Lessons completed, and the Buddy/tag reconciliation backstop (see
// docs/adr/0008). One job failing doesn't stop the others; its error is
// reported in `errors`.
export async function runAllSweeps(emailSender: EmailSender): Promise<SweepResult> {
  const result: SweepResult = {
    remindersSent: 0,
    lessonsCompleted: 0,
    strandedLessonsCancelled: 0,
    membersCleanedOfDeletedTags: 0,
    errors: [],
  };
  const attempt = async (name: string, job: () => Promise<void>) => {
    try {
      await job();
    } catch (err) {
      console.error(`${name} sweep failed`, err);
      result.errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  await attempt('Meeting reminder', async () => {
    result.remindersSent = (await sendDueLessonReminders({ emailSender })).remindersSent;
  });
  await attempt('Meeting completion', async () => {
    result.lessonsCompleted = (await completeDueLessons()).completed;
  });
  await attempt('Reconciliation', async () => {
    const { cancelledLessons, membersWithDanglingTagsCleaned } = await reconcileBuddyState({ emailSender });
    result.strandedLessonsCancelled = cancelledLessons;
    result.membersCleanedOfDeletedTags = membersWithDanglingTagsCleaned;
  });
  return result;
}
