import express from 'express';
import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';
import { healthRouter } from './routes/health.js';
import { createMeRouter } from './routes/me.js';
import { onboardingRouter } from './routes/onboarding.js';
import { adminRouter } from './routes/admin.js';
import { buddyRouter } from './routes/buddy.js';
import { creditPacksRouter } from './routes/creditPacks.js';
import { createPaymentsRouter } from './routes/payments.js';
import { createAuthRouter } from './routes/auth.js';
import { createLessonsRouter } from './routes/lessons.js';
import { notificationsRouter } from './routes/notifications.js';
import { consoleEmailSender, type EmailSender } from './services/email.js';
import { realGoogleTokenVerifier, type GoogleTokenVerifier } from './services/googleAuth.js';
import { realStripeClient, type StripeClient } from './services/stripeClient.js';
import { realPoliClient, type PoliClient } from './services/poliClient.js';

export interface AppDependencies {
  emailSender?: EmailSender;
  googleTokenVerifier?: GoogleTokenVerifier;
  stripeClient?: StripeClient;
  poliClient?: PoliClient;
}

export function createApp(deps: AppDependencies = {}) {
  const emailSender = deps.emailSender ?? consoleEmailSender;
  const googleTokenVerifier = deps.googleTokenVerifier ?? realGoogleTokenVerifier;
  const stripeClient = deps.stripeClient ?? realStripeClient;
  const poliClient = deps.poliClient ?? realPoliClient;

  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
  app.use(express.json());
  app.use(healthRouter);
  app.use(createMeRouter({ emailSender }));
  app.use(onboardingRouter);
  app.use(adminRouter);
  app.use(buddyRouter);
  app.use(notificationsRouter);
  app.use(creditPacksRouter);
  app.use(createPaymentsRouter({ stripeClient, poliClient }));
  app.use(createAuthRouter({ emailSender, googleTokenVerifier }));
  app.use(createLessonsRouter({ emailSender }));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
