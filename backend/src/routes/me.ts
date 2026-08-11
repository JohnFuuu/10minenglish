import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Account } from '../models/Account.js';
import { isLikelyNewZealand } from '../services/location.js';

export const meRouter = Router();

meRouter.get('/api/me', requireAuth, async (req, res) => {
  const account = await Account.findById(req.account!.accountId);
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }
  res.status(200).json({
    id: account.id,
    role: account.role,
    onboardingCompleted: account.onboardingCompleted,
    credits: account.credits,
    isNZLocated: isLikelyNewZealand(account.location),
  });
});
