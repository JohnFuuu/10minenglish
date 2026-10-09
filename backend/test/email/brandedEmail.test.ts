import { describe, expect, it } from 'vitest';
import { brandedHtmlFromText } from '../../src/services/emailLayout.js';
import {
  buildBuddyCancellationNotification,
  buildConfirmationEmail,
  buildLessonCancelledByUserNotification,
  buildUserCancellationEmail,
} from '../../src/services/lessonBooking.js';

const kenji = 'https://meet.google.com/oso-suqt-vmh';
const sundays = Array.from({ length: 3 }, (_, i) => new Date(Date.UTC(2099, 9, 18 + 7 * i, 0, 30)));

describe('branded email layout', () => {
  it('wraps plain text in the 10 Minute English layout, escaping it and linking URLs', () => {
    const html = brandedHtmlFromText('Hello', 'Hi <Sarah>,\n\nJoin: https://x.test/a?b=1&c=2');

    expect(html).toContain('10 Minute English');
    expect(html).toContain('Hi &lt;Sarah&gt;,');
    expect(html).toContain('<a href="https://x.test/a?b=1&amp;c=2"');
    expect(html).not.toContain('<Sarah>');
  });
});

describe('booking confirmation email', () => {
  const email = buildConfirmationEmail(
    'sarah@example.com',
    sundays.map((startTime) => ({ startTime, buddyName: 'Kenji', meetingLink: kenji })),
    'Pacific/Auckland',
    'Sarah',
  );

  it('greets the member and sums up the booking', () => {
    expect(email.subject).toBe('You’re booked: 3 lessons with Kenji');
    expect(email.body).toMatch(/^Hi Sarah,/);
    expect(email.html).toContain('Hi Sarah,');
    expect(email.html).toContain('3 lessons with Kenji');
  });

  it('lists every lesson in the member’s own time, numbered', () => {
    for (const text of [email.body, email.html!]) {
      expect(text).toContain('Sun 18 Oct 2099');
      expect(text).toContain('1:30 pm');
      expect(text).not.toContain('(UTC)');
    }
    expect(email.body).toContain('1. Sun 18 Oct 2099 · 1:30 pm');
    expect(email.body).toContain('3. Sun 1 Nov 2099 · 1:30 pm');
  });

  it('shows a shared meeting link once, as a Join button', () => {
    expect(email.html!.split(kenji).length - 1).toBe(1);
    expect(email.body.split(kenji).length - 1).toBe(1);
    expect(email.html).toContain('Join your lesson');
  });

  it('keeps a link per lesson when they differ', () => {
    const mixed = buildConfirmationEmail(
      'sarah@example.com',
      [
        { startTime: sundays[0], buddyName: 'Kenji', meetingLink: kenji },
        { startTime: sundays[1], buddyName: 'Aroha', meetingLink: 'https://zoom.us/j/9' },
      ],
      'Pacific/Auckland',
    );
    expect(mixed.subject).toBe('You’re booked: 2 lessons');
    expect(mixed.html).toContain(kenji);
    expect(mixed.html).toContain('https://zoom.us/j/9');
    expect(mixed.body).toMatch(/^Hi there,/);
  });
});

describe('cancellation emails', () => {
  const start = new Date(Date.UTC(2099, 9, 14, 19, 30)); // Thu 15 Oct 2099, 8:30 am in Auckland

  it('when the Buddy cancels: greets the member, shows the lesson as cancelled, the reason, the refund and a Book button', () => {
    const { message, email } = buildBuddyCancellationNotification({
      buddyName: 'EnglandHandsome',
      userName: 'Ziang',
      userEmail: 'z@example.com',
      startTime: start,
      creditsRemaining: 3,
      timezone: 'Pacific/Auckland',
      reason: 'I’m sick',
    });

    expect(email.subject).toBe('EnglandHandsome cancelled your lesson — credits refunded');
    expect(email.body).toMatch(/^Hi Ziang,/);
    expect(email.body).toContain('3 credits');
    expect(email.body).not.toContain('credit(s)');
    const html = email.html!;
    expect(html).toContain('Hi Ziang,');
    expect(html).toContain('Thu 15 Oct 2099 · 8:30 am');
    expect(html).toContain('CANCELLED');
    expect(html).toContain('“I’m sick”');
    expect(html).toContain('You have <strong>3 credits</strong>');
    expect(html).toContain('/book');
    expect(message).toContain('Reason: “I’m sick”');
  });

  it('when the member cancels: their confirmation says whether the credits came back', () => {
    const refunded = buildUserCancellationEmail({
      to: 'z@example.com', name: 'Ziang', buddyName: 'EnglandHandsome', startTime: start,
      timezone: 'Pacific/Auckland', refunded: true, creditsCost: 2, reason: 'I’m busy',
    });
    const late = buildUserCancellationEmail({
      to: 'z@example.com', name: 'Ziang', buddyName: 'EnglandHandsome', startTime: start,
      timezone: 'Pacific/Auckland', refunded: false, creditsCost: 1,
    });

    expect(refunded.html).toContain('Your 2 credits are back');
    expect(refunded.html).toContain('“I’m busy”');
    expect(late.html).toContain('less than 12 hours');
    expect(late.html).not.toContain('Reason');
  });

  it('when the member cancels: the Buddy is told, with the reason, and the time is free', () => {
    const { email } = buildLessonCancelledByUserNotification({
      userName: 'Sarah', buddyName: 'Kenji', buddyEmail: 'k@example.com', startTime: start,
      timezone: 'Asia/Tokyo', reason: 'Need a different time',
    });

    expect(email!.html).toContain('Hi Kenji,');
    expect(email!.html).toContain('“Need a different time”');
    expect(email!.html).toContain('free again');
    expect(email!.html).not.toContain('/book');
  });

  it('escapes what people type', () => {
    const { email } = buildBuddyCancellationNotification({
      buddyName: 'K', userEmail: 'z@example.com', startTime: start, creditsRemaining: 1, reason: '<b>sick</b>',
    });
    expect(email.html).toContain('&lt;b&gt;sick&lt;/b&gt;');
    expect(email.html).not.toContain('<b>sick</b>');
  });
});
