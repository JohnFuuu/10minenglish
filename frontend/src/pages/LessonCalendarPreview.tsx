// A picture of when the booked lessons will be: month calendars with each
// planned lesson day marked and numbered. Easier to read than "Every week"
// for learners still building their English.

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
// Long plans (e.g. weekly for 30 weeks) stay short: the rest is summed up below.
const MAX_MONTHS = 3;

// The dates the server will try, in order — mirrors the backend's
// generateRecurringCandidates: step N days in the viewer's own calendar
// (same clock time each day), skipping Sat/Sun unless weekends are included.
export function planLessonDates(params: {
  start: Date;
  stepDays: number;
  includeWeekends: boolean;
  count: number;
}): Date[] {
  const dates: Date[] = [];
  const current = new Date(params.start);
  // Bounded like the backend's candidate cap, so a bad input can't loop forever.
  for (let tries = 0; dates.length < params.count && tries < params.count * 6 + 60; tries += 1) {
    const day = current.getDay();
    if (params.includeWeekends || (day !== 0 && day !== 6)) dates.push(new Date(current));
    current.setDate(current.getDate() + Math.max(1, params.stepDays));
  }
  return dates;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function MonthGrid({ year, month, lessonNumberByDay }: { year: number; month: number; lessonNumberByDay: Map<string, number> }) {
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
          const lessonNumber = lessonNumberByDay.get(dayKey(new Date(year, month, day)));
          return lessonNumber ? (
            <span
              key={day}
              aria-label={`Lesson ${lessonNumber}`}
              className="relative mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-sm font-extrabold text-text-inverse"
            >
              {day}
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-secondary px-0.5 text-[9px] font-extrabold text-text-inverse">
                {lessonNumber}
              </span>
            </span>
          ) : (
            <span key={day} className="mx-auto flex h-8 w-8 items-center justify-center text-sm text-text-secondary">
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function LessonCalendarPreview({ dates, recurring }: { dates: Date[]; recurring: boolean }) {
  // e.g. every week starting on a Sunday, with weekends turned off.
  if (dates.length === 0) {
    return (
      <p className="rounded-md border-2 border-warning bg-warning/10 px-3 py-3 text-sm font-bold text-warning">
        No lesson days fit: every day in this pattern is a Saturday or Sunday, and weekends are turned off. Go back and
        turn on “Also on Saturday and Sunday”, or pick another day.
      </p>
    );
  }

  const lessonNumberByDay = new Map(dates.map((d, i) => [dayKey(d), i + 1]));
  const months: { year: number; month: number }[] = [];
  for (const d of dates) {
    const last = months[months.length - 1];
    if (!last || last.year !== d.getFullYear() || last.month !== d.getMonth()) {
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
  }
  const shownMonths = months.slice(0, MAX_MONTHS);
  const lastShown = shownMonths[shownMonths.length - 1];
  const hiddenDates = dates.filter((d) => d.getFullYear() * 12 + d.getMonth() > lastShown.year * 12 + lastShown.month);
  const time = dates[0].toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="rounded-md border-2 border-b-[4px] border-border bg-bg-surface p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-text-secondary">
        {recurring ? `Your ${dates.length} lessons` : 'Your lesson'}
      </p>
      <div className="flex flex-col gap-4">
        {shownMonths.map(({ year, month }) => (
          <MonthGrid key={`${year}-${month}`} year={year} month={month} lessonNumberByDay={lessonNumberByDay} />
        ))}
      </div>
      {hiddenDates.length > 0 && (
        <p className="mt-3 text-sm font-bold text-text-heading">
          + {hiddenDates.length} more, until{' '}
          {hiddenDates[hiddenDates.length - 1].toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
        </p>
      )}
      <p className="mt-3 flex items-center gap-2 text-sm font-bold text-text-heading">
        <span className="h-3 w-3 shrink-0 rounded-full bg-brand-primary" aria-hidden="true" />
        {recurring ? 'Lesson days' : 'Lesson day'} · {time}
      </p>
      {recurring && (
        <p className="mt-1 text-xs font-medium text-text-secondary">
          If your Buddy is busy on one of these days, we skip it and try the next one.
        </p>
      )}
    </div>
  );
}
