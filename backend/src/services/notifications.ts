import type mongoose from 'mongoose';
import { Notification, type NotificationDocument, type NotificationType } from '../models/Notification.js';
import type { EmailMessage, EmailSender } from './email.js';

export async function createNotification(params: {
  emailSender: EmailSender;
  accountId: string | mongoose.Types.ObjectId;
  type: NotificationType;
  message: string;
  email: EmailMessage;
}): Promise<NotificationDocument> {
  const notification = await Notification.create({
    accountId: params.accountId,
    type: params.type,
    message: params.message,
  });
  await params.emailSender.send(params.email);
  return notification;
}
