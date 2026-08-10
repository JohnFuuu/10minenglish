import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(healthRouter);
  app.use(meRouter);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
