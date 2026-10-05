import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Account } from '../models/Account.js';
import { Lesson } from '../models/Lesson.js';
import { hashPassword } from '../services/password.js';
import { cancelLessonAsBuddy } from '../services/buddyCancellation.js';
import type { EmailSender } from '../services/email.js';
import { accountLabel, recordAdminAction } from '../services/auditLog.js';

export interface AdminRouterDependencies {
  emailSender: EmailSender;
}

export function createAdminRouter(deps: AdminRouterDependencies): Router {
  const { emailSender } = deps;
  const router = Router();

  router.post('/api/admin/buddies', requireAuth, requireRole('admin'), async (req, res) => {
    const { name, email, password } = req.body ?? {};

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const existing = await Account.findOne({ email });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const buddy = await Account.create({
      role: 'buddy',
      name,
      email,
      passwordHash,
      // Admin-provisioned accounts are curated, not self-signed-up — no
      // need for the email-ownership verification that public signup uses.
      emailConfirmed: true,
      // Onboarding (referral source, self-rated level, lessons/week goal) is
      // a User-only concept — a Buddy should never be routed through it.
      onboardingCompleted: true,
    });

    await recordAdminAction(req.account!.accountId, 'buddy.created', { type: 'buddy', id: String(buddy._id), label: accountLabel(buddy) });

    res.status(201).json({ id: buddy.id, email: buddy.email, role: buddy.role });
  });

  // Unlike the User-facing directory, this lists inactive Buddies too — taking
  // one out of rotation is not the same as deleting them, so an Admin has to be
  // able to see them and put them back.
  router.get('/api/admin/buddies', requireAuth, requireRole('admin'), async (_req, res) => {
    const buddies = await Account.find({ role: 'buddy' }).sort({ name: 1 });
    // What deactivating would cancel (and refund) — shown in the confirm.
    // One grouped query for the whole roster rather than one per Buddy.
    const counts = await Lesson.aggregate<{ _id: unknown; count: number }>([
      { $match: { buddyId: { $in: buddies.map((b) => b._id) }, status: 'upcoming', startTime: { $gt: new Date() } } },
      { $group: { _id: '$buddyId', count: { $sum: 1 } } },
    ]);
    const upcomingByBuddy = new Map(counts.map((c) => [String(c._id), c.count]));

    res.status(200).json({
      buddies: buddies.map((b) => ({
        id: b.id,
        name: b.name,
        email: b.email,
        active: b.active,
        hasMeetingLink: Boolean(b.meetingLink),
        upcomingLessons: upcomingByBuddy.get(String(b._id)) ?? 0,
      })),
    });
  });

  router.patch('/api/admin/buddies/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const { active } = req.body ?? {};
    if (typeof active !== 'boolean') {
      res.status(400).json({ error: 'active must be a boolean' });
      return;
    }

    const buddy = await Account.findById(req.params.id);
    if (!buddy || buddy.role !== 'buddy') {
      res.status(404).json({ error: 'Buddy not found' });
      return;
    }

    // One conditional update (returns the document as it was), so two
    // identical requests at once can't both see the old state — only the one
    // that actually flips it cancels Lessons and is audited.
    const previous = await Account.findOneAndUpdate({ _id: buddy._id, active: { $ne: active } }, { $set: { active } });
    const wasActive = previous ? previous.active : active;
    buddy.active = active;

    // Deactivating means this Buddy will not be teaching their booked Lessons,
    // so those Lessons are cancelled down the same path a Buddy-initiated
    // cancellation takes: always refunded, always notified (see CONTEXT.md,
    // Account). Reactivating cancels nothing — the Lessons are already gone.
    let cancelledLessons = 0;
    if (wasActive && !active) {
      const upcoming = await Lesson.find({
        buddyId: buddy._id,
        status: 'upcoming',
        startTime: { $gt: new Date() },
      });

      for (const lesson of upcoming) {
        const result = await cancelLessonAsBuddy({
          emailSender,
          lessonId: lesson._id,
          buddyName: buddy.name,
        });
        if (result) cancelledLessons += 1;
      }
    }

    if (wasActive !== active) {
      await recordAdminAction(
        req.account!.accountId,
        active ? 'buddy.activated' : 'buddy.deactivated',
        { type: 'buddy', id: String(buddy._id), label: accountLabel(buddy) },
        active ? {} : { cancelledLessons },
      );
    }

    res.status(200).json({
      id: buddy.id,
      name: buddy.name,
      email: buddy.email,
      active: buddy.active,
      cancelledLessons,
    });
  });

  return router;
}
