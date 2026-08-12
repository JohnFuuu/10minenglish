import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { DateTime } from 'luxon';
import { Account } from '../../src/models/Account.js';
import { Lesson } from '../../src/models/Lesson.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import { createTestApp } from '../testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

const BUDDY_TZ = 'Asia/Tokyo';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

function anchorLocal() {
  return DateTime.now().setZone(BUDDY_TZ).plus({ days: 30 }).set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
}

async function userToken(overrides: Record<string, unknown> = {}) {
  const account = await Account.create({ role: 'user', email: 'user@example.com', credits: 3, ...overrides });
  return { account, token: signAccountToken({ accountId: account.id, role: account.role }) };
}

async function bookableBuddy(overrides: Record<string, unknown> = {}) {
  const anchor = anchorLocal();
  return Account.create({
    role: 'buddy',
    email: 'buddy@example.com',
    name: 'Buddy',
    timezone: BUDDY_TZ,
    zoomLink: 'https://zoom.us/j/123',
    availabilityBlocks: [{ dayOfWeek: anchor.weekday % 7, startTime: '09:00', endTime: '17:00' }],
    ...overrides,
  });
}

describe('POST /api/lessons', () => {
  it('rejects a non-user account', async () => {
    const buddy = await bookableBuddy();
    const token = signAccountToken({ accountId: buddy.id, role: buddy.role });
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({ buddyId: buddy.id, startTime: anchorLocal().toJSDate().toISOString() });

    expect(res.status).toBe(403);
  });

  it('blocks booking with 0 credits and deducts nothing', async () => {
    const buddy = await bookableBuddy();
    const { account, token } = await userToken({ credits: 0 });
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({ buddyId: buddy.id, startTime: anchorLocal().toJSDate().toISOString() });

    expect(res.status).toBe(402);
    const updated = await Account.findById(account.id);
    expect(updated!.credits).toBe(0);
    expect(await Lesson.countDocuments()).toBe(0);
  });

  it('404s for an unknown buddy', async () => {
    const { token } = await userToken();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({ buddyId: '507f1f77bcf86cd799439011', startTime: anchorLocal().toJSDate().toISOString() });

    expect(res.status).toBe(404);
  });

  it('rejects a slot outside the availability schedule and deducts nothing', async () => {
    const buddy = await bookableBuddy();
    const { account, token } = await userToken();
    const outsideSlot = anchorLocal().set({ hour: 20 });
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({ buddyId: buddy.id, startTime: outsideSlot.toJSDate().toISOString() });

    expect(res.status).toBe(409);
    const updated = await Account.findById(account.id);
    expect(updated!.credits).toBe(3);
    expect(await Lesson.countDocuments()).toBe(0);
  });

  it('rejects a slot already booked by another user and deducts nothing', async () => {
    const buddy = await bookableBuddy();
    const other = await Account.create({ role: 'user', email: 'other@example.com' });
    const anchor = anchorLocal();
    await Lesson.create({ userId: other.id, buddyId: buddy.id, startTime: anchor.toJSDate(), zoomLink: buddy.zoomLink });

    const { account, token } = await userToken();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({ buddyId: buddy.id, startTime: anchor.toJSDate().toISOString() });

    expect(res.status).toBe(409);
    const updated = await Account.findById(account.id);
    expect(updated!.credits).toBe(3);
  });

  it('books the lesson, deducts 1 credit, snapshots the Zoom link, and emails a confirmation', async () => {
    const buddy = await bookableBuddy();
    const { account, token } = await userToken();
    const anchor = anchorLocal();
    const { app, emailSender } = createTestApp();

    const res = await request(app)
      .post('/api/lessons')
      .set('Authorization', `Bearer ${token}`)
      .send({ buddyId: buddy.id, startTime: anchor.toJSDate().toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.creditsRemaining).toBe(2);
    expect(res.body.lesson).toMatchObject({
      buddyId: buddy.id,
      status: 'upcoming',
      zoomLink: buddy.zoomLink,
    });

    const updated = await Account.findById(account.id);
    expect(updated!.credits).toBe(2);

    const lessons = await Lesson.find();
    expect(lessons).toHaveLength(1);
    expect(lessons[0].startTime.toISOString()).toBe(anchor.toJSDate().toISOString());

    expect(emailSender.sent).toHaveLength(1);
    expect(emailSender.sent[0].to).toBe('user@example.com');
    expect(emailSender.sent[0].body).toContain(buddy.zoomLink);
  });
});
