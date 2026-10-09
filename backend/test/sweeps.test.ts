import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Account } from '../src/models/Account.js';
import { Lesson } from '../src/models/Lesson.js';
import { Notification } from '../src/models/Notification.js';
import { createTestApp } from './testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from './dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);
afterEach(() => {
  delete process.env.SWEEP_TOKEN;
});

describe('POST /internal/sweeps (called by Cloud Scheduler)', () => {
  it('does not exist unless a SWEEP_TOKEN is configured', async () => {
    const { app } = createTestApp();

    const res = await request(app).post('/internal/sweeps').set('X-Sweep-Token', 'anything');

    expect(res.status).toBe(404);
  });

  it('refuses a missing or wrong token', async () => {
    process.env.SWEEP_TOKEN = 'right-token';
    const { app } = createTestApp();

    expect((await request(app).post('/internal/sweeps')).status).toBe(401);
    expect((await request(app).post('/internal/sweeps').set('X-Sweep-Token', 'wrong-token')).status).toBe(401);
  });

  it('runs every sweep once: sends due reminders and completes finished meetings', async () => {
    process.env.SWEEP_TOKEN = 'right-token';
    const user = await Account.create({ role: 'user', email: 'sarah@example.com', name: 'Sarah' });
    const buddy = await Account.create({ role: 'buddy', email: 'kenji@example.com', name: 'Kenji' });
    const finished = await Lesson.create({ userId: user._id, buddyId: buddy._id, startTime: new Date(Date.now() - 60 * 60_000), meetingLink: 'https://zoom.us/j/1' });
    const soon = await Lesson.create({ userId: user._id, buddyId: buddy._id, startTime: new Date(Date.now() + 30 * 60_000), meetingLink: 'https://zoom.us/j/1' });
    const { app } = createTestApp();

    const res = await request(app).post('/internal/sweeps').set('X-Sweep-Token', 'right-token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ remindersSent: 1, lessonsCompleted: 1, errors: [] });
    expect((await Lesson.findById(finished.id))!.status).toBe('completed');
    expect((await Lesson.findById(soon.id))!.reminderSentAt).toBeDefined();
    expect(await Notification.countDocuments({ type: 'lesson_reminder' })).toBe(2);
  });
});
