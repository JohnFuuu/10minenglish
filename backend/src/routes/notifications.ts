import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Notification, type NotificationDocument } from '../models/Notification.js';

function serializeNotification(notification: NotificationDocument) {
  return {
    id: notification._id.toString(),
    type: notification.type,
    message: notification.message,
    ...(notification.details ? { details: notification.details } : {}),
    read: notification.read,
    createdAt: notification.createdAt.toISOString(),
  };
}

export const notificationsRouter = Router();

// What the recipient still sees: everything they haven't deleted.
function inboxFilter(accountId: string) {
  return { accountId, archivedAt: { $exists: false } };
}

function unreadCount(accountId: string) {
  return Notification.countDocuments({ ...inboxFilter(accountId), read: false });
}

notificationsRouter.get('/api/notifications', requireAuth, async (req, res) => {
  const notifications = await Notification.find(inboxFilter(req.account!.accountId)).sort({ createdAt: -1 });
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

  res.status(200).json({ notification: serializeNotification(notification), unreadCount: await unreadCount(req.account!.accountId) });
});

// "Delete" in the inbox — archives rather than removes (see Notification.archivedAt).
notificationsRouter.post('/api/notifications/archive-read', requireAuth, async (req, res) => {
  const accountId = req.account!.accountId;
  const result = await Notification.updateMany({ ...inboxFilter(accountId), read: true }, { $set: { archivedAt: new Date() } });

  res.status(200).json({ archivedCount: result.modifiedCount, unreadCount: await unreadCount(accountId) });
});

notificationsRouter.post('/api/notifications/:id/archive', requireAuth, async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }
  if (notification.accountId.toString() !== req.account!.accountId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  if (!notification.archivedAt) {
    notification.archivedAt = new Date();
    await notification.save();
  }

  res.status(200).json({ unreadCount: await unreadCount(req.account!.accountId) });
});
