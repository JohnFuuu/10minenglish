import { Account } from '../models/Account.js';
import { Lesson, type LessonDocument } from '../models/Lesson.js';
import type { EmailMessage, EmailSender } from './email.js';
import { lessonDateAndTime } from './lessonBooking.js';
import { createNotification } from './notifications.js';

// How far ahead of a Lesson its reminder goes out.
export const REMINDER_LEAD_MINUTES = 60;

// "in 1 hour" / "in 20 minutes" — how long until the meeting when the
// reminder goes out. Said outright so the email's arrival time (an hour
// early) can't be mistaken for the meeting time.
function startsIn(startTime: Date, now: Date): string {
  const minutes = Math.max(1, Math.round((startTime.getTime() - now.getTime()) / 60_000));
  if (minutes >= REMINDER_LEAD_MINUTES - 5) return 'in 1 hour';
  return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function buildLessonReminderNotification(params: {
  recipientEmail: string;
  otherPartyName: string;
  startTime: Date;
  meetingLink: string;
  timezone?: string;
  now?: Date;
}): { message: string; email: EmailMessage } {
  // The reader's own clock time, e.g. "1:00 pm on Sun 18 Oct 2026"; marked
  // "(UTC)" when we don't know their time zone.
  const { date, time, utc } = lessonDateAndTime(params.startTime, params.timezone);
  const when = `${startsIn(params.startTime, params.now ?? new Date())}, at ${time}${utc ? ' (UTC)' : ''} on ${date}`;
  return {
    message: `Reminder: your meeting with ${params.otherPartyName} starts ${when}.`,
    email: {
      to: params.recipientEmail,
      subject: `Your 10ME meeting starts ${startsIn(params.startTime, params.now ?? new Date())}`,
      body: `Your meeting with ${params.otherPartyName} starts ${when}. Join here: ${params.meetingLink}`,
    },
  };
}

async function remindBothParties(
  emailSender: EmailSender,
  lesson: LessonDocument,
  now: Date,
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
      // Booking requires a confirmed email, and Buddies are provisioned with
      // one, so both sides of a Lesson have an address.
      recipientEmail: account.email!,
      otherPartyName,
      startTime: lesson.startTime,
      meetingLink: lesson.meetingLink,
      timezone: account.timezone,
      now,
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
      await remindBothParties(emailSender, claimed, now);
      remindersSent += 1;
    } catch (err) {
      // One bad Lesson must not stop the sweep for the rest.
      console.error('Failed to send meeting reminder', err);
    }
  }

  return { remindersSent };
}
