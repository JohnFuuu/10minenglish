import type { AuthTokenPayload } from '../middleware/auth.js';

declare global {
  namespace Express {
    interface Request {
      account?: AuthTokenPayload;
    }
  }
}

export {};
