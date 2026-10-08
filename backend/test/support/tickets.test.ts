import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Account } from '../../src/models/Account.js';
import { AuditEntry } from '../../src/models/AuditEntry.js';
import { Lesson } from '../../src/models/Lesson.js';
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

async function people() {
  const member = await Account.create({ role: 'user', email: 'sarah@example.com', name: 'Sarah' });
  const other = await Account.create({ role: 'user', email: 'tom@example.com', name: 'Tom' });
  const buddy = await Account.create({ role: 'buddy', email: 'kenji@example.com', name: 'Kenji', meetingLink: 'https://zoom.us/j/1' });
  const admin = await Account.create({ role: 'admin', email: 'admin@10me.test', name: 'Ada Admin' });
  const token = (a: { id: string; role: string }) => signAccountToken({ accountId: a.id, role: a.role as 'user' });
  return {
    member,
    buddy,
    memberToken: token(member),
    otherToken: token(other),
    buddyToken: token(buddy),
    adminToken: token(admin),
  };
}

describe('sending a support ticket', () => {
  it('lets a member send one with a topic and message; it starts Open with their message', async () => {
    const { memberToken } = await people();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/support/tickets')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ topic: 'payment', message: '  I paid but got no credits  ' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      topic: 'payment',
      status: 'open',
      messages: [{ from: 'sender', authorName: 'Sarah', body: 'I paid but got no credits' }],
    });
  });

  it('lets a Buddy send one too', async () => {
    const { buddyToken } = await people();
    const { app } = createTestApp();

    const res = await request(app).post('/api/support/tickets').set('Authorization', `Bearer ${buddyToken}`).send({ topic: 'app', message: 'Calendar is blank' });

    expect(res.status).toBe(201);
  });

  it('can point at one of the sender’s own lessons, but not someone else’s', async () => {
    const { member, buddy, memberToken, otherToken } = await people();
    const lesson = await Lesson.create({ userId: member._id, buddyId: buddy._id, startTime: new Date(Date.now() + 864e5), meetingLink: 'https://zoom.us/j/1' });
    const { app } = createTestApp();

    const mine = await request(app).post('/api/support/tickets').set('Authorization', `Bearer ${memberToken}`).send({ topic: 'lesson', message: 'Buddy did not join', lessonId: lesson.id });
    const theirs = await request(app).post('/api/support/tickets').set('Authorization', `Bearer ${otherToken}`).send({ topic: 'lesson', message: 'x', lessonId: lesson.id });

    expect(mine.status).toBe(201);
    expect(mine.body.lesson).toMatchObject({ id: lesson.id, buddyName: 'Kenji' });
    expect(theirs.status).toBe(400);
  });

  it('refuses an unknown topic, an empty or too-long message, and Admins', async () => {
    const { memberToken, adminToken } = await people();
    const { app } = createTestApp();
    const send = (token: string, body: object) => request(app).post('/api/support/tickets').set('Authorization', `Bearer ${token}`).send(body);

    expect((await send(memberToken, { topic: 'nope', message: 'hi' })).status).toBe(400);
    expect((await send(memberToken, { topic: 'other', message: '   ' })).status).toBe(400);
    expect((await send(memberToken, { topic: 'other', message: 'x'.repeat(2001) })).status).toBe(400);
    expect((await send(adminToken, { topic: 'other', message: 'hi' })).status).toBe(403);
  });
});

describe('a sender’s own tickets', () => {
  it('lists only their own, most recently active first, and hides others’ tickets', async () => {
    const { memberToken, otherToken } = await people();
    const { app } = createTestApp();
    const first = await request(app).post('/api/support/tickets').set('Authorization', `Bearer ${memberToken}`).send({ topic: 'other', message: 'first' });
    await request(app).post('/api/support/tickets').set('Authorization', `Bearer ${memberToken}`).send({ topic: 'other', message: 'second' });
    await request(app).post(`/api/support/tickets/${first.body.id}/messages`).set('Authorization', `Bearer ${memberToken}`).send({ message: 'bump' });
    await request(app).post('/api/support/tickets').set('Authorization', `Bearer ${otherToken}`).send({ topic: 'other', message: 'tom’s' });

    const list = await request(app).get('/api/support/tickets').set('Authorization', `Bearer ${memberToken}`);
    expect(list.body.tickets.map((t: { messages: { body: string }[] }) => t.messages[0].body)).toEqual(['first', 'second']);

    const peek = await request(app).get(`/api/support/tickets/${first.body.id}`).set('Authorization', `Bearer ${otherToken}`);
    expect(peek.status).toBe(404);
  });
});

describe('the thread', () => {
  async function openTicket() {
    const p = await people();
    const created = createTestApp();
    const ticket = await request(created.app).post('/api/support/tickets').set('Authorization', `Bearer ${p.memberToken}`).send({ topic: 'payment', message: 'Help please' });
    return { ...p, ...created, ticketId: ticket.body.id as string };
  }

  it('an Admin reply marks it Answered, notifies the sender in the app and by email, and is audited', async () => {
    const { app, emailSender, member, adminToken, ticketId } = await openTicket();

    const res = await request(app).post(`/api/support/tickets/${ticketId}/messages`).set('Authorization', `Bearer ${adminToken}`).send({ message: 'Refunded now.' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('answered');
    expect(res.body.messages[1]).toMatchObject({ from: 'admin', authorName: 'Ada Admin', body: 'Refunded now.' });
    const [notification] = await Notification.find({ accountId: member._id });
    expect(notification.type).toBe('support_reply');
    expect(notification.details).toMatchObject({ ticketId });
    expect(notification.message).toContain('Refunded now.');
    expect(emailSender.sent.find((m) => m.to === 'sarah@example.com')!.body).toContain('Refunded now.');
    expect(await AuditEntry.countDocuments({ action: 'support.replied' })).toBe(1);
  });

  it('a sender reply sets it back to Open, even after it was closed', async () => {
    const { app, memberToken, adminToken, ticketId } = await openTicket();
    await request(app).patch(`/api/admin/support/tickets/${ticketId}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'closed' });

    const res = await request(app).post(`/api/support/tickets/${ticketId}/messages`).set('Authorization', `Bearer ${memberToken}`).send({ message: 'Still broken' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('open');
  });

  it('an Admin can close and reopen it, audited; others can’t', async () => {
    const { app, memberToken, adminToken, ticketId } = await openTicket();
    const setStatus = (token: string, status: string) =>
      request(app).patch(`/api/admin/support/tickets/${ticketId}`).set('Authorization', `Bearer ${token}`).send({ status });

    expect((await setStatus(memberToken, 'closed')).status).toBe(403);
    expect((await setStatus(adminToken, 'answered')).status).toBe(400);
    expect((await setStatus(adminToken, 'closed')).body.status).toBe('closed');
    expect((await setStatus(adminToken, 'open')).body.status).toBe('open');
    expect(await AuditEntry.countDocuments({ action: { $in: ['support.closed', 'support.reopened'] } })).toBe(2);
  });

  it('refuses an empty reply, and a reply from someone who isn’t the sender or an Admin', async () => {
    const { app, memberToken, otherToken, ticketId } = await openTicket();
    const reply = (token: string, message: string) => request(app).post(`/api/support/tickets/${ticketId}/messages`).set('Authorization', `Bearer ${token}`).send({ message });

    expect((await reply(memberToken, '  ')).status).toBe(400);
    expect((await reply(otherToken, 'hi')).status).toBe(404);
  });
});

describe('the Admin support queue', () => {
  it('filters by status, shows who sent each, and counts every status', async () => {
    const { app } = createTestApp();
    const { memberToken, buddyToken, adminToken } = await people();
    const a = await request(app).post('/api/support/tickets').set('Authorization', `Bearer ${memberToken}`).send({ topic: 'payment', message: 'one' });
    await request(app).post('/api/support/tickets').set('Authorization', `Bearer ${buddyToken}`).send({ topic: 'app', message: 'two' });
    await request(app).post(`/api/support/tickets/${a.body.id}/messages`).set('Authorization', `Bearer ${adminToken}`).send({ message: 'done' });

    const open = await request(app).get('/api/admin/support/tickets').query({ status: 'open' }).set('Authorization', `Bearer ${adminToken}`);
    expect(open.status).toBe(200);
    expect(open.body.counts).toEqual({ open: 1, answered: 1, closed: 0 });
    expect(open.body.tickets).toHaveLength(1);
    expect(open.body.tickets[0]).toMatchObject({ topic: 'app', sender: { name: 'Kenji', role: 'buddy', email: 'kenji@example.com' } });

    const all = await request(app).get('/api/admin/support/tickets').set('Authorization', `Bearer ${adminToken}`);
    expect(all.body.tickets).toHaveLength(2);
  });

  it('is Admin-only', async () => {
    const { memberToken } = await people();
    const { app } = createTestApp();

    expect((await request(app).get('/api/admin/support/tickets').set('Authorization', `Bearer ${memberToken}`)).status).toBe(403);
  });
});
