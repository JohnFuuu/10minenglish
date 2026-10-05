import type { NextFunction, Request, Response } from 'express';
import { Account } from '../models/Account.js';

// A new User is signed in before confirming their email, so they can look
// around and onboard — but spending (booking a Lesson, buying Credits) waits
// until the address is proven. Runs after requireAuth. Reads the flag from the
// database rather than the token, so it takes effect the moment they click
// the link, without needing a fresh token.
export async function requireConfirmedEmail(req: Request, res: Response, next: NextFunction) {
  const account = await Account.findById(req.account!.accountId, { emailConfirmed: 1 });
  if (!account?.emailConfirmed) {
    res.status(403).json({ error: 'EMAIL_NOT_CONFIRMED' });
    return;
  }
  next();
}
