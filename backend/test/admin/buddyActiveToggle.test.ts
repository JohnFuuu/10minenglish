import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
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

async function adminToken() {
  const admin = await Account.create({ role: 'admin', email: 'admin@10me.test' });
  return signAccountToken({ accountId: admin.id, role: admin.role });
}

async function createBuddy() {
  return Account.create({
    role: 'buddy',
    email: 'maria@example.com',
    name: 'Maria',
    zoomLink: 'https://zoom.us/j/1234567890',
    timezone: 'Pacific/Auckland',
    availabilityBlocks: [{ dayOfWeek: 1, startTime: '00:00', endTime: '23:59' }],
  });
}

async function createUser(credits = 3) {
  const account = await Account.create({ role: 'user', email: 'sarah@example.com', credits });
  return { account, token: signAccountToken({ accountId: account.id, role: account.role }) };
}

async function createUpcomingLesson(userId: string, buddyId: string, daysAhead = 3) {
  return Lesson.create({
    userId,
    buddyId,
    startTime: new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000),
    durationMinutes: 10,
    status: 'upcoming',
    zoomLink: 'https://zoom.us/j/1234567890',
  });
}

describe('PATCH /api/admin/buddies/:id', () => {
  it('rejects a non-admin account', async () => {
    const { token } = await createUser();
    const buddy = await createBuddy();

    const { app } = createTestApp();
    const res = await request(app)
      .patch(`/api/admin/buddies/${buddy.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });

    expect(res.status).toBe(403);
  });

  it('toggles a Buddy inactive and back again', async () => {
    const token = await adminToken();
    const buddy = await createBuddy();

    const { app } = createTestApp();
    const off = await request(app)
      .patch(`/api/admin/buddies/${buddy.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });

    expect(off.status).toBe(200);
    expect(off.body.active).toBe(false);
    expect((await Account.findById(buddy.id))!.active).toBe(false);

    const on = await request(app)
      .patch(`/api/admin/buddies/${buddy.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: true });

    expect(on.body.active).toBe(true);
    expect((await Account.findById(buddy.id))!.active).toBe(true);
  });

  it('auto-cancels upcoming Lessons, refunds the User, and notifies them', async () => {
    const token = await adminToken();
    const buddy = await createBuddy();
    const { account: user } = await createUser(0);
    const lesson = await createUpcomingLesson(user.id, buddy.id);

    const { app, emailSender } = createTestApp();
    const res = await request(app)
      .patch(`/api/admin/buddies/${buddy.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(res.body.cancelledLessons).toBe(1);

    expect((await Lesson.findById(lesson.id))!.status).toBe('cancelled');
    expect((await Account.findById(user.id))!.credits).toBe(1);

    const notifications = await Notification.find({ accountId: user.id });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('buddy_cancellation_refund');
    expect(emailSender.sent.map((m) => m.to)).toContain(user.email);
  });

  it('refunds every affected Lesson, however close it is', async () => {
    const token = await adminToken();
    const buddy = await createBuddy();
    const { account: user } = await createUser(0);
    // Inside the 12h window a User-initiated cancellation would not refund.
    await createUpcomingLesson(user.id, buddy.id, 0.1);
    await createUpcomingLesson(user.id, buddy.id, 5);

    const { app } = createTestApp();
    const res = await request(app)
      .patch(`/api/admin/buddies/${buddy.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });

    expect(res.body.cancelledLessons).toBe(2);
    expect((await Account.findById(user.id))!.credits).toBe(2);
  });

  it('leaves past and already-cancelled Lessons alone', async () => {
    const token = await adminToken();
    const buddy = await createBuddy();
    const { account: user } = await createUser(0);

    const past = await Lesson.create({
      userId: user.id,
      buddyId: buddy.id,
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
      durationMinutes: 10,
      status: 'upcoming',
      zoomLink: 'https://zoom.us/j/1234567890',
    });
    const cancelled = await Lesson.create({
      userId: user.id,
      buddyId: buddy.id,
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      durationMinutes: 10,
      status: 'cancelled',
      zoomLink: 'https://zoom.us/j/1234567890',
    });

    const { app } = createTestApp();
    const res = await request(app)
      .patch(`/api/admin/buddies/${buddy.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });

    expect(res.body.cancelledLessons).toBe(0);
    expect((await Lesson.findById(past.id))!.status).toBe('upcoming');
    expect((await Lesson.findById(cancelled.id))!.status).toBe('cancelled');
    expect((await Account.findById(user.id))!.credits).toBe(0);
  });

  it('cancels nothing when reactivating', async () => {
    const token = await adminToken();
    const buddy = await createBuddy();
    const { account: user } = await createUser(0);
    await createUpcomingLesson(user.id, buddy.id);

    const { app } = createTestApp();
    const res = await request(app)
      .patch(`/api/admin/buddies/${buddy.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: true });

    expect(res.body.cancelledLessons).toBe(0);
    expect((await Account.findById(user.id))!.credits).toBe(0);
  });

  it('rejects a missing or non-boolean active flag', async () => {
    const token = await adminToken();
    const buddy = await createBuddy();

    const { app } = createTestApp();
    const res = await request(app)
      .patch(`/api/admin/buddies/${buddy.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('an inactive Buddy is not bookable', () => {
  it('drops out of the Buddies directory', async () => {
    const token = await adminToken();
    const buddy = await createBuddy();
    const { token: userToken } = await createUser();

    const { app } = createTestApp();
    await request(app)
      .patch(`/api/admin/buddies/${buddy.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });

    const res = await request(app).get('/api/buddies').set('Authorization', `Bearer ${userToken}`);
    expect(res.body.buddies).toEqual([]);
  });

  it('is reported as not bookable on their Buddy page', async () => {
    const token = await adminToken();
    const buddy = await createBuddy();
    const { token: userToken } = await createUser();

    const { app } = createTestApp();
    await request(app)
      .patch(`/api/admin/buddies/${buddy.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });

    const res = await request(app)
      .get(`/api/buddies/${buddy.id}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.body.bookable).toBe(false);
  });

  it('cannot be booked directly', async () => {
    const token = await adminToken();
    const buddy = await createBuddy();
    const { token: userToken } = await createUser();

    const { app } = createTestApp();
    await request(app)
      .patch(`/api/admin/buddies/${buddy.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });

    // Next Monday, inside the availability block set up above.
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + ((8 - start.getUTCDay()) % 7 || 7));
    start.setUTCHours(3, 0, 0, 0);

    const res = await request(app)
      .post('/api/lessons')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ buddyId: buddy.id, startTime: start.toISOString() });

    expect(res.status).toBe(409);
  });
});

describe('GET /api/admin/buddies', () => {
  it('lists inactive Buddies too, so they can be put back', async () => {
    const token = await adminToken();
    const buddy = await createBuddy();

    const { app } = createTestApp();
    await request(app)
      .patch(`/api/admin/buddies/${buddy.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });

    const res = await request(app)
      .get('/api/admin/buddies')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.buddies).toHaveLength(1);
    expect(res.body.buddies[0]).toMatchObject({ name: 'Maria', active: false, hasZoomLink: true });
  });
});
