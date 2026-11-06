import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Account } from '../../src/models/Account.js';
import { Notification } from '../../src/models/Notification.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import { createTestApp } from '../testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

async function userToken(overrides: Record<string, unknown> = {}) {
  const account = await Account.create({ role: 'user', email: 'user@example.com', ...overrides });
  return { account, token: signAccountToken({ accountId: account.id, role: account.role }) };
}

describe('GET /api/notifications', () => {
  it('rejects an unauthenticated request', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('returns an empty inbox and zero unread count when none exist', async () => {
    const { token } = await userToken();
    const { app } = createTestApp();

    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ notifications: [], unreadCount: 0 });
  });

  it('returns only the caller\'s notifications, newest first, with an accurate unread count', async () => {
    const { account, token } = await userToken();
    const other = await Account.create({ role: 'user', email: 'other@example.com' });

    const older = await Notification.create({
      accountId: account._id,
      type: 'buddy_cancellation_refund',
      message: 'older',
      read: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    const newer = await Notification.create({
      accountId: account._id,
      type: 'buddy_cancellation_refund',
      message: 'newer',
      createdAt: new Date('2026-01-02T00:00:00Z'),
    });
    await Notification.create({
      accountId: other._id,
      type: 'buddy_cancellation_refund',
      message: 'not mine',
    });
    const { app } = createTestApp();

    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications.map((n: { id: string }) => n.id)).toEqual([newer.id, older.id]);
    expect(res.body.notifications[0]).toMatchObject({ message: 'newer', read: false });
    expect(res.body.unreadCount).toBe(1);
  });
});

describe('POST /api/notifications/:id/read', () => {
  it('404s for an unknown notification', async () => {
    const { token } = await userToken();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/notifications/507f1f77bcf86cd799439011/read')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('403s when marking another account\'s notification read', async () => {
    const other = await Account.create({ role: 'user', email: 'other@example.com' });
    const { token } = await userToken();
    const notification = await Notification.create({
      accountId: other._id,
      type: 'buddy_cancellation_refund',
      message: 'not mine',
    });
    const { app } = createTestApp();

    const res = await request(app)
      .post(`/api/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('marks a notification read and returns the updated unread count', async () => {
    const { account, token } = await userToken();
    const notification = await Notification.create({
      accountId: account._id,
      type: 'buddy_cancellation_refund',
      message: 'mine',
    });
    const { app } = createTestApp();

    const res = await request(app)
      .post(`/api/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.notification).toMatchObject({ id: notification.id, read: true });
    expect(res.body.unreadCount).toBe(0);
  });
});

describe('POST /api/notifications/:id/archive', () => {
  it('404s for an unknown notification', async () => {
    const { token } = await userToken();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/notifications/507f1f77bcf86cd799439011/archive')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('403s when archiving another account\'s notification', async () => {
    const other = await Account.create({ role: 'user', email: 'other@example.com' });
    const { token } = await userToken();
    const notification = await Notification.create({ accountId: other._id, type: 'lesson_reminder', message: 'not mine' });
    const { app } = createTestApp();

    const res = await request(app)
      .post(`/api/notifications/${notification.id}/archive`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect((await Notification.findById(notification.id))!.archivedAt).toBeUndefined();
  });

  it('hides the notification from the inbox and the unread count, but keeps the record', async () => {
    const { account, token } = await userToken();
    const archived = await Notification.create({ accountId: account._id, type: 'lesson_reminder', message: 'archive me' });
    const kept = await Notification.create({ accountId: account._id, type: 'lesson_reminder', message: 'keep me' });
    const { app } = createTestApp();

    const res = await request(app)
      .post(`/api/notifications/${archived.id}/archive`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(1);

    const inbox = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`);
    expect(inbox.body.notifications.map((n: { id: string }) => n.id)).toEqual([kept.id]);
    expect(inbox.body.unreadCount).toBe(1);
    expect((await Notification.findById(archived.id))!.archivedAt).toBeInstanceOf(Date);
  });
});

describe('POST /api/notifications/archive-read', () => {
  it('archives every read notification of the caller and leaves unread and other accounts\' ones alone', async () => {
    const { account, token } = await userToken();
    const other = await Account.create({ role: 'user', email: 'other@example.com' });
    await Notification.create({ accountId: account._id, type: 'lesson_reminder', message: 'read 1', read: true });
    await Notification.create({ accountId: account._id, type: 'lesson_reminder', message: 'read 2', read: true });
    const unread = await Notification.create({ accountId: account._id, type: 'lesson_reminder', message: 'unread' });
    const othersRead = await Notification.create({ accountId: other._id, type: 'lesson_reminder', message: 'theirs', read: true });
    const { app } = createTestApp();

    const res = await request(app).post('/api/notifications/archive-read').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ archivedCount: 2, unreadCount: 1 });

    const inbox = await request(app).get('/api/notifications').set('Authorization', `Bearer ${token}`);
    expect(inbox.body.notifications.map((n: { id: string }) => n.id)).toEqual([unread.id]);
    expect((await Notification.findById(othersRead.id))!.archivedAt).toBeUndefined();
  });
});

describe('POST /api/notifications/:id/read after archiving', () => {
  it('leaves archived notifications out of the returned unread count', async () => {
    const { account, token } = await userToken();
    await Notification.create({ accountId: account._id, type: 'lesson_reminder', message: 'archived unread', archivedAt: new Date() });
    const notification = await Notification.create({ accountId: account._id, type: 'lesson_reminder', message: 'mine' });
    const { app } = createTestApp();

    const res = await request(app)
      .post(`/api/notifications/${notification.id}/read`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.unreadCount).toBe(0);
  });
});
