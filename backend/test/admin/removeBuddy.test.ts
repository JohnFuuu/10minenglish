import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Account } from '../../src/models/Account.js';
import { AuditEntry } from '../../src/models/AuditEntry.js';
import { Lesson } from '../../src/models/Lesson.js';
import { hashPassword } from '../../src/services/password.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import { createTestApp } from '../testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

const PASSWORD = 'StarterPass1!';
const DAY = 24 * 60 * 60 * 1000;

async function setup() {
  const admin = await Account.create({ role: 'admin', email: 'ada@10me.test', name: 'Ada Admin' });
  const buddy = await Account.create({
    role: 'buddy',
    email: 'maria@example.com',
    name: 'Maria',
    passwordHash: await hashPassword(PASSWORD),
    emailConfirmed: true,
    meetingLink: 'https://zoom.us/j/1',
    timezone: 'Pacific/Auckland',
  });
  const user = await Account.create({ role: 'user', email: 'sarah@example.com', name: 'Sarah', emailConfirmed: true, credits: 1 });
  const lesson = (offsetMs: number, status: 'upcoming' | 'completed') =>
    Lesson.create({ userId: user._id, buddyId: buddy._id, startTime: new Date(Date.now() + offsetMs), durationMinutes: 10, status, meetingLink: 'https://zoom.us/j/1' });
  const { app } = createTestApp();
  const asAdmin = (method: 'get' | 'delete', path: string) =>
    request(app)[method](path).set('Authorization', `Bearer ${signAccountToken({ accountId: admin.id, role: 'admin' })}`);
  return { admin, buddy, user, lesson, app, asAdmin };
}

describe('DELETE /api/admin/buddies/:id (archive)', () => {
  it('refuses a non-Admin', async () => {
    const { buddy, user, app } = await setup();

    const res = await request(app)
      .delete(`/api/admin/buddies/${buddy.id}`)
      .set('Authorization', `Bearer ${signAccountToken({ accountId: user.id, role: 'user' })}`);

    expect(res.status).toBe(403);
    expect((await Account.findById(buddy._id))!.removedAt).toBeUndefined();
  });

  it('archives the Buddy, cancelling and refunding upcoming Lessons, and audits it', async () => {
    const { buddy, user, lesson, asAdmin } = await setup();
    const upcoming = await lesson(2 * DAY, 'upcoming');
    const past = await lesson(-2 * DAY, 'completed');

    const res = await asAdmin('delete', `/api/admin/buddies/${buddy.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: buddy.id, cancelledLessons: 1 });
    const archived = await Account.findById(buddy._id);
    expect(archived!.removedAt).toBeInstanceOf(Date);
    expect(archived!.active).toBe(false);
    expect((await Lesson.findById(upcoming._id))!.status).toBe('cancelled');
    expect((await Lesson.findById(past._id))!.status).toBe('completed');
    expect((await Account.findById(user._id))!.credits).toBe(2);
    const audit = await AuditEntry.find().lean();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'buddy.removed', target: { type: 'buddy', id: buddy.id, label: 'Maria' }, details: { cancelledLessons: 1 } });
  });

  it('drops the Buddy from the Admin roster but keeps their name on Users’ past Lessons', async () => {
    const { buddy, user, lesson, app, asAdmin } = await setup();
    await lesson(-2 * DAY, 'completed');

    await asAdmin('delete', `/api/admin/buddies/${buddy.id}`);
    const roster = await asAdmin('get', '/api/admin/buddies');
    const history = await request(app).get('/api/lessons').set('Authorization', `Bearer ${signAccountToken({ accountId: user.id, role: 'user' })}`);

    expect(roster.body.buddies).toEqual([]);
    expect(JSON.stringify(history.body)).toContain('Maria');
  });

  it('locks the Buddy out: no password login, and an existing session stops working', async () => {
    const { buddy, app, asAdmin } = await setup();
    const oldToken = signAccountToken({ accountId: buddy.id, role: 'buddy' });

    await asAdmin('delete', `/api/admin/buddies/${buddy.id}`);
    const login = await request(app).post('/auth/login').send({ email: 'maria@example.com', password: PASSWORD });
    const profile = await request(app).get('/api/buddy/profile').set('Authorization', `Bearer ${oldToken}`);
    const me = await request(app).get('/api/me').set('Authorization', `Bearer ${oldToken}`);

    expect(login.status).toBe(403);
    expect(login.body.error).toBe('ACCOUNT_REMOVED');
    expect(profile.status).toBe(401);
    expect(me.status).toBe(401);
  });

  it('locks the Buddy out of Google and Facebook sign-in too', async () => {
    const { buddy, asAdmin } = await setup();
    await asAdmin('delete', `/api/admin/buddies/${buddy.id}`);
    const { app, googleTokenVerifier, facebookAuthClient } = createTestApp();
    googleTokenVerifier.registerToken('g', { googleId: 'g-1', email: 'maria@example.com', name: 'Maria' });
    facebookAuthClient.registerCode('f', { facebookId: 'f-1', email: 'maria@example.com', name: 'Maria' });

    const google = await request(app).post('/auth/google').send({ idToken: 'g' });
    const facebook = await request(app).post('/auth/facebook').send({ code: 'f' });

    expect(google.status).toBe(403);
    expect(facebook.status).toBe(403);
  });

  // A repeat finishes any clean-up an interrupted removal left behind (#29),
  // so it succeeds — but it is not a second removal.
  it('treats a repeat removal as a no-op success, and 404s unknown, malformed, or non-Buddy targets', async () => {
    const { buddy, user, asAdmin } = await setup();

    const first = await asAdmin('delete', `/api/admin/buddies/${buddy.id}`);
    const again = await asAdmin('delete', `/api/admin/buddies/${buddy.id}`);
    const unknown = await asAdmin('delete', '/api/admin/buddies/0123456789abcdef01234567');
    const malformed = await asAdmin('delete', '/api/admin/buddies/not-an-id');
    const notBuddy = await asAdmin('delete', `/api/admin/buddies/${user.id}`);

    expect(first.status).toBe(200);
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ id: buddy.id, cancelledLessons: 0 });
    expect([unknown.status, malformed.status, notBuddy.status]).toEqual([404, 404, 404]);
    expect(await AuditEntry.countDocuments({ action: 'buddy.removed' })).toBe(1);
  });

  it('records only one removal for two identical concurrent requests', async () => {
    const { buddy, asAdmin } = await setup();

    const results = await Promise.all([asAdmin('delete', `/api/admin/buddies/${buddy.id}`), asAdmin('delete', `/api/admin/buddies/${buddy.id}`)]);

    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(await AuditEntry.countDocuments({ action: 'buddy.removed' })).toBe(1);
  });
});
