import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Account } from '../models/Account.js';
import { Lesson } from '../models/Lesson.js';
import { hashPassword } from '../services/password.js';
import { cancelLessonAsBuddy } from '../services/buddyCancellation.js';
import type { EmailSender } from '../services/email.js';

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
    });

    res.status(201).json({ id: buddy.id, email: buddy.email, role: buddy.role });
  });

  // Unlike the User-facing directory, this lists inactive Buddies too — taking
  // one out of rotation is not the same as deleting them, so an Admin has to be
  // able to see them and put them back.
  router.get('/api/admin/buddies', requireAuth, requireRole('admin'), async (_req, res) => {
    const buddies = await Account.find({ role: 'buddy' }).sort({ name: 1 });

    res.status(200).json({
      buddies: buddies.map((b) => ({
        id: b.id,
        name: b.name,
        email: b.email,
        active: b.active,
        hasZoomLink: Boolean(b.zoomLink),
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

    const wasActive = buddy.active;
    buddy.active = active;
    await buddy.save();

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
