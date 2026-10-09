import { describe, expect, it } from 'vitest';
import { buildLessonCalendar } from '../../src/services/calendar.js';

const start = new Date('2099-10-31T00:30:00Z');

function unfold(ics: string): string {
  return ics.replace(/\r\n /g, '');
}

describe('meeting calendar file (.ics)', () => {
  it('describes each meeting as an event in exact UTC time, with the link and a reminder', () => {
    const ics = unfold(
      buildLessonCalendar({
        method: 'PUBLISH',
        lessons: [
          { id: 'lesson1', startTime: start, durationMinutes: 10, title: 'English meeting with Kenji', meetingLink: 'https://zoom.us/j/1' },
          { id: 'lesson2', startTime: new Date('2099-11-07T00:30:00Z'), durationMinutes: 10, title: 'English meeting with Kenji', meetingLink: 'https://zoom.us/j/1' },
        ],
      }),
    );

    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('METHOD:PUBLISH');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('UID:lesson1@10minenglish');
    expect(ics).toContain('DTSTART:20991031T003000Z');
    expect(ics).toContain('DTEND:20991031T004000Z');
    expect(ics).toContain('SUMMARY:English meeting with Kenji');
    expect(ics).toContain('URL:https://zoom.us/j/1');
    expect(ics).toContain('LOCATION:https://zoom.us/j/1');
    expect(ics).toContain('TRIGGER:-PT15M');
    expect(ics).toContain('STATUS:CONFIRMED');
  });

  it('marks events cancelled for a cancellation, under the same UID', () => {
    const ics = unfold(
      buildLessonCalendar({
        method: 'CANCEL',
        lessons: [{ id: 'lesson1', startTime: start, durationMinutes: 10, title: 'English meeting with Kenji', meetingLink: 'https://zoom.us/j/1' }],
      }),
    );

    expect(ics).toContain('METHOD:CANCEL');
    expect(ics).toContain('UID:lesson1@10minenglish');
    expect(ics).toContain('STATUS:CANCELLED');
    expect(ics).not.toContain('BEGIN:VALARM');
  });

  it('escapes special characters and folds long lines to 75 characters', () => {
    const ics = buildLessonCalendar({
      method: 'PUBLISH',
      lessons: [{ id: 'x', startTime: start, durationMinutes: 10, title: 'Meeting; with, Kenji\\Tom', meetingLink: `https://meet.test/${'a'.repeat(120)}` }],
    });

    expect(unfold(ics)).toContain('SUMMARY:Meeting\\; with\\, Kenji\\\\Tom');
    for (const line of ics.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75);
  });

  it('gives a later update a higher SEQUENCE, so calendars replace the old event', () => {
    const seq = (ics: string) => Number(/SEQUENCE:(\d+)/.exec(ics)![1]);
    const lesson = { id: 'x', startTime: start, durationMinutes: 10, title: 't', meetingLink: 'https://m.test' };

    const first = buildLessonCalendar({ method: 'PUBLISH', lessons: [lesson], now: new Date('2099-01-01T00:00:00Z') });
    const later = buildLessonCalendar({ method: 'PUBLISH', lessons: [lesson], now: new Date('2099-01-02T00:00:00Z') });

    expect(seq(later)).toBeGreaterThan(seq(first));
  });
});
