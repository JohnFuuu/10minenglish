import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { DateTime } from 'luxon';
import { createApp } from '../../src/app.js';
import { Account } from '../../src/models/Account.js';
import { Lesson } from '../../src/models/Lesson.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

const BUDDY_TZ = 'Asia/Tokyo'; // fixed UTC+9 offset, no DST — deterministic across the year

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

function anchorLocal() {
  return DateTime.now().setZone(BUDDY_TZ).plus({ days: 30 }).set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
}

async function userToken() {
  const account = await Account.create({ role: 'user', email: 'user@example.com', credits: 5 });
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

describe('GET /api/buddies/:id/slots', () => {
  it('404s for a non-buddy id', async () => {
    const { token } = await userToken();
    const app = createApp();

    const res = await request(app)
      .get('/api/buddies/507f1f77bcf86cd799439011/slots')
      .query({ date: '2026-01-01', viewerTimezone: 'UTC' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('400s when date or viewerTimezone is missing', async () => {
    const buddy = await bookableBuddy();
    const { token } = await userToken();
    const app = createApp();

    const res = await request(app)
      .get(`/api/buddies/${buddy.id}/slots`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns only slots inside the availability window, excluding already-booked ones', async () => {
    const buddy = await bookableBuddy();
    const { token } = await userToken();
    const anchor = anchorLocal();

    // Pre-book the anchor slot so it should be excluded from the response.
    await Lesson.create({
      userId: (await Account.create({ role: 'user', email: 'other@example.com' })).id,
      buddyId: buddy.id,
      startTime: anchor.toJSDate(),
      zoomLink: buddy.zoomLink,
    });

    const app = createApp();
    const res = await request(app)
      .get(`/api/buddies/${buddy.id}/slots`)
      .query({ date: anchor.toFormat('yyyy-MM-dd'), viewerTimezone: BUDDY_TZ })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.slots).not.toContain(anchor.toJSDate().toISOString());

    // A neighbouring slot inside the window (13:00) should still be offered.
    const otherSlot = anchor.set({ hour: 13, minute: 0 });
    expect(res.body.slots).toContain(otherSlot.toJSDate().toISOString());

    // 20:00 is outside the buddy's 09:00-17:00 window.
    const outsideSlot = anchor.set({ hour: 20, minute: 0 });
    expect(res.body.slots).not.toContain(outsideSlot.toJSDate().toISOString());
  });
});

describe('GET /api/buddies/available', () => {
  it('400s for a missing or invalid startTime', async () => {
    const { token } = await userToken();
    const app = createApp();

    const res = await request(app)
      .get('/api/buddies/available')
      .query({ startTime: 'not-a-date' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('lists only buddies who are free at the requested instant', async () => {
    const anchor = anchorLocal();
    const free = await bookableBuddy({ email: 'free@example.com', name: 'Free Buddy' });
    const busy = await bookableBuddy({ email: 'busy@example.com', name: 'Busy Buddy' });
    await Lesson.create({
      userId: (await Account.create({ role: 'user', email: 'other2@example.com' })).id,
      buddyId: busy.id,
      startTime: anchor.toJSDate(),
      zoomLink: busy.zoomLink,
    });
    const { token } = await userToken();

    const app = createApp();
    const res = await request(app)
      .get('/api/buddies/available')
      .query({ startTime: anchor.toJSDate().toISOString() })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.buddies.map((b: { name: string }) => b.name);
    expect(names).toContain('Free Buddy');
    expect(names).not.toContain('Busy Buddy');
  });
});
