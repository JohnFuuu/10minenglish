import mongoose, { Schema } from 'mongoose';

export type NotificationType = 'buddy_cancellation_refund' | 'lesson_reminder' | 'lesson_rescheduled' | 'lesson_cancelled' | 'credits_awarded' | 'support_reply';

export interface NotificationDocument extends mongoose.Document {
  accountId: mongoose.Types.ObjectId;
  type: NotificationType;
  message: string;
  // Parts of the message the app styles on its own (e.g. a credit award's
  // amount and reason). Absent for types that are just a sentence.
  details?: Record<string, unknown>;
  read: boolean;
  // Set when the recipient deletes it from their inbox. Kept (not removed)
  // so support can still see what was sent; the inbox just hides it.
  archivedAt?: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>({
  accountId: { type: Schema.Types.ObjectId, required: true, ref: 'Account' },
  type: { type: String, required: true, enum: ['buddy_cancellation_refund', 'lesson_reminder', 'lesson_rescheduled', 'lesson_cancelled', 'credits_awarded', 'support_reply'] },
  message: { type: String, required: true },
  details: { type: Schema.Types.Mixed },
  read: { type: Boolean, required: true, default: false },
  archivedAt: { type: Date },
  createdAt: { type: Date, required: true, default: Date.now },
});

notificationSchema.index({ accountId: 1, createdAt: -1 });

export const Notification = mongoose.model<NotificationDocument>('Notification', notificationSchema);
