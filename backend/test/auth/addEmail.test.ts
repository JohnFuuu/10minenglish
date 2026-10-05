import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Account } from '../../src/models/Account.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import { createTestApp } from '../testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

// A Facebook sign-up that shared no email.
async function emailLessUser() {
  const account = await Account.create({ role: 'user', facebookId: 'fb-456', name: 'Phone Only' });
  return { account, token: signAccountToken({ accountId: account.id, role: account.role }) };
}

function extractToken(body: string): string {
  const match = body.match(/token=([a-f0-9]+)/);
  if (!match) throw new Error(`no token found in email body: ${body}`);
  return match[1];
}

describe('adding an email to an account that has none', () => {
  it('holds the address as pending and emails it a confirmation link', async () => {
    const { account, token } = await emailLessUser();
    const { app, emailSender } = createTestApp();

    const res = await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'Phone.Only@Example.com' });

    expect(res.status).toBe(200);
    const updated = await Account.findById(account.id);
    expect(updated!.email).toBeUndefined();
    expect(updated!.pendingEmail).toBe('phone.only@example.com');
    expect(emailSender.sent.map((m) => m.to)).toEqual(['phone.only@example.com']);
  });

  it('shows the pending address on /api/me so the app can say where the link went', async () => {
    const { token } = await emailLessUser();
    const { app } = createTestApp();
    await request(app).patch('/api/profile').set('Authorization', `Bearer ${token}`).send({ email: 'p@example.com' });

    const me = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);

    expect(me.body).toMatchObject({ pendingEmail: 'p@example.com', emailConfirmed: false });
    expect(me.body.email).toBeUndefined();
  });

  it('becomes the confirmed email once the link is clicked, unlocking booking', async () => {
    const { account, token } = await emailLessUser();
    const { app, emailSender } = createTestApp();
    await request(app).patch('/api/profile').set('Authorization', `Bearer ${token}`).send({ email: 'p@example.com' });

    await request(app).get(`/auth/confirm-email?token=${extractToken(emailSender.sent[0].body)}`);

    const updated = await Account.findById(account.id);
    expect(updated!.email).toBe('p@example.com');
    expect(updated!.pendingEmail).toBeUndefined();
    expect(updated!.emailConfirmed).toBe(true);
  });

  it('sends a fresh link when the same address is submitted again', async () => {
    const { token } = await emailLessUser();
    const { app, emailSender } = createTestApp();

    await request(app).patch('/api/profile').set('Authorization', `Bearer ${token}`).send({ email: 'p@example.com' });
    await request(app).patch('/api/profile').set('Authorization', `Bearer ${token}`).send({ email: 'p@example.com' });

    expect(emailSender.sent).toHaveLength(2);
  });

  it('refuses an address that already belongs to another account', async () => {
    await Account.create({ role: 'user', email: 'taken@example.com', emailConfirmed: true });
    const { token } = await emailLessUser();
    const { app, emailSender } = createTestApp();

    const res = await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'taken@example.com' });

    expect(res.status).toBe(409);
    expect(emailSender.sent).toHaveLength(0);
  });
});
