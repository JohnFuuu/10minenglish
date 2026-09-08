import { randomBytes } from 'node:crypto';

// Shared generator for the single-use tokens emailed to an account holder
// (email confirmation, password reset).
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}
