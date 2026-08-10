import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Account } from '../../src/models/Account.js';
import { createTestApp } from '../testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

describe('POST /auth/google', () => {
  it('creates a new, already-confirmed account on first sign-in', async () => {
    const { app, googleTokenVerifier } = createTestApp();
    googleTokenVerifier.registerToken('valid-id-token', {
      googleId: 'google-123',
      email: 'sarah@example.com',
      name: 'Sarah Lee',
    });

    const res = await request(app).post('/auth/google').send({ idToken: 'valid-id-token' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toMatchObject({ role: 'user' });

    const account = await Account.findOne({ email: 'sarah@example.com' });
    expect(account).not.toBeNull();
    expect(account!.emailConfirmed).toBe(true);
    expect(account!.googleId).toBe('google-123');
  });

  it('logs in the same account on a second sign-in without duplicating it', async () => {
    const { app, googleTokenVerifier } = createTestApp();
    googleTokenVerifier.registerToken('valid-id-token', {
      googleId: 'google-123',
      email: 'sarah@example.com',
      name: 'Sarah Lee',
    });

    await request(app).post('/auth/google').send({ idToken: 'valid-id-token' });
    const res = await request(app).post('/auth/google').send({ idToken: 'valid-id-token' });

    expect(res.status).toBe(200);
    const count = await Account.countDocuments({ email: 'sarah@example.com' });
    expect(count).toBe(1);
  });

  it('rejects an invalid Google token', async () => {
    const { app } = createTestApp();

    const res = await request(app).post('/auth/google').send({ idToken: 'garbage' });

    expect(res.status).toBe(401);
  });
});
