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

async function buddyToken(overrides: Record<string, unknown> = {}) {
  const account = await Account.create({
    role: 'buddy',
    email: 'buddy@example.com',
    zoomLink: 'https://zoom.us/j/123',
    ...overrides,
  });
  return { account, token: signAccountToken({ accountId: account.id, role: account.role }) };
}

describe('GET /api/lessons/teaching', () => {
  it('rejects a non-buddy account', async () => {
    const u = await Account.create({ role: 'user', email: 'user@example.com' });
    const token = signAccountToken({ accountId: u.id, role: u.role });
    const { app } = createTestApp();

    const res = await request(app).get('/api/lessons/teaching').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns empty upcoming and previous lists when the buddy has no lessons', async () => {
    const { token } = await buddyToken();
    const { app } = createTestApp();

    const res = await request(app).get('/api/lessons/teaching').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ upcoming: [], previous: [] });
  });

  it('splits lessons into upcoming vs previous and includes the student name', async () => {
    const { account: buddy, token } = await buddyToken();
    const student = await Account.create({ role: 'user', email: 'student@example.com', name: 'Aria' });
    const now = DateTime.now();

    const future = await Lesson.create({
      userId: student.id,
      buddyId: buddy.id,
      startTime: now.plus({ days: 1 }).toJSDate(),
      zoomLink: buddy.zoomLink,
      status: 'upcoming',
    });
    const past = await Lesson.create({
      userId: student.id,
      buddyId: buddy.id,
      startTime: now.minus({ days: 1 }).toJSDate(),
      zoomLink: buddy.zoomLink,
      status: 'upcoming',
    });
    const { app } = createTestApp();

    const res = await request(app).get('/api/lessons/teaching').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.upcoming).toHaveLength(1);
    expect(res.body.upcoming[0]).toMatchObject({ id: future.id, userName: 'Aria', status: 'upcoming' });
    expect(res.body.previous.map((l: { id: string }) => l.id)).toEqual([past.id]);
  });
});
