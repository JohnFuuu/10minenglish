import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { Account } from '../../src/models/Account.js';
import { Lesson } from '../../src/models/Lesson.js';
import { reconcileBuddyState } from '../../src/services/buddyReconciliation.js';
import { consoleEmailSender } from '../../src/services/email.js';
import { signAccountToken } from '../../src/middleware/auth.js';
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
    email: 'maria@example.com',
    name: 'Maria',
    ...overrides,
  });
  return { account, token: signAccountToken({ accountId: account.id, role: account.role }) };
}

describe('PUT /api/buddy/availability', () => {
  it('rejects setting availability before a timezone is set', async () => {
    const { token } = await buddyToken();
    const app = createApp();

    const res = await request(app)
      .put('/api/buddy/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({ blocks: [{ dayOfWeek: 1, startTime: '09:00', endTime: '13:00' }] });

    expect(res.status).toBe(400);
  });

  it('replaces the availability blocks once a timezone is set', async () => {
    const { account, token } = await buddyToken({ timezone: 'Pacific/Auckland' });
    const app = createApp();

    const blocks = [
      { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '13:00' },
    ];
    const res = await request(app)
      .put('/api/buddy/availability')
      .set('Authorization', `Bearer ${token}`)
      .send({ blocks });

    expect(res.status).toBe(200);
    expect(res.body.availabilityBlocks).toEqual(blocks);

    const updated = await Account.findById(account.id);
    const plainBlocks = updated!.availabilityBlocks.map((b) => ({
      dayOfWeek: b.dayOfWeek,
      startTime: b.startTime,
      endTime: b.endTime,
    }));
    expect(plainBlocks).toEqual(blocks);
  });
});

describe('GET /api/buddies/:id/availability', () => {
  it("converts the buddy's schedule into the requested viewer timezone", async () => {
    // Tokyo (UTC+9) and Kolkata (UTC+5:30) both have fixed, DST-free offsets
    // year-round, so this expected value is deterministic regardless of
    // when the test runs — unlike zones such as Auckland/LA, whose offset
    // (and therefore the expected day/time) shifts with DST.
    const { account } = await buddyToken({
      timezone: 'Asia/Tokyo',
      availabilityBlocks: [{ dayOfWeek: 1, startTime: '09:00', endTime: '13:00' }],
    });
    const requester = await Account.create({ role: 'user', email: 'sarah@example.com' });
    const requesterToken = signAccountToken({ accountId: requester.id, role: requester.role });

    const app = createApp();
    const res = await request(app)
      .get(`/api/buddies/${account.id}/availability`)
      .query({ viewerTimezone: 'Asia/Kolkata' })
      .set('Authorization', `Bearer ${requesterToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      availabilityBlocks: [{ dayOfWeek: 1, startTime: '05:30', endTime: '09:30' }],
    });
  });

  it('404s for a non-buddy account id', async () => {
    const requester = await Account.create({ role: 'user', email: 'sarah@example.com' });
    const requesterToken = signAccountToken({ accountId: requester.id, role: requester.role });

    const app = createApp();
    const res = await request(app)
      .get(`/api/buddies/${requester.id}/availability`)
      .query({ viewerTimezone: 'America/Los_Angeles' })
      .set('Authorization', `Bearer ${requesterToken}`);

    expect(res.status).toBe(404);
  });
});

describe('changing availability keeps booked lessons', () => {
  it('leaves an upcoming lesson booked when its time drops out of the new hours, even after the clean-up sweep', async () => {
    const { account, token } = await buddyToken({
      timezone: 'Pacific/Auckland',
      meetingLink: 'https://zoom.us/j/1',
      availabilityBlocks: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, startTime: '08:00', endTime: '18:00' })),
    });
    const member = await Account.create({ role: 'user', email: 'sarah@example.com', credits: 0 });
    const lesson = await Lesson.create({
      userId: member._id,
      buddyId: account._id,
      startTime: new Date(Date.now() + 3 * 864e5),
      meetingLink: 'https://zoom.us/j/1',
    });
    const app = createApp();

    // Clear every hour: the booked lesson is now outside availability.
    const res = await request(app).put('/api/buddy/availability').set('Authorization', `Bearer ${token}`).send({ blocks: [] });
    await reconcileBuddyState({ emailSender: consoleEmailSender });

    expect(res.status).toBe(200);
    expect((await Lesson.findById(lesson.id))!.status).toBe('upcoming');
    expect((await Account.findById(member.id))!.credits).toBe(0);
  });
});
