import express from 'express';
import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';
import { onboardingRouter } from './routes/onboarding.js';
import { adminRouter } from './routes/admin.js';
import { buddyRouter } from './routes/buddy.js';
import { createAuthRouter } from './routes/auth.js';
import { consoleEmailSender, type EmailSender } from './services/email.js';
import { realGoogleTokenVerifier, type GoogleTokenVerifier } from './services/googleAuth.js';

export interface AppDependencies {
  emailSender?: EmailSender;
  googleTokenVerifier?: GoogleTokenVerifier;
}

export function createApp(deps: AppDependencies = {}) {
  const emailSender = deps.emailSender ?? consoleEmailSender;
  const googleTokenVerifier = deps.googleTokenVerifier ?? realGoogleTokenVerifier;

  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
  app.use(express.json());
  app.use(healthRouter);
  app.use(meRouter);
  app.use(onboardingRouter);
  app.use(adminRouter);
  app.use(buddyRouter);
  app.use(createAuthRouter({ emailSender, googleTokenVerifier }));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
