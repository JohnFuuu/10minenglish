import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { DateTime } from 'luxon';
import { Account } from '../../src/models/Account.js';
import { Lesson } from '../../src/models/Lesson.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import type { EmailMessage } from '../../src/services/email.js';
import { createTestApp } from '../testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

const TZ = 'Asia/Tokyo';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

function slot(daysAhead: number) {
  return DateTime.now().setZone(TZ).plus({ days: daysAhead }).set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
}

async function setup() {
  const buddy = await Account.create({
    role: 'buddy',
    email: 'kenji@example.com',
    name: 'Kenji',
    timezone: TZ,
    meetingLink: 'https://zoom.us/j/1',
    availabilityBlocks: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, startTime: '00:00', endTime: '23:50' })),
  });
  const member = await Account.create({ role: 'user', email: 'sarah@example.com', name: 'Sarah', emailConfirmed: true, credits: 10 });
  const created = createTestApp();
  return {
    ...created,
    buddy,
    member,
    memberToken: signAccountToken({ accountId: member.id, role: 'user' }),
    buddyToken: signAccountToken({ accountId: buddy.id, role: 'buddy' }),
  };
}

function calendarIn(email: EmailMessage | undefined): string {
  const ics = email?.attachments?.find((a) => a.contentType.startsWith('text/calendar'));
  if (!ics) throw new Error(`no calendar attached to ${email?.subject}`);
  return ics.content.replace(/\r\n /g, '');
}

const to = (sent: EmailMessage[], address: string) => sent.filter((m) => m.to === address);

describe('calendar files on lesson emails', () => {
  it('a single booking: the member’s confirmation and a new Buddy email both carry the event', async () => {
    const { app, emailSender, buddy, memberToken } = await setup();

    const res = await request(app).post('/api/lessons').set('Authorization', `Bearer ${memberToken}`).send({ buddyId: buddy.id, startTime: slot(3).toJSDate().toISOString() });
    const lessonId = res.body.lesson.id;

    const memberIcs = calendarIn(to(emailSender.sent, 'sarah@example.com')[0]);
    expect(memberIcs).toContain('METHOD:PUBLISH');
    expect(memberIcs).toContain(`UID:${lessonId}@10minenglish`);
    expect(memberIcs).toContain('SUMMARY:English lesson with Kenji');

    const [toBuddy] = to(emailSender.sent, 'kenji@example.com');
    expect(toBuddy.subject).toBe('New lesson booked: Sarah');
    expect(toBuddy.body).toContain('Sarah booked');
    expect(calendarIn(toBuddy)).toContain(`UID:${lessonId}@10minenglish`);
    expect(calendarIn(toBuddy)).toContain('SUMMARY:English lesson with Sarah');
  });

  it('a series: one calendar file with every lesson, for the member and the Buddy', async () => {
    const { app, emailSender, buddy, memberToken } = await setup();

    await request(app)
      .post('/api/lessons/recurring')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ buddyId: buddy.id, startTime: slot(3).toJSDate().toISOString(), frequency: { type: 'weekly' }, includeWeekends: true, occurrenceCount: 3, timezone: TZ });

    expect(calendarIn(to(emailSender.sent, 'sarah@example.com')[0]).match(/BEGIN:VEVENT/g)).toHaveLength(3);
    const buddyEmails = to(emailSender.sent, 'kenji@example.com');
    expect(buddyEmails).toHaveLength(1);
    expect(buddyEmails[0].subject).toBe('New lessons booked: 3 with Sarah');
    expect(calendarIn(buddyEmails[0]).match(/BEGIN:VEVENT/g)).toHaveLength(3);
  });

  it('a move updates the same event for both, at the new time', async () => {
    const { app, emailSender, buddy, memberToken } = await setup();
    const booked = await request(app).post('/api/lessons').set('Authorization', `Bearer ${memberToken}`).send({ buddyId: buddy.id, startTime: slot(3).toJSDate().toISOString() });
    emailSender.sent = [];

    await request(app).patch(`/api/lessons/${booked.body.lesson.id}`).set('Authorization', `Bearer ${memberToken}`).send({ startTime: slot(4).toJSDate().toISOString() });

    const newStart = slot(4).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
    for (const address of ['sarah@example.com', 'kenji@example.com']) {
      const ics = calendarIn(to(emailSender.sent, address)[0]);
      expect(ics).toContain('METHOD:PUBLISH');
      expect(ics).toContain(`UID:${booked.body.lesson.id}@10minenglish`);
      expect(ics).toContain(`DTSTART:${newStart}`);
    }
  });

  it('a member’s cancellation removes the event for both', async () => {
    const { app, emailSender, buddy, memberToken } = await setup();
    const booked = await request(app).post('/api/lessons').set('Authorization', `Bearer ${memberToken}`).send({ buddyId: buddy.id, startTime: slot(3).toJSDate().toISOString() });
    emailSender.sent = [];

    await request(app).post(`/api/lessons/${booked.body.lesson.id}/cancel`).set('Authorization', `Bearer ${memberToken}`);

    for (const address of ['sarah@example.com', 'kenji@example.com']) {
      const ics = calendarIn(to(emailSender.sent, address)[0]);
      expect(ics).toContain('METHOD:CANCEL');
      expect(ics).toContain(`UID:${booked.body.lesson.id}@10minenglish`);
    }
  });

  it('a Buddy’s cancellation removes the event for the member', async () => {
    const { app, emailSender, buddy, member, buddyToken } = await setup();
    const lesson = await Lesson.create({ userId: member._id, buddyId: buddy._id, startTime: slot(3).toJSDate(), meetingLink: 'https://zoom.us/j/1' });

    await request(app).post(`/api/lessons/${lesson.id}/buddy-cancel`).set('Authorization', `Bearer ${buddyToken}`);

    const ics = calendarIn(to(emailSender.sent, 'sarah@example.com')[0]);
    expect(ics).toContain('METHOD:CANCEL');
    expect(ics).toContain(`UID:${lesson.id}@10minenglish`);
  });
});
