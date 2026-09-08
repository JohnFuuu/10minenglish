import type mongoose from 'mongoose';
import { Account } from '../models/Account.js';
import type { LessonDocument } from '../models/Lesson.js';
import type { EmailSender } from './email.js';
import { buddyCancelLesson, buildBuddyCancellationNotification } from './lessonBooking.js';
import { createNotification } from './notifications.js';

// The one Buddy-initiated cancellation path: always refund, always notify,
// whatever triggered it. A Buddy cancelling their own Lesson and an Admin
// deactivating that Buddy both go through here, so the User sees the same
// outcome either way.
export async function cancelLessonAsBuddy(params: {
  emailSender: EmailSender;
  lessonId: mongoose.Types.ObjectId | string;
  buddyName?: string;
}): Promise<{ lesson: LessonDocument; creditsRemaining: number } | null> {
  const { emailSender, lessonId, buddyName } = params;

  const result = await buddyCancelLesson({ lessonId });
  if (!result) return null;

  const user = await Account.findById(result.lesson.userId);
  if (user) {
    const { message, email } = buildBuddyCancellationNotification({
      buddyName: buddyName ?? 'Your Buddy',
      userEmail: user.email,
      startTime: result.lesson.startTime,
      creditsRemaining: result.creditsRemaining,
    });
    try {
      await createNotification({
        emailSender,
        accountId: user._id,
        type: 'buddy_cancellation_refund',
        message,
        email,
      });
    } catch (err) {
      // The cancellation and refund are already committed — a failure to notify
      // (e.g. the email leg throwing) must not surface as a failed cancellation.
      console.error('Failed to send buddy-cancellation notification', err);
    }
  }

  return result;
}
