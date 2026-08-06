import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Account } from '../src/models/Account.js';
import { signAccountToken } from '../src/middleware/auth.js';
import { clearTestDb, startTestDb, stopTestDb } from './dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

describe('GET /api/me', () => {
  it('rejects a request with no token', async () => {
    const app = createApp();
    const res = await request(app).get('/api/me');

    expect(res.status).toBe(401);
  });

  it('rejects a request with an invalid token', async () => {
    const app = createApp();
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer garbage');

    expect(res.status).toBe(401);
  });

  it('returns the account id and role for a valid token', async () => {
    const account = await Account.create({ role: 'buddy', email: 'buddy@example.com' });
    const token = signAccountToken({ accountId: account.id, role: account.role });

    const app = createApp();
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: account.id, role: 'buddy' });
  });
});
