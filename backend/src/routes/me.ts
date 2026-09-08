import type { HydratedDocument } from 'mongoose';
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Account, type AccountDocument } from '../models/Account.js';
import { isLikelyNewZealand } from '../services/location.js';
import type { EmailSender } from '../services/email.js';
import { EMAIL_CONFIRMATION_TTL_MS, sendConfirmationEmail } from '../services/emailConfirmation.js';
import { generateToken } from '../services/tokens.js';
import { hashPassword, verifyPassword } from '../services/password.js';

export interface MeRouterDependencies {
  emailSender: EmailSender;
}

// Fields signup requires; a profile edit may change them but never blank them.
const REQUIRED_TEXT_FIELDS = ['name', 'phoneNumber', 'location', 'nationality'] as const;

type RequiredTextField = (typeof REQUIRED_TEXT_FIELDS)[number];

function profileResponse(account: HydratedDocument<AccountDocument>) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    pendingEmail: account.pendingEmail,
    picture: account.picture,
    phoneNumber: account.phoneNumber,
    location: account.location,
    nationality: account.nationality,
    // Date-only, so the client isn't left shifting a midnight timestamp across
    // timezones to render a date of birth.
    dateOfBirth: account.dateOfBirth?.toISOString().slice(0, 10),
    learningGoals: account.learningGoals ?? [],
    learningGoalOther: account.learningGoalOther,
    // Google-only accounts have nothing to verify a password change against,
    // so the client hides that part of the form.
    hasPassword: Boolean(account.passwordHash),
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createMeRouter(deps: MeRouterDependencies): Router {
  const { emailSender } = deps;
  const router = Router();

  router.get('/api/me', requireAuth, async (req, res) => {
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

  router.get('/api/profile', requireAuth, requireRole('user'), async (req, res) => {
    const account = await Account.findById(req.account!.accountId);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    res.status(200).json(profileResponse(account));
  });

  router.patch('/api/profile', requireAuth, requireRole('user'), async (req, res) => {
    const {
      name,
      email,
      picture,
      phoneNumber,
      location,
      nationality,
      dateOfBirth,
      learningGoals,
      learningGoalOther,
    } = req.body ?? {};

    const textFields: Record<RequiredTextField, unknown> = {
      name,
      phoneNumber,
      location,
      nationality,
    };
    for (const field of REQUIRED_TEXT_FIELDS) {
      const value = textFields[field];
      if (value !== undefined && (typeof value !== 'string' || value.trim() === '')) {
        res.status(400).json({ error: `${field} cannot be empty` });
        return;
      }
    }

    if (learningGoals !== undefined && (!Array.isArray(learningGoals) || learningGoals.length === 0)) {
      res.status(400).json({ error: 'learningGoals cannot be empty' });
      return;
    }

    let parsedDateOfBirth: Date | undefined;
    if (dateOfBirth !== undefined) {
      parsedDateOfBirth = new Date(dateOfBirth);
      if (Number.isNaN(parsedDateOfBirth.getTime())) {
        res.status(400).json({ error: 'Invalid dateOfBirth' });
        return;
      }
    }

    if (email !== undefined && (typeof email !== 'string' || email.trim() === '')) {
      res.status(400).json({ error: 'email cannot be empty' });
      return;
    }

    const account = await Account.findById(req.account!.accountId);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    // An email change doesn't take effect here: the address has to be
    // confirmed first, so the account keeps its current (working) email until
    // the link in the new inbox is clicked.
    let confirmationToken: string | undefined;
    if (email !== undefined) {
      const requestedEmail = normalizeEmail(email);

      if (requestedEmail === account.email) {
        account.pendingEmail = undefined;
      } else {
        const taken = await Account.findOne({
          _id: { $ne: account._id },
          $or: [{ email: requestedEmail }, { pendingEmail: requestedEmail }],
        });
        if (taken) {
          res.status(409).json({ error: 'Email already registered' });
          return;
        }

        confirmationToken = generateToken();
        account.pendingEmail = requestedEmail;
        account.emailConfirmationToken = confirmationToken;
        account.emailConfirmationExpires = new Date(Date.now() + EMAIL_CONFIRMATION_TTL_MS);
      }
    }

    if (name !== undefined) account.name = name;
    if (picture !== undefined) account.picture = picture;
    if (phoneNumber !== undefined) account.phoneNumber = phoneNumber;
    if (location !== undefined) account.location = location;
    if (nationality !== undefined) account.nationality = nationality;
    if (parsedDateOfBirth !== undefined) account.dateOfBirth = parsedDateOfBirth;
    if (learningGoals !== undefined) account.learningGoals = learningGoals;
    if (learningGoalOther !== undefined) account.learningGoalOther = learningGoalOther;
    await account.save();

    if (confirmationToken) {
      await sendConfirmationEmail(
        emailSender,
        account.pendingEmail!,
        confirmationToken,
        'Confirm your new 10ME email',
      );
    }

    res.status(200).json(profileResponse(account));
  });

  router.patch('/api/profile/password', requireAuth, requireRole('user'), async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Missing currentPassword or newPassword' });
      return;
    }

    const account = await Account.findById(req.account!.accountId);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    if (!account.passwordHash) {
      res.status(400).json({ error: 'This account signs in with Google and has no password' });
      return;
    }

    if (!(await verifyPassword(currentPassword, account.passwordHash))) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }

    account.passwordHash = await hashPassword(newPassword);
    account.failedLoginAttempts = 0;
    account.lockedUntil = undefined;
    await account.save();

    res.status(200).json({ updated: true });
  });

  return router;
}
