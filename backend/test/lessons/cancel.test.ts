import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { DateTime } from 'luxon';
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

async function userToken(overrides: Record<string, unknown> = {}) {
  const account = await Account.create({ role: 'user', email: 'user@example.com', credits: 2, ...overrides });
  return { account, token: signAccountToken({ accountId: account.id, role: account.role }) };
}

async function buddy(overrides: Record<string, unknown> = {}) {
  return Account.create({
    role: 'buddy',
    email: 'buddy@example.com',
    name: 'Kenji',
    timezone: 'Asia/Tokyo',
    meetingLink: 'https://zoom.us/j/123',
    ...overrides,
  });
}

describe('POST /api/lessons/:id/cancel', () => {
  it('rejects a non-user account', async () => {
    const b = await buddy();
    const token = signAccountToken({ accountId: b.id, role: b.role });
    const lesson = await Lesson.create({ userId: b.id, buddyId: b.id, startTime: new Date(), meetingLink: b.meetingLink });
    const { app } = createTestApp();

    const res = await request(app).post(`/api/lessons/${lesson.id}/cancel`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('404s for an unknown meeting', async () => {
    const { token } = await userToken();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/lessons/507f1f77bcf86cd799439011/cancel')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("403s when cancelling another user's meeting", async () => {
    const b = await buddy();
    const owner = await Account.create({ role: 'user', email: 'owner@example.com', credits: 2 });
    const { token } = await userToken();
    const lesson = await Lesson.create({
      userId: owner.id,
      buddyId: b.id,
      startTime: DateTime.now().plus({ days: 1 }).toJSDate(),
      meetingLink: b.meetingLink,
    });
    const { app } = createTestApp();

    const res = await request(app).post(`/api/lessons/${lesson.id}/cancel`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('409s when the meeting is already cancelled', async () => {
    const b = await buddy();
    const { account, token } = await userToken();
    const lesson = await Lesson.create({
      userId: account.id,
      buddyId: b.id,
      startTime: DateTime.now().plus({ days: 1 }).toJSDate(),
      meetingLink: b.meetingLink,
      status: 'cancelled',
    });
    const { app } = createTestApp();

    const res = await request(app).post(`/api/lessons/${lesson.id}/cancel`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  it('refunds the credit when cancelled >= 12h before start', async () => {
    const b = await buddy();
    const { account, token } = await userToken({ credits: 2 });
    const lesson = await Lesson.create({
      userId: account.id,
      buddyId: b.id,
      startTime: DateTime.now().plus({ hours: 13 }).toJSDate(),
      meetingLink: b.meetingLink,
    });
    const { app } = createTestApp();

    const res = await request(app).post(`/api/lessons/${lesson.id}/cancel`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.refunded).toBe(true);
    expect(res.body.creditsRemaining).toBe(3);
    expect(res.body.lesson.status).toBe('cancelled');

    const updatedAccount = await Account.findById(account.id);
    expect(updatedAccount!.credits).toBe(3);
    const updatedLesson = await Lesson.findById(lesson.id);
    expect(updatedLesson!.status).toBe('cancelled');
  });

  it('does not refund when cancelled < 12h before start', async () => {
    const b = await buddy();
    const { account, token } = await userToken({ credits: 2 });
    const lesson = await Lesson.create({
      userId: account.id,
      buddyId: b.id,
      startTime: DateTime.now().plus({ hours: 6 }).toJSDate(),
      meetingLink: b.meetingLink,
    });
    const { app } = createTestApp();

    const res = await request(app).post(`/api/lessons/${lesson.id}/cancel`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.refunded).toBe(false);
    expect(res.body.creditsRemaining).toBe(2);

    const updatedAccount = await Account.findById(account.id);
    expect(updatedAccount!.credits).toBe(2);
  });

  it('only refunds once when two cancel requests race for the same meeting', async () => {
    const b = await buddy();
    const { account, token } = await userToken({ credits: 2 });
    const lesson = await Lesson.create({
      userId: account.id,
      buddyId: b.id,
      startTime: DateTime.now().plus({ hours: 13 }).toJSDate(),
      meetingLink: b.meetingLink,
    });
    const { app } = createTestApp();

    const [resA, resB] = await Promise.all([
      request(app).post(`/api/lessons/${lesson.id}/cancel`).set('Authorization', `Bearer ${token}`),
      request(app).post(`/api/lessons/${lesson.id}/cancel`).set('Authorization', `Bearer ${token}`),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const successResponse = resA.status === 200 ? resA : resB;
    expect(successResponse.body.refunded).toBe(true);

    const updatedAccount = await Account.findById(account.id);
    expect(updatedAccount!.credits).toBe(3);
  });
});

describe('emails after a User cancels', () => {
  // A fixed future time, so the formatted text is predictable: 00:30 UTC is
  // 9:30 am in Tokyo (the Buddy) and 1:30 pm in Auckland (the User).
  const startTime = DateTime.fromISO('2099-10-31T00:30:00Z').toJSDate();

  async function cancelAt(start: Date, now: 'early' | 'late' = 'early') {
    const b = await buddy();
    const { account, token } = await userToken({ name: 'Sarah', timezone: 'Pacific/Auckland' });
    const lesson = await Lesson.create({
      userId: account.id,
      buddyId: b.id,
      startTime: now === 'early' ? start : DateTime.now().plus({ hours: 2 }).toJSDate(),
      meetingLink: b.meetingLink,
    });
    const created = createTestApp();
    const res = await request(created.app).post(`/api/lessons/${lesson.id}/cancel`).set('Authorization', `Bearer ${token}`);
    return { ...created, res, buddyAccount: b, account };
  }

  it('emails the User a confirmation with their refund, in their own timezone', async () => {
    const { emailSender } = await cancelAt(startTime);

    const toUser = emailSender.sent.find((m) => m.to === 'user@example.com')!;
    expect(toUser.subject).toBe('Your 10ME meeting is cancelled');
    expect(toUser.body).toContain('Sat 31 Oct 2099, 1:30 pm');
    expect(toUser.body).toContain('Kenji');
    expect(toUser.body).toContain('Your 1 credit is back in your account');
  });

  it('tells the User plainly when a late cancellation is not refunded', async () => {
    const { emailSender } = await cancelAt(startTime, 'late');

    const toUser = emailSender.sent.find((m) => m.to === 'user@example.com')!;
    expect(toUser.body).toContain('less than 12 hours');
    expect(toUser.body).not.toContain('credit is back');
  });

  it('notifies the Buddy in the app and by email, in the Buddy’s timezone', async () => {
    const { emailSender, buddyAccount } = await cancelAt(startTime);

    const toBuddy = emailSender.sent.find((m) => m.to === 'buddy@example.com')!;
    expect(toBuddy.subject).toBe('Sarah cancelled a meeting');
    expect(toBuddy.body).toContain('Sarah cancelled');
    expect(toBuddy.body).toContain('Sat 31 Oct 2099, 9:30 am');
    const [notification] = await Notification.find({ accountId: buddyAccount._id });
    expect(notification.type).toBe('lesson_cancelled');
    expect(notification.message).toBe('Sarah cancelled your meeting on Sat 31 Oct 2099, 9:30 am. That time is free again.');
  });

  it('still cancels and refunds when an email fails to send', async () => {
    const b = await buddy();
    const { account, token } = await userToken({ credits: 2 });
    const lesson = await Lesson.create({ userId: account.id, buddyId: b.id, startTime, meetingLink: b.meetingLink });
    const { app, emailSender } = createTestApp();
    emailSender.send = async () => {
      throw new Error('email provider down');
    };

    const res = await request(app).post(`/api/lessons/${lesson.id}/cancel`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.refunded).toBe(true);
    expect((await Account.findById(account.id))!.credits).toBe(3);
  });
});

describe('cancellation reason', () => {
  const startTime = DateTime.fromISO('2099-10-31T00:30:00Z').toJSDate();

  async function cancelWith(body: Record<string, unknown>) {
    const b = await buddy();
    const { account, token } = await userToken({ name: 'Sarah' });
    const lesson = await Lesson.create({ userId: account.id, buddyId: b.id, startTime, meetingLink: b.meetingLink });
    const created = createTestApp();
    const res = await request(created.app).post(`/api/lessons/${lesson.id}/cancel`).set('Authorization', `Bearer ${token}`).send(body);
    return { ...created, res, lesson, buddyAccount: b, account };
  }

  it('saves the reason on the Meeting and tells the Buddy, in the app and by email', async () => {
    const { res, lesson, emailSender, buddyAccount } = await cancelWith({ reason: '  I’m sick  ' });

    expect(res.status).toBe(200);
    expect(res.body.lesson.cancellationReason).toBe('I’m sick');
    expect((await Lesson.findById(lesson.id))!.cancellationReason).toBe('I’m sick');
    const [notification] = await Notification.find({ accountId: buddyAccount._id });
    expect(notification.message).toContain('Reason: “I’m sick”');
    expect(emailSender.sent.find((m) => m.to === 'buddy@example.com')!.body).toContain('Reason: “I’m sick”');
    expect(emailSender.sent.find((m) => m.to === 'user@example.com')!.body).toContain('Your reason: “I’m sick”');
  });

  it('is optional: no reason means no "Reason" line', async () => {
    const { res, lesson, buddyAccount, emailSender } = await cancelWith({});

    expect(res.status).toBe(200);
    expect((await Lesson.findById(lesson.id))!.cancellationReason).toBeUndefined();
    const [notification] = await Notification.find({ accountId: buddyAccount._id });
    expect(notification.message).not.toContain('Reason');
    expect(emailSender.sent.find((m) => m.to === 'user@example.com')!.body).not.toContain('reason');
  });

  it('refuses a reason over 200 characters or not text, cancelling nothing', async () => {
    for (const reason of ['x'.repeat(201), 42]) {
      const { res, lesson, account } = await cancelWith({ reason });
      expect(res.status).toBe(400);
      expect((await Lesson.findById(lesson.id))!.status).toBe('upcoming');
      await Lesson.deleteMany({});
      await Account.deleteMany({ _id: account._id });
      await Account.deleteMany({ role: 'buddy' });
    }
  });
});
