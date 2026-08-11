import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Account } from '../models/Account.js';
import { hashPassword } from '../services/password.js';

export const adminRouter = Router();

adminRouter.post(
  '/api/admin/buddies',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
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
  },
);
