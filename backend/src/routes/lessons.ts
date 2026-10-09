import { DateTime } from 'luxon';
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireConfirmedEmail } from '../middleware/requireConfirmedEmail.js';
import { Account, type AccountDocument } from '../models/Account.js';
import { Lesson, LESSON_DURATION_MINUTES, type LessonDocument } from '../models/Lesson.js';
import type { EmailSender } from '../services/email.js';
import {
  BOOKABLE_BUDDY_QUERY,
  bookLesson,
  buildBuddyBookingEmail,
  buildConfirmationEmail,
  buildLessonRescheduledNotification,
  buildLessonCancelledByUserNotification,
  buildUserCancellationEmail,
  cancelLesson,
  CANCELLATION_REFUND_CUTOFF_HOURS,
  findAvailableBuddy,
  generateCandidateSlots,
  planRecurringOccurrences,
  isLessonJoinable,
  isLessonUpcoming,
  isSlotBookable,
  type RecurringFrequency,
} from '../services/lessonBooking.js';
import { cancelLessonAsBuddy } from '../services/buddyCancellation.js';
import { createNotification } from '../services/notifications.js';
import { calendarForLessons, lessonCalendarAttachment, withCalendar } from '../services/calendar.js';
import { currentCreditsPerLesson } from '../models/LessonPrice.js';

const MAX_CANCELLATION_REASON_LENGTH = 200;

// The optional reason given when cancelling (by the User or the Buddy):
// trimmed text, or undefined when none was given; `invalid` when it isn't
// text or is too long.
function readCancellationReason(body: unknown): { invalid: true } | { invalid: false; reason?: string } {
  const { reason } = (body ?? {}) as { reason?: unknown };
  if (reason === undefined) return { invalid: false };
  if (typeof reason !== 'string' || reason.trim().length > MAX_CANCELLATION_REASON_LENGTH) return { invalid: true };
  return { invalid: false, reason: reason.trim() || undefined };
}

// Members never set a timezone themselves, so remember the one their browser
// sends with a booking — emails then show their local time instead of UTC.
async function rememberTimezone(user: AccountDocument, timezone: unknown): Promise<void> {
  if (typeof timezone !== 'string' || !timezone || timezone === user.timezone) return;
  if (!DateTime.local().setZone(timezone).isValid) return;
  user.timezone = timezone;
  await Account.updateOne({ _id: user._id }, { $set: { timezone } });
}

// Emails each Buddy their newly booked Lessons with a calendar file. Never
// throws: the bookings are already made.
async function emailBuddiesAboutBookings(
  emailSender: EmailSender,
  member: AccountDocument,
  booked: { lesson: LessonDocument; buddy: AccountDocument }[],
): Promise<void> {
  const byBuddy = new Map<string, { buddy: AccountDocument; lessons: LessonDocument[] }>();
  for (const { lesson, buddy } of booked) {
    const entry = byBuddy.get(String(buddy._id)) ?? { buddy, lessons: [] };
    entry.lessons.push(lesson);
    byBuddy.set(String(buddy._id), entry);
  }
  const memberName = member.name ?? 'A member';
  for (const { buddy, lessons } of byBuddy.values()) {
    if (!buddy.email) continue;
    try {
      await emailSender.send(
        withCalendar(
          buildBuddyBookingEmail({ to: buddy.email, buddyName: buddy.name, memberName, startTimes: lessons.map((l) => l.startTime), timezone: buddy.timezone }),
          calendarForLessons('PUBLISH', lessons.map(calendarLesson), memberName),
        ),
      );
    } catch (err) {
      console.error('Failed to email Buddy about new bookings', err);
    }
  }
}

function calendarLesson(lesson: LessonDocument) {
  return { id: String(lesson._id), startTime: lesson.startTime, durationMinutes: lesson.durationMinutes, meetingLink: lesson.meetingLink };
}

export interface LessonsRouterDependencies {
  emailSender: EmailSender;
}

function serializeLesson(lesson: LessonDocument) {
  return {
    id: lesson._id.toString(),
    buddyId: lesson.buddyId.toString(),
    userId: lesson.userId.toString(),
    startTime: lesson.startTime.toISOString(),
    durationMinutes: lesson.durationMinutes,
    status: lesson.status,
    meetingLink: lesson.meetingLink,
    creditsCost: lesson.creditsCost,
    ...(lesson.cancellationReason ? { cancellationReason: lesson.cancellationReason } : {}),
  };
}

function serializeLessonForList(lesson: LessonDocument, buddyName: string | undefined) {
  return {
    ...serializeLesson(lesson),
    buddyName: buddyName ?? 'Buddy',
    joinable: isLessonJoinable(lesson),
  };
}

function serializeLessonForTeachingList(lesson: LessonDocument, userName: string | undefined) {
  return {
    ...serializeLesson(lesson),
    userName: userName ?? 'User',
  };
}

function isValidFrequency(frequency: unknown): frequency is RecurringFrequency {
  if (!frequency || typeof frequency !== 'object') return false;
  const f = frequency as Record<string, unknown>;
  if (f.type === 'daily' || f.type === 'weekly') return true;
  if (f.type === 'everyXDays') return typeof f.days === 'number' && f.days >= 1;
  return false;
}

export function createLessonsRouter(deps: LessonsRouterDependencies): Router {
  const { emailSender } = deps;
  const router = Router();

  router.get('/api/buddies/:id/slots', requireAuth, async (req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const viewerTimezone = typeof req.query.viewerTimezone === 'string' ? req.query.viewerTimezone : undefined;
    if (!date || !viewerTimezone) {
      res.status(400).json({ error: 'Missing date or viewerTimezone query param' });
      return;
    }

    const buddy = await Account.findById(req.params.id);
    if (!buddy || buddy.role !== 'buddy') {
      res.status(404).json({ error: 'Buddy not found' });
      return;
    }

    const candidates = generateCandidateSlots(date, viewerTimezone);
    const bookable: string[] = [];
    for (const candidate of candidates) {
      if (await isSlotBookable(buddy, candidate)) bookable.push(candidate.toISOString());
    }

    res.status(200).json({ slots: bookable });
  });

  router.get('/api/buddies/available', requireAuth, async (req, res) => {
    const startTime = typeof req.query.startTime === 'string' ? req.query.startTime : undefined;
    if (!startTime) {
      res.status(400).json({ error: 'Missing startTime query param' });
      return;
    }
    const instant = new Date(startTime);
    if (Number.isNaN(instant.getTime())) {
      res.status(400).json({ error: 'Invalid startTime' });
      return;
    }

    const buddies = await Account.find(BOOKABLE_BUDDY_QUERY);
    const available: AccountDocument[] = [];
    for (const buddy of buddies) {
      if (await isSlotBookable(buddy, instant)) available.push(buddy);
    }

    res.status(200).json({
      buddies: available.map((b) => ({ id: b._id.toString(), name: b.name, picture: b.picture, bio: b.bio })),
    });
  });

  router.post('/api/lessons', requireAuth, requireRole('user'), requireConfirmedEmail, async (req, res) => {
    const { buddyId, startTime } = req.body ?? {};
    if (typeof buddyId !== 'string' || typeof startTime !== 'string') {
      res.status(400).json({ error: 'Missing buddyId or startTime' });
      return;
    }
    const instant = new Date(startTime);
    if (Number.isNaN(instant.getTime())) {
      res.status(400).json({ error: 'Invalid startTime' });
      return;
    }

    const creditsCost = await currentCreditsPerLesson();
    const user = await Account.findById(req.account!.accountId);
    if (!user || user.credits < creditsCost) {
      res.status(402).json({ error: 'Not enough credits — buy more to book a lesson' });
      return;
    }
    await rememberTimezone(user, req.body?.timezone);

    const buddy = await Account.findById(buddyId);
    if (!buddy || buddy.role !== 'buddy') {
      res.status(404).json({ error: 'Buddy not found' });
      return;
    }

    if (!(await isSlotBookable(buddy, instant))) {
      res.status(409).json({ error: 'That time is no longer available' });
      return;
    }

    const lesson = await bookLesson({ user, buddy, startTime: instant, creditsCost });
    if (!lesson) {
      // Spent elsewhere (e.g. another booking) since the check above.
      res.status(402).json({ error: 'Not enough credits — buy more to book a lesson' });
      return;
    }
    await emailSender.send(
      withCalendar(
        buildConfirmationEmail(
          user.email!,
          [{ startTime: instant, buddyName: buddy.name ?? 'your Buddy', meetingLink: buddy.meetingLink! }],
          user.timezone,
          user.name,
        ),
        calendarForLessons('PUBLISH', [calendarLesson(lesson)], buddy.name ?? 'your Buddy'),
      ),
    );
    await emailBuddiesAboutBookings(emailSender, user, [{ lesson, buddy }]);

    res.status(201).json({ lesson: serializeLesson(lesson), creditsRemaining: user.credits });
  });

  // Shared by the booking and its preview: the planned dates for a request
  // body, or an error message for a malformed one.
  async function readRecurringRequest(body: unknown): Promise<
    | { error: string; status: number }
    | { planned: Date[]; fixedBuddy?: AccountDocument; occurrenceCount: number }
  > {
    const { buddyId, startTime, frequency, includeWeekends, occurrenceCount, timezone } = (body ?? {}) as Record<string, unknown>;
    if (typeof startTime !== 'string' || !isValidFrequency(frequency) || typeof occurrenceCount !== 'number' || occurrenceCount < 1) {
      return { status: 400, error: 'Missing or invalid startTime, frequency, or occurrenceCount' };
    }
    if (buddyId !== undefined && typeof buddyId !== 'string') return { status: 400, error: 'Invalid buddyId' };
    const anchor = new Date(startTime);
    if (Number.isNaN(anchor.getTime())) return { status: 400, error: 'Invalid startTime' };

    let fixedBuddy: AccountDocument | undefined;
    if (buddyId) {
      const found = await Account.findById(buddyId);
      if (!found || found.role !== 'buddy') return { status: 404, error: 'Buddy not found' };
      fixedBuddy = found;
    }
    const viewerTimezone = typeof timezone === 'string' && timezone ? timezone : 'utc';
    const planned = planRecurringOccurrences(anchor, frequency, includeWeekends === true, occurrenceCount, viewerTimezone);
    return { planned, fixedBuddy, occurrenceCount };
  }

  // The chosen Buddy if free then, or else the first free Buddy; null if none.
  async function buddyFor(candidate: Date, fixedBuddy?: AccountDocument): Promise<AccountDocument | null> {
    if (!fixedBuddy) return findAvailableBuddy(candidate);
    return (await isSlotBookable(fixedBuddy, candidate)) ? fixedBuddy : null;
  }

  // What the confirm screen's calendar draws: each planned date, and whether
  // it's free right now. Books nothing.
  router.post('/api/lessons/recurring/preview', requireAuth, requireRole('user'), async (req, res) => {
    const request = await readRecurringRequest(req.body);
    if ('error' in request) {
      res.status(request.status).json({ error: request.error });
      return;
    }
    const occurrences = [];
    for (const candidate of request.planned) {
      occurrences.push({ startTime: candidate.toISOString(), available: (await buddyFor(candidate, request.fixedBuddy)) !== null });
    }
    res.status(200).json({ occurrences });
  });

  router.post('/api/lessons/recurring', requireAuth, requireRole('user'), requireConfirmedEmail, async (req, res) => {
    const request = await readRecurringRequest(req.body);
    if ('error' in request) {
      res.status(request.status).json({ error: request.error });
      return;
    }
    const { planned, fixedBuddy, occurrenceCount } = request;

    const creditsCost = await currentCreditsPerLesson();
    const user = await Account.findById(req.account!.accountId);
    if (!user || user.credits < occurrenceCount * creditsCost) {
      res.status(402).json({ error: 'Not enough credits for the full series' });
      return;
    }
    await rememberTimezone(user, req.body?.timezone);
    if (planned.length === 0) {
      res.status(400).json({ error: 'No dates fit this pattern (every one falls on a weekend, and weekends are off)' });
      return;
    }

    const booked: { lesson: LessonDocument; buddy: AccountDocument }[] = [];
    const skipped: { startTime: string; reason: string }[] = [];
    for (const candidate of planned) {
      const targetBuddy = await buddyFor(candidate, fixedBuddy);
      if (!targetBuddy) {
        skipped.push({
          startTime: candidate.toISOString(),
          reason: fixedBuddy ? 'Buddy unavailable at this time' : 'No Buddy available at this time',
        });
        continue;
      }
      const lesson = await bookLesson({ user, buddy: targetBuddy, startTime: candidate, creditsCost });
      if (!lesson) {
        // Credits spent elsewhere mid-series.
        skipped.push({ startTime: candidate.toISOString(), reason: 'Not enough credits' });
        continue;
      }
      booked.push({ lesson, buddy: targetBuddy });
    }

    if (booked.length > 0) {
      await emailSender.send(
        withCalendar(
          buildConfirmationEmail(
            user.email!,
            booked.map(({ lesson, buddy }) => ({
              startTime: lesson.startTime,
              buddyName: buddy.name ?? 'your Buddy',
              meetingLink: buddy.meetingLink!,
            })),
            user.timezone,
            user.name,
          ),
          // Each event names its own Buddy ("any Buddy" series can mix them).
          lessonCalendarAttachment({
            method: 'PUBLISH',
            lessons: booked.map(({ lesson, buddy }) => ({
              ...calendarLesson(lesson),
              title: `English lesson with ${buddy.name ?? 'your Buddy'}`,
            })),
          }),
        ),
      );
      await emailBuddiesAboutBookings(emailSender, user, booked);
    }

    res.status(201).json({
      booked: booked.map(({ lesson }) => serializeLesson(lesson)),
      skipped,
      creditsDeducted: booked.reduce((sum, { lesson }) => sum + lesson.creditsCost, 0),
      creditsRemaining: user.credits,
      lessonDurationMinutes: LESSON_DURATION_MINUTES,
    });
  });

  router.get('/api/lessons', requireAuth, requireRole('user'), async (req, res) => {
    const lessons = await Lesson.find({ userId: req.account!.accountId }).sort({ startTime: 1 });
    const buddyIds = [...new Set(lessons.map((l) => l.buddyId.toString()))];
    const buddies = await Account.find({ _id: { $in: buddyIds } }).select('name');
    const buddyNameById = new Map(buddies.map((b) => [b._id.toString(), b.name]));

    const now = new Date();
    const upcoming: ReturnType<typeof serializeLessonForList>[] = [];
    const previous: ReturnType<typeof serializeLessonForList>[] = [];

    for (const lesson of lessons) {
      const serialized = serializeLessonForList(lesson, buddyNameById.get(lesson.buddyId.toString()));
      const isUpcoming = isLessonUpcoming(lesson, now);
      (isUpcoming ? upcoming : previous).push(serialized);
    }

    // `lessons` is sorted ascending by startTime, so `previous` was built
    // oldest-first — reverse it so the most recent past lesson leads.
    // `upcoming` stays ascending (soonest first).
    res.status(200).json({ upcoming, previous: previous.reverse() });
  });

  router.get('/api/lessons/teaching', requireAuth, requireRole('buddy'), async (req, res) => {
    const lessons = await Lesson.find({ buddyId: req.account!.accountId }).sort({ startTime: 1 });
    const userIds = [...new Set(lessons.map((l) => l.userId.toString()))];
    const users = await Account.find({ _id: { $in: userIds } }).select('name');
    const userNameById = new Map(users.map((u) => [u._id.toString(), u.name]));

    const now = new Date();
    const upcoming: ReturnType<typeof serializeLessonForTeachingList>[] = [];
    const previous: ReturnType<typeof serializeLessonForTeachingList>[] = [];

    for (const lesson of lessons) {
      const serialized = serializeLessonForTeachingList(lesson, userNameById.get(lesson.userId.toString()));
      const isUpcoming = isLessonUpcoming(lesson, now);
      (isUpcoming ? upcoming : previous).push(serialized);
    }

    res.status(200).json({ upcoming, previous: previous.reverse() });
  });

  router.patch('/api/lessons/:id', requireAuth, requireRole('user'), async (req, res) => {
    const { startTime } = req.body ?? {};
    if (typeof startTime !== 'string') {
      res.status(400).json({ error: 'Missing startTime' });
      return;
    }
    const instant = new Date(startTime);
    if (Number.isNaN(instant.getTime())) {
      res.status(400).json({ error: 'Invalid startTime' });
      return;
    }

    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }
    if (lesson.userId.toString() !== req.account!.accountId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    if (!isLessonUpcoming(lesson)) {
      res.status(409).json({ error: 'Lesson is not upcoming' });
      return;
    }

    // Same 12h line the refund rule draws: inside it a User is committed, so
    // moving the Lesson can't be used to sidestep the no-refund window.
    const hoursUntilStart = (lesson.startTime.getTime() - Date.now()) / (60 * 60 * 1000);
    if (hoursUntilStart < CANCELLATION_REFUND_CUTOFF_HOURS) {
      res.status(409).json({
        error: `Lessons can only be moved more than ${CANCELLATION_REFUND_CUTOFF_HOURS} hours ahead`,
      });
      return;
    }

    const buddy = await Account.findById(lesson.buddyId);
    if (!buddy) {
      res.status(404).json({ error: 'Buddy not found' });
      return;
    }
    // Excluding this Lesson from the conflict check, so a small shift that
    // overlaps its current slot isn't rejected as clashing with itself.
    if (!(await isSlotBookable(buddy, instant, lesson._id))) {
      res.status(409).json({ error: 'That time is no longer available' });
      return;
    }

    const previousStartTime = lesson.startTime;
    lesson.startTime = instant;
    // The reminder was scheduled against the old time; let the sweep send a
    // fresh one for the new time.
    lesson.reminderSentAt = undefined;
    await lesson.save();

    const user = await Account.findById(req.account!.accountId);
    if (user) {
      // The User triggered this, so they get a plain confirmation, mirroring
      // the booking one. The Buddy didn't, so they get a Notification.
      // (Booking required a confirmed email, so this User has one.)
      await emailSender.send(
        withCalendar(
          buildConfirmationEmail(user.email!, [
            { startTime: instant, buddyName: buddy.name ?? 'your Buddy', meetingLink: lesson.meetingLink },
          ], user.timezone, user.name),
          calendarForLessons('PUBLISH', [calendarLesson(lesson)], buddy.name ?? 'your Buddy'),
        ),
      );

      const { message, email } = buildLessonRescheduledNotification({
        userName: user.name ?? 'Your learner',
        buddyEmail: buddy.email!,
        previousStartTime,
        startTime: instant,
        timezone: buddy.timezone,
      });
      try {
        await createNotification({
          emailSender,
          accountId: buddy._id,
          type: 'lesson_rescheduled',
          message,
          email: withCalendar(email, calendarForLessons('PUBLISH', [calendarLesson(lesson)], user.name ?? 'your learner')),
        });
      } catch (err) {
        // The move is already committed — failing to notify must not surface
        // as a failed reschedule.
        console.error('Failed to send lesson-rescheduled notification', err);
      }
    }

    res.status(200).json({ lesson: serializeLesson(lesson) });
  });

  router.post('/api/lessons/:id/cancel', requireAuth, requireRole('user'), async (req, res) => {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }
    if (lesson.userId.toString() !== req.account!.accountId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const parsedReason = readCancellationReason(req.body);
    if (parsedReason.invalid) {
      res.status(400).json({ error: `reason must be text, up to ${MAX_CANCELLATION_REASON_LENGTH} characters` });
      return;
    }
    const trimmedReason = parsedReason.reason;

    const user = await Account.findById(req.account!.accountId);
    if (!user) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const result = await cancelLesson({ lessonId: lesson._id, accountId: user._id, reason: trimmedReason });
    if (!result) {
      res.status(409).json({ error: 'Lesson is not upcoming' });
      return;
    }

    // The cancellation (and any refund) is already committed; failing to
    // email either side must not surface as a failed cancel.
    const buddy = await Account.findById(lesson.buddyId);
    try {
      if (user.email) {
        await emailSender.send(withCalendar(
          buildUserCancellationEmail({
            to: user.email,
            name: user.name,
            buddyName: buddy?.name ?? 'your Buddy',
            startTime: result.lesson.startTime,
            timezone: user.timezone,
            refunded: result.refunded,
            creditsCost: result.lesson.creditsCost,
            reason: trimmedReason,
          }),
          calendarForLessons('CANCEL', [calendarLesson(result.lesson)], buddy?.name ?? 'your Buddy'),
        ));
      }
    } catch (err) {
      console.error('Failed to send cancellation email to User', err);
    }
    if (buddy) {
      try {
        const notice = buildLessonCancelledByUserNotification({
          userName: user.name ?? 'Your learner',
          buddyName: buddy.name,
          buddyEmail: buddy.email,
          startTime: result.lesson.startTime,
          timezone: buddy.timezone,
          reason: trimmedReason,
        });
        await createNotification({
          emailSender,
          accountId: buddy._id,
          type: 'lesson_cancelled',
          message: notice.message,
          email: withCalendar(notice.email, calendarForLessons('CANCEL', [calendarLesson(result.lesson)], user.name ?? 'your learner')),
        });
      } catch (err) {
        console.error('Failed to send lesson-cancelled notification to Buddy', err);
      }
    }

    res.status(200).json({
      lesson: serializeLesson(result.lesson),
      refunded: result.refunded,
      creditsRemaining: result.creditsRemaining,
    });
  });

  router.post('/api/lessons/:id/buddy-cancel', requireAuth, requireRole('buddy'), async (req, res) => {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }
    if (lesson.buddyId.toString() !== req.account!.accountId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const parsedReason = readCancellationReason(req.body);
    if (parsedReason.invalid) {
      res.status(400).json({ error: `reason must be text, up to ${MAX_CANCELLATION_REASON_LENGTH} characters` });
      return;
    }

    const buddy = await Account.findById(req.account!.accountId);
    const result = await cancelLessonAsBuddy({
      emailSender,
      lessonId: lesson._id,
      buddyName: buddy?.name,
      reason: parsedReason.reason,
    });
    if (!result) {
      res.status(409).json({ error: 'Lesson is not upcoming' });
      return;
    }

    res.status(200).json({ lesson: serializeLesson(result.lesson), creditsRemaining: result.creditsRemaining });
  });

  return router;
}
