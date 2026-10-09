import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
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

const DAY = 24 * 60 * 60 * 1000;

async function setup() {
  const admin = await Account.create({ role: 'admin', email: 'ada@10me.test', name: 'Ada Admin' });
  const buddy = await Account.create({
    role: 'buddy',
    email: 'maria@example.com',
    name: 'Maria',
    passwordHash: 'secret-hash',
    timezone: 'Pacific/Auckland',
    location: 'Wellington, NZ',
    bio: 'Former teacher, loves cooking.',
    meetingLink: 'https://zoom.us/j/123',
    availabilityBlocks: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
    ],
  });
  const user = await Account.create({ role: 'user', email: 'sarah@example.com' });
  const lesson = (offsetMs: number, status: 'upcoming' | 'completed' | 'cancelled') =>
    Lesson.create({ userId: user._id, buddyId: buddy._id, startTime: new Date(Date.now() + offsetMs), durationMinutes: 10, status, meetingLink: 'https://zoom.us/j/123' });
  const { app } = createTestApp();
  const get = (id: string, accountId = admin.id, role = 'admin') =>
    request(app).get(`/api/admin/buddies/${id}`).set('Authorization', `Bearer ${signAccountToken({ accountId, role })}`);
  return { buddy, user, lesson, get };
}

describe('GET /api/admin/buddies/:id', () => {
  it('refuses a non-Admin', async () => {
    const { buddy, user, get } = await setup();

    const res = await get(buddy.id, user.id, 'user');

    expect(res.status).toBe(403);
  });

  it('returns the Buddy’s profile, availability, and meeting counts', async () => {
    const { buddy, lesson, get } = await setup();
    const soon = await lesson(2 * DAY, 'upcoming');
    await lesson(5 * DAY, 'upcoming');
    await lesson(-3 * DAY, 'completed');
    await lesson(-1 * DAY, 'completed');
    await lesson(1 * DAY, 'cancelled');

    const res = await get(buddy.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: buddy.id,
      name: 'Maria',
      email: 'maria@example.com',
      active: true,
      timezone: 'Pacific/Auckland',
      location: 'Wellington, NZ',
      bio: 'Former teacher, loves cooking.',
      meetingLink: 'https://zoom.us/j/123',
      availabilityBlocks: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
        { dayOfWeek: 3, startTime: '09:00', endTime: '17:00' },
      ],
      lessons: { upcoming: 2, completed: 2, cancelled: 1 },
      nextLessonAt: soon.startTime.toISOString(),
    });
    expect(new Date(res.body.joinedAt).getTime()).toBe(buddy._id.getTimestamp().getTime());
  });

  it('never exposes credentials', async () => {
    const { buddy, get } = await setup();

    const res = await get(buddy.id);

    expect(JSON.stringify(res.body)).not.toMatch(/secret-hash|passwordHash/);
  });

  it('reports no next meeting and empty fields for a new Buddy', async () => {
    const { get } = await setup();
    const fresh = await Account.create({ role: 'buddy', email: 'new@example.com', name: 'New' });

    const res = await get(fresh.id);

    expect(res.body).toMatchObject({ lessons: { upcoming: 0, completed: 0, cancelled: 0 }, nextLessonAt: null, availabilityBlocks: [] });
    expect(res.body.meetingLink).toBeUndefined();
  });

  it('404s a removed, unknown, malformed, or non-Buddy target', async () => {
    const { user, get } = await setup();
    const removed = await Account.create({ role: 'buddy', email: 'gone@example.com', removedAt: new Date(), active: false });

    const statuses = await Promise.all([removed.id, '0123456789abcdef01234567', 'not-an-id', user.id].map(async (id) => (await get(id)).status));

    expect(statuses).toEqual([404, 404, 404, 404]);
  });
});
