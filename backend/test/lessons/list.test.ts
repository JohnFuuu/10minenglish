import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { DateTime } from 'luxon';
import { Account } from '../../src/models/Account.js';
import { Lesson } from '../../src/models/Lesson.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import { createTestApp } from '../testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

async function userToken(overrides: Record<string, unknown> = {}) {
  const account = await Account.create({ role: 'user', email: 'user@example.com', credits: 3, ...overrides });
  return { account, token: signAccountToken({ accountId: account.id, role: account.role }) };
}

async function buddy(overrides: Record<string, unknown> = {}) {
  return Account.create({
    role: 'buddy',
    email: 'buddy@example.com',
    name: 'Kenji',
    timezone: 'Asia/Tokyo',
    zoomLink: 'https://zoom.us/j/123',
    ...overrides,
  });
}

describe('GET /api/lessons', () => {
  it('rejects a non-user account', async () => {
    const b = await buddy();
    const token = signAccountToken({ accountId: b.id, role: b.role });
    const { app } = createTestApp();

    const res = await request(app).get('/api/lessons').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns empty upcoming and previous lists when the user has no lessons', async () => {
    const { token } = await userToken();
    const { app } = createTestApp();

    const res = await request(app).get('/api/lessons').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ upcoming: [], previous: [] });
  });

  it('splits lessons into upcoming vs previous and includes the buddy name', async () => {
    const { account, token } = await userToken();
    const b = await buddy();
    const now = DateTime.now();

    const future = await Lesson.create({
      userId: account.id,
      buddyId: b.id,
      startTime: now.plus({ days: 1 }).toJSDate(),
      zoomLink: b.zoomLink,
      status: 'upcoming',
    });
    const pastNeverCompleted = await Lesson.create({
      userId: account.id,
      buddyId: b.id,
      startTime: now.minus({ days: 1 }).toJSDate(),
      zoomLink: b.zoomLink,
      status: 'upcoming',
    });
    const cancelledButFuture = await Lesson.create({
      userId: account.id,
      buddyId: b.id,
      startTime: now.plus({ days: 2 }).toJSDate(),
      zoomLink: b.zoomLink,
      status: 'cancelled',
    });
    const { app } = createTestApp();

    const res = await request(app).get('/api/lessons').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.upcoming).toHaveLength(1);
    expect(res.body.upcoming[0]).toMatchObject({ id: future.id, buddyName: 'Kenji', status: 'upcoming' });

    const previousIds = res.body.previous.map((l: { id: string }) => l.id);
    expect(previousIds.sort()).toEqual([pastNeverCompleted.id, cancelledButFuture.id].sort());
  });

  it('marks a lesson joinable only from 10 minutes before start through its end', async () => {
    const { account, token } = await userToken();
    const b = await buddy();
    const now = DateTime.now();

    const joinable = await Lesson.create({
      userId: account.id,
      buddyId: b.id,
      startTime: now.plus({ minutes: 5 }).toJSDate(),
      zoomLink: b.zoomLink,
      status: 'upcoming',
    });
    const tooEarly = await Lesson.create({
      userId: account.id,
      buddyId: b.id,
      startTime: now.plus({ minutes: 30 }).toJSDate(),
      zoomLink: b.zoomLink,
      status: 'upcoming',
    });
    const { app } = createTestApp();

    const res = await request(app).get('/api/lessons').set('Authorization', `Bearer ${token}`);

    const byId = new Map(res.body.upcoming.map((l: { id: string; joinable: boolean }) => [l.id, l.joinable]));
    expect(byId.get(joinable.id)).toBe(true);
    expect(byId.get(tooEarly.id)).toBe(false);
  });
});
