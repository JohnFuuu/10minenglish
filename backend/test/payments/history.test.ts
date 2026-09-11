import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Account } from '../../src/models/Account.js';
import { Payment } from '../../src/models/Payment.js';
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
  const account = await Account.create({ role: 'user', email: 'sarah@example.com', ...overrides });
  return { account, token: signAccountToken({ accountId: account.id, role: account.role }) };
}

describe('GET /api/payments/history', () => {
  it('rejects a request with no token', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/payments/history');
    expect(res.status).toBe(401);
  });

  it('rejects a non-user account', async () => {
    const buddy = await Account.create({ role: 'buddy', email: 'buddy@example.com' });
    const token = signAccountToken({ accountId: buddy.id, role: buddy.role });
    const { app } = createTestApp();

    const res = await request(app).get('/api/payments/history').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns only this account\'s payments, most recent first', async () => {
    const { account, token } = await userToken();
    const { account: other } = await userToken({ email: 'other@example.com' });

    const older = await Payment.create({
      accountId: account._id,
      provider: 'stripe',
      packSize: 10,
      priceCentsAtPurchase: 1000,
      status: 'succeeded',
      providerReference: 'sess-older',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    const newer = await Payment.create({
      accountId: account._id,
      provider: 'poli',
      packSize: 20,
      priceCentsAtPurchase: 2000,
      status: 'succeeded',
      providerReference: 'sess-newer',
      createdAt: new Date('2026-02-01T00:00:00Z'),
    });
    await Payment.create({
      accountId: other._id,
      provider: 'stripe',
      packSize: 30,
      priceCentsAtPurchase: 3000,
      status: 'succeeded',
      providerReference: 'sess-other-account',
    });

    const { app } = createTestApp();
    const res = await request(app).get('/api/payments/history').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.payments).toHaveLength(2);
    expect(res.body.payments[0]).toMatchObject({ id: newer.id, packSize: 20, status: 'succeeded' });
    expect(res.body.payments[1]).toMatchObject({ id: older.id, packSize: 10, status: 'succeeded' });
  });

  it('includes pending and failed payments alongside succeeded ones', async () => {
    const { account, token } = await userToken();
    await Payment.create({
      accountId: account._id,
      provider: 'stripe',
      packSize: 1,
      priceCentsAtPurchase: 100,
      status: 'pending',
      providerReference: 'sess-pending',
    });
    await Payment.create({
      accountId: account._id,
      provider: 'stripe',
      packSize: 1,
      priceCentsAtPurchase: 100,
      status: 'failed',
      providerReference: 'sess-failed',
    });

    const { app } = createTestApp();
    const res = await request(app).get('/api/payments/history').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const statuses = res.body.payments.map((p: { status: string }) => p.status).sort();
    expect(statuses).toEqual(['failed', 'pending']);
  });
});
