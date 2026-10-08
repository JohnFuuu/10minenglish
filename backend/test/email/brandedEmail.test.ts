import { describe, expect, it } from 'vitest';
import { brandedHtmlFromText } from '../../src/services/emailLayout.js';
import { buildConfirmationEmail } from '../../src/services/lessonBooking.js';

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
