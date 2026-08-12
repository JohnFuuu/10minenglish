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

function nextFriday() {
  let dt = DateTime.now().setZone(BUDDY_TZ).plus({ days: 1 }).set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
  while (dt.weekday !== 5) dt = dt.plus({ days: 1 }); // luxon: 5 = Friday
  return dt;
}

async function userToken(overrides: Record<string, unknown> = {}) {
  const account = await Account.create({ role: 'user', email: 'user@example.com', credits: 10, ...overrides });
  return { account, token: signAccountToken({ accountId: account.id, role: account.role }) };
}

async function everyDayBuddy(overrides: Record<string, unknown> = {}) {
  return Account.create({
    role: 'buddy',
    email: 'buddy@example.com',
    name: 'Buddy',
    timezone: BUDDY_TZ,
    zoomLink: 'https://zoom.us/j/123',
    availabilityBlocks: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, startTime: '00:00', endTime: '23:50' })),
    ...overrides,
  });
}

describe('POST /api/lessons/recurring', () => {
  it('blocks the whole series upfront when credits are insufficient, creating nothing', async () => {
    const buddy = await everyDayBuddy();
    const { account, token } = await userToken({ credits: 2 });
    const anchor = nextFriday();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/lessons/recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({
        buddyId: buddy.id,
        startTime: anchor.toJSDate().toISOString(),
        frequency: { type: 'weekly' },
        includeWeekends: true,
        occurrenceCount: 3,
      });

    expect(res.status).toBe(402);
    expect(await Lesson.countDocuments()).toBe(0);
    const updated = await Account.findById(account.id);
    expect(updated!.credits).toBe(2);
  });

  it('books a full weekly series with a specific buddy and sends one combined confirmation email', async () => {
    const buddy = await everyDayBuddy();
    const { account, token } = await userToken();
    const anchor = nextFriday();
    const { app, emailSender } = createTestApp();

    const res = await request(app)
      .post('/api/lessons/recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({
        buddyId: buddy.id,
        startTime: anchor.toJSDate().toISOString(),
        frequency: { type: 'weekly' },
        includeWeekends: true,
        occurrenceCount: 3,
      });

    expect(res.status).toBe(201);
    expect(res.body.booked).toHaveLength(3);
    expect(res.body.skipped).toHaveLength(0);
    expect(res.body.creditsDeducted).toBe(3);

    const updated = await Account.findById(account.id);
    expect(updated!.credits).toBe(7);
    expect(await Lesson.countDocuments()).toBe(3);

    expect(emailSender.sent).toHaveLength(1);
    expect(emailSender.sent[0].subject).toContain('3 10ME lessons');
  });

  it('skips an occurrence that conflicts, reports it, and pulls a later occurrence to still fill the requested count', async () => {
    const buddy = await everyDayBuddy();
    const anchor = nextFriday();
    const secondOccurrence = anchor.plus({ weeks: 1 });
    const otherUser = await Account.create({ role: 'user', email: 'other@example.com' });
    await Lesson.create({
      userId: otherUser.id,
      buddyId: buddy.id,
      startTime: secondOccurrence.toJSDate(),
      zoomLink: buddy.zoomLink,
    });

    const { account, token } = await userToken();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/lessons/recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({
        buddyId: buddy.id,
        startTime: anchor.toJSDate().toISOString(),
        frequency: { type: 'weekly' },
        includeWeekends: true,
        occurrenceCount: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.booked).toHaveLength(2);
    expect(res.body.skipped).toHaveLength(1);
    expect(res.body.skipped[0].startTime).toBe(secondOccurrence.toJSDate().toISOString());
    expect(res.body.creditsDeducted).toBe(2);

    const bookedTimes = res.body.booked.map((l: { startTime: string }) => l.startTime).sort();
    expect(bookedTimes).toEqual(
      [anchor.toJSDate().toISOString(), anchor.plus({ weeks: 2 }).toJSDate().toISOString()].sort(),
    );

    const updated = await Account.findById(account.id);
    expect(updated!.credits).toBe(8);
  });

  it('picks the first available buddy for each occurrence when no buddy is specified', async () => {
    const anchor = nextFriday();
    const busy = await everyDayBuddy({ email: 'busy@example.com', name: 'Busy' });
    const free = await everyDayBuddy({ email: 'free@example.com', name: 'Free' });
    const otherUser = await Account.create({ role: 'user', email: 'other@example.com' });
    await Lesson.create({ userId: otherUser.id, buddyId: busy.id, startTime: anchor.toJSDate(), zoomLink: busy.zoomLink });

    const { token } = await userToken();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/lessons/recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({
        startTime: anchor.toJSDate().toISOString(),
        frequency: { type: 'weekly' },
        includeWeekends: true,
        occurrenceCount: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.booked).toHaveLength(1);
    const lesson = await Lesson.findById(res.body.booked[0].id);
    expect(lesson!.buddyId.toString()).toBe(free.id);
  });

  it('excludes weekend occurrences from a daily series when includeWeekends is false', async () => {
    const buddy = await everyDayBuddy();
    const anchor = nextFriday();
    const { token } = await userToken();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/lessons/recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({
        buddyId: buddy.id,
        startTime: anchor.toJSDate().toISOString(),
        frequency: { type: 'daily' },
        includeWeekends: false,
        occurrenceCount: 3,
        timezone: BUDDY_TZ,
      });

    expect(res.status).toBe(201);
    expect(res.body.booked).toHaveLength(3);
    // Friday, then skip Sat/Sun, then Monday, Tuesday.
    const expected = [anchor, anchor.plus({ days: 3 }), anchor.plus({ days: 4 })].map((d) => d.toJSDate().toISOString());
    const bookedTimes = res.body.booked.map((l: { startTime: string }) => l.startTime).sort();
    expect(bookedTimes).toEqual(expected.sort());
  });
});
