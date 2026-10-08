import type mongoose from 'mongoose';
import { Notification, type NotificationDocument, type NotificationType } from '../models/Notification.js';
import type { EmailMessage, EmailSender } from './email.js';

export async function createNotification(params: {
  emailSender: EmailSender;
  accountId: string | mongoose.Types.ObjectId;
  type: NotificationType;
  message: string;
  details?: Record<string, unknown>;
  // Omitted for an account with no email (e.g. a Facebook sign-up that
  // shared none): the in-app notification is all they get.
  email?: EmailMessage;
}): Promise<NotificationDocument> {
  const notification = await Notification.create({
    accountId: params.accountId,
    type: params.type,
    message: params.message,
    details: params.details,
  });
  if (params.email) await params.emailSender.send(params.email);
  return notification;
}
