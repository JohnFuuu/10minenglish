import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Account, type AccountDocument } from '../models/Account.js';
import { Lesson, LESSON_DURATION_MINUTES, type LessonDocument } from '../models/Lesson.js';
import type { EmailSender } from '../services/email.js';
import {
  bookLesson,
  buddyCancelLesson,
  buildBuddyCancellationNotification,
  buildConfirmationEmail,
  cancelLesson,
  findAvailableBuddy,
  generateCandidateSlots,
  generateRecurringCandidates,
  isLessonJoinable,
  isSlotBookable,
  type RecurringFrequency,
} from '../services/lessonBooking.js';
import { createNotification } from '../services/notifications.js';

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
    zoomLink: lesson.zoomLink,
  };
}

function serializeLessonForList(lesson: LessonDocument, buddyName: string | undefined) {
  return {
    ...serializeLesson(lesson),
    buddyName: buddyName ?? 'Buddy',
    joinable: isLessonJoinable(lesson),
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

    const buddies = await Account.find({ role: 'buddy', zoomLink: { $exists: true, $nin: [null, ''] } });
    const available: AccountDocument[] = [];
    for (const buddy of buddies) {
      if (await isSlotBookable(buddy, instant)) available.push(buddy);
    }

    res.status(200).json({
      buddies: available.map((b) => ({ id: b._id.toString(), name: b.name, picture: b.picture, bio: b.bio })),
    });
  });

  router.post('/api/lessons', requireAuth, requireRole('user'), async (req, res) => {
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

    const user = await Account.findById(req.account!.accountId);
    if (!user || user.credits < 1) {
      res.status(402).json({ error: 'Not enough credits — buy more to book a lesson' });
      return;
    }

    const buddy = await Account.findById(buddyId);
    if (!buddy || buddy.role !== 'buddy') {
      res.status(404).json({ error: 'Buddy not found' });
      return;
    }

    if (!(await isSlotBookable(buddy, instant))) {
      res.status(409).json({ error: 'That time is no longer available' });
      return;
    }

    const lesson = await bookLesson({ user, buddy, startTime: instant });
    await emailSender.send(
      buildConfirmationEmail(user.email, [{ startTime: instant, buddyName: buddy.name ?? 'your Buddy', zoomLink: buddy.zoomLink! }]),
    );

    res.status(201).json({ lesson: serializeLesson(lesson), creditsRemaining: user.credits });
  });

  router.post('/api/lessons/recurring', requireAuth, requireRole('user'), async (req, res) => {
    const { buddyId, startTime, frequency, includeWeekends, occurrenceCount, timezone } = req.body ?? {};

    if (typeof startTime !== 'string' || !isValidFrequency(frequency) || typeof occurrenceCount !== 'number' || occurrenceCount < 1) {
      res.status(400).json({ error: 'Missing or invalid startTime, frequency, or occurrenceCount' });
      return;
    }
    if (buddyId !== undefined && typeof buddyId !== 'string') {
      res.status(400).json({ error: 'Invalid buddyId' });
      return;
    }
    const anchor = new Date(startTime);
    if (Number.isNaN(anchor.getTime())) {
      res.status(400).json({ error: 'Invalid startTime' });
      return;
    }

    const user = await Account.findById(req.account!.accountId);
    if (!user || user.credits < occurrenceCount) {
      res.status(402).json({ error: 'Not enough credits for the full series' });
      return;
    }

    let fixedBuddy: AccountDocument | undefined;
    if (buddyId) {
      const found = await Account.findById(buddyId);
      if (!found || found.role !== 'buddy') {
        res.status(404).json({ error: 'Buddy not found' });
        return;
      }
      fixedBuddy = found;
    }

    const booked: { lesson: LessonDocument; buddy: AccountDocument }[] = [];
    const skipped: { startTime: string; reason: string }[] = [];
    const maxCandidates = Math.max(occurrenceCount * 6, 60);
    let examined = 0;

    const viewerTimezone = typeof timezone === 'string' && timezone ? timezone : 'utc';
    for (const candidate of generateRecurringCandidates(anchor, frequency, includeWeekends === true, viewerTimezone)) {
      if (booked.length >= occurrenceCount || examined >= maxCandidates) break;
      examined += 1;

      const targetBuddy = fixedBuddy ?? (await findAvailableBuddy(candidate));
      if (!targetBuddy || !(await isSlotBookable(targetBuddy, candidate))) {
        skipped.push({
          startTime: candidate.toISOString(),
          reason: fixedBuddy ? 'Buddy unavailable at this time' : 'No Buddy available at this time',
        });
        continue;
      }

      const lesson = await bookLesson({ user, buddy: targetBuddy, startTime: candidate });
      booked.push({ lesson, buddy: targetBuddy });
    }

    if (booked.length > 0) {
      await emailSender.send(
        buildConfirmationEmail(
          user.email,
          booked.map(({ lesson, buddy }) => ({
            startTime: lesson.startTime,
            buddyName: buddy.name ?? 'your Buddy',
            zoomLink: buddy.zoomLink!,
          })),
        ),
      );
    }

    res.status(201).json({
      booked: booked.map(({ lesson }) => serializeLesson(lesson)),
      skipped,
      creditsDeducted: booked.length,
      creditsRemaining: user.credits,
      lessonDurationMinutes: LESSON_DURATION_MINUTES,
    });
  });

  router.get('/api/lessons', requireAuth, requireRole('user'), async (req, res) => {
    const lessons = await Lesson.find({ userId: req.account!.accountId }).sort({ startTime: 1 });
    const buddyIds = [...new Set(lessons.map((l) => l.buddyId.toString()))];
    const buddies = await Account.find({ _id: { $in: buddyIds } }).select('name');
    const buddyNameById = new Map(buddies.map((b) => [b._id.toString(), b.name]));

    const now = Date.now();
    const upcoming: ReturnType<typeof serializeLessonForList>[] = [];
    const previous: ReturnType<typeof serializeLessonForList>[] = [];

    for (const lesson of lessons) {
      const serialized = serializeLessonForList(lesson, buddyNameById.get(lesson.buddyId.toString()));
      const endTime = lesson.startTime.getTime() + lesson.durationMinutes * 60_000;
      const isUpcoming = lesson.status === 'upcoming' && endTime > now;
      (isUpcoming ? upcoming : previous).push(serialized);
    }

    // `lessons` is sorted ascending by startTime, so `previous` was built
    // oldest-first — reverse it so the most recent past lesson leads.
    // `upcoming` stays ascending (soonest first).
    res.status(200).json({ upcoming, previous: previous.reverse() });
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

    const user = await Account.findById(req.account!.accountId);
    if (!user) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const result = await cancelLesson({ lessonId: lesson._id, accountId: user._id });
    if (!result) {
      res.status(409).json({ error: 'Lesson is not upcoming' });
      return;
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

    const result = await buddyCancelLesson({ lessonId: lesson._id });
    if (!result) {
      res.status(409).json({ error: 'Lesson is not upcoming' });
      return;
    }

    const buddy = await Account.findById(req.account!.accountId);
    const user = await Account.findById(result.lesson.userId);
    if (user) {
      const { message, email } = buildBuddyCancellationNotification({
        buddyName: buddy?.name ?? 'Your Buddy',
        userEmail: user.email,
        startTime: result.lesson.startTime,
        creditsRemaining: result.creditsRemaining,
      });
      await createNotification({
        emailSender,
        accountId: user._id,
        type: 'buddy_cancellation_refund',
        message,
        email,
      });
    }

    res.status(200).json({ lesson: serializeLesson(result.lesson), creditsRemaining: result.creditsRemaining });
  });

  return router;
}
