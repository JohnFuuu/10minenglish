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

describe('POST /api/payments/stripe/checkout', () => {
  it('rejects a non-user account', async () => {
    const buddy = await Account.create({ role: 'buddy', email: 'buddy@example.com' });
    const token = signAccountToken({ accountId: buddy.id, role: buddy.role });
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/payments/stripe/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packSize: 10 });

    expect(res.status).toBe(403);
  });

  it('rejects an invalid pack size', async () => {
    const { token } = await userToken();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/payments/stripe/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packSize: 7 });

    expect(res.status).toBe(400);
  });

  it('creates a pending Payment and returns a checkout URL', async () => {
    const { account, token } = await userToken();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/payments/stripe/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packSize: 10 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('checkoutUrl');

    const payment = await Payment.findOne({ accountId: account._id });
    expect(payment).not.toBeNull();
    expect(payment!.provider).toBe('stripe');
    expect(payment!.packSize).toBe(10);
    expect(payment!.status).toBe('pending');
  });
});

describe('POST /api/payments/stripe/confirm', () => {
  it('credits the account and marks the Payment succeeded when Stripe reports paid', async () => {
    const { account, token } = await userToken();
    const { app, stripeClient } = createTestApp();

    const checkoutRes = await request(app)
      .post('/api/payments/stripe/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packSize: 10 });
    const { sessionId } = checkoutRes.body;
    stripeClient.setStatus(sessionId, 'paid');

    const confirmRes = await request(app)
      .post('/api/payments/stripe/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body).toMatchObject({ status: 'succeeded', credits: 10 });

    const updated = await Account.findById(account._id);
    expect(updated!.credits).toBe(10);

    const payment = await Payment.findOne({ providerReference: sessionId });
    expect(payment!.status).toBe('succeeded');
  });

  it('does not double-credit on a second confirm of the same session', async () => {
    const { account, token } = await userToken();
    const { app, stripeClient } = createTestApp();

    const checkoutRes = await request(app)
      .post('/api/payments/stripe/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packSize: 10 });
    const { sessionId } = checkoutRes.body;
    stripeClient.setStatus(sessionId, 'paid');

    await request(app)
      .post('/api/payments/stripe/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId });
    await request(app)
      .post('/api/payments/stripe/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId });

    const updated = await Account.findById(account._id);
    expect(updated!.credits).toBe(10);
  });

  it('marks the Payment failed and adds no credits when Stripe reports unpaid', async () => {
    const { account, token } = await userToken();
    const { app, stripeClient } = createTestApp();

    const checkoutRes = await request(app)
      .post('/api/payments/stripe/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ packSize: 10 });
    const { sessionId } = checkoutRes.body;
    stripeClient.setStatus(sessionId, 'expired');

    const confirmRes = await request(app)
      .post('/api/payments/stripe/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId });

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body).toMatchObject({ status: 'failed' });

    const updated = await Account.findById(account._id);
    expect(updated!.credits).toBe(0);
  });

  it("rejects confirming another account's payment session", async () => {
    const { token: ownerToken } = await userToken({ email: 'owner@example.com' });
    const { token: attackerToken } = await userToken({ email: 'attacker@example.com' });
    const { app, stripeClient } = createTestApp();

    const checkoutRes = await request(app)
      .post('/api/payments/stripe/checkout')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ packSize: 10 });
    const { sessionId } = checkoutRes.body;
    stripeClient.setStatus(sessionId, 'paid');

    const confirmRes = await request(app)
      .post('/api/payments/stripe/confirm')
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ sessionId });

    expect(confirmRes.status).toBe(403);
  });

  it('404s for an unknown session id', async () => {
    const { token } = await userToken();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/payments/stripe/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId: 'not-a-real-session' });

    expect(res.status).toBe(404);
  });
});
