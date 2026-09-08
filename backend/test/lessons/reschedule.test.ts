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

const ZOOM_LINK = 'https://zoom.us/j/1234567890';
const HOUR_MS = 60 * 60 * 1000;

async function createPair() {
  const user = await Account.create({
    role: 'user',
    email: 'sarah@example.com',
    name: 'Sarah',
    credits: 2,
  });
  const buddy = await Account.create({
    role: 'buddy',
    email: 'maria@example.com',
    name: 'Maria',
    zoomLink: ZOOM_LINK,
    timezone: 'UTC',
    // Bookable around the clock, every day, so the tests can pick any instant.
    availabilityBlocks: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      startTime: '00:00',
      endTime: '23:59',
    })),
  });
  return { user, buddy, token: signAccountToken({ accountId: user.id, role: user.role }) };
}

async function createLesson(userId: string, buddyId: string, hoursAhead: number) {
  return Lesson.create({
    userId,
    buddyId,
    startTime: new Date(Date.now() + hoursAhead * HOUR_MS),
    durationMinutes: 10,
    status: 'upcoming',
    zoomLink: ZOOM_LINK,
  });
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * HOUR_MS).toISOString();
}

describe('PATCH /api/lessons/:id', () => {
  it('moves an upcoming Lesson to a new time', async () => {
    const { user, buddy, token } = await createPair();
    const lesson = await createLesson(user.id, buddy.id, 48);
    const newStart = hoursFromNow(72);

    const { app } = createTestApp();
    const res = await request(app)
      .patch(`/api/lessons/${lesson.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: newStart });

    expect(res.status).toBe(200);
    expect(res.body.lesson.startTime).toBe(newStart);
    expect((await Lesson.findById(lesson.id))!.startTime.toISOString()).toBe(newStart);
  });

  it('costs no credit and refunds none', async () => {
    const { user, buddy, token } = await createPair();
    const lesson = await createLesson(user.id, buddy.id, 48);

    const { app } = createTestApp();
    await request(app)
      .patch(`/api/lessons/${lesson.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: hoursFromNow(72) });

    expect((await Account.findById(user.id))!.credits).toBe(2);
  });

  it('notifies the Buddy and confirms the new time to the User', async () => {
    const { user, buddy, token } = await createPair();
    const lesson = await createLesson(user.id, buddy.id, 48);

    const { app, emailSender } = createTestApp();
    await request(app)
      .patch(`/api/lessons/${lesson.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: hoursFromNow(72) });

    const notifications = await Notification.find({ accountId: buddy.id });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('lesson_rescheduled');
    expect(notifications[0].message).toContain('Sarah');

    // The User triggered the move, so they get a confirmation rather than a
    // Notification.
    expect(await Notification.countDocuments({ accountId: user.id })).toBe(0);
    expect(emailSender.sent.map((m) => m.to).sort()).toEqual([
      'maria@example.com',
      'sarah@example.com',
    ]);
  });

  it('allows a small shift that overlaps the current slot', async () => {
    const { user, buddy, token } = await createPair();
    const lesson = await createLesson(user.id, buddy.id, 48);

    const { app } = createTestApp();
    const res = await request(app)
      .patch(`/api/lessons/${lesson.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: new Date(lesson.startTime.getTime() + 5 * 60_000).toISOString() });

    expect(res.status).toBe(200);
  });

  it('rejects a time that clashes with another Lesson of that Buddy', async () => {
    const { user, buddy, token } = await createPair();
    const lesson = await createLesson(user.id, buddy.id, 48);
    const other = await createLesson(user.id, buddy.id, 72);

    const { app } = createTestApp();
    const res = await request(app)
      .patch(`/api/lessons/${lesson.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: other.startTime.toISOString() });

    expect(res.status).toBe(409);
    expect((await Lesson.findById(lesson.id))!.startTime.toISOString()).toBe(
      lesson.startTime.toISOString(),
    );
  });

  it("rejects a time outside the Buddy's availability", async () => {
    const { user, buddy, token } = await createPair();
    await Account.updateOne(
      { _id: buddy.id },
      { availabilityBlocks: [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }] },
    );
    const lesson = await createLesson(user.id, buddy.id, 48);

    const { app } = createTestApp();
    const res = await request(app)
      .patch(`/api/lessons/${lesson.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: hoursFromNow(100) });

    expect(res.status).toBe(409);
  });

  it('rejects a move inside the 12h window', async () => {
    const { user, buddy, token } = await createPair();
    const lesson = await createLesson(user.id, buddy.id, 6);

    const { app } = createTestApp();
    const res = await request(app)
      .patch(`/api/lessons/${lesson.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: hoursFromNow(72) });

    expect(res.status).toBe(409);
    expect((await Lesson.findById(lesson.id))!.startTime.toISOString()).toBe(
      lesson.startTime.toISOString(),
    );
  });

  it('rejects rescheduling a cancelled Lesson', async () => {
    const { user, buddy, token } = await createPair();
    const lesson = await createLesson(user.id, buddy.id, 48);
    await Lesson.updateOne({ _id: lesson.id }, { status: 'cancelled' });

    const { app } = createTestApp();
    const res = await request(app)
      .patch(`/api/lessons/${lesson.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: hoursFromNow(72) });

    expect(res.status).toBe(409);
  });

  it("rejects rescheduling another User's Lesson", async () => {
    const { user, buddy } = await createPair();
    const lesson = await createLesson(user.id, buddy.id, 48);
    const other = await Account.create({ role: 'user', email: 'other@example.com' });
    const otherToken = signAccountToken({ accountId: other.id, role: other.role });

    const { app } = createTestApp();
    const res = await request(app)
      .patch(`/api/lessons/${lesson.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ startTime: hoursFromNow(72) });

    expect(res.status).toBe(403);
  });

  it('rejects a missing or unparseable startTime', async () => {
    const { user, buddy, token } = await createPair();
    const lesson = await createLesson(user.id, buddy.id, 48);

    const { app } = createTestApp();
    expect(
      (
        await request(app)
          .patch(`/api/lessons/${lesson.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({})
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .patch(`/api/lessons/${lesson.id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ startTime: 'not-a-date' })
      ).status,
    ).toBe(400);
  });

  it('clears a sent reminder so the new time gets its own', async () => {
    const { user, buddy, token } = await createPair();
    const lesson = await createLesson(user.id, buddy.id, 48);
    await Lesson.updateOne({ _id: lesson.id }, { reminderSentAt: new Date() });

    const { app } = createTestApp();
    await request(app)
      .patch(`/api/lessons/${lesson.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: hoursFromNow(72) });

    expect((await Lesson.findById(lesson.id))!.reminderSentAt).toBeUndefined();
  });
});
