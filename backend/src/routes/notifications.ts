import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Notification, type NotificationDocument } from '../models/Notification.js';

function serializeNotification(notification: NotificationDocument) {
  return {
    id: notification._id.toString(),
    type: notification.type,
    message: notification.message,
    read: notification.read,
    createdAt: notification.createdAt.toISOString(),
  };
}

export const notificationsRouter = Router();

notificationsRouter.get('/api/notifications', requireAuth, async (req, res) => {
  const notifications = await Notification.find({ accountId: req.account!.accountId }).sort({ createdAt: -1 });
  const unreadCount = notifications.filter((n) => !n.read).length;

  res.status(200).json({ notifications: notifications.map(serializeNotification), unreadCount });
});

notificationsRouter.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }
  if (notification.accountId.toString() !== req.account!.accountId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  notification.read = true;
  await notification.save();

  const unreadCount = await Notification.countDocuments({ accountId: req.account!.accountId, read: false });

  res.status(200).json({ notification: serializeNotification(notification), unreadCount });
});
