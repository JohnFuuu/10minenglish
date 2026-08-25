import mongoose, { Schema } from 'mongoose';

export type NotificationType = 'buddy_cancellation_refund';

export interface NotificationDocument extends mongoose.Document {
  accountId: mongoose.Types.ObjectId;
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>({
  accountId: { type: Schema.Types.ObjectId, required: true, ref: 'Account' },
  type: { type: String, required: true, enum: ['buddy_cancellation_refund'] },
  message: { type: String, required: true },
  read: { type: Boolean, required: true, default: false },
  createdAt: { type: Date, required: true, default: Date.now },
});

notificationSchema.index({ accountId: 1, createdAt: -1 });

export const Notification = mongoose.model<NotificationDocument>('Notification', notificationSchema);
