import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Account } from '../models/Account.js';

export const onboardingRouter = Router();

const REFERRAL_OTHER_MAX_LENGTH = 200;

onboardingRouter.post('/api/onboarding', requireAuth, async (req, res) => {
  const { referralSource, referralSourceOther, selfRatedLevel, motivation, lessonsPerWeekGoal } = req.body ?? {};

  if (!referralSource || !selfRatedLevel || !lessonsPerWeekGoal) {
    res.status(400).json({ error: 'Missing required onboarding answers' });
    return;
  }

  const account = await Account.findById(req.account!.accountId);
  if (!account) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  account.referralSource = referralSource;
  // The "Other" text box is optional and only means something alongside "Other".
  const otherDetail =
    referralSource === 'Other' && typeof referralSourceOther === 'string'
      ? referralSourceOther.trim().slice(0, REFERRAL_OTHER_MAX_LENGTH)
      : '';
  account.referralSourceOther = otherDetail || undefined;
  account.selfRatedLevel = selfRatedLevel;
  // No longer asked in Onboarding (dropped in favor of a more detailed
  // self-rated level) — stays optional so it's a no-op unless still sent.
  if (motivation !== undefined) account.motivation = motivation;
  account.lessonsPerWeekGoal = lessonsPerWeekGoal;
  account.onboardingCompleted = true;
  await account.save();

  res.status(200).json({ onboardingCompleted: true });
});
