import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Account } from '../src/models/Account.js';
import { signAccountToken } from '../src/middleware/auth.js';
import { hashPassword } from '../src/services/password.js';
import { createTestApp } from './testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from './dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

const PASSWORD = 'correct horse battery staple';

async function createUser(overrides: Record<string, unknown> = {}) {
  const account = await Account.create({
    role: 'user',
    name: 'Sarah Lee',
    email: 'sarah@example.com',
    passwordHash: await hashPassword(PASSWORD),
    phoneNumber: '+64211234567',
    location: 'Auckland, NZ',
    nationality: 'New Zealander',
    dateOfBirth: new Date('1995-03-14'),
    learningGoals: ['Build confidence speaking English'],
    emailConfirmed: true,
    ...overrides,
  });
  return { account, token: signAccountToken({ accountId: account.id, role: account.role }) };
}

function extractToken(body: string): string {
  const match = body.match(/token=([a-f0-9]+)/);
  if (!match) throw new Error(`no token found in email body: ${body}`);
  return match[1];
}

describe('GET /api/profile', () => {
  it('rejects a request with no token', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/profile');

    expect(res.status).toBe(401);
  });

  it('rejects a Buddy account', async () => {
    const buddy = await Account.create({ role: 'buddy', email: 'maria@example.com' });
    const token = signAccountToken({ accountId: buddy.id, role: buddy.role });

    const { app } = createTestApp();
    const res = await request(app).get('/api/profile').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("returns the User's current field values", async () => {
    const { token } = await createUser({ picture: 'https://example.com/sarah.jpg' });

    const { app } = createTestApp();
    const res = await request(app).get('/api/profile').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'Sarah Lee',
      email: 'sarah@example.com',
      picture: 'https://example.com/sarah.jpg',
      phoneNumber: '+64211234567',
      location: 'Auckland, NZ',
      nationality: 'New Zealander',
      dateOfBirth: '1995-03-14',
      learningGoals: ['Build confidence speaking English'],
      hasPassword: true,
    });
  });

  it('reports no password for a Google-only account', async () => {
    const account = await Account.create({
      role: 'user',
      email: 'google-sarah@example.com',
      googleId: 'google-123',
      emailConfirmed: true,
    });
    const token = signAccountToken({ accountId: account.id, role: account.role });

    const { app } = createTestApp();
    const res = await request(app).get('/api/profile').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.hasPassword).toBe(false);
  });
});

describe('PATCH /api/profile', () => {
  it('updates the editable fields and persists them', async () => {
    const { account, token } = await createUser();

    const { app } = createTestApp();
    const res = await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Sarah Lee-Wong',
        phoneNumber: '+64277654321',
        location: 'Wellington, NZ',
        nationality: 'Malaysian',
        dateOfBirth: '1994-12-01',
        learningGoals: ['Improve my pronunciation', 'Expand my vocabulary'],
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Sarah Lee-Wong', dateOfBirth: '1994-12-01' });

    const updated = await Account.findById(account.id);
    expect(updated!.name).toBe('Sarah Lee-Wong');
    expect(updated!.location).toBe('Wellington, NZ');
    expect(updated!.learningGoals).toEqual(['Improve my pronunciation', 'Expand my vocabulary']);
  });

  it('leaves fields the request omitted untouched', async () => {
    const { account, token } = await createUser();

    const { app } = createTestApp();
    await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ location: 'Christchurch, NZ' });

    const updated = await Account.findById(account.id);
    expect(updated!.location).toBe('Christchurch, NZ');
    expect(updated!.name).toBe('Sarah Lee');
    expect(updated!.phoneNumber).toBe('+64211234567');
  });

  it('rejects blanking a field signup requires, without changing the account', async () => {
    const { account, token } = await createUser();

    const { app } = createTestApp();
    const res = await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '   ' });

    expect(res.status).toBe(400);
    const unchanged = await Account.findById(account.id);
    expect(unchanged!.name).toBe('Sarah Lee');
  });

  it('rejects an empty learning goals list', async () => {
    const { token } = await createUser();

    const { app } = createTestApp();
    const res = await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ learningGoals: [] });

    expect(res.status).toBe(400);
  });

  it('rejects an unparseable date of birth', async () => {
    const { token } = await createUser();

    const { app } = createTestApp();
    const res = await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ dateOfBirth: 'not-a-date' });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/profile — changing email', () => {
  it('keeps the current email active and emails a confirmation link to the new address', async () => {
    const { account, token } = await createUser();

    const { app, emailSender } = createTestApp();
    const res = await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'sarah.new@example.com' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email: 'sarah@example.com',
      pendingEmail: 'sarah.new@example.com',
    });

    const updated = await Account.findById(account.id);
    expect(updated!.email).toBe('sarah@example.com');
    expect(updated!.pendingEmail).toBe('sarah.new@example.com');

    expect(emailSender.sent).toHaveLength(1);
    expect(emailSender.sent[0].to).toBe('sarah.new@example.com');
  });

  it('switches the email once the new address is confirmed', async () => {
    const { account, token } = await createUser();

    const { app, emailSender } = createTestApp();
    await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'sarah.new@example.com' });

    const confirmToken = extractToken(emailSender.sent[0].body);
    const res = await request(app).get(`/auth/confirm-email?token=${confirmToken}`);

    expect(res.status).toBe(200);
    const updated = await Account.findById(account.id);
    expect(updated!.email).toBe('sarah.new@example.com');
    expect(updated!.pendingEmail).toBeUndefined();
    expect(updated!.emailConfirmed).toBe(true);
  });

  it('lets the User log in with the new email, and not the old one, after confirming', async () => {
    const { token } = await createUser();

    const { app, emailSender } = createTestApp();
    await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'sarah.new@example.com' });
    await request(app).get(`/auth/confirm-email?token=${extractToken(emailSender.sent[0].body)}`);

    const withNew = await request(app)
      .post('/auth/login')
      .send({ email: 'sarah.new@example.com', password: PASSWORD });
    expect(withNew.status).toBe(200);

    const withOld = await request(app)
      .post('/auth/login')
      .send({ email: 'sarah@example.com', password: PASSWORD });
    expect(withOld.status).toBe(401);
  });

  it('still lets the User log in with the old email while the change is unconfirmed', async () => {
    const { token } = await createUser();

    const { app } = createTestApp();
    await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'sarah.new@example.com' });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'sarah@example.com', password: PASSWORD });

    expect(res.status).toBe(200);
  });

  it('rejects an email already registered to another account', async () => {
    const { account, token } = await createUser();
    await Account.create({ role: 'user', email: 'taken@example.com' });

    const { app, emailSender } = createTestApp();
    const res = await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'taken@example.com' });

    expect(res.status).toBe(409);
    const unchanged = await Account.findById(account.id);
    expect(unchanged!.pendingEmail).toBeUndefined();
    expect(emailSender.sent).toHaveLength(0);
  });

  it('rejects an email another account is already waiting to confirm', async () => {
    const { token } = await createUser();
    await Account.create({
      role: 'user',
      email: 'other@example.com',
      pendingEmail: 'contested@example.com',
    });

    const { app } = createTestApp();
    const res = await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'contested@example.com' });

    expect(res.status).toBe(409);
  });

  it('keeps the old email if the new address is claimed before confirmation', async () => {
    const { account, token } = await createUser();

    const { app, emailSender } = createTestApp();
    await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'sarah.new@example.com' });

    // Someone else registers the address in the window before confirmation.
    await Account.create({ role: 'user', email: 'sarah.new@example.com' });

    const res = await request(app).get(
      `/auth/confirm-email?token=${extractToken(emailSender.sent[0].body)}`,
    );

    expect(res.status).toBe(409);
    const unchanged = await Account.findById(account.id);
    expect(unchanged!.email).toBe('sarah@example.com');
  });

  it('does not send a confirmation when the email is unchanged', async () => {
    const { token } = await createUser();

    const { app, emailSender } = createTestApp();
    const res = await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'sarah@example.com', name: 'Sarah L' });

    expect(res.status).toBe(200);
    expect(res.body.pendingEmail).toBeUndefined();
    expect(emailSender.sent).toHaveLength(0);
  });
});

describe('PATCH /api/profile/password', () => {
  it('rejects an incorrect current password', async () => {
    const { token } = await createUser();

    const { app } = createTestApp();
    const res = await request(app)
      .patch('/api/profile/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrong password', newPassword: 'a brand new password' });

    expect(res.status).toBe(400);

    const stillOld = await request(app)
      .post('/auth/login')
      .send({ email: 'sarah@example.com', password: PASSWORD });
    expect(stillOld.status).toBe(200);
  });

  it('changes the password so the new one logs in and the old one does not', async () => {
    const { token } = await createUser();

    const { app } = createTestApp();
    const res = await request(app)
      .patch('/api/profile/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: PASSWORD, newPassword: 'a brand new password' });

    expect(res.status).toBe(200);

    const withNew = await request(app)
      .post('/auth/login')
      .send({ email: 'sarah@example.com', password: 'a brand new password' });
    expect(withNew.status).toBe(200);

    const withOld = await request(app)
      .post('/auth/login')
      .send({ email: 'sarah@example.com', password: PASSWORD });
    expect(withOld.status).toBe(401);
  });

  it('rejects a Google-only account that has no password to verify', async () => {
    const account = await Account.create({
      role: 'user',
      email: 'google-sarah@example.com',
      googleId: 'google-123',
      emailConfirmed: true,
    });
    const token = signAccountToken({ accountId: account.id, role: account.role });

    const { app } = createTestApp();
    const res = await request(app)
      .patch('/api/profile/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'anything', newPassword: 'a brand new password' });

    expect(res.status).toBe(400);
  });
});
