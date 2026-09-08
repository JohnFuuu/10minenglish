import { Account } from '../models/Account.js';
import { Lesson, type LessonDocument } from '../models/Lesson.js';
import type { EmailMessage, EmailSender } from './email.js';
import { createNotification } from './notifications.js';

// How far ahead of a Lesson its reminder goes out.
export const REMINDER_LEAD_MINUTES = 60;

// How often the server sweeps for due reminders. Anything smaller than the lead
// time works; this only bounds how late a reminder can be.
export const REMINDER_SWEEP_INTERVAL_MS = 60_000;

export function buildLessonReminderNotification(params: {
  recipientEmail: string;
  otherPartyName: string;
  startTime: Date;
  zoomLink: string;
}): { message: string; email: EmailMessage } {
  const startTimeText = params.startTime.toISOString();
  return {
    message: `Reminder: your lesson with ${params.otherPartyName} starts at ${startTimeText}.`,
    email: {
      to: params.recipientEmail,
      subject: 'Your 10ME lesson is coming up',
      body: `Your lesson with ${params.otherPartyName} starts at ${startTimeText}. Join here: ${params.zoomLink}`,
    },
  };
}

async function remindBothParties(
  emailSender: EmailSender,
  lesson: LessonDocument,
): Promise<void> {
  const [user, buddy] = await Promise.all([
    Account.findById(lesson.userId),
    Account.findById(lesson.buddyId),
  ]);

  // Both sides get the same reminder on the same dual in-app + email channel.
  const recipients = [
    { account: user, otherPartyName: buddy?.name ?? 'your Buddy' },
    { account: buddy, otherPartyName: user?.name ?? 'your learner' },
  ];

  for (const { account, otherPartyName } of recipients) {
    if (!account) continue;
    const { message, email } = buildLessonReminderNotification({
      recipientEmail: account.email,
      otherPartyName,
      startTime: lesson.startTime,
      zoomLink: lesson.zoomLink,
    });
    await createNotification({
      emailSender,
      accountId: account._id,
      type: 'lesson_reminder',
      message,
      email,
    });
  }
}

// Sends the reminder for every Lesson now inside the lead window. Driven by the
// server's sweep timer rather than a request, so it is the scheduler's entry
// point; safe to call repeatedly.
export async function sendDueLessonReminders(params: {
  emailSender: EmailSender;
  now?: Date;
}): Promise<{ remindersSent: number }> {
  const { emailSender, now = new Date() } = params;
  const dueBy = new Date(now.getTime() + REMINDER_LEAD_MINUTES * 60_000);

  const due = await Lesson.find({
    status: 'upcoming',
    reminderSentAt: { $exists: false },
    startTime: { $gt: now, $lte: dueBy },
  });

  let remindersSent = 0;
  for (const lesson of due) {
    // Same atomic-claim pattern as cancellation: only the sweep that actually
    // stamps reminderSentAt sends, so overlapping sweeps can't double-send.
    const claimed = await Lesson.findOneAndUpdate(
      { _id: lesson._id, status: 'upcoming', reminderSentAt: { $exists: false } },
      { $set: { reminderSentAt: now } },
      { returnDocument: 'after' },
    );
    if (!claimed) continue;

    try {
      await remindBothParties(emailSender, claimed);
      remindersSent += 1;
    } catch (err) {
      // One bad Lesson must not stop the sweep for the rest.
      console.error('Failed to send lesson reminder', err);
    }
  }

  return { remindersSent };
}
