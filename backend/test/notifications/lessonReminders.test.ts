import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Account } from '../../src/models/Account.js';
import { Lesson } from '../../src/models/Lesson.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import {
  REMINDER_LEAD_MINUTES,
  sendDueLessonReminders,
} from '../../src/services/lessonReminders.js';
import { createTestApp } from '../testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

const MEETING_LINK = 'https://zoom.us/j/1234567890';

async function createPair() {
  const user = await Account.create({ role: 'user', email: 'sarah@example.com', name: 'Sarah' });
  const buddy = await Account.create({
    role: 'buddy',
    email: 'maria@example.com',
    name: 'Maria',
    meetingLink: MEETING_LINK,
  });
  return {
    user,
    buddy,
    userToken: signAccountToken({ accountId: user.id, role: user.role }),
    buddyToken: signAccountToken({ accountId: buddy.id, role: buddy.role }),
  };
}

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

async function createLesson(
  userId: string,
  buddyId: string,
  startTime: Date,
  status: 'upcoming' | 'cancelled' = 'upcoming',
) {
  return Lesson.create({
    userId,
    buddyId,
    startTime,
    durationMinutes: 10,
    status,
    meetingLink: MEETING_LINK,
  });
}

async function inboxOf(app: Parameters<typeof request>[0], token: string) {
  const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`);
  return res.body as { notifications: { type: string; message: string }[]; unreadCount: number };
}

describe('pre-lesson reminders', () => {
  it('reminds both the User and the Buddy, in-app and by email', async () => {
    const { user, buddy, userToken, buddyToken } = await createPair();
    await createLesson(user.id, buddy.id, minutesFromNow(REMINDER_LEAD_MINUTES - 10));

    const { app, emailSender } = createTestApp();
    const result = await sendDueLessonReminders({ emailSender });

    expect(result.remindersSent).toBe(1);

    const userInbox = await inboxOf(app, userToken);
    expect(userInbox.notifications).toHaveLength(1);
    expect(userInbox.notifications[0].type).toBe('lesson_reminder');
    expect(userInbox.notifications[0].message).toContain('Maria');
    expect(userInbox.unreadCount).toBe(1);

    const buddyInbox = await inboxOf(app, buddyToken);
    expect(buddyInbox.notifications).toHaveLength(1);
    expect(buddyInbox.notifications[0].type).toBe('lesson_reminder');
    expect(buddyInbox.notifications[0].message).toContain('Sarah');

    expect(emailSender.sent.map((m) => m.to).sort()).toEqual([
      'maria@example.com',
      'sarah@example.com',
    ]);
  });

  it('does not remind for a cancelled Meeting', async () => {
    const { user, buddy, userToken } = await createPair();
    await createLesson(user.id, buddy.id, minutesFromNow(REMINDER_LEAD_MINUTES - 10), 'cancelled');

    const { app, emailSender } = createTestApp();
    const result = await sendDueLessonReminders({ emailSender });

    expect(result.remindersSent).toBe(0);
    expect(emailSender.sent).toHaveLength(0);
    expect((await inboxOf(app, userToken)).notifications).toEqual([]);
  });

  it('does not remind for a Meeting still outside the lead window', async () => {
    const { user, buddy } = await createPair();
    await createLesson(user.id, buddy.id, minutesFromNow(REMINDER_LEAD_MINUTES + 30));

    const { emailSender } = createTestApp();
    const result = await sendDueLessonReminders({ emailSender });

    expect(result.remindersSent).toBe(0);
    expect(emailSender.sent).toHaveLength(0);
  });

  it('does not remind for a Meeting that already started', async () => {
    const { user, buddy } = await createPair();
    await createLesson(user.id, buddy.id, minutesFromNow(-5));

    const { emailSender } = createTestApp();
    const result = await sendDueLessonReminders({ emailSender });

    expect(result.remindersSent).toBe(0);
  });

  it('sends once, however many times the sweep runs', async () => {
    const { user, buddy, userToken } = await createPair();
    await createLesson(user.id, buddy.id, minutesFromNow(REMINDER_LEAD_MINUTES - 10));

    const { app, emailSender } = createTestApp();
    await sendDueLessonReminders({ emailSender });
    const second = await sendDueLessonReminders({ emailSender });

    expect(second.remindersSent).toBe(0);
    expect(emailSender.sent).toHaveLength(2); // one per party, from the first sweep
    expect((await inboxOf(app, userToken)).notifications).toHaveLength(1);
  });

  it('reminds each due Meeting when several are in the window', async () => {
    const { user, buddy } = await createPair();
    await createLesson(user.id, buddy.id, minutesFromNow(REMINDER_LEAD_MINUTES - 30));
    await createLesson(user.id, buddy.id, minutesFromNow(REMINDER_LEAD_MINUTES - 5));

    const { emailSender } = createTestApp();
    const result = await sendDueLessonReminders({ emailSender });

    expect(result.remindersSent).toBe(2);
    expect(emailSender.sent).toHaveLength(4);
  });

  it('reminds a Meeting once it enters the window on a later sweep', async () => {
    const { user, buddy } = await createPair();
    const startTime = minutesFromNow(REMINDER_LEAD_MINUTES + 30);
    await createLesson(user.id, buddy.id, startTime);

    const { emailSender } = createTestApp();
    expect((await sendDueLessonReminders({ emailSender })).remindersSent).toBe(0);

    const later = new Date(startTime.getTime() - (REMINDER_LEAD_MINUTES - 5) * 60_000);
    expect((await sendDueLessonReminders({ emailSender, now: later })).remindersSent).toBe(1);
  });
});

// The time in a reminder must be right for each reader, in their own time
// zone — a learner in Auckland and a Buddy in Tokyo see the same meeting at
// different clock times. These pin the exact words.
describe('reminder times, per recipient time zone', () => {
  async function remindAt(startIso: string, nowIso: string, tz: { user?: string; buddy?: string }) {
    const user = await Account.create({ role: 'user', email: 'sarah@example.com', name: 'Sarah', timezone: tz.user });
    const buddy = await Account.create({ role: 'buddy', email: 'maria@example.com', name: 'Maria', meetingLink: MEETING_LINK, timezone: tz.buddy });
    await createLesson(user.id, buddy.id, new Date(startIso));
    const { emailSender } = createTestApp();
    await sendDueLessonReminders({ emailSender, now: new Date(nowIso) });
    const to = (address: string) => emailSender.sent.find((m) => m.to === address)!;
    return { userEmail: to('sarah@example.com'), buddyEmail: to('maria@example.com') };
  }

  it('says when it starts, in 1 hour, at each reader\'s own clock time', async () => {
    // 00:00 UTC on 18 Oct 2026 = 1:00 pm NZDT (Auckland) = 9:00 am JST (Tokyo).
    const { userEmail, buddyEmail } = await remindAt('2026-10-18T00:00:00Z', '2026-10-17T23:00:00Z', { user: 'Pacific/Auckland', buddy: 'Asia/Tokyo' });

    expect(userEmail.subject).toBe('Your 10ME meeting starts in 1 hour');
    expect(userEmail.body).toContain('Your meeting with Maria starts in 1 hour, at 1:00 pm on Sun 18 Oct 2026.');
    expect(buddyEmail.body).toContain('Your meeting with Sarah starts in 1 hour, at 9:00 am on Sun 18 Oct 2026.');
  });

  it('keeps the right local time on both sides of the NZ daylight-saving change (27 Sep 2026)', async () => {
    // Sat 26 Sep 1:00 pm NZST (+12) = 01:00 UTC; Sun 27 Sep 1:00 pm NZDT (+13) = 00:00 UTC.
    const before = await remindAt('2026-09-26T01:00:00Z', '2026-09-26T00:00:00Z', { user: 'Pacific/Auckland', buddy: 'Asia/Tokyo' });
    expect(before.userEmail.body).toContain('at 1:00 pm on Sat 26 Sept 2026.');
    expect(before.buddyEmail.body).toContain('at 10:00 am on Sat 26 Sept 2026.');

    await Lesson.deleteMany({});
    await Account.deleteMany({});
    const after = await remindAt('2026-09-27T00:00:00Z', '2026-09-26T23:00:00Z', { user: 'Pacific/Auckland', buddy: 'Asia/Tokyo' });
    expect(after.userEmail.body).toContain('at 1:00 pm on Sun 27 Sept 2026.');
    // Tokyo has no daylight saving, so the NZ change shows up as an hour earlier there.
    expect(after.buddyEmail.body).toContain('at 9:00 am on Sun 27 Sept 2026.');
  });

  it('says the real time left for a meeting booked less than an hour ahead', async () => {
    const { userEmail } = await remindAt('2026-10-18T00:00:00Z', '2026-10-17T23:40:00Z', { user: 'Pacific/Auckland' });

    expect(userEmail.subject).toBe('Your 10ME meeting starts in 20 minutes');
    expect(userEmail.body).toContain('starts in 20 minutes, at 1:00 pm on Sun 18 Oct 2026.');
  });

  it('labels the time as UTC when the reader has no time zone on file, rather than guessing', async () => {
    const { userEmail } = await remindAt('2026-10-18T00:00:00Z', '2026-10-17T23:00:00Z', {});

    expect(userEmail.body).toContain('at 12:00 am (UTC) on Sun 18 Oct 2026.');
  });
});
