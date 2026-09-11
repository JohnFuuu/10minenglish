import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Account } from '../../src/models/Account.js';
import { Lesson } from '../../src/models/Lesson.js';
import { completeDueLessons } from '../../src/services/lessonCompletion.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

const ZOOM_LINK = 'https://zoom.us/j/1234567890';

async function createPair() {
  const user = await Account.create({ role: 'user', email: 'sarah@example.com', name: 'Sarah' });
  const buddy = await Account.create({ role: 'buddy', email: 'maria@example.com', name: 'Maria' });
  return { user, buddy };
}

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

async function createLesson(params: {
  userId: string;
  buddyId: string;
  startTime: Date;
  durationMinutes?: number;
  status?: 'upcoming' | 'cancelled' | 'completed';
}) {
  return Lesson.create({
    userId: params.userId,
    buddyId: params.buddyId,
    startTime: params.startTime,
    durationMinutes: params.durationMinutes ?? 10,
    status: params.status ?? 'upcoming',
    zoomLink: ZOOM_LINK,
  });
}

describe('completeDueLessons', () => {
  it('completes an upcoming Lesson once its end time has passed', async () => {
    const { user, buddy } = await createPair();
    const lesson = await createLesson({
      userId: user.id,
      buddyId: buddy.id,
      startTime: minutesFromNow(-15),
      durationMinutes: 10,
    });

    const res = await completeDueLessons();

    expect(res.completed).toBe(1);
    const updated = await Lesson.findById(lesson._id);
    expect(updated!.status).toBe('completed');
  });

  it('leaves an upcoming Lesson alone while it is still in progress', async () => {
    const { user, buddy } = await createPair();
    // Started 5 minutes ago, runs for 10 — still 5 minutes left.
    const lesson = await createLesson({
      userId: user.id,
      buddyId: buddy.id,
      startTime: minutesFromNow(-5),
      durationMinutes: 10,
    });

    const res = await completeDueLessons();

    expect(res.completed).toBe(0);
    const unchanged = await Lesson.findById(lesson._id);
    expect(unchanged!.status).toBe('upcoming');
  });

  it('leaves a future Lesson alone', async () => {
    const { user, buddy } = await createPair();
    const lesson = await createLesson({
      userId: user.id,
      buddyId: buddy.id,
      startTime: minutesFromNow(30),
    });

    const res = await completeDueLessons();

    expect(res.completed).toBe(0);
    const unchanged = await Lesson.findById(lesson._id);
    expect(unchanged!.status).toBe('upcoming');
  });

  it('does not touch a Lesson that was already cancelled', async () => {
    const { user, buddy } = await createPair();
    const lesson = await createLesson({
      userId: user.id,
      buddyId: buddy.id,
      startTime: minutesFromNow(-30),
      status: 'cancelled',
    });

    const res = await completeDueLessons();

    expect(res.completed).toBe(0);
    const unchanged = await Lesson.findById(lesson._id);
    expect(unchanged!.status).toBe('cancelled');
  });

  it('completes multiple due Lessons in one sweep', async () => {
    const { user, buddy } = await createPair();
    await createLesson({ userId: user.id, buddyId: buddy.id, startTime: minutesFromNow(-40) });
    await createLesson({ userId: user.id, buddyId: buddy.id, startTime: minutesFromNow(-20) });
    await createLesson({ userId: user.id, buddyId: buddy.id, startTime: minutesFromNow(15) });

    const res = await completeDueLessons();

    expect(res.completed).toBe(2);
    const statuses = (await Lesson.find().sort({ startTime: 1 })).map((l) => l.status);
    expect(statuses).toEqual(['completed', 'completed', 'upcoming']);
  });

  it('accepts an explicit `now` for deterministic testing', async () => {
    const { user, buddy } = await createPair();
    const fixedNow = new Date('2026-01-01T12:00:00Z');
    const lesson = await createLesson({
      userId: user.id,
      buddyId: buddy.id,
      startTime: new Date('2026-01-01T11:45:00Z'),
      durationMinutes: 10,
    });

    const res = await completeDueLessons({ now: fixedNow });

    expect(res.completed).toBe(1);
    const updated = await Lesson.findById(lesson._id);
    expect(updated!.status).toBe('completed');
  });
});
