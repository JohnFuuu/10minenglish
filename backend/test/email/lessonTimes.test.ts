import { describe, expect, it } from 'vitest';
import {
  buildBuddyCancellationNotification,
  buildConfirmationEmail,
  buildLessonRescheduledNotification,
  formatLessonTimeFor,
} from '../../src/services/lessonBooking.js';
import { buildLessonReminderNotification } from '../../src/services/lessonReminders.js';

// 00:30 UTC on 31 Oct 2099 is 1:30 pm in Auckland and 9:30 am in Tokyo.
const start = new Date('2099-10-31T00:30:00Z');
const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

describe('lesson times in emails and notifications', () => {
  it('formats a time in the reader’s timezone, or says UTC when there is none', () => {
    expect(formatLessonTimeFor(start, 'Pacific/Auckland')).toBe('Sat 31 Oct 2099, 1:30 pm');
    expect(formatLessonTimeFor(start, 'Asia/Tokyo')).toBe('Sat 31 Oct 2099, 9:30 am');
    expect(formatLessonTimeFor(start)).toBe('Sat 31 Oct 2099, 12:30 am (UTC)');
    expect(formatLessonTimeFor(start, 'Not/AZone')).toBe('Sat 31 Oct 2099, 12:30 am (UTC)');
  });

  it('booking confirmation', () => {
    const email = buildConfirmationEmail('u@example.com', [{ startTime: start, buddyName: 'Kenji', meetingLink: 'https://zoom.test/1' }], 'Pacific/Auckland');
    expect(email.body).toContain('Sat 31 Oct 2099, 1:30 pm with Kenji');
    expect(email.body).not.toMatch(ISO);
  });

  it('Buddy cancellation, to the User', () => {
    const { message, email } = buildBuddyCancellationNotification({
      buddyName: 'Kenji',
      userEmail: 'u@example.com',
      startTime: start,
      creditsRemaining: 3,
      timezone: 'Pacific/Auckland',
    });
    for (const text of [message, email.body]) {
      expect(text).toContain('Sat 31 Oct 2099, 1:30 pm');
      expect(text).not.toMatch(ISO);
    }
  });

  it('reschedule, to the Buddy', () => {
    const { message, email } = buildLessonRescheduledNotification({
      userName: 'Sarah',
      buddyEmail: 'b@example.com',
      previousStartTime: new Date('2099-10-30T00:30:00Z'),
      startTime: start,
      timezone: 'Asia/Tokyo',
    });
    for (const text of [message, email.body]) {
      expect(text).toContain('from Fri 30 Oct 2099, 9:30 am to Sat 31 Oct 2099, 9:30 am');
      expect(text).not.toMatch(ISO);
    }
  });

  it('1-hour reminder', () => {
    const { message, email } = buildLessonReminderNotification({
      recipientEmail: 'u@example.com',
      otherPartyName: 'Kenji',
      startTime: start,
      meetingLink: 'https://zoom.test/1',
      timezone: 'Pacific/Auckland',
    });
    for (const text of [message, email.body]) {
      expect(text).toContain('Sat 31 Oct 2099, 1:30 pm');
      expect(text).not.toMatch(ISO);
    }
  });
});
