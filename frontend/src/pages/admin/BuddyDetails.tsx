import type { AdminBuddyDetails } from '../../lib/api';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Monday first, as people read a working week.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

type Block = AdminBuddyDetails['availabilityBlocks'][number];

// Buddies often save hour-long slots (09:00–10:00, 10:00–11:00, …); join
// back-to-back or overlapping slots on the same day into one range.
function mergeDay(blocks: Block[]): { start: string; end: string }[] {
  const sorted = [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const merged: { start: string; end: string }[] = [];
  for (const { startTime, endTime } of sorted) {
    const last = merged[merged.length - 1];
    if (last && startTime <= last.end) {
      if (endTime > last.end) last.end = endTime;
    } else {
      merged.push({ start: startTime, end: endTime });
    }
  }
  return merged;
}

// One line per distinct set of hours, listing the days that share it:
// "Mon, Wed · 09:00–12:00" / "Sun · 08:00–10:00, 11:00–14:00".
export function summariseAvailability(blocks: Block[]): string[] {
  const daysByHours = new Map<string, number[]>();
  for (const day of WEEK_ORDER) {
    const ranges = mergeDay(blocks.filter((b) => b.dayOfWeek === day));
    if (ranges.length === 0) continue;
    const hours = ranges.map((r) => `${r.start}–${r.end}`).join(', ');
    daysByHours.set(hours, [...(daysByHours.get(hours) ?? []), day]);
  }
  return [...daysByHours.entries()].map(([hours, days]) => `${days.map((d) => DAY_NAMES[d]).join(', ')} · ${hours}`);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

// Label above a full-width value: at phone width a side-by-side layout
// leaves values too narrow (emails and links wrap mid-word).
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
  const availability = summariseAvailability(details.availabilityBlocks);
  const { upcoming, completed, cancelled } = details.lessons;

  return (
    // A tinted inset card, so the details read as "about this Buddy" rather
    // than as more roster rows.
    <div data-testid="buddy-details" className="mt-3 flex flex-col gap-2.5 rounded-md bg-border/40 p-3">
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
          <>
            {availability.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {details.timezone && <p className="text-xs text-text-secondary">Times in {details.timezone}</p>}
          </>
        )}
      </Field>
      {details.location && <Field label="Location">{details.location}</Field>}
      {details.bio && <Field label="Bio">{details.bio}</Field>}
    </div>
  );
}
