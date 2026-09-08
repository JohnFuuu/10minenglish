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

const ZOOM_LINK = 'https://zoom.us/j/1234567890';

async function createPair() {
  const user = await Account.create({ role: 'user', email: 'sarah@example.com', name: 'Sarah' });
  const buddy = await Account.create({
    role: 'buddy',
    email: 'maria@example.com',
    name: 'Maria',
    zoomLink: ZOOM_LINK,
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
    zoomLink: ZOOM_LINK,
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

  it('does not remind for a cancelled Lesson', async () => {
    const { user, buddy, userToken } = await createPair();
    await createLesson(user.id, buddy.id, minutesFromNow(REMINDER_LEAD_MINUTES - 10), 'cancelled');

    const { app, emailSender } = createTestApp();
    const result = await sendDueLessonReminders({ emailSender });

    expect(result.remindersSent).toBe(0);
    expect(emailSender.sent).toHaveLength(0);
    expect((await inboxOf(app, userToken)).notifications).toEqual([]);
  });

  it('does not remind for a Lesson still outside the lead window', async () => {
    const { user, buddy } = await createPair();
    await createLesson(user.id, buddy.id, minutesFromNow(REMINDER_LEAD_MINUTES + 30));

    const { emailSender } = createTestApp();
    const result = await sendDueLessonReminders({ emailSender });

    expect(result.remindersSent).toBe(0);
    expect(emailSender.sent).toHaveLength(0);
  });

  it('does not remind for a Lesson that already started', async () => {
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

  it('reminds each due Lesson when several are in the window', async () => {
    const { user, buddy } = await createPair();
    await createLesson(user.id, buddy.id, minutesFromNow(REMINDER_LEAD_MINUTES - 30));
    await createLesson(user.id, buddy.id, minutesFromNow(REMINDER_LEAD_MINUTES - 5));

    const { emailSender } = createTestApp();
    const result = await sendDueLessonReminders({ emailSender });

    expect(result.remindersSent).toBe(2);
    expect(emailSender.sent).toHaveLength(4);
  });

  it('reminds a Lesson once it enters the window on a later sweep', async () => {
    const { user, buddy } = await createPair();
    const startTime = minutesFromNow(REMINDER_LEAD_MINUTES + 30);
    await createLesson(user.id, buddy.id, startTime);

    const { emailSender } = createTestApp();
    expect((await sendDueLessonReminders({ emailSender })).remindersSent).toBe(0);

    const later = new Date(startTime.getTime() - (REMINDER_LEAD_MINUTES - 5) * 60_000);
    expect((await sendDueLessonReminders({ emailSender, now: later })).remindersSent).toBe(1);
  });
});
