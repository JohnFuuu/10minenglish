import { Lesson } from '../models/Lesson.js';

// The class itself happens on a Buddy-supplied meeting link (see ADR 0002)
// that the app has no visibility into, so there's no way to verify
// attendance — completion is purely time-based: once startTime +
// durationMinutes has passed, an upcoming Lesson is auto-completed.

// Marks every Lesson whose end time has passed as completed. Run by the
// time-driven sweep (services/sweeps.ts) rather than a request; safe to
// call repeatedly.
export async function completeDueLessons(params: { now?: Date } = {}): Promise<{ completed: number }> {
  const { now = new Date() } = params;

  const due = await Lesson.find({
    status: 'upcoming',
    $expr: {
      $lte: [{ $add: ['$startTime', { $multiply: ['$durationMinutes', 60_000] }] }, now],
    },
  });

  let completed = 0;
  for (const lesson of due) {
    // Same atomic-claim pattern as the reminder/cancellation sweeps: only the
    // sweep that actually flips the status counts it, so overlapping sweeps
    // can't double-process the same Lesson.
    const claimed = await Lesson.findOneAndUpdate(
      { _id: lesson._id, status: 'upcoming' },
      { $set: { status: 'completed' } },
      { returnDocument: 'after' },
    );
    if (claimed) completed += 1;
  }

  return { completed };
}
