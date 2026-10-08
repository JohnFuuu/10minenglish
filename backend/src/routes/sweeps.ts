import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import type { EmailSender } from '../services/email.js';
import { runAllSweeps } from '../services/sweeps.js';

function tokensMatch(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// On Cloud Run, CPU pauses between requests, so in-process timers can't be
// trusted; Cloud Scheduler calls this every minute instead (SWEEP_MODE=
// scheduler turns the timers off — see server.ts). Guarded by a shared
// secret in the X-Sweep-Token header; without SWEEP_TOKEN set it doesn't
// exist at all.
export function createSweepsRouter({ emailSender }: { emailSender: EmailSender }): Router {
  const router = Router();

  router.post('/internal/sweeps', async (req, res) => {
    const expected = process.env.SWEEP_TOKEN;
    if (!expected) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const given = req.get('X-Sweep-Token');
    if (!given || !tokensMatch(given, expected)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.status(200).json(await runAllSweeps(emailSender));
  });

  return router;
}
