import { DateTime } from 'luxon';
import type mongoose from 'mongoose';
import type { AccountDocument } from '../models/Account.js';
import type { AvailabilityBlock } from '../models/Account.js';
import { Account } from '../models/Account.js';
import { Lesson, LESSON_DURATION_MINUTES, type LessonDocument } from '../models/Lesson.js';
import type { EmailMessage } from './email.js';

// UI granularity for slot pickers — coarser than the 10-minute lesson length
// itself so a full day's bookable grid stays a manageable size.
export const SLOT_INTERVAL_MINUTES = 30;

export const JOIN_WINDOW_MINUTES_BEFORE = 10;

export const CANCELLATION_REFUND_CUTOFF_HOURS = 12;

export function isLessonJoinable(lesson: LessonDocument, now: Date = new Date()): boolean {
  if (lesson.status !== 'upcoming') return false;
  const windowStart = new Date(lesson.startTime.getTime() - JOIN_WINDOW_MINUTES_BEFORE * 60_000);
  const windowEnd = new Date(lesson.startTime.getTime() + lesson.durationMinutes * 60_000);
  return now >= windowStart && now <= windowEnd;
}

export function isLessonUpcoming(lesson: LessonDocument, now: Date = new Date()): boolean {
  const endTime = lesson.startTime.getTime() + lesson.durationMinutes * 60_000;
  return lesson.status === 'upcoming' && endTime > now.getTime();
}

export async function cancelLesson(params: {
  lessonId: mongoose.Types.ObjectId | string;
  accountId: mongoose.Types.ObjectId | string;
  now?: Date;
}): Promise<{ lesson: LessonDocument; refunded: boolean; creditsRemaining: number } | null> {
  const { lessonId, accountId, now = new Date() } = params;

  // Atomically claim the lesson: only the request that actually flips
  // status upcoming -> cancelled proceeds. Concurrent cancel requests for
  // the same lesson will have all but one of these calls return null,
  // preventing a double refund.
  const claimed = await Lesson.findOneAndUpdate(
    { _id: lessonId, status: 'upcoming' },
    { $set: { status: 'cancelled' } },
    { returnDocument: 'after' },
  );
  if (!claimed) return null;

  const hoursUntilStart = (claimed.startTime.getTime() - now.getTime()) / (60 * 60 * 1000);
  const refunded = hoursUntilStart >= CANCELLATION_REFUND_CUTOFF_HOURS;

  let creditsRemaining: number;
  if (refunded) {
    const updatedAccount = await Account.findOneAndUpdate(
      { _id: accountId },
      { $inc: { credits: claimed.creditsCost } },
      { returnDocument: 'after' },
    );
    creditsRemaining = updatedAccount?.credits ?? 0;
  } else {
    const account = await Account.findById(accountId);
    creditsRemaining = account?.credits ?? 0;
  }

  return { lesson: claimed, refunded, creditsRemaining };
}

export async function buddyCancelLesson(params: {
  lessonId: mongoose.Types.ObjectId | string;
}): Promise<{ lesson: LessonDocument; creditsRemaining: number } | null> {
  const { lessonId } = params;

  // Same atomic claim pattern as cancelLesson: only the request that flips
  // upcoming -> cancelled proceeds, so concurrent cancels can't double-refund.
  const claimed = await Lesson.findOneAndUpdate(
    { _id: lessonId, status: 'upcoming' },
    { $set: { status: 'cancelled' } },
    { returnDocument: 'after' },
  );
  if (!claimed) return null;

  // Buddy-initiated cancellation always refunds — no cutoff check, unlike
  // cancelLesson — and it refunds the Lesson's User, not the caller.
  const updatedUser = await Account.findOneAndUpdate(
    { _id: claimed.userId },
    { $inc: { credits: claimed.creditsCost } },
    { returnDocument: 'after' },
  );

  return { lesson: claimed, creditsRemaining: updatedUser?.credits ?? 0 };
}

function parseMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function fitsInBlock(dayOfWeek: number, minuteOfDay: number, durationMinutes: number, block: AvailabilityBlock): boolean {
  const start = parseMinutes(block.startTime);
  const end = parseMinutes(block.endTime);

  if (end > start) {
    return dayOfWeek === block.dayOfWeek && minuteOfDay >= start && minuteOfDay + durationMinutes <= end;
  }

  // Overnight block (e.g. 22:00-02:00): spans block.dayOfWeek 22:00-24:00 and
  // the following day 00:00-02:00.
  if (dayOfWeek === block.dayOfWeek && minuteOfDay >= start) {
    return minuteOfDay + durationMinutes <= 1440 || minuteOfDay + durationMinutes - 1440 <= end;
  }
  if (dayOfWeek === (block.dayOfWeek + 1) % 7 && minuteOfDay < end) {
    return minuteOfDay + durationMinutes <= end;
  }
  return false;
}

export function isWithinAvailability(
  instant: Date,
  blocks: AvailabilityBlock[],
  timezone: string,
  durationMinutes: number = LESSON_DURATION_MINUTES,
): boolean {
  const local = DateTime.fromJSDate(instant, { zone: 'utc' }).setZone(timezone);
  const dayOfWeek = local.weekday % 7; // luxon: 1=Mon..7=Sun -> 0=Sun..6=Sat
  const minuteOfDay = local.hour * 60 + local.minute;

  return blocks.some((block) => fitsInBlock(dayOfWeek, minuteOfDay, durationMinutes, block));
}

export function generateCandidateSlots(dateISO: string, timezone: string): Date[] {
  const dayStart = DateTime.fromISO(dateISO, { zone: timezone }).startOf('day');
  const slots: Date[] = [];
  for (let minutes = 0; minutes + LESSON_DURATION_MINUTES <= 24 * 60; minutes += SLOT_INTERVAL_MINUTES) {
    slots.push(dayStart.plus({ minutes }).toJSDate());
  }
  return slots;
}

export async function hasConflict(
  buddyId: mongoose.Types.ObjectId | string,
  startTime: Date,
  durationMinutes: number = LESSON_DURATION_MINUTES,
  // Set when moving an existing Lesson, so it isn't treated as a conflict with
  // itself when the new slot overlaps the old one.
  excludeLessonId?: mongoose.Types.ObjectId | string,
): Promise<boolean> {
  const lower = new Date(startTime.getTime() - durationMinutes * 60_000);
  const upper = new Date(startTime.getTime() + durationMinutes * 60_000);
  const conflict = await Lesson.findOne({
    buddyId,
    status: 'upcoming',
    startTime: { $gt: lower, $lt: upper },
    ...(excludeLessonId ? { _id: { $ne: excludeLessonId } } : {}),
  });
  return conflict !== null;
}

// One definition of "a Buddy a User may book": provisioned, in rotation, and
// reachable (ADR-0002 — no meeting link, no Lesson). Every list and every booking
// path filters on this, so a deactivated Buddy disappears from all of them at
// once.
export const BOOKABLE_BUDDY_QUERY = {
  role: 'buddy',
  active: true,
  meetingLink: { $exists: true, $nin: [null, ''] },
} as const;

export async function isSlotBookable(
  buddy: AccountDocument,
  instant: Date,
  excludeLessonId?: mongoose.Types.ObjectId | string,
): Promise<boolean> {
  if (buddy.role !== 'buddy' || !buddy.active || !buddy.meetingLink || !buddy.timezone) return false;
  if (!isWithinAvailability(instant, buddy.availabilityBlocks, buddy.timezone)) return false;
  return !(await hasConflict(buddy._id, instant, LESSON_DURATION_MINUTES, excludeLessonId));
}

export async function findAvailableBuddy(instant: Date): Promise<AccountDocument | null> {
  const buddies = await Account.find(BOOKABLE_BUDDY_QUERY).sort({ _id: 1 });

  for (const buddy of buddies) {
    if (await isSlotBookable(buddy, instant)) return buddy;
  }
  return null;
}

// Charges the User `creditsCost` and books the Lesson, recording its cost.
// The charge is one conditional update ("only if they still have enough"),
// so two bookings at once can't spend the same credits; null means they
// couldn't afford it and nothing was booked. Keeps `user.credits` in step.
export async function bookLesson(params: {
  user: AccountDocument;
  buddy: AccountDocument;
  startTime: Date;
  creditsCost: number;
}): Promise<LessonDocument | null> {
  const { user, buddy, startTime, creditsCost } = params;
  const charged = await Account.findOneAndUpdate(
    { _id: user._id, credits: { $gte: creditsCost } },
    { $inc: { credits: -creditsCost } },
    { returnDocument: 'after' },
  );
  if (!charged) return null;
  user.credits = charged.credits;
  try {
    return await Lesson.create({
      userId: user._id,
      buddyId: buddy._id,
      startTime,
      meetingLink: buddy.meetingLink,
      creditsCost,
    });
  } catch (err) {
    // Don't keep credits for a Lesson that was never created.
    await Account.updateOne({ _id: user._id }, { $inc: { credits: creditsCost } });
    user.credits += creditsCost;
    throw err;
  }
}

export function buildConfirmationEmail(
  to: string,
  entries: { startTime: Date; buddyName: string; meetingLink: string }[],
  // The User's, so times read in their own day.
  timezone?: string,
): EmailMessage {
  const lines = entries.map((e) => `${formatLessonTimeFor(e.startTime, timezone)} with ${e.buddyName} — ${e.meetingLink}`);
  return {
    to,
    subject: entries.length > 1 ? `Your ${entries.length} 10ME lessons are booked` : 'Your 10ME lesson is booked',
    body: `Your lesson${entries.length > 1 ? 's are' : ' is'} booked:\n\n${lines.join('\n')}`,
  };
}

export function buildBuddyCancellationNotification(params: {
  buddyName: string;
  userEmail: string;
  startTime: Date;
  creditsRemaining: number;
  timezone?: string;
}): { message: string; email: EmailMessage } {
  const startTimeText = formatLessonTimeFor(params.startTime, params.timezone);
  return {
    message: `${params.buddyName} cancelled your lesson on ${startTimeText}. The credits you paid are back in your account.`,
    email: {
      to: params.userEmail,
      subject: 'Your 10ME lesson was cancelled — credit refunded',
      body: `${params.buddyName} cancelled your lesson scheduled for ${startTimeText}. The credits you paid are back in your account — you now have ${params.creditsRemaining} credit(s). Book another lesson anytime.`,
    },
  };
}

export function buildLessonRescheduledNotification(params: {
  userName: string;
  buddyEmail: string;
  previousStartTime: Date;
  startTime: Date;
  timezone?: string;
}): { message: string; email: EmailMessage } {
  const from = formatLessonTimeFor(params.previousStartTime, params.timezone);
  const to = formatLessonTimeFor(params.startTime, params.timezone);
  return {
    message: `${params.userName} moved your lesson from ${from} to ${to}.`,
    email: {
      to: params.buddyEmail,
      subject: 'A 10ME lesson was moved',
      body: `${params.userName} moved your lesson from ${from} to ${to}. Your meeting link is unchanged.`,
    },
  };
}

export type RecurringFrequency = { type: 'daily' } | { type: 'weekly' } | { type: 'everyXDays'; days: number };

function stepDays(frequency: RecurringFrequency): number {
  switch (frequency.type) {
    case 'daily':
      return 1;
    case 'weekly':
      return 7;
    case 'everyXDays':
      return frequency.days;
  }
}

// The dates a recurring booking will try: the first `count` steps of the
// pattern in the viewer's own calendar (same clock time), leaving out Sat/Sun
// unless weekends are included. A busy date is skipped at booking time, never
// replaced by a later one (see docs/adr/0001). Bounded, so a pattern that only
// ever lands on a weekend (weekly from a Sunday, weekends off) yields no
// dates instead of searching forever.
export function planRecurringOccurrences(
  anchor: Date,
  frequency: RecurringFrequency,
  includeWeekends: boolean,
  count: number,
  timezone: string = 'utc',
): Date[] {
  const step = stepDays(frequency);
  const dates: Date[] = [];
  let current = DateTime.fromJSDate(anchor, { zone: 'utc' }).setZone(timezone);
  // Weekdays-only still lands at least 2 of every 7 steps, so count * 7 is ample.
  for (let steps = 0; dates.length < count && steps < count * 7; steps += 1) {
    const isWeekend = current.weekday === 6 || current.weekday === 7; // luxon: 6=Sat, 7=Sun
    if (includeWeekends || !isWeekend) dates.push(current.toJSDate());
    current = current.plus({ days: step });
  }
  return dates;
}

// A lesson time as the reader would say it, in their own timezone, e.g.
// "Sat 31 Oct 2099, 1:30 pm". Falls back to UTC (and says so) for an
// account without a timezone.
export function formatLessonTimeFor(startTime: Date, timezone?: string): string {
  const zoned = DateTime.fromJSDate(startTime, { zone: timezone ?? 'UTC' });
  const zone = zoned.isValid ? zoned : DateTime.fromJSDate(startTime, { zone: 'UTC' });
  const text = zone.setLocale('en-NZ').toFormat('ccc d LLL yyyy, h:mm a').replace(/AM$|PM$/, (m) => m.toLowerCase());
  return timezone && zoned.isValid ? text : `${text} (UTC)`;
}

// The User cancelled, so they get a plain confirmation that says whether
// their credit came back, in short sentences for learners.
export function buildUserCancellationEmail(params: {
  to: string;
  name?: string;
  buddyName: string;
  startTime: Date;
  timezone?: string;
  refunded: boolean;
  // What the Lesson cost — the amount refunded (or not).
  creditsCost: number;
}): EmailMessage {
  const when = formatLessonTimeFor(params.startTime, params.timezone);
  const credits = `${params.creditsCost} credit${params.creditsCost === 1 ? '' : 's'}`;
  const refundLine = params.refunded
    ? `Your ${credits} ${params.creditsCost === 1 ? 'is' : 'are'} back in your account.`
    : `You cancelled less than ${CANCELLATION_REFUND_CUTOFF_HOURS} hours before the lesson, so the ${credits} ${params.creditsCost === 1 ? 'was' : 'were'} not returned.`;
  return {
    to: params.to,
    subject: 'Your 10ME lesson is cancelled',
    body: [
      `Hi ${params.name ?? 'there'},`,
      `Your lesson with ${params.buddyName} on ${when} is cancelled.`,
      refundLine,
      'Book another lesson whenever you like.',
      '— The 10ME team',
    ].join('\n\n'),
  };
}

// The Buddy didn't cancel, so they get a Notification (in the app and by
// email), like a reschedule.
export function buildLessonCancelledByUserNotification(params: {
  userName: string;
  buddyEmail?: string;
  startTime: Date;
  timezone?: string;
}): { message: string; email?: EmailMessage } {
  const when = formatLessonTimeFor(params.startTime, params.timezone);
  const message = `${params.userName} cancelled your lesson on ${when}. That time is free again.`;
  return {
    message,
    email: params.buddyEmail
      ? { to: params.buddyEmail, subject: 'A 10ME lesson was cancelled', body: `${message} You don't need to do anything.` }
      : undefined,
  };
}
