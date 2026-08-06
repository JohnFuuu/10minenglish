import { Router } from 'express';
import mongoose from 'mongoose';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res
    .status(connected ? 200 : 503)
    .json({ status: connected ? 'ok' : 'unavailable', db: connected ? 'connected' : 'disconnected' });
});
