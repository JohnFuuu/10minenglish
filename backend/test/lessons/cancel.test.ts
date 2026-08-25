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
  const account = await Account.create({ role: 'user', email: 'user@example.com', credits: 2, ...overrides });
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

describe('POST /api/lessons/:id/cancel', () => {
  it('rejects a non-user account', async () => {
    const b = await buddy();
    const token = signAccountToken({ accountId: b.id, role: b.role });
    const lesson = await Lesson.create({ userId: b.id, buddyId: b.id, startTime: new Date(), zoomLink: b.zoomLink });
    const { app } = createTestApp();

    const res = await request(app).post(`/api/lessons/${lesson.id}/cancel`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('404s for an unknown lesson', async () => {
    const { token } = await userToken();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/lessons/507f1f77bcf86cd799439011/cancel')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("403s when cancelling another user's lesson", async () => {
    const b = await buddy();
    const owner = await Account.create({ role: 'user', email: 'owner@example.com', credits: 2 });
    const { token } = await userToken();
    const lesson = await Lesson.create({
      userId: owner.id,
      buddyId: b.id,
      startTime: DateTime.now().plus({ days: 1 }).toJSDate(),
      zoomLink: b.zoomLink,
    });
    const { app } = createTestApp();

    const res = await request(app).post(`/api/lessons/${lesson.id}/cancel`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('409s when the lesson is already cancelled', async () => {
    const b = await buddy();
    const { account, token } = await userToken();
    const lesson = await Lesson.create({
      userId: account.id,
      buddyId: b.id,
      startTime: DateTime.now().plus({ days: 1 }).toJSDate(),
      zoomLink: b.zoomLink,
      status: 'cancelled',
    });
    const { app } = createTestApp();

    const res = await request(app).post(`/api/lessons/${lesson.id}/cancel`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  it('refunds the credit when cancelled >= 12h before start', async () => {
    const b = await buddy();
    const { account, token } = await userToken({ credits: 2 });
    const lesson = await Lesson.create({
      userId: account.id,
      buddyId: b.id,
      startTime: DateTime.now().plus({ hours: 13 }).toJSDate(),
      zoomLink: b.zoomLink,
    });
    const { app } = createTestApp();

    const res = await request(app).post(`/api/lessons/${lesson.id}/cancel`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.refunded).toBe(true);
    expect(res.body.creditsRemaining).toBe(3);
    expect(res.body.lesson.status).toBe('cancelled');

    const updatedAccount = await Account.findById(account.id);
    expect(updatedAccount!.credits).toBe(3);
    const updatedLesson = await Lesson.findById(lesson.id);
    expect(updatedLesson!.status).toBe('cancelled');
  });

  it('does not refund when cancelled < 12h before start', async () => {
    const b = await buddy();
    const { account, token } = await userToken({ credits: 2 });
    const lesson = await Lesson.create({
      userId: account.id,
      buddyId: b.id,
      startTime: DateTime.now().plus({ hours: 6 }).toJSDate(),
      zoomLink: b.zoomLink,
    });
    const { app } = createTestApp();

    const res = await request(app).post(`/api/lessons/${lesson.id}/cancel`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.refunded).toBe(false);
    expect(res.body.creditsRemaining).toBe(2);

    const updatedAccount = await Account.findById(account.id);
    expect(updatedAccount!.credits).toBe(2);
  });

  it('only refunds once when two cancel requests race for the same lesson', async () => {
    const b = await buddy();
    const { account, token } = await userToken({ credits: 2 });
    const lesson = await Lesson.create({
      userId: account.id,
      buddyId: b.id,
      startTime: DateTime.now().plus({ hours: 13 }).toJSDate(),
      zoomLink: b.zoomLink,
    });
    const { app } = createTestApp();

    const [resA, resB] = await Promise.all([
      request(app).post(`/api/lessons/${lesson.id}/cancel`).set('Authorization', `Bearer ${token}`),
      request(app).post(`/api/lessons/${lesson.id}/cancel`).set('Authorization', `Bearer ${token}`),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const successResponse = resA.status === 200 ? resA : resB;
    expect(successResponse.body.refunded).toBe(true);

    const updatedAccount = await Account.findById(account.id);
    expect(updatedAccount!.credits).toBe(3);
  });
});
