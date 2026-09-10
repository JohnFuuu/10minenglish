import { Router } from 'express';
import { Account } from '../models/Account.js';
import { hashPassword, verifyPassword } from '../services/password.js';
import { signAccountToken } from '../middleware/auth.js';
import type { EmailSender } from '../services/email.js';
import type { GoogleTokenVerifier } from '../services/googleAuth.js';
import { EMAIL_CONFIRMATION_TTL_MS, sendConfirmationEmail } from '../services/emailConfirmation.js';
import { generateToken } from '../services/tokens.js';

export interface AuthRouterDependencies {
  emailSender: EmailSender;
  googleTokenVerifier: GoogleTokenVerifier;
}

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

export function createAuthRouter(deps: AuthRouterDependencies): Router {
  const { emailSender, googleTokenVerifier } = deps;
  const router = Router();

  router.post('/auth/signup', async (req, res) => {
    const {
      name,
      email,
      password,
      phoneNumber,
      location,
      nationality,
      dateOfBirth,
      learningGoals,
      learningGoalOther,
    } = req.body ?? {};

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Missing required signup fields' });
      return;
    }

    const existing = await Account.findOne({ email });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const emailConfirmationToken = generateToken();
    const emailConfirmationExpires = new Date(Date.now() + EMAIL_CONFIRMATION_TTL_MS);

    // Phone/location/nationality/date of birth/learning goal are no longer
    // collected at signup — kept optional here so an already-confirmed
    // account can still fill them in later via Profile edit (#4).
    const account = await Account.create({
      role: 'user',
      name,
      email,
      passwordHash,
      phoneNumber,
      location,
      nationality,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      learningGoals,
      learningGoalOther,
      emailConfirmed: false,
      emailConfirmationToken,
      emailConfirmationExpires,
    });

    await sendConfirmationEmail(
      emailSender,
      account.email,
      emailConfirmationToken,
      'Welcome to 10ME! Confirm your email',
    );

    res.status(201).json({ id: account.id, email: account.email });
  });

  router.get('/auth/confirm-email', async (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    if (!token) {
      res.status(400).json({ error: 'Missing token' });
      return;
    }

    const account = await Account.findOne({
      emailConfirmationToken: token,
      emailConfirmationExpires: { $gt: new Date() },
    });
    if (!account) {
      res.status(400).json({ error: 'Invalid or expired confirmation token' });
      return;
    }

    // A pending email means this token came from a profile email change rather
    // than signup: the address is now proven reachable, so apply it. Re-check
    // uniqueness because someone else may have claimed it since the request.
    if (account.pendingEmail) {
      const taken = await Account.findOne({
        _id: { $ne: account._id },
        $or: [{ email: account.pendingEmail }, { pendingEmail: account.pendingEmail }],
      });
      if (taken) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      account.email = account.pendingEmail;
      account.pendingEmail = undefined;
    }

    account.emailConfirmed = true;
    account.emailConfirmationToken = undefined;
    account.emailConfirmationExpires = undefined;
    await account.save();

    res.status(200).json({ confirmed: true, email: account.email });
  });

  router.post('/auth/resend-confirmation', async (req, res) => {
    const { email } = req.body ?? {};
    if (!email) {
      res.status(400).json({ error: 'Missing email' });
      return;
    }

    const account = await Account.findOne({ email });
    if (account && !account.emailConfirmed) {
      account.emailConfirmationToken = generateToken();
      account.emailConfirmationExpires = new Date(Date.now() + EMAIL_CONFIRMATION_TTL_MS);
      await account.save();

      await sendConfirmationEmail(emailSender, account.email, account.emailConfirmationToken);
    }

    // Always 200, regardless of whether the account exists or is already
    // confirmed — avoids leaking which emails are registered.
    res.status(200).json({ sent: true });
  });

  router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      res.status(400).json({ error: 'Missing email or password' });
      return;
    }

    const account = await Account.findOne({ email });
    if (!account || !account.passwordHash) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
      res.status(423).json({ error: 'Account locked', lockedUntil: account.lockedUntil });
      return;
    }

    const passwordCorrect = await verifyPassword(password, account.passwordHash);
    if (!passwordCorrect) {
      account.failedLoginAttempts += 1;
      if (account.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
        account.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      }
      await account.save();
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    account.failedLoginAttempts = 0;
    account.lockedUntil = undefined;
    await account.save();

    if (!account.emailConfirmed) {
      res.status(403).json({
        error: 'EMAIL_NOT_CONFIRMED',
        message: 'Please confirm your email before logging in.',
        resend: true,
      });
      return;
    }

    const token = signAccountToken({ accountId: account.id, role: account.role });
    res.status(200).json({ token, id: account.id, role: account.role });
  });

  router.post('/auth/forgot-password', async (req, res) => {
    const { email } = req.body ?? {};
    if (!email) {
      res.status(400).json({ error: 'Missing email' });
      return;
    }

    const account = await Account.findOne({ email });
    if (account) {
      account.passwordResetToken = generateToken();
      account.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
      await account.save();

      await emailSender.send({
        to: account.email,
        subject: 'Reset your 10ME password',
        body: `Reset your password: ${FRONTEND_URL}/reset-password?token=${account.passwordResetToken}`,
      });
    }

    // Always 200 — avoids leaking which emails are registered.
    res.status(200).json({ sent: true });
  });

  router.post('/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body ?? {};
    if (!token || !newPassword) {
      res.status(400).json({ error: 'Missing token or newPassword' });
      return;
    }

    const account = await Account.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });
    if (!account) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    account.passwordHash = await hashPassword(newPassword);
    account.passwordResetToken = undefined;
    account.passwordResetExpires = undefined;
    account.failedLoginAttempts = 0;
    account.lockedUntil = undefined;
    await account.save();

    res.status(200).json({ reset: true });
  });

  router.post('/auth/google', async (req, res) => {
    const { idToken } = req.body ?? {};
    if (!idToken) {
      res.status(400).json({ error: 'Missing idToken' });
      return;
    }

    let profile;
    try {
      profile = await googleTokenVerifier.verify(idToken);
    } catch {
      res.status(401).json({ error: 'Invalid Google token' });
      return;
    }

    let account = await Account.findOne({ googleId: profile.googleId });
    if (!account) {
      // Link to an existing password account with the same email, if any,
      // rather than creating a duplicate.
      account = await Account.findOne({ email: profile.email });
    }

    if (!account) {
      account = await Account.create({
        role: 'user',
        email: profile.email,
        name: profile.name,
        googleId: profile.googleId,
        emailConfirmed: true, // Google is the trust source — no confirmation needed.
      });
    } else if (!account.googleId) {
      account.googleId = profile.googleId;
      account.emailConfirmed = true;
      await account.save();
    }

    const token = signAccountToken({ accountId: account.id, role: account.role });
    res.status(200).json({ token, id: account.id, role: account.role });
  });

  return router;
}
