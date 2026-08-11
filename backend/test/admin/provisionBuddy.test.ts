import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { Account } from '../../src/models/Account.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import { verifyPassword } from '../../src/services/password.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

const buddyPayload = {
  name: 'Maria Santos',
  email: 'maria@example.com',
  password: 'buddy-starter-password',
};

async function tokenFor(role: 'admin' | 'user') {
  const account = await Account.create({ role, email: `${role}@example.com` });
  return signAccountToken({ accountId: account.id, role: account.role });
}

describe('POST /api/admin/buddies', () => {
  it('rejects a request with no token', async () => {
    const app = createApp();
    const res = await request(app).post('/api/admin/buddies').send(buddyPayload);

    expect(res.status).toBe(401);
  });

  it('rejects a non-admin account', async () => {
    const token = await tokenFor('user');
    const app = createApp();
    const res = await request(app)
      .post('/api/admin/buddies')
      .set('Authorization', `Bearer ${token}`)
      .send(buddyPayload);

    expect(res.status).toBe(403);
  });

  it('creates a Buddy account, pre-confirmed, as an admin', async () => {
    const token = await tokenFor('admin');
    const app = createApp();
    const res = await request(app)
      .post('/api/admin/buddies')
      .set('Authorization', `Bearer ${token}`)
      .send(buddyPayload);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: buddyPayload.email, role: 'buddy' });

    const buddy = await Account.findOne({ email: buddyPayload.email });
    expect(buddy).not.toBeNull();
    expect(buddy!.role).toBe('buddy');
    expect(buddy!.emailConfirmed).toBe(true);
    expect(buddy!.name).toBe(buddyPayload.name);
    expect(await verifyPassword(buddyPayload.password, buddy!.passwordHash!)).toBe(true);
  });

  it('rejects an email that is already registered', async () => {
    const token = await tokenFor('admin');
    await Account.create({ role: 'user', email: buddyPayload.email });

    const app = createApp();
    const res = await request(app)
      .post('/api/admin/buddies')
      .set('Authorization', `Bearer ${token}`)
      .send(buddyPayload);

    expect(res.status).toBe(409);
  });

  it('lets the newly provisioned Buddy log in via the shared login endpoint', async () => {
    const token = await tokenFor('admin');
    const app = createApp();
    await request(app)
      .post('/api/admin/buddies')
      .set('Authorization', `Bearer ${token}`)
      .send(buddyPayload);

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: buddyPayload.email, password: buddyPayload.password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toMatchObject({ role: 'buddy' });
  });
});

describe('POST /auth/signup', () => {
  it('ignores a client-supplied role and always creates a User account', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/auth/signup')
      .send({
        name: 'Sneaky',
        email: 'sneaky@example.com',
        password: 'correct horse battery staple',
        phoneNumber: '+64211234567',
        location: 'Auckland, NZ',
        nationality: 'New Zealander',
        dateOfBirth: '1995-03-14',
        learningGoals: ['Build confidence speaking English'],
        role: 'buddy',
      });

    expect(res.status).toBe(201);
    const account = await Account.findOne({ email: 'sneaky@example.com' });
    expect(account!.role).toBe('user');
  });
});
