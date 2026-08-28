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
      { $inc: { credits: 1 } },
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
    { $inc: { credits: 1 } },
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
): Promise<boolean> {
  const lower = new Date(startTime.getTime() - durationMinutes * 60_000);
  const upper = new Date(startTime.getTime() + durationMinutes * 60_000);
  const conflict = await Lesson.findOne({
    buddyId,
    status: 'upcoming',
    startTime: { $gt: lower, $lt: upper },
  });
  return conflict !== null;
}

export async function isSlotBookable(buddy: AccountDocument, instant: Date): Promise<boolean> {
  if (buddy.role !== 'buddy' || !buddy.zoomLink || !buddy.timezone) return false;
  if (!isWithinAvailability(instant, buddy.availabilityBlocks, buddy.timezone)) return false;
  return !(await hasConflict(buddy._id, instant));
}

export async function findAvailableBuddy(instant: Date): Promise<AccountDocument | null> {
  const buddies = await Account.find({
    role: 'buddy',
    zoomLink: { $exists: true, $nin: [null, ''] },
  }).sort({ _id: 1 });

  for (const buddy of buddies) {
    if (await isSlotBookable(buddy, instant)) return buddy;
  }
  return null;
}

export async function bookLesson(params: {
  user: AccountDocument;
  buddy: AccountDocument;
  startTime: Date;
}): Promise<LessonDocument> {
  const { user, buddy, startTime } = params;
  const lesson = await Lesson.create({
    userId: user._id,
    buddyId: buddy._id,
    startTime,
    zoomLink: buddy.zoomLink,
  });
  user.credits -= 1;
  await user.save();
  return lesson;
}

export function buildConfirmationEmail(
  to: string,
  entries: { startTime: Date; buddyName: string; zoomLink: string }[],
): EmailMessage {
  const lines = entries.map((e) => `${e.startTime.toISOString()} with ${e.buddyName} — ${e.zoomLink}`);
  return {
    to,
    subject: entries.length > 1 ? `Your ${entries.length} 10ME lessons are booked` : 'Your 10ME lesson is booked',
    body: `Your lesson${entries.length > 1 ? 's are' : ' is'} booked:\n\n${lines.join('\n')}`,
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

export function* generateRecurringCandidates(
  anchor: Date,
  frequency: RecurringFrequency,
  includeWeekends: boolean,
  timezone: string = 'utc',
): Generator<Date> {
  const step = stepDays(frequency);
  let current = DateTime.fromJSDate(anchor, { zone: 'utc' }).setZone(timezone);
  while (true) {
    const isWeekend = current.weekday === 6 || current.weekday === 7; // luxon: 6=Sat, 7=Sun
    if (includeWeekends || !isWeekend) {
      yield current.toJSDate();
    }
    current = current.plus({ days: step });
  }
}
