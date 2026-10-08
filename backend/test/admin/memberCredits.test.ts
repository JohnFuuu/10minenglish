import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Account } from '../../src/models/Account.js';
import { AuditEntry } from '../../src/models/AuditEntry.js';
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

async function admin() {
  const account = await Account.create({ role: 'admin', email: 'admin@10me.test', name: 'Ada Admin' });
  return { account, token: signAccountToken({ accountId: account.id, role: 'admin' }) };
}

describe('POST /api/admin/members/:id/credits', () => {
  it('adds credits to the member’s balance and returns the updated member', async () => {
    const { token } = await admin();
    const member = await Account.create({ role: 'user', email: 'sarah@example.com', name: 'Sarah', credits: 3 });
    const { app } = createTestApp();

    const res = await request(app)
      .post(`/api/admin/members/${member.id}/credits`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 10, reason: '  Hardship grant  ' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: member.id, credits: 13 });
    expect((await Account.findById(member.id))!.credits).toBe(13);
  });

  it('records the award, with the reason and new balance, under a "credits" audit filter', async () => {
    const { account: adminAccount, token } = await admin();
    const member = await Account.create({ role: 'user', email: 'sarah@example.com', name: 'Sarah', credits: 3 });
    const { app } = createTestApp();

    await request(app)
      .post(`/api/admin/members/${member.id}/credits`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 10, reason: '  Hardship grant  ' });

    const entries = await AuditEntry.find();
    expect(entries).toHaveLength(1);
    expect(entries[0].toObject()).toMatchObject({
      action: 'member.credits_awarded',
      admin: { name: 'Ada Admin' },
      target: { type: 'member', id: member.id, label: 'Sarah' },
      details: { amount: 10, reason: 'Hardship grant', balanceAfter: 13 },
    });
    expect(String(entries[0].admin.id)).toBe(adminAccount.id);

    const log = await request(app).get('/api/admin/audit-log').query({ category: 'credits' }).set('Authorization', `Bearer ${token}`);
    expect(log.body.entries.map((e: { action: string }) => e.action)).toEqual(['member.credits_awarded']);
  });

  it('notifies the member in the app and by email, with the amount and reason', async () => {
    const { token } = await admin();
    const member = await Account.create({ role: 'user', email: 'sarah@example.com', name: 'Sarah', credits: 3 });
    const { app, emailSender } = createTestApp();

    await request(app)
      .post(`/api/admin/members/${member.id}/credits`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 10, reason: 'Hardship grant' });

    const notifications = await Notification.find({ accountId: member._id });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('credits_awarded');
    expect(notifications[0].message).toBe('Good news! The 10ME team has added 10 free credits to your account: “Hardship grant”.');
    // Kept apart from the sentence, so the app can highlight them.
    expect(notifications[0].details).toEqual({ amount: 10, reason: 'Hardship grant' });
    expect(emailSender.sent).toHaveLength(1);
    expect(emailSender.sent[0].to).toBe('sarah@example.com');
    expect(emailSender.sent[0].body).toContain('10 free credits');
    expect(emailSender.sent[0].body).toContain('Hardship grant');
    expect(emailSender.sent[0].body).toMatch(/^Hi Sarah,/);
    expect(emailSender.sent[0].body).not.toMatch(/now have/);
  });

  it('notifies an email-less member in the app only', async () => {
    const { token } = await admin();
    const member = await Account.create({ role: 'user', facebookId: 'fb-1', name: 'Phone Only', credits: 0 });
    const { app, emailSender } = createTestApp();

    const res = await request(app)
      .post(`/api/admin/members/${member.id}/credits`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 1, reason: 'Welcome' });

    expect(res.status).toBe(200);
    const [notification] = await Notification.find({ accountId: member._id });
    expect(notification.message).toBe('Good news! The 10ME team has added 1 free credit to your account: “Welcome”.');

    const listed = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${signAccountToken({ accountId: member.id, role: 'user' })}`);
    expect(listed.body.notifications[0]).toMatchObject({ type: 'credits_awarded', details: { amount: 1, reason: 'Welcome' } });
    expect(emailSender.sent).toHaveLength(0);
  });

  it('still awards the credits when the email fails to send', async () => {
    const { token } = await admin();
    const member = await Account.create({ role: 'user', email: 'sarah@example.com', credits: 0 });
    const { app, emailSender } = createTestApp();
    emailSender.send = async () => {
      throw new Error('email provider down');
    };

    const res = await request(app)
      .post(`/api/admin/members/${member.id}/credits`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 5, reason: 'grant' });

    expect(res.status).toBe(200);
    expect((await Account.findById(member.id))!.credits).toBe(5);
    expect(await AuditEntry.countDocuments()).toBe(1);
  });

  it('refuses an amount that isn’t a whole number from 1 to 100, or a missing reason, changing nothing', async () => {
    const { token } = await admin();
    const member = await Account.create({ role: 'user', email: 'sarah@example.com', credits: 3 });
    const { app } = createTestApp();
    const award = (body: object) =>
      request(app).post(`/api/admin/members/${member.id}/credits`).set('Authorization', `Bearer ${token}`).send(body);

    for (const amount of [0, -5, 2.5, 101, '10', null]) {
      expect((await award({ amount, reason: 'grant' })).status).toBe(400);
    }
    expect((await award({ amount: 5 })).status).toBe(400);
    expect((await award({ amount: 5, reason: '   ' })).status).toBe(400);
    expect((await award({ amount: 5, reason: 'x'.repeat(201) })).status).toBe(400);

    expect((await Account.findById(member.id))!.credits).toBe(3);
    expect(await AuditEntry.countDocuments()).toBe(0);
  });

  it('404s an unknown or malformed member and a non-User account', async () => {
    const { token } = await admin();
    const buddy = await Account.create({ role: 'buddy', email: 'buddy@example.com', credits: 0 });
    const { app } = createTestApp();
    const award = (id: string) =>
      request(app).post(`/api/admin/members/${id}/credits`).set('Authorization', `Bearer ${token}`).send({ amount: 5, reason: 'grant' });

    expect((await award('not-an-id')).status).toBe(404);
    expect((await award('0123456789abcdef01234567')).status).toBe(404);
    expect((await award(buddy.id)).status).toBe(404);
    expect((await Account.findById(buddy.id))!.credits).toBe(0);
  });

  it('refuses a non-Admin', async () => {
    const member = await Account.create({ role: 'user', email: 'sarah@example.com', credits: 0 });
    const { app } = createTestApp();

    const res = await request(app)
      .post(`/api/admin/members/${member.id}/credits`)
      .set('Authorization', `Bearer ${signAccountToken({ accountId: member.id, role: 'user' })}`)
      .send({ amount: 50, reason: 'free money' });

    expect(res.status).toBe(403);
    expect((await Account.findById(member.id))!.credits).toBe(0);
  });
});
