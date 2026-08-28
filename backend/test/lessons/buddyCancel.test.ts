import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { DateTime } from 'luxon';
import { Account } from '../../src/models/Account.js';
import { Lesson } from '../../src/models/Lesson.js';
import { Notification } from '../../src/models/Notification.js';
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
    name: 'Kenji',
    timezone: 'Asia/Tokyo',
    zoomLink: 'https://zoom.us/j/123',
    ...overrides,
  });
  return { account, token: signAccountToken({ accountId: account.id, role: account.role }) };
}

async function user(overrides: Record<string, unknown> = {}) {
  return Account.create({ role: 'user', email: 'user@example.com', credits: 2, ...overrides });
}

describe('POST /api/lessons/:id/buddy-cancel', () => {
  it('rejects a non-buddy account', async () => {
    const u = await user();
    const token = signAccountToken({ accountId: u.id, role: u.role });
    const lesson = await Lesson.create({ userId: u.id, buddyId: u.id, startTime: new Date(), zoomLink: 'https://zoom.us/j/1' });
    const { app } = createTestApp();

    const res = await request(app).post(`/api/lessons/${lesson.id}/buddy-cancel`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('404s for an unknown lesson', async () => {
    const { token } = await buddyToken();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/lessons/507f1f77bcf86cd799439011/buddy-cancel')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('403s when cancelling another Buddy\'s lesson', async () => {
    const otherBuddy = await Account.create({ role: 'buddy', email: 'other-buddy@example.com', zoomLink: 'https://zoom.us/j/9' });
    const u = await user();
    const { token } = await buddyToken();
    const lesson = await Lesson.create({
      userId: u.id,
      buddyId: otherBuddy.id,
      startTime: DateTime.now().plus({ days: 1 }).toJSDate(),
      zoomLink: otherBuddy.zoomLink,
    });
    const { app } = createTestApp();

    const res = await request(app).post(`/api/lessons/${lesson.id}/buddy-cancel`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('409s when the lesson is already cancelled', async () => {
    const { account: buddy, token } = await buddyToken();
    const u = await user();
    const lesson = await Lesson.create({
      userId: u.id,
      buddyId: buddy.id,
      startTime: DateTime.now().plus({ days: 1 }).toJSDate(),
      zoomLink: buddy.zoomLink,
      status: 'cancelled',
    });
    const { app } = createTestApp();

    const res = await request(app).post(`/api/lessons/${lesson.id}/buddy-cancel`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  it('refunds the credit even when the lesson starts in under 12 hours, and notifies the User in-app and by email', async () => {
    const { account: buddy, token } = await buddyToken();
    const u = await user({ credits: 2 });
    const lesson = await Lesson.create({
      userId: u.id,
      buddyId: buddy.id,
      startTime: DateTime.now().plus({ minutes: 30 }).toJSDate(),
      zoomLink: buddy.zoomLink,
    });
    const { app, emailSender } = createTestApp();

    const res = await request(app).post(`/api/lessons/${lesson.id}/buddy-cancel`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.creditsRemaining).toBe(3);
    expect(res.body.lesson.status).toBe('cancelled');

    const updatedUser = await Account.findById(u.id);
    expect(updatedUser!.credits).toBe(3);

    const notifications = await Notification.find({ accountId: u.id });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ type: 'buddy_cancellation_refund', read: false });
    expect(notifications[0].message).toContain('Kenji');

    expect(emailSender.sent).toHaveLength(1);
    expect(emailSender.sent[0].to).toBe(u.email);
    expect(emailSender.sent[0].subject).toMatch(/cancelled/i);
  });
});
