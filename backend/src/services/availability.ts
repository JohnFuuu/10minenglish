import { DateTime } from 'luxon';
import type { AvailabilityBlock } from '../models/Account.js';

function parseTime(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(':').map(Number);
  return { hour, minute };
}

function blockToInterval(block: AvailabilityBlock, sunday: DateTime) {
  const dayStart = sunday.plus({ days: block.dayOfWeek });
  const start = dayStart.set({ ...parseTime(block.startTime), second: 0, millisecond: 0 });
  let end = dayStart.set({ ...parseTime(block.endTime), second: 0, millisecond: 0 });
  if (end <= start) end = end.plus({ days: 1 }); // overnight block, e.g. 22:00-02:00
  return { start, end };
}

function toBlockPart(dt: DateTime): { dayOfWeek: number; time: string } {
  return { dayOfWeek: dt.weekday % 7, time: dt.toFormat('HH:mm') }; // luxon: 1=Mon..7=Sun -> %7 gives 0=Sun..6=Sat
}

/**
 * Converts a Buddy's recurring weekly availability (stored in their own
 * timezone) into the equivalent blocks in a viewer's timezone. Anchored to
 * the current week so DST offset matches "right now", not an arbitrary date.
 * A block that crosses midnight after conversion is split into two.
 */
export function convertAvailabilityToTimezone(
  blocks: AvailabilityBlock[],
  fromTimezone: string,
  toTimezone: string,
): AvailabilityBlock[] {
  // luxon's startOf('week') is Monday-based; shift back one day so
  // block.dayOfWeek (0=Sun..6=Sat) lines up with `sunday.plus({ days: dayOfWeek })`.
  const sunday = DateTime.now().setZone(fromTimezone).startOf('week').minus({ days: 1 });

  const result: AvailabilityBlock[] = [];
  for (const block of blocks) {
    const { start, end } = blockToInterval(block, sunday);
    const startConverted = start.setZone(toTimezone);
    const endConverted = end.setZone(toTimezone);

    const startPart = toBlockPart(startConverted);
    const endPart = toBlockPart(endConverted);

    if (startPart.dayOfWeek === endPart.dayOfWeek) {
      result.push({ dayOfWeek: startPart.dayOfWeek, startTime: startPart.time, endTime: endPart.time });
    } else {
      result.push({ dayOfWeek: startPart.dayOfWeek, startTime: startPart.time, endTime: '23:59' });
      result.push({ dayOfWeek: endPart.dayOfWeek, startTime: '00:00', endTime: endPart.time });
    }
  }
  return result;
}
