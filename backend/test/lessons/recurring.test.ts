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
  const account = await Account.create({ role: 'user', email: 'user@example.com', emailConfirmed: true, credits: 10, ...overrides });
  return { account, token: signAccountToken({ accountId: account.id, role: account.role }) };
}

async function everyDayBuddy(overrides: Record<string, unknown> = {}) {
  return Account.create({
    role: 'buddy',
    email: 'buddy@example.com',
    name: 'Buddy',
    timezone: BUDDY_TZ,
    meetingLink: 'https://zoom.us/j/123',
    availabilityBlocks: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, startTime: '00:00', endTime: '23:50' })),
    ...overrides,
  });
}

describe('POST /api/lessons/recurring', () => {
  it('blocks a series until the User confirms their email, creating nothing', async () => {
    const buddy = await everyDayBuddy();
    const { account, token } = await userToken({ emailConfirmed: false });
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/lessons/recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({
        buddyId: buddy.id,
        startTime: nextFriday().toJSDate().toISOString(),
        frequency: { type: 'weekly' },
        includeWeekends: true,
        occurrenceCount: 3,
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EMAIL_NOT_CONFIRMED');
    expect(await Lesson.countDocuments()).toBe(0);
    const updated = await Account.findById(account.id);
    expect(updated!.credits).toBe(10);
  });

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

    // One combined email each for the member and the Buddy.
    const toMember = emailSender.sent.filter((m) => m.to === 'user@example.com');
    expect(toMember).toHaveLength(1);
    expect(toMember[0].subject).toBe('You’re booked: 3 meetings with Buddy');
    expect(emailSender.sent.filter((m) => m.to === 'buddy@example.com')).toHaveLength(1);
  });

  it('books only the planned dates: a busy one is skipped and reported, not replaced by a later date', async () => {
    const buddy = await everyDayBuddy();
    const anchor = nextFriday();
    const secondOccurrence = anchor.plus({ weeks: 1 });
    const otherUser = await Account.create({ role: 'user', email: 'other@example.com' });
    await Lesson.create({
      userId: otherUser.id,
      buddyId: buddy.id,
      startTime: secondOccurrence.toJSDate(),
      meetingLink: buddy.meetingLink,
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
    expect(res.body.booked.map((l: { startTime: string }) => l.startTime)).toEqual([anchor.toJSDate().toISOString()]);
    expect(res.body.skipped).toHaveLength(1);
    expect(res.body.skipped[0].startTime).toBe(secondOccurrence.toJSDate().toISOString());
    expect(res.body.creditsDeducted).toBe(1);
    expect((await Account.findById(account.id))!.credits).toBe(9);
  });

  it('refuses a pattern with no dates at all (weekly on a Saturday, weekends off) instead of searching forever', async () => {
    const buddy = await everyDayBuddy();
    const saturday = nextFriday().plus({ days: 1 });
    const { account, token } = await userToken();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/lessons/recurring')
      .set('Authorization', `Bearer ${token}`)
      .send({
        buddyId: buddy.id,
        startTime: saturday.toJSDate().toISOString(),
        frequency: { type: 'weekly' },
        includeWeekends: false,
        occurrenceCount: 3,
        timezone: BUDDY_TZ,
      });

    expect(res.status).toBe(400);
    expect(await Lesson.countDocuments()).toBe(0);
    expect((await Account.findById(account.id))!.credits).toBe(10);
  });

  it('picks the first available buddy for each occurrence when no buddy is specified', async () => {
    const anchor = nextFriday();
    const busy = await everyDayBuddy({ email: 'busy@example.com', name: 'Busy' });
    const free = await everyDayBuddy({ email: 'free@example.com', name: 'Free' });
    const otherUser = await Account.create({ role: 'user', email: 'other@example.com' });
    await Lesson.create({ userId: otherUser.id, buddyId: busy.id, startTime: anchor.toJSDate(), meetingLink: busy.meetingLink });

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

describe('POST /api/lessons/recurring — new frequency options', () => {
  it('books a daily series on the ticked weekdays only', async () => {
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
        frequency: { type: 'daily', weekdays: [2, 4] }, // Tue, Thu
        occurrenceCount: 3,
        timezone: BUDDY_TZ,
      });

    expect(res.status).toBe(201);
    // Friday (the original date), then Tuesday and Thursday.
    const expected = [anchor, anchor.plus({ days: 4 }), anchor.plus({ days: 6 })].map((d) => d.toJSDate().toISOString());
    expect(res.body.booked.map((l: { startTime: string }) => l.startTime).sort()).toEqual(expected.sort());
  });

  it('rejects an out-of-range week count or weekday', async () => {
    const { token } = await userToken();
    const { app } = createTestApp();
    const base = { startTime: nextFriday().toJSDate().toISOString(), occurrenceCount: 2, timezone: BUDDY_TZ };

    for (const frequency of [{ type: 'weekly', everyWeeks: 5 }, { type: 'weekly', everyWeeks: 0 }, { type: 'daily', weekdays: [0] }, { type: 'daily', weekdays: [8] }, { type: 'daily', weekdays: 'mon' }]) {
      const res = await request(app).post('/api/lessons/recurring/preview').set('Authorization', `Bearer ${token}`).send({ ...base, frequency });
      expect(res.status, JSON.stringify(frequency)).toBe(400);
    }
  });
});

describe('POST /api/lessons/recurring/preview', () => {
  it('lists the planned dates and whether each one is free, booking nothing', async () => {
    const buddy = await everyDayBuddy();
    const anchor = nextFriday();
    const otherUser = await Account.create({ role: 'user', email: 'other@example.com' });
    await Lesson.create({
      userId: otherUser.id,
      buddyId: buddy.id,
      startTime: anchor.plus({ weeks: 1 }).toJSDate(),
      meetingLink: buddy.meetingLink,
    });
    const { token } = await userToken();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/lessons/recurring/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({
        buddyId: buddy.id,
        startTime: anchor.toJSDate().toISOString(),
        frequency: { type: 'weekly' },
        includeWeekends: true,
        occurrenceCount: 3,
      });

    expect(res.status).toBe(200);
    expect(res.body.occurrences).toEqual([
      { startTime: anchor.toJSDate().toISOString(), available: true, status: 'free' },
      { startTime: anchor.plus({ weeks: 1 }).toJSDate().toISOString(), available: false, status: 'busy' },
      { startTime: anchor.plus({ weeks: 2 }).toJSDate().toISOString(), available: true, status: 'free' },
    ]);
    expect(await Lesson.countDocuments()).toBe(1);
  });

  it('counts a date as free when any Buddy is free, if no Buddy is chosen', async () => {
    const anchor = nextFriday();
    const busy = await everyDayBuddy({ email: 'busy@example.com' });
    await everyDayBuddy({ email: 'free@example.com' });
    const otherUser = await Account.create({ role: 'user', email: 'other@example.com' });
    await Lesson.create({ userId: otherUser.id, buddyId: busy.id, startTime: anchor.toJSDate(), meetingLink: busy.meetingLink });
    const { token } = await userToken();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/lessons/recurring/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: anchor.toJSDate().toISOString(), frequency: { type: 'daily' }, includeWeekends: true, occurrenceCount: 1 });

    expect(res.body.occurrences).toEqual([{ startTime: anchor.toJSDate().toISOString(), available: true, status: 'free' }]);
  });

  it('returns no dates for a weekend-only pattern with weekends off', async () => {
    const buddy = await everyDayBuddy();
    const { token } = await userToken();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/lessons/recurring/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({
        buddyId: buddy.id,
        startTime: nextFriday().plus({ days: 2 }).toJSDate().toISOString(),
        frequency: { type: 'weekly' },
        includeWeekends: false,
        occurrenceCount: 4,
        timezone: BUDDY_TZ,
      });

    expect(res.status).toBe(200);
    expect(res.body.occurrences).toEqual([]);
  });
});

describe('alternatives when the chosen Buddy is busy', () => {
  async function setup() {
    const anchor = nextFriday();
    const chosen = await everyDayBuddy({ email: 'chosen@example.com', name: 'Chosen' });
    await everyDayBuddy({ email: 'alt@example.com', name: 'Alt' });
    const otherUser = await Account.create({ role: 'user', email: 'other@example.com' });
    // The chosen Buddy is taken in week 2.
    await Lesson.create({ userId: otherUser.id, buddyId: chosen.id, startTime: anchor.plus({ weeks: 1 }).toJSDate(), meetingLink: chosen.meetingLink });
    const { token } = await userToken();
    const body = { buddyId: chosen.id, startTime: anchor.toJSDate().toISOString(), frequency: { type: 'weekly', everyWeeks: 1 }, occurrenceCount: 3, timezone: BUDDY_TZ };
    return { anchor, chosen, token, body };
  }

  it('preview marks a date as "alternative" (with who) when someone else is free, and only counts it when alternatives are allowed', async () => {
    const { anchor, token, body } = await setup();
    const { app } = createTestApp();

    const allowed = await request(app).post('/api/lessons/recurring/preview').set('Authorization', `Bearer ${token}`).send({ ...body, allowAlternatives: true });
    expect(allowed.body.occurrences[1]).toEqual({ startTime: anchor.plus({ weeks: 1 }).toJSDate().toISOString(), available: true, status: 'alternative', buddyName: 'Alt' });
    expect(allowed.body.occurrences.map((o: { status: string }) => o.status)).toEqual(['free', 'alternative', 'free']);

    const notAllowed = await request(app).post('/api/lessons/recurring/preview').set('Authorization', `Bearer ${token}`).send(body);
    expect(notAllowed.body.occurrences[1]).toMatchObject({ available: false, status: 'alternative', buddyName: 'Alt' });
  });

  it('preview says busy when nobody at all is free', async () => {
    const { anchor, token, body } = await setup();
    const alt = await Account.findOne({ email: 'alt@example.com' });
    const otherUser = await Account.findOne({ email: 'other@example.com' });
    await Lesson.create({ userId: otherUser!.id, buddyId: alt!.id, startTime: anchor.plus({ weeks: 1 }).toJSDate(), meetingLink: alt!.meetingLink });
    const { app } = createTestApp();

    const res = await request(app).post('/api/lessons/recurring/preview').set('Authorization', `Bearer ${token}`).send({ ...body, allowAlternatives: true });
    expect(res.body.occurrences[1]).toEqual({ startTime: anchor.plus({ weeks: 1 }).toJSDate().toISOString(), available: false, status: 'busy' });
  });

  it('books the alternative Buddy on the busy date when alternatives are allowed', async () => {
    const { anchor, chosen, token, body } = await setup();
    const { app } = createTestApp();

    const res = await request(app).post('/api/lessons/recurring').set('Authorization', `Bearer ${token}`).send({ ...body, allowAlternatives: true });

    expect(res.status).toBe(201);
    expect(res.body.booked).toHaveLength(3);
    const week2 = await Lesson.findOne({ userId: { $ne: undefined }, startTime: anchor.plus({ weeks: 1 }).toJSDate(), buddyId: { $ne: chosen._id } });
    expect(week2).not.toBeNull();
    const withChosen = await Lesson.countDocuments({ buddyId: chosen._id, startTime: { $in: [anchor.toJSDate(), anchor.plus({ weeks: 2 }).toJSDate()] } });
    expect(withChosen).toBe(2);
  });

  it('skips the busy date when alternatives are not allowed', async () => {
    const { token, body } = await setup();
    const { app } = createTestApp();

    const res = await request(app).post('/api/lessons/recurring').set('Authorization', `Bearer ${token}`).send(body);

    expect(res.status).toBe(201);
    expect(res.body.booked).toHaveLength(2);
    expect(res.body.skipped).toHaveLength(1);
  });
});
