import type { Types } from 'mongoose';
import { Account } from '../models/Account.js';
import { Lesson } from '../models/Lesson.js';
import { Tag } from '../models/Tag.js';
import type { EmailSender } from './email.js';
import { cancelLessonAsBuddy } from './buddyCancellation.js';

export const RECONCILE_SWEEP_INTERVAL_MS = 60_000;

// Cancels, refunds, and notifies every still-upcoming Lesson of one Buddy.
// Safe to repeat and to race: each Lesson is claimed with a single
// "only if still upcoming" update, so it is cancelled, refunded, and
// notified at most once whichever caller gets there first.
export async function cancelUpcomingLessonsForBuddy(params: {
  emailSender: EmailSender;
  buddyId: Types.ObjectId;
  buddyName?: string;
}): Promise<number> {
  const { emailSender, buddyId, buddyName } = params;
  const upcoming = await Lesson.find({ buddyId, status: 'upcoming', startTime: { $gt: new Date() } });
  let cancelled = 0;
  for (const lesson of upcoming) {
    if (await cancelLessonAsBuddy({ emailSender, lessonId: lesson._id, buddyName })) cancelled += 1;
  }
  return cancelled;
}

// Makes reality match the Admin's decisions (see #29). A Buddy's active /
// removed flag is the source of truth: an inactive or removed Buddy has no
// upcoming Lessons. Deactivate/remove do this work immediately; this sweep
// finishes anything left behind by a crash mid-way, or by a booking that
// landed at the same moment. It also drops member references to deleted
// tags. Idempotent — running it again changes nothing.
export async function reconcileBuddyState(params: {
  emailSender: EmailSender;
}): Promise<{ cancelledLessons: number; membersWithDanglingTagsCleaned: number }> {
  const { emailSender } = params;

  const outOfRotation = await Account.find(
    { role: 'buddy', $or: [{ active: false }, { removedAt: { $exists: true } }] },
    { name: 1 },
  );
  let cancelledLessons = 0;
  for (const buddy of outOfRotation) {
    cancelledLessons += await cancelUpcomingLessonsForBuddy({ emailSender, buddyId: buddy._id, buddyName: buddy.name });
  }

  const liveTagIds = await Tag.distinct('_id');
  // $elemMatch: members with *any* dangling entry. (A bare $nin on the array
  // field would only match members whose entries are *all* dangling.)
  const cleaned = await Account.updateMany(
    { memberTags: { $elemMatch: { tagId: { $nin: liveTagIds } } } },
    { $pull: { memberTags: { tagId: { $nin: liveTagIds } } } },
  );

  return { cancelledLessons, membersWithDanglingTagsCleaned: cleaned.modifiedCount };
}
