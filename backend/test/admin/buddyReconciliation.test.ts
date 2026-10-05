import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Types } from 'mongoose';
import { Account } from '../../src/models/Account.js';
import { AuditEntry } from '../../src/models/AuditEntry.js';
import { Lesson } from '../../src/models/Lesson.js';
import { Notification } from '../../src/models/Notification.js';
import { Tag } from '../../src/models/Tag.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import { reconcileBuddyState } from '../../src/services/buddyReconciliation.js';
import { createTestApp, FakeEmailSender } from '../testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

const DAY = 24 * 60 * 60 * 1000;

async function world() {
  const admin = await Account.create({ role: 'admin', email: 'ada@10me.test', name: 'Ada Admin' });
  const buddy = (name: string, extra: Record<string, unknown> = {}) =>
    Account.create({ role: 'buddy', email: `${name.toLowerCase()}@example.com`, name, meetingLink: 'https://zoom.us/j/1', ...extra });
  const user = await Account.create({ role: 'user', email: 'sarah@example.com', name: 'Sarah', emailConfirmed: true, credits: 0 });
  const lesson = (buddyId: Types.ObjectId, offsetMs: number, status: 'upcoming' | 'completed' | 'cancelled' = 'upcoming') =>
    Lesson.create({ userId: user._id, buddyId, startTime: new Date(Date.now() + offsetMs), durationMinutes: 10, status, meetingLink: 'https://zoom.us/j/1' });
  const { app } = createTestApp();
  const asAdmin = (method: 'patch' | 'delete', path: string, body?: object) =>
    request(app)[method](path).set('Authorization', `Bearer ${signAccountToken({ accountId: admin.id, role: 'admin' })}`).send(body);
  return { admin, buddy, user, lesson, asAdmin };
}

const credits = async (id: unknown) => (await Account.findById(id))!.credits;

describe('reconcileBuddyState (sweep)', () => {
  it('cancels and refunds upcoming Lessons of inactive and removed Buddies — and nothing else', async () => {
    const { buddy, user, lesson } = await world();
    const paused = await buddy('Paused', { active: false });
    const gone = await buddy('Gone', { active: false, removedAt: new Date() });
    const working = await buddy('Working');
    const stranded1 = await lesson(paused._id, 2 * DAY);
    const stranded2 = await lesson(gone._id, 3 * DAY);
    const fine = await lesson(working._id, 2 * DAY);
    const past = await lesson(paused._id, -2 * DAY, 'completed');

    const result = await reconcileBuddyState({ emailSender: new FakeEmailSender() });

    expect(result.cancelledLessons).toBe(2);
    expect((await Lesson.findById(stranded1._id))!.status).toBe('cancelled');
    expect((await Lesson.findById(stranded2._id))!.status).toBe('cancelled');
    expect((await Lesson.findById(fine._id))!.status).toBe('upcoming');
    expect((await Lesson.findById(past._id))!.status).toBe('completed');
    expect(await credits(user._id)).toBe(2);
    expect(await Notification.countDocuments({ accountId: user._id })).toBe(2);
  });

  it('is safe to run repeatedly: a second run changes nothing', async () => {
    const { buddy, user, lesson } = await world();
    const paused = await buddy('Paused', { active: false });
    await lesson(paused._id, 2 * DAY);
    const emailSender = new FakeEmailSender();

    await reconcileBuddyState({ emailSender });
    const second = await reconcileBuddyState({ emailSender });

    expect(second.cancelledLessons).toBe(0);
    expect(await credits(user._id)).toBe(1);
    expect(await Notification.countDocuments({ accountId: user._id })).toBe(1);
    expect(emailSender.sent).toHaveLength(1);
  });

  it('removes member references to tags that no longer exist', async () => {
    const { admin, user } = await world();
    const live = await Tag.create({ name: 'low-income', nameKey: 'low-income' });
    const ghostId = '0123456789abcdef01234567';
    await Account.updateOne({ _id: user._id }, {
      $set: { memberTags: [
        { tagId: live._id, addedBy: admin._id, addedAt: new Date() },
        { tagId: ghostId, addedBy: admin._id, addedAt: new Date() },
      ] },
    });

    const result = await reconcileBuddyState({ emailSender: new FakeEmailSender() });

    expect(result.membersWithDanglingTagsCleaned).toBe(1);
    expect((await Account.findById(user._id))!.memberTags.map((t) => String(t.tagId))).toEqual([live.id]);
  });
});

describe('finishing an interrupted deactivate or remove', () => {
  // Simulates a crash after the flag was set but before the Lessons were
  // cancelled: the flag is set directly, the Lessons are left booked.
  it('a retried deactivate cancels the leftover Lessons without auditing a second change', async () => {
    const { buddy, user, lesson, asAdmin } = await world();
    const paused = await buddy('Paused', { active: false });
    await lesson(paused._id, 2 * DAY);
    await lesson(paused._id, 4 * DAY);

    const res = await asAdmin('patch', `/api/admin/buddies/${paused.id}`, { active: false });

    expect(res.status).toBe(200);
    expect(res.body.cancelledLessons).toBe(2);
    expect(await Lesson.countDocuments({ buddyId: paused._id, status: 'upcoming' })).toBe(0);
    expect(await credits(user._id)).toBe(2);
    expect(await AuditEntry.countDocuments()).toBe(0);
  });

  it('a retried remove cancels the leftover Lessons, succeeds, and audits only once', async () => {
    const { buddy, user, lesson, asAdmin } = await world();
    const target = await buddy('Gone');
    await asAdmin('delete', `/api/admin/buddies/${target.id}`);
    // Crash simulation: a Lesson still booked after the archive.
    await lesson(target._id, 2 * DAY);

    const retry = await asAdmin('delete', `/api/admin/buddies/${target.id}`);

    expect(retry.status).toBe(200);
    expect(retry.body.cancelledLessons).toBe(1);
    expect(await credits(user._id)).toBe(1);
    expect(await AuditEntry.countDocuments({ action: 'buddy.removed' })).toBe(1);
  });

  it('a retry racing the sweep still cancels, refunds, and notifies each Lesson exactly once', async () => {
    const { buddy, user, lesson, asAdmin } = await world();
    const paused = await buddy('Paused', { active: false });
    for (let i = 1; i <= 3; i++) await lesson(paused._id, i * DAY);

    await Promise.all([
      asAdmin('patch', `/api/admin/buddies/${paused.id}`, { active: false }),
      reconcileBuddyState({ emailSender: new FakeEmailSender() }),
      reconcileBuddyState({ emailSender: new FakeEmailSender() }),
    ]);

    expect(await Lesson.countDocuments({ buddyId: paused._id, status: 'cancelled' })).toBe(3);
    expect(await credits(user._id)).toBe(3);
    expect(await Notification.countDocuments({ accountId: user._id })).toBe(3);
  });
});
