import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Account } from '../models/Account.js';
import { Lesson } from '../models/Lesson.js';
import { hashPassword } from '../services/password.js';
import { cancelUpcomingLessonsForBuddy } from '../services/buddyReconciliation.js';
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
    // Archived (removed) Buddies are gone from the roster for good.
    const buddies = await Account.find({ role: 'buddy', removedAt: { $exists: false } }).sort({ name: 1 });
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
    // Account). Run even when the Buddy was already inactive, so a retry
    // finishes a deactivation that was interrupted part-way (#29); the
    // reconciliation sweep is the backstop. Reactivating cancels nothing.
    const cancelledLessons = active
      ? 0
      : await cancelUpcomingLessonsForBuddy({ emailSender, buddyId: buddy._id, buddyName: buddy.name });

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

  // Archives a Buddy: cancels and refunds their upcoming Lessons (the same
  // path as deactivating), locks them out, and hides them everywhere, while
  // keeping the record so Users' past Lessons still show who taught them.
  router.delete('/api/admin/buddies/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const buddyId = String(req.params.id);
    if (!/^[a-f0-9]{24}$/i.test(buddyId)) {
      res.status(404).json({ error: 'Buddy not found' });
      return;
    }

    // One conditional update, so a double click archives (and audits) once.
    const buddy = await Account.findOneAndUpdate(
      { _id: buddyId, role: 'buddy', removedAt: { $exists: false } },
      { $set: { removedAt: new Date(), active: false } },
      { new: true },
    );
    if (!buddy) {
      // Already removed: finish any clean-up an interrupted removal left
      // behind (#29), but don't audit a second removal.
      const archived = await Account.findOne({ _id: buddyId, role: 'buddy', removedAt: { $exists: true } });
      if (!archived) {
        res.status(404).json({ error: 'Buddy not found' });
        return;
      }
      const cancelledLessons = await cancelUpcomingLessonsForBuddy({ emailSender, buddyId: archived._id, buddyName: archived.name });
      res.status(200).json({ id: archived.id, cancelledLessons });
      return;
    }

    const cancelledLessons = await cancelUpcomingLessonsForBuddy({ emailSender, buddyId: buddy._id, buddyName: buddy.name });

    await recordAdminAction(
      req.account!.accountId,
      'buddy.removed',
      { type: 'buddy', id: String(buddy._id), label: accountLabel(buddy) },
      { cancelledLessons },
    );
    res.status(200).json({ id: buddy.id, cancelledLessons });
  });

  router.get('/api/admin/admins', requireAuth, requireRole('admin'), async (_req, res) => {
    const admins = await Account.find({ role: 'admin' }).sort({ name: 1 });
    res.status(200).json({ admins: admins.map((a) => ({ id: a.id, name: a.name, email: a.email })) });
  });

  // Admins are created by another Admin, like Buddies — there is no self-signup.
  router.post('/api/admin/admins', requireAuth, requireRole('admin'), async (req, res) => {
    const { name, email, password } = req.body ?? {};
    if (
      typeof name !== 'string' || !name.trim() ||
      typeof email !== 'string' || !email.trim() ||
      typeof password !== 'string' || !password
    ) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Stored emails are lowercased, so compare the same way: one email, one
    // Account, whatever its role.
    const normalizedEmail = email.trim().toLowerCase();
    if (await Account.findOne({ email: normalizedEmail })) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const admin = await Account.create({
      role: 'admin',
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      // Curated by an existing Admin, like a Buddy account.
      emailConfirmed: true,
      onboardingCompleted: true,
    });
    await recordAdminAction(req.account!.accountId, 'admin.created', { type: 'admin', id: String(admin._id), label: accountLabel(admin) });

    res.status(201).json({ id: admin.id, email: admin.email, role: admin.role });
  });

  return router;
}
