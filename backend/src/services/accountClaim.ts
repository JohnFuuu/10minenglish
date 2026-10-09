import type { HydratedDocument } from 'mongoose';
import type { AccountDocument } from '../models/Account.js';

// When Google or Facebook proves someone owns an email that an existing,
// UNCONFIRMED account was registered with, the account becomes theirs — but
// whoever registered it may not be them (account pre-hijacking: sign up with
// someone else's email and wait for them to arrive by social sign-in). So
// nothing that unproven registrant set up keeps working: their password,
// pending reset/confirmation links, lockout, and every login issued so far.
// The owner can set their own password in Profile. Call before saving.
export function claimUnconfirmedAccount(account: HydratedDocument<AccountDocument>, now: Date = new Date()): void {
  account.passwordHash = undefined;
  account.passwordResetToken = undefined;
  account.passwordResetExpires = undefined;
  account.emailConfirmationToken = undefined;
  account.emailConfirmationExpires = undefined;
  account.pendingEmail = undefined;
  account.failedLoginAttempts = 0;
  account.lockedUntil = undefined;
  // Login tokens carry their issue time in whole seconds; anything issued
  // before this second is no longer accepted (see middleware/auth.ts).
  account.tokensValidAfter = new Date(Math.floor(now.getTime() / 1000) * 1000);
  account.emailConfirmed = true;
}
