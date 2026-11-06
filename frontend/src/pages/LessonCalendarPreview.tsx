import type { PlannedDateStatus } from '../lib/api';

// A picture of when the booked lessons will be: month calendars with each
// planned lesson day marked and numbered — green if free, amber if the chosen
// Buddy is busy but someone else will take it, red if nobody can (not booked).
// Easier to read than "Every week" for learners still building their English.

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
// Long plans (e.g. weekly for 30 weeks) stay short: the rest is summed up below.
const MAX_MONTHS = 3;

export interface PlannedLesson {
  date: Date;
  status: PlannedDateStatus;
  /** Who takes an 'alternative' day. */
  buddyName?: string;
}

const DOT_CLASS: Record<PlannedDateStatus, string> = {
  free: 'bg-brand-primary',
  alternative: 'bg-warning',
  busy: 'bg-error',
};
const STATUS_WORDS: Record<PlannedDateStatus, string> = {
  free: '',
  alternative: ', busy, alternative found',
  busy: ', busy',
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function MonthGrid({
  year,
  month,
  lessonByDay,
}: {
  year: number;
  month: number;
  lessonByDay: Map<string, { number: number; status: PlannedDateStatus }>;
}) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first: Sun (0) becomes the 7th column.
  const leadingBlanks = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <p className="mb-1.5 text-sm font-extrabold text-text-heading">
        {first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className={`text-[11px] font-bold ${i >= 5 ? 'text-text-secondary/70' : 'text-text-secondary'}`}>
            {w}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`blank-${i}`} />;
          const lesson = lessonByDay.get(dayKey(new Date(year, month, day)));
          if (!lesson) {
            return (
              <span key={day} className="mx-auto flex h-8 w-8 items-center justify-center text-sm text-text-secondary">
                {day}
              </span>
            );
          }
          return (
            <span
              key={day}
              aria-label={`Meeting ${lesson.number}${STATUS_WORDS[lesson.status]}`}
              className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-text-inverse ${
                DOT_CLASS[lesson.status]
              }`}
            >
              {day}
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-secondary px-0.5 text-[9px] font-extrabold text-text-inverse">
                {lesson.number}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function LessonCalendarPreview({
  lessons,
  recurring,
  loading = false,
}: {
  lessons: PlannedLesson[];
  recurring: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <p className="rounded-md border-2 border-b-[4px] border-border bg-bg-surface p-4 text-sm font-bold text-text-secondary">
        Checking your meeting days…
      </p>
    );
  }
  // The first date is always planned, so this shouldn't happen — but say so plainly if it does.
  if (lessons.length === 0) {
    return (
      <p className="rounded-md border-2 border-warning bg-warning/10 px-3 py-3 text-sm font-bold text-warning">
        No meeting days fit this pattern. Go back and choose other days.
      </p>
    );
  }

  const lessonByDay = new Map(lessons.map((l, i) => [dayKey(l.date), { number: i + 1, status: l.status }]));
  const months: { year: number; month: number }[] = [];
  for (const { date } of lessons) {
    const last = months[months.length - 1];
    if (!last || last.year !== date.getFullYear() || last.month !== date.getMonth()) {
      months.push({ year: date.getFullYear(), month: date.getMonth() });
    }
  }
  const shownMonths = months.slice(0, MAX_MONTHS);
  const lastShown = shownMonths[shownMonths.length - 1];
  const hidden = lessons.filter(
    ({ date }) => date.getFullYear() * 12 + date.getMonth() > lastShown.year * 12 + lastShown.month,
  );
  const time = lessons[0].date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const busy = lessons.filter((l) => l.status === 'busy');
  const alternatives = lessons.filter((l) => l.status === 'alternative');
  const alternativesByBuddy = new Map<string, PlannedLesson[]>();
  for (const l of alternatives) {
    const name = l.buddyName ?? 'Another Buddy';
    alternativesByBuddy.set(name, [...(alternativesByBuddy.get(name) ?? []), l]);
  }
  const shortDate = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="rounded-md border-2 border-b-[4px] border-border bg-bg-surface p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-text-secondary">
        {recurring ? `Your ${lessons.length} meetings` : 'Your meeting'}
      </p>
      <div className="flex flex-col gap-4">
        {shownMonths.map(({ year, month }) => (
          <MonthGrid key={`${year}-${month}`} year={year} month={month} lessonByDay={lessonByDay} />
        ))}
      </div>
      {hidden.length > 0 && (
        <p className="mt-3 text-sm font-bold text-text-heading">
          + {hidden.length} more, until {shortDate(hidden[hidden.length - 1].date)}
          {hidden.some((l) => l.status === 'busy') && (
            <span className="text-error"> ({hidden.filter((l) => l.status === 'busy').length} busy)</span>
          )}
          {hidden.some((l) => l.status === 'alternative') && (
            <span className="text-warning"> ({hidden.filter((l) => l.status === 'alternative').length} with another Buddy)</span>
          )}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-1 text-sm font-bold text-text-heading">
        <p className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full bg-brand-primary" aria-hidden="true" />
          Free · {time}
        </p>
        {alternatives.length > 0 && (
          <p className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full bg-warning" aria-hidden="true" />
            Another Buddy
          </p>
        )}
        {busy.length > 0 && (
          <p className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full bg-error" aria-hidden="true" />
            Busy · not booked
          </p>
        )}
      </div>

      {alternatives.length > 0 && (
        <div className="mt-3 flex flex-col gap-0.5 rounded-md bg-warning/10 px-3 py-2 text-sm font-bold text-text-heading">
          {/* One line per stand-in Buddy, e.g. "Demo Buddy: Fri 13 Nov, Sat 14 Nov". */}
          {[...alternativesByBuddy].map(([name, days]) => (
            <p key={name}>
              {name}: {days.map((l) => shortDate(l.date)).join(', ')}
            </p>
          ))}
        </div>
      )}

      {busy.length > 0 && (
        <p className="mt-3 rounded-md bg-error/10 px-3 py-2 text-sm font-bold text-error">
          {busy.length === lessons.length
            ? 'All of these days are busy, so nothing can be booked. Go back and choose another time.'
            : `${busy.length} of these days ${busy.length === 1 ? 'is' : 'are'} busy (${busy
                .map((l) => shortDate(l.date))
                .join(', ')}). We will book the other ${lessons.length - busy.length} and not add new days.`}
        </p>
      )}
    </div>
  );
}
