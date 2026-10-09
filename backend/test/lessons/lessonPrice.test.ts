import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { DateTime } from 'luxon';
import { Account } from '../../src/models/Account.js';
import { AuditEntry } from '../../src/models/AuditEntry.js';
import { Lesson } from '../../src/models/Lesson.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import { createTestApp } from '../testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

const TZ = 'Asia/Tokyo';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

// Two days out at noon Tokyo time: comfortably outside the refund cutoff.
function slot(daysAhead = 2) {
  return DateTime.now().setZone(TZ).plus({ days: daysAhead }).set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
}

async function setup(credits: number) {
  const buddy = await Account.create({
    role: 'buddy',
    email: 'buddy@example.com',
    name: 'Kenji',
    timezone: TZ,
    meetingLink: 'https://zoom.us/j/123',
    availabilityBlocks: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, startTime: '00:00', endTime: '23:50' })),
  });
  const user = await Account.create({ role: 'user', email: 'user@example.com', emailConfirmed: true, credits });
  const admin = await Account.create({ role: 'admin', email: 'admin@10me.test', name: 'Ada Admin' });
  const { app } = createTestApp();
  return {
    app,
    buddy,
    user,
    userToken: signAccountToken({ accountId: user.id, role: 'user' }),
    buddyToken: signAccountToken({ accountId: buddy.id, role: 'buddy' }),
    adminToken: signAccountToken({ accountId: admin.id, role: 'admin' }),
  };
}

async function setPrice(app: Parameters<typeof request>[0], adminToken: string, creditsPerLesson: number) {
  return request(app).patch('/api/admin/lesson-price').set('Authorization', `Bearer ${adminToken}`).send({ creditsPerLesson });
}

describe('meeting price (credits per meeting)', () => {
  it('starts at 1 credit, and an Admin can change it, audited under pricing', async () => {
    const { app, userToken, adminToken } = await setup(0);

    expect((await request(app).get('/api/lesson-price').set('Authorization', `Bearer ${userToken}`)).body).toEqual({ creditsPerLesson: 1 });

    const res = await setPrice(app, adminToken, 3);
    expect(res.status).toBe(200);
    expect((await request(app).get('/api/lesson-price').set('Authorization', `Bearer ${userToken}`)).body).toEqual({ creditsPerLesson: 3 });

    const log = await request(app).get('/api/admin/audit-log').query({ category: 'pricing' }).set('Authorization', `Bearer ${adminToken}`);
    expect(log.body.entries[0]).toMatchObject({ action: 'lesson_price.changed', details: { from: 1, to: 3 } });
    // Saving the same price again isn't a change.
    await setPrice(app, adminToken, 3);
    expect(await AuditEntry.countDocuments({ action: 'lesson_price.changed' })).toBe(1);
  });

  it('refuses a non-Admin, and a price that isn’t a whole number from 1 to 20', async () => {
    const { app, userToken, adminToken } = await setup(0);

    const asUser = await request(app).patch('/api/admin/lesson-price').set('Authorization', `Bearer ${userToken}`).send({ creditsPerLesson: 2 });
    expect(asUser.status).toBe(403);
    for (const bad of [0, -1, 1.5, 21, '2', null]) {
      expect((await setPrice(app, adminToken, bad as number)).status).toBe(400);
    }
  });

  it('charges the current price for a booking and records it on the Meeting', async () => {
    const { app, user, buddy, userToken, adminToken } = await setup(5);
    await setPrice(app, adminToken, 3);

    const res = await request(app)
      .post('/api/lessons')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ buddyId: buddy.id, startTime: slot().toJSDate().toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.creditsRemaining).toBe(2);
    expect(res.body.lesson.creditsCost).toBe(3);
    expect((await Account.findById(user.id))!.credits).toBe(2);
  });

  it('refuses a booking the User can’t afford at the current price, charging nothing', async () => {
    const { app, user, buddy, userToken, adminToken } = await setup(2);
    await setPrice(app, adminToken, 3);

    const res = await request(app)
      .post('/api/lessons')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ buddyId: buddy.id, startTime: slot().toJSDate().toISOString() });

    expect(res.status).toBe(402);
    expect(await Lesson.countDocuments()).toBe(0);
    expect((await Account.findById(user.id))!.credits).toBe(2);
  });

  it('needs credits for every meeting in a recurring series at the current price', async () => {
    const { app, user, buddy, userToken, adminToken } = await setup(5);
    await setPrice(app, adminToken, 2);
    const series = (occurrenceCount: number) =>
      request(app)
        .post('/api/lessons/recurring')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ buddyId: buddy.id, startTime: slot().toJSDate().toISOString(), frequency: { type: 'weekly' }, includeWeekends: true, occurrenceCount, timezone: TZ });

    expect((await series(3)).status).toBe(402);

    const res = await series(2);
    expect(res.status).toBe(201);
    expect(res.body.creditsDeducted).toBe(4);
    expect(res.body.creditsRemaining).toBe(1);
    expect((await Account.findById(user.id))!.credits).toBe(1);
  });

  it('refunds what the Meeting cost when booked, even after the price changes', async () => {
    const { app, user, buddy, userToken, adminToken } = await setup(10);
    await setPrice(app, adminToken, 3);
    const booked = await request(app)
      .post('/api/lessons')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ buddyId: buddy.id, startTime: slot().toJSDate().toISOString() });
    await setPrice(app, adminToken, 5);

    const res = await request(app).post(`/api/lessons/${booked.body.lesson.id}/cancel`).set('Authorization', `Bearer ${userToken}`);

    expect(res.body).toMatchObject({ refunded: true, creditsRemaining: 10 });
    expect((await Account.findById(user.id))!.credits).toBe(10);
  });

  it('refunds what the Meeting cost when the Buddy cancels', async () => {
    const { app, user, buddy, userToken, buddyToken, adminToken } = await setup(10);
    await setPrice(app, adminToken, 4);
    const booked = await request(app)
      .post('/api/lessons')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ buddyId: buddy.id, startTime: slot().toJSDate().toISOString() });

    await request(app).post(`/api/lessons/${booked.body.lesson.id}/buddy-cancel`).set('Authorization', `Bearer ${buddyToken}`);

    expect((await Account.findById(user.id))!.credits).toBe(10);
  });

  it('refunds 1 credit for a Meeting booked before prices existed (no cost recorded)', async () => {
    const { app, user, buddy, userToken } = await setup(0);
    const { insertedId } = await Lesson.collection.insertOne({
      userId: user._id,
      buddyId: buddy._id,
      startTime: slot().toJSDate(),
      durationMinutes: 10,
      status: 'upcoming',
      meetingLink: 'https://zoom.us/j/123',
      createdAt: new Date(),
    });

    await request(app).post(`/api/lessons/${insertedId}/cancel`).set('Authorization', `Bearer ${userToken}`);

    expect((await Account.findById(user.id))!.credits).toBe(1);
  });
});
