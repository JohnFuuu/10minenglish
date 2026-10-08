// Calendar files (.ics, RFC 5545) attached to lesson emails, so members and
// Buddies can add lessons to Apple Calendar, Outlook or Google Calendar in
// one tap. Each event's UID is the Lesson's id, so a later email about the
// same Lesson (moved: PUBLISH with a higher SEQUENCE; cancelled: CANCEL)
// updates or removes the entry instead of adding a second one.
import type { EmailAttachment, EmailMessage } from './email.js';

export interface CalendarLesson {
  id: string;
  startTime: Date;
  durationMinutes: number;
  title: string;
  meetingLink: string;
}

// 2099-10-31T00:30:00Z -> 20991031T003000Z
function icsTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Lines longer than 75 characters continue on the next line after a space.
function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = ' ' + rest.slice(75);
  }
  parts.push(rest);
  return parts.join('\r\n');
}

export function buildLessonCalendar(params: {
  method: 'PUBLISH' | 'CANCEL';
  lessons: CalendarLesson[];
  now?: Date;
}): string {
  const { method, lessons, now = new Date() } = params;
  const cancelled = method === 'CANCEL';
  // Rises with time, so each update outranks what the calendar already has.
  const sequence = Math.floor(now.getTime() / 1000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//10 Minute English//Lessons//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
  ];
  for (const lesson of lessons) {
    const end = new Date(lesson.startTime.getTime() + lesson.durationMinutes * 60_000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${lesson.id}@10minenglish`,
      `DTSTAMP:${icsTime(now)}`,
      `SEQUENCE:${sequence}`,
      `DTSTART:${icsTime(lesson.startTime)}`,
      `DTEND:${icsTime(end)}`,
      `SUMMARY:${escapeText(cancelled ? `Cancelled: ${lesson.title}` : lesson.title)}`,
      `DESCRIPTION:${escapeText(`Join here: ${lesson.meetingLink}`)}`,
      `LOCATION:${escapeText(lesson.meetingLink)}`,
      `URL:${lesson.meetingLink}`,
      `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    );
    if (!cancelled) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Your English lesson starts soon', 'TRIGGER:-PT15M', 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

// The calendar file as an email attachment.
export function lessonCalendarAttachment(params: {
  method: 'PUBLISH' | 'CANCEL';
  lessons: CalendarLesson[];
}): EmailAttachment {
  return {
    filename: params.method === 'CANCEL' ? 'cancelled-lesson.ics' : params.lessons.length > 1 ? '10me-lessons.ics' : '10me-lesson.ics',
    contentType: `text/calendar; charset=utf-8; method=${params.method}`,
    content: buildLessonCalendar(params),
  };
}

// Lessons as one reader sees them: titled with the other person's name.
export function calendarForLessons(
  method: 'PUBLISH' | 'CANCEL',
  lessons: { id: string; startTime: Date; durationMinutes: number; meetingLink: string }[],
  otherPartyName: string,
): EmailAttachment {
  return lessonCalendarAttachment({
    method,
    lessons: lessons.map((l) => ({ ...l, title: `English lesson with ${otherPartyName}` })),
  });
}

// The same email with a calendar file attached.
export function withCalendar<T extends EmailMessage | undefined>(email: T, calendar: EmailAttachment): T {
  return (email ? { ...email, attachments: [...(email.attachments ?? []), calendar] } : email) as T;
}
