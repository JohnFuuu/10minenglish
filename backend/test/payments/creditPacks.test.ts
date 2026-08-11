import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { Account } from '../../src/models/Account.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

async function tokenFor(role: 'user' | 'admin') {
  const account = await Account.create({ role, email: `${role}@example.com` });
  return signAccountToken({ accountId: account.id, role: account.role });
}

describe('GET /api/credit-packs', () => {
  it('returns all four pack sizes with default prices', async () => {
    const token = await tokenFor('user');
    const app = createApp();
    const res = await request(app).get('/api/credit-packs').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.packs).toHaveLength(4);
    expect(res.body.packs.map((p: { size: number }) => p.size).sort((a: number, b: number) => a - b)).toEqual([
      1, 10, 20, 30,
    ]);
  });

  it('rejects a request with no token', async () => {
    const app = createApp();
    const res = await request(app).get('/api/credit-packs');

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/admin/credit-packs/:size', () => {
  it('rejects a non-admin account', async () => {
    const token = await tokenFor('user');
    const app = createApp();
    const res = await request(app)
      .patch('/api/admin/credit-packs/10')
      .set('Authorization', `Bearer ${token}`)
      .send({ priceCents: 19900 });

    expect(res.status).toBe(403);
  });

  it('updates the price, visible on the next GET with no deploy', async () => {
    const adminToken = await tokenFor('admin');
    const userToken = await tokenFor('user');
    const app = createApp();

    const patchRes = await request(app)
      .patch('/api/admin/credit-packs/10')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ priceCents: 19900 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body).toMatchObject({ size: 10, priceCents: 19900 });

    const getRes = await request(app)
      .get('/api/credit-packs')
      .set('Authorization', `Bearer ${userToken}`);
    const pack10 = getRes.body.packs.find((p: { size: number }) => p.size === 10);
    expect(pack10.priceCents).toBe(19900);
  });

  it('rejects an invalid pack size', async () => {
    const adminToken = await tokenFor('admin');
    const app = createApp();
    const res = await request(app)
      .patch('/api/admin/credit-packs/7')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ priceCents: 19900 });

    expect(res.status).toBe(400);
  });
});
