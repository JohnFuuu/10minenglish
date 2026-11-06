// Daylight-saving clock changes in the viewer's own time zone (the device's),
// so the booking screens can warn about one that falls before a meeting.

export interface ClockChange {
  /** The moment the clocks change. */
  at: Date;
  /** How far the clocks move, in minutes: positive = forward, negative = back. */
  minutes: number;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// getTimezoneOffset is minutes *behind* UTC, so NZ summer is -780.
const offsetAt = (ms: number) => new Date(ms).getTimezoneOffset();

/** Every clock change after `from` up to and including `to`, oldest first. */
export function clockChangesBetween(from: Date, to: Date): ClockChange[] {
  const changes: ClockChange[] = [];
  let prevMs = from.getTime();
  const endMs = to.getTime();
  while (prevMs < endMs) {
    const nextMs = Math.min(prevMs + DAY, endMs);
    const before = offsetAt(prevMs);
    const after = offsetAt(nextMs);
    if (before !== after) {
      // Narrow down to the hour it happened in (changes land on the hour or half-hour).
      let lo = prevMs;
      let hi = nextMs;
      while (hi - lo > HOUR / 4) {
        const mid = lo + (hi - lo) / 2;
        if (offsetAt(mid) === before) lo = mid;
        else hi = mid;
      }
      changes.push({ at: new Date(hi), minutes: before - after });
    }
    prevMs = nextMs;
  }
  return changes;
}

/** "1 hour" / "30 minutes" for a clock change. */
export function clockChangeAmount(minutes: number): string {
  const m = Math.abs(minutes);
  if (m % 60 === 0) return `${m / 60} hour${m === 60 ? '' : 's'}`;
  return `${m} minutes`;
}
