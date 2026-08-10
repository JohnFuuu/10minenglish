import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Account } from '../models/Account.js';

export const onboardingRouter = Router();

onboardingRouter.post('/api/onboarding', requireAuth, async (req, res) => {
  const { referralSource, selfRatedLevel, motivation, lessonsPerWeekGoal } = req.body ?? {};

  if (!referralSource || !selfRatedLevel || !motivation || !lessonsPerWeekGoal) {
    res.status(400).json({ error: 'Missing required onboarding answers' });
    return;
  }

  const account = await Account.findById(req.account!.accountId);
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  account.referralSource = referralSource;
  account.selfRatedLevel = selfRatedLevel;
  account.motivation = motivation;
  account.lessonsPerWeekGoal = lessonsPerWeekGoal;
  account.onboardingCompleted = true;
  await account.save();

  res.status(200).json({ onboardingCompleted: true });
});
