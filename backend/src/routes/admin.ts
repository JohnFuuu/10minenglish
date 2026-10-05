import { Router, type Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Account } from '../models/Account.js';
import { Lesson } from '../models/Lesson.js';
import { hashPassword } from '../services/password.js';
import { cancelUpcomingLessonsForBuddy } from '../services/buddyReconciliation.js';
import type { EmailSender } from '../services/email.js';
import { accountLabel, recordAdminAction } from '../services/auditLog.js';
import { isSuperAdmin } from '../services/superAdmins.js';

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

  // One Buddy's details for the roster's expanded row: profile, availability,
  // and how many Lessons they have. Fetched on demand so the roster list
  // itself stays a single light query. No credentials are included.
  router.get('/api/admin/buddies/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const buddyId = String(req.params.id);
    const buddy = /^[a-f0-9]{24}$/i.test(buddyId)
      ? await Account.findOne({ _id: buddyId, role: 'buddy', removedAt: { $exists: false } })
      : null;
    if (!buddy) {
      res.status(404).json({ error: 'Buddy not found' });
      return;
    }

    const now = new Date();
    const [upcoming, completed, cancelled, next] = await Promise.all([
      Lesson.countDocuments({ buddyId: buddy._id, status: 'upcoming', startTime: { $gt: now } }),
      Lesson.countDocuments({ buddyId: buddy._id, status: 'completed' }),
      Lesson.countDocuments({ buddyId: buddy._id, status: 'cancelled' }),
      Lesson.findOne({ buddyId: buddy._id, status: 'upcoming', startTime: { $gt: now } }).sort({ startTime: 1 }),
    ]);

    res.status(200).json({
      id: buddy.id,
      name: buddy.name,
      email: buddy.email,
      active: buddy.active,
      joinedAt: buddy._id.getTimestamp().toISOString(),
      picture: buddy.picture,
      timezone: buddy.timezone,
      location: buddy.location,
      bio: buddy.bio,
      meetingLink: buddy.meetingLink,
      availabilityBlocks: buddy.availabilityBlocks.map((b) => ({ dayOfWeek: b.dayOfWeek, startTime: b.startTime, endTime: b.endTime })),
      lessons: { upcoming, completed, cancelled },
      nextLessonAt: next ? next.startTime.toISOString() : null,
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
    // Removed (archived) Admins are gone from the list; deactivated ones stay.
    const admins = await Account.find({ role: 'admin', removedAt: { $exists: false } }).sort({ name: 1 });
    res.status(200).json({
      admins: admins.map((a) => ({ id: a.id, name: a.name, email: a.email, active: a.active !== false, isSuperAdmin: isSuperAdmin(a.email) })),
    });
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

  // Suspend (active: false) or restore (active: true) another Admin.
  router.patch('/api/admin/admins/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const { active } = req.body ?? {};
    if (typeof active !== 'boolean') {
      res.status(400).json({ error: 'active must be a boolean' });
      return;
    }
    if (!(await requireSuperAdmin(req.account!.accountId, res))) return;
    const target = await findChangeableAdmin(String(req.params.id), req.account!.accountId, res);
    if (!target) return;

    // Conditional on the current state, so a double click changes (and
    // audits) once; a no-op returns the current state.
    const previous = await Account.findOneAndUpdate(
      { _id: target._id, removedAt: { $exists: false }, active: active ? false : { $ne: false } },
      { $set: { active } },
    );
    if (previous && !active && !(await anyActiveAdminLeft())) {
      // Two Admins deactivating each other at once could leave nobody able
      // to manage the app: undo this one.
      await Account.updateOne({ _id: target._id }, { $set: { active: true } });
      res.status(409).json({ error: 'LAST_ACTIVE_ADMIN' });
      return;
    }
    if (previous) {
      await recordAdminAction(
        req.account!.accountId,
        active ? 'admin.activated' : 'admin.deactivated',
        { type: 'admin', id: String(target._id), label: accountLabel(target) },
      );
    }
    res.status(200).json({ id: target.id, name: target.name, email: target.email, active });
  });

  // Archive another Admin: locked out and hidden, record kept for the audit
  // log. A repeat is a no-op success, like removing a Buddy.
  router.delete('/api/admin/admins/:id', requireAuth, requireRole('admin'), async (req, res) => {
    if (!(await requireSuperAdmin(req.account!.accountId, res))) return;
    const id = String(req.params.id);
    if (/^[a-f0-9]{24}$/i.test(id) && (await Account.exists({ _id: id, role: 'admin', removedAt: { $exists: true } }))) {
      res.status(200).json({ id });
      return;
    }
    const target = await findChangeableAdmin(id, req.account!.accountId, res);
    if (!target) return;

    const previous = await Account.findOneAndUpdate(
      { _id: target._id, removedAt: { $exists: false } },
      { $set: { removedAt: new Date(), active: false } },
    );
    if (!previous) {
      res.status(200).json({ id: target.id });
      return;
    }
    if (!(await anyActiveAdminLeft())) {
      await Account.updateOne({ _id: target._id }, { $unset: { removedAt: '' }, $set: { active: previous.active !== false } });
      res.status(409).json({ error: 'LAST_ACTIVE_ADMIN' });
      return;
    }
    await recordAdminAction(req.account!.accountId, 'admin.removed', { type: 'admin', id: String(target._id), label: accountLabel(target) });
    res.status(200).json({ id: target.id });
  });

  return router;
}

// Only super admins (SUPER_BACKEND_ADMIN) may deactivate or remove Admins.
async function requireSuperAdmin(actorId: string, res: Response): Promise<boolean> {
  const actor = await Account.findById(actorId, { email: 1 });
  if (isSuperAdmin(actor?.email)) return true;
  res.status(403).json({ error: 'SUPER_ADMIN_REQUIRED' });
  return false;
}

// At least one Admin must always be able to sign in and manage the app.
async function anyActiveAdminLeft(): Promise<boolean> {
  return Boolean(await Account.exists({ role: 'admin', active: { $ne: false }, removedAt: { $exists: false } }));
}

// The other, still-existing Admin an Admin action targets — or a response
// explaining why not (unknown → 404, yourself or a super admin → 409).
async function findChangeableAdmin(id: string, actorId: string, res: Response) {
  const target = /^[a-f0-9]{24}$/i.test(id) ? await Account.findOne({ _id: id, role: 'admin', removedAt: { $exists: false } }) : null;
  if (!target) {
    res.status(404).json({ error: 'Admin not found' });
    return null;
  }
  if (String(target._id) === actorId) {
    res.status(409).json({ error: 'CANNOT_CHANGE_SELF' });
    return null;
  }
  // Super admins can't lock each other out; demoting one means editing
  // SUPER_BACKEND_ADMIN.
  if (isSuperAdmin(target.email)) {
    res.status(409).json({ error: 'SUPER_ADMIN_PROTECTED' });
    return null;
  }
  return target;
}
