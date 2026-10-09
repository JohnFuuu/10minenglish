import { DateTime } from 'luxon';
import type mongoose from 'mongoose';
import type { AccountDocument } from '../models/Account.js';
import type { AvailabilityBlock } from '../models/Account.js';
import { Account } from '../models/Account.js';
import { Lesson, LESSON_DURATION_MINUTES, type LessonDocument } from '../models/Lesson.js';
import type { EmailMessage } from './email.js';
import { EMAIL_COLORS, appUrl, brandedHtml, button, escapeHtml, heading, lessonCard, note, paragraph, quote } from './emailLayout.js';

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
  reason?: string;
  now?: Date;
}): Promise<{ lesson: LessonDocument; refunded: boolean; creditsRemaining: number } | null> {
  const { lessonId, accountId, reason, now = new Date() } = params;

  // Atomically claim the lesson: only the request that actually flips
  // status upcoming -> cancelled proceeds. Concurrent cancel requests for
  // the same lesson will have all but one of these calls return null,
  // preventing a double refund.
  const claimed = await Lesson.findOneAndUpdate(
    { _id: lessonId, status: 'upcoming' },
    { $set: { status: 'cancelled', ...(reason ? { cancellationReason: reason } : {}) } },
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
  reason?: string;
}): Promise<{ lesson: LessonDocument; creditsRemaining: number } | null> {
  const { lessonId, reason } = params;

  // Same atomic claim pattern as cancelLesson: only the request that flips
  // upcoming -> cancelled proceeds, so concurrent cancels can't double-refund.
  const claimed = await Lesson.findOneAndUpdate(
    { _id: lessonId, status: 'upcoming' },
    { $set: { status: 'cancelled', ...(reason ? { cancellationReason: reason } : {}) } },
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

// The member's booking confirmation: a greeting, a one-line summary, then
// each lesson numbered with its date and time in their own timezone. A
// meeting link shared by every lesson is shown once (as a Join button)
// instead of on every line.
export function buildConfirmationEmail(
  to: string,
  entries: { startTime: Date; buddyName: string; meetingLink: string }[],
  // The User's, so times read in their own day.
  timezone?: string,
  name?: string,
): EmailMessage {
  const lessons = entries.map((e) => ({ ...e, ...lessonDateAndTime(e.startTime, timezone) }));
  const count = lessons.length;
  const buddies = [...new Set(lessons.map((l) => l.buddyName))];
  const oneBuddy = buddies.length === 1 ? buddies[0] : undefined;
  const sharedLink = new Set(lessons.map((l) => l.meetingLink)).size === 1 ? lessons[0]?.meetingLink : undefined;
  const what = `${count} meeting${count === 1 ? '' : 's'}${oneBuddy ? ` with ${oneBuddy}` : ''}`;
  const greeting = `Hi ${name ?? 'there'},`;
  const intro = count === 1 ? `Your meeting${oneBuddy ? ` with ${oneBuddy}` : ''} is booked. See you there!` : `Your ${what} are booked. See you there!`;
  const zoneNote = lessons.some((l) => l.utc) ? 'Times are in UTC.' : undefined;

  const textLines = lessons.map(
    (l, i) => `${i + 1}. ${l.date} · ${l.time}${oneBuddy ? '' : ` · with ${l.buddyName}`}${sharedLink ? '' : ` · ${l.meetingLink}`}`,
  );
  const body = [
    greeting,
    intro,
    textLines.join('\n'),
    ...(sharedLink ? [`${count === 1 ? 'Join with this link' : 'Join every meeting with this link'}: ${sharedLink}`] : []),
    ...(zoneNote ? [zoneNote] : []),
    'Need to change something? You can move or cancel a meeting in the app (free up to 12 hours before).',
    '— The 10 Minute English team',
  ].join('\n\n');

  const { BRAND_GREEN, TEXT, MUTED } = EMAIL_COLORS;
  const rows = lessons
    .map(
      (l, i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
<td width="56" style="vertical-align:middle;">
<div style="width:48px;border:2px solid ${BRAND_GREEN};border-radius:10px;text-align:center;overflow:hidden;">
<div style="background:${BRAND_GREEN};color:#fff;font-size:11px;font-weight:bold;padding:2px 0;">${escapeHtml(l.month.toUpperCase())}</div>
<div style="font-size:20px;font-weight:900;color:${TEXT};padding:2px 0 0;">${escapeHtml(l.day)}</div>
<div style="font-size:10px;font-weight:bold;color:${MUTED};padding:0 0 3px;">${escapeHtml(l.weekday.toUpperCase())}</div>
</div></td>
<td style="vertical-align:middle;padding-left:10px;font-size:15px;color:${TEXT};">
<div style="font-weight:bold;">${escapeHtml(l.date)} · ${escapeHtml(l.time)}${oneBuddy ? '' : ` · ${escapeHtml(l.buddyName)}`}</div>
<div style="font-size:13px;color:${MUTED};">Meeting ${i + 1} of ${count}${sharedLink ? '' : ` · <a href="${escapeHtml(l.meetingLink)}" style="color:${EMAIL_COLORS.BRAND_BLUE};font-weight:bold;">Join</a>`}</div>
</td></tr></table></td></tr>`,
    )
    .join('');
  const html = brandedHtml(
    'Your meetings are booked',
    [
      paragraph(escapeHtml(greeting)),
      `<h1 style="margin:0 0 8px;font-size:22px;font-weight:900;color:${TEXT};">You’re booked! 🎉</h1>`,
      paragraph(
        count === 1
          ? `Your meeting${oneBuddy ? ` with <strong>${escapeHtml(oneBuddy)}</strong>` : ''} is booked. See you there!`
          : `Your <strong>${escapeHtml(what)}</strong> are booked. See you there!`,
      ),
      `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;">${rows}</table>`,
      ...(sharedLink
        ? [
            ...(count > 1 ? [paragraph('Use the same link for every meeting:')] : []),
            button('Join your meeting', sharedLink),
          ]
        : []),
      ...(zoneNote ? [paragraph(`<span style="color:${MUTED};font-size:13px;">${zoneNote}</span>`)] : []),
      paragraph(
        `<span style="color:${MUTED};font-size:14px;">Need to change something? You can move or cancel a meeting in the app — free up to 12 hours before.</span>`,
      ),
    ].join(''),
  );

  return {
    to,
    subject: `You’re booked: ${what}`,
    body,
    html,
  };
}

function creditsLabel(n: number): string {
  return `${n} credit${n === 1 ? '' : 's'}`;
}

export function buildBuddyCancellationNotification(params: {
  buddyName: string;
  userName?: string;
  userEmail: string;
  startTime: Date;
  creditsRemaining: number;
  timezone?: string;
  reason?: string;
}): { message: string; email: EmailMessage } {
  const parts = lessonDateAndTime(params.startTime, params.timezone);
  const when = formatLessonTimeFor(params.startTime, params.timezone);
  const because = params.reason ? ` Reason: “${params.reason}”.` : '';
  const balance = creditsLabel(params.creditsRemaining);
  const greeting = `Hi ${params.userName ?? 'there'},`;
  return {
    message: `${params.buddyName} cancelled your meeting on ${when}.${because} The credits you paid are back in your account.`,
    email: {
      to: params.userEmail,
      subject: `${params.buddyName} cancelled your meeting — credits refunded`,
      body: [
        greeting,
        `${params.buddyName} cancelled your meeting on ${when}.${because}`,
        `The credits you paid are back in your account. You have ${balance}.`,
        `Book another meeting whenever you like: ${appUrl('/book')}`,
        '— The 10 Minute English team',
      ].join('\n\n'),
      html: brandedHtml(
        'Your meeting was cancelled',
        [
          paragraph(escapeHtml(greeting)),
          heading(`${params.buddyName} had to cancel your meeting`),
          lessonCard({ ...parts, time: parts.time + (parts.utc ? ' (UTC)' : ''), withName: params.buddyName, cancelled: true }),
          ...(params.reason ? [quote(`${params.buddyName}’s reason`, params.reason)] : []),
          note(`✓ The credits you paid are back. You have <strong>${escapeHtml(balance)}</strong>.`, 'good'),
          paragraph('Sorry about that — pick another time that suits you:'),
          button('Book another meeting', appUrl('/book')),
        ].join(''),
      ),
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
    message: `${params.userName} moved your meeting from ${from} to ${to}.`,
    email: {
      to: params.buddyEmail,
      subject: 'A 10ME meeting was moved',
      body: `${params.userName} moved your meeting from ${from} to ${to}. Your meeting link is unchanged.`,
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
  const { date, time, utc } = lessonDateAndTime(startTime, timezone);
  return `${date}, ${time}${utc ? ' (UTC)' : ''}`;
}

// The parts of a lesson time in the reader's timezone, e.g. date "Sun 18 Oct
// 2099", time "1:30 pm"; `utc` when there was no usable timezone.
export function lessonDateAndTime(startTime: Date, timezone?: string) {
  const zoned = DateTime.fromJSDate(startTime, { zone: timezone ?? 'UTC' });
  const usable = Boolean(timezone) && zoned.isValid;
  const dt = (usable ? zoned : DateTime.fromJSDate(startTime, { zone: 'UTC' })).setLocale('en-NZ');
  return {
    date: dt.toFormat('ccc d LLL yyyy'),
    time: dt.toFormat('h:mm a').replace(/AM$|PM$/, (m) => m.toLowerCase()),
    weekday: dt.toFormat('ccc'),
    day: dt.toFormat('d'),
    month: dt.toFormat('LLL'),
    utc: !usable,
  };
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
  // The User's own reason, echoed back so both sides' emails match.
  reason?: string;
}): EmailMessage {
  const parts = lessonDateAndTime(params.startTime, params.timezone);
  const when = formatLessonTimeFor(params.startTime, params.timezone);
  const credits = creditsLabel(params.creditsCost);
  const greeting = `Hi ${params.name ?? 'there'},`;
  const refundLine = params.refunded
    ? `Your ${credits} ${params.creditsCost === 1 ? 'is' : 'are'} back in your account.`
    : `You cancelled less than ${CANCELLATION_REFUND_CUTOFF_HOURS} hours before the meeting, so the ${credits} ${params.creditsCost === 1 ? 'was' : 'were'} not returned.`;
  return {
    to: params.to,
    subject: 'Your 10ME meeting is cancelled',
    body: [
      greeting,
      `Your meeting with ${params.buddyName} on ${when} is cancelled.`,
      ...(params.reason ? [`Your reason: “${params.reason}” (we told ${params.buddyName}).`] : []),
      refundLine,
      `Book another meeting whenever you like: ${appUrl('/book')}`,
      '— The 10 Minute English team',
    ].join('\n\n'),
    html: brandedHtml(
      'Your meeting is cancelled',
      [
        paragraph(escapeHtml(greeting)),
        heading('Your meeting is cancelled'),
        lessonCard({ ...parts, time: parts.time + (parts.utc ? ' (UTC)' : ''), withName: params.buddyName, cancelled: true }),
        ...(params.reason ? [quote(`Your reason (we told ${params.buddyName})`, params.reason)] : []),
        note(
          params.refunded ? `✓ ${escapeHtml(refundLine)}` : escapeHtml(refundLine),
          params.refunded ? 'good' : 'caution',
        ),
        button('Book another meeting', appUrl('/book')),
      ].join(''),
    ),
  };
}

// The Buddy didn't cancel, so they get a Notification (in the app and by
// email), like a reschedule.
export function buildLessonCancelledByUserNotification(params: {
  userName: string;
  buddyName?: string;
  buddyEmail?: string;
  startTime: Date;
  timezone?: string;
  reason?: string;
}): { message: string; email?: EmailMessage } {
  const parts = lessonDateAndTime(params.startTime, params.timezone);
  const when = formatLessonTimeFor(params.startTime, params.timezone);
  const because = params.reason ? ` Reason: “${params.reason}”.` : '';
  const message = `${params.userName} cancelled your meeting on ${when}.${because} That time is free again.`;
  const greeting = `Hi ${params.buddyName ?? 'there'},`;
  return {
    message,
    email: params.buddyEmail
      ? {
          to: params.buddyEmail,
          subject: `${params.userName} cancelled a meeting`,
          body: [greeting, message, "You don't need to do anything.", '— The 10 Minute English team'].join('\n\n'),
          html: brandedHtml(
            'A meeting was cancelled',
            [
              paragraph(escapeHtml(greeting)),
              heading(`${params.userName} cancelled a meeting`),
              lessonCard({ ...parts, time: parts.time + (parts.utc ? ' (UTC)' : ''), withName: params.userName, cancelled: true }),
              ...(params.reason ? [quote(`${params.userName}’s reason`, params.reason)] : []),
              note('That time is free again — you don’t need to do anything.', 'good'),
            ].join(''),
          ),
        }
      : undefined,
  };
}

// Tells a Buddy about new Lessons with a member (one email per booking, all
// of that Buddy's Lessons in it), times in the Buddy's own timezone. The
// route attaches the calendar file.
export function buildBuddyBookingEmail(params: {
  to: string;
  buddyName?: string;
  memberName: string;
  startTimes: Date[];
  timezone?: string;
}): EmailMessage {
  const count = params.startTimes.length;
  const lines = params.startTimes.map((t, i) => {
    const { date, time, utc } = lessonDateAndTime(t, params.timezone);
    return `${count > 1 ? `${i + 1}. ` : ''}${date} · ${time}${utc ? ' (UTC)' : ''}`;
  });
  return {
    to: params.to,
    subject: count === 1 ? `New meeting booked: ${params.memberName}` : `New meetings booked: ${count} with ${params.memberName}`,
    body: [
      `Hi ${params.buddyName ?? 'there'},`,
      `${params.memberName} booked ${count === 1 ? 'a meeting' : `${count} meetings`} with you:`,
      lines.join('\n'),
      'Tap the attached calendar file to add ' + (count === 1 ? 'it' : 'them') + ' to your calendar. Your usual meeting link is in each event.',
      '— The 10 Minute English team',
    ].join('\n\n'),
  };
}
