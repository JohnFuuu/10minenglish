import type { AdminBuddyDetails } from '../../lib/api';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Monday first, as people read a working week.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// "Mon, Wed · 09:00–17:00 (Pacific/Auckland)" — days sharing the same hours
// on one line, one line per distinct time range.
export function summariseAvailability(blocks: AdminBuddyDetails['availabilityBlocks'], timezone?: string): string[] {
  const daysByRange = new Map<string, number[]>();
  for (const block of blocks) {
    const range = `${block.startTime}–${block.endTime}`;
    daysByRange.set(range, [...(daysByRange.get(range) ?? []), block.dayOfWeek]);
  }
  return [...daysByRange.entries()].map(([range, days]) => {
    const dayList = WEEK_ORDER.filter((d) => days.includes(d)).map((d) => DAY_NAMES[d]).join(', ');
    return `${dayList} · ${range}${timezone ? ` (${timezone})` : ''}`;
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-wide text-text-secondary">{label}</p>
      <div className="break-words text-sm text-text-body">{children}</div>
    </div>
  );
}

// The expanded part of a Buddy roster row (Admin only).
export function BuddyDetails({ details }: { details: AdminBuddyDetails }) {
  const availability = summariseAvailability(details.availabilityBlocks, details.timezone);
  const { upcoming, completed, cancelled } = details.lessons;

  return (
    <div className="mt-3 flex flex-col gap-3 border-t-2 border-border pt-3">
      <Field label="Email">{details.email}</Field>
      <Field label="Status">
        {details.active ? 'Active' : 'Inactive'} · joined {formatDate(details.joinedAt)}
      </Field>
      <Field label="Meeting link">
        {details.meetingLink ? (
          <a href={details.meetingLink} target="_blank" rel="noopener noreferrer" className="font-bold text-brand-secondary underline">
            {details.meetingLink}
          </a>
        ) : (
          <span className="text-text-secondary">Not set yet — they aren't bookable</span>
        )}
      </Field>
      <Field label="Lessons">
        <p>{`${upcoming} upcoming · ${completed} completed · ${cancelled} cancelled`}</p>
        {details.nextLessonAt && <p className="text-text-secondary">Next lesson: {formatDateTime(details.nextLessonAt)}</p>}
      </Field>
      <Field label="Availability">
        {availability.length === 0 ? (
          <span className="text-text-secondary">No availability set</span>
        ) : (
          availability.map((line) => <p key={line}>{line}</p>)
        )}
      </Field>
      {details.location && <Field label="Location">{details.location}</Field>}
      {details.bio && <Field label="Bio">{details.bio}</Field>}
    </div>
  );
}
