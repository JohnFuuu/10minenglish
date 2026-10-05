import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { Account } from '../models/Account.js';

export interface AuthTokenPayload {
  accountId: string;
  role: string;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

export function signAccountToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '7d' });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }

  const token = header.slice('Bearer '.length);
  let payload: AuthTokenPayload;
  try {
    payload = jwt.verify(token, getSecret()) as AuthTokenPayload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Tokens last 7 days, so a removed (archived) Buddy's existing session is
  // cut off here rather than when it expires. Only Buddies can be removed,
  // so only their requests pay for the lookup.
  if (payload.role === 'buddy') {
    const account = await Account.findById(payload.accountId, { removedAt: 1 });
    if (account?.removedAt) {
      res.status(401).json({ error: 'Account removed' });
      return;
    }
  }

  req.account = payload;
  next();
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.account?.role !== role) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}
