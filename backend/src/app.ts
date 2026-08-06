import express from 'express';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(healthRouter);
  app.use(meRouter);
  return app;
}
