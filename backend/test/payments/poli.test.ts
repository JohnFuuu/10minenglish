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

describe('POST /api/payments/poli/checkout', () => {
  it('rejects a User whose location is not New Zealand', async () => {
    const { token } = await userToken({ location: 'London, UK' });
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/payments/poli/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packSize: 10 });

    expect(res.status).toBe(403);
  });

  it('creates a pending Payment and returns a navigate URL for an NZ-located User', async () => {
    const { account, token } = await userToken({ location: 'Auckland, NZ' });
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/payments/poli/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packSize: 10 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('navigateUrl');

    const payment = await Payment.findOne({ accountId: account._id });
    expect(payment!.provider).toBe('poli');
    expect(payment!.status).toBe('pending');
  });
});

describe('POST /api/payments/poli/confirm', () => {
  it('credits the account when POLi reports the transaction completed', async () => {
    const { account, token } = await userToken({ location: 'Auckland, NZ' });
    const { app, poliClient } = createTestApp();

    const checkoutRes = await request(app)
      .post('/api/payments/poli/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packSize: 10 });
    const { token: poliToken } = checkoutRes.body;
    poliClient.setStatus(poliToken, 'completed');

    const confirmRes = await request(app)
      .post('/api/payments/poli/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: poliToken });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body).toMatchObject({ status: 'succeeded', credits: 10 });

    const updated = await Account.findById(account._id);
    expect(updated!.credits).toBe(10);
  });

  it('resolves to the same failed outcome as Stripe when POLi reports failure', async () => {
    const { account, token } = await userToken({ location: 'Auckland, NZ' });
    const { app, poliClient } = createTestApp();

    const checkoutRes = await request(app)
      .post('/api/payments/poli/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packSize: 10 });
    const { token: poliToken } = checkoutRes.body;
    poliClient.setStatus(poliToken, 'failed');

    const confirmRes = await request(app)
      .post('/api/payments/poli/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: poliToken });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body).toMatchObject({ status: 'failed' });

    const updated = await Account.findById(account._id);
    expect(updated!.credits).toBe(0);
  });
});
