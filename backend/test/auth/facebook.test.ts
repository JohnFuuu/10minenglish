import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Account } from '../../src/models/Account.js';
import { hashPassword } from '../../src/services/password.js';
import { createTestApp } from '../testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

const sarah = { facebookId: 'fb-123', email: 'sarah@example.com', name: 'Sarah Lee' };

describe('POST /auth/facebook', () => {
  it('creates a new, already-confirmed User on first sign-in', async () => {
    const { app, facebookAuthClient } = createTestApp();
    facebookAuthClient.registerCode('good-code', sarah);

    const res = await request(app).post('/auth/facebook').send({ code: 'good-code' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body).toMatchObject({ role: 'user' });
    const account = await Account.findOne({ email: 'sarah@example.com' });
    expect(account!.facebookId).toBe('fb-123');
    expect(account!.name).toBe('Sarah Lee');
    expect(account!.emailConfirmed).toBe(true);
  });

  it('signs the same account in again on a later sign-in without duplicating it', async () => {
    const { app, facebookAuthClient } = createTestApp();
    facebookAuthClient.registerCode('code-1', sarah);
    facebookAuthClient.registerCode('code-2', { ...sarah, email: 'sarah.new@example.com' });

    await request(app).post('/auth/facebook').send({ code: 'code-1' });
    const res = await request(app).post('/auth/facebook').send({ code: 'code-2' });

    expect(res.status).toBe(200);
    expect(await Account.countDocuments()).toBe(1);
  });

  it('links to an existing password account with the same email and confirms it', async () => {
    const existing = await Account.create({
      role: 'user',
      email: 'sarah@example.com',
      name: 'Sarah Lee',
      passwordHash: await hashPassword('correct horse battery staple'),
      emailConfirmed: false,
    });
    const { app, facebookAuthClient } = createTestApp();
    facebookAuthClient.registerCode('good-code', sarah);

    const res = await request(app).post('/auth/facebook').send({ code: 'good-code' });

    expect(res.body.id).toBe(existing.id);
    const linked = await Account.findById(existing.id);
    expect(linked!.facebookId).toBe('fb-123');
    expect(linked!.emailConfirmed).toBe(true);
    expect(await Account.countDocuments()).toBe(1);
  });

  // Some Facebook accounts have no email (phone sign-ups), or the person
  // declined to share it. They get in, but can't book or buy credits until
  // they add and confirm one (requireConfirmedEmail).
  it('creates an email-less, unconfirmed User and signs them in when Facebook shares no email', async () => {
    const { app, facebookAuthClient } = createTestApp();
    facebookAuthClient.registerCode('no-email-code', { facebookId: 'fb-456', name: 'Phone Only' });

    const res = await request(app).post('/auth/facebook').send({ code: 'no-email-code' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    const account = await Account.findOne({ facebookId: 'fb-456' });
    expect(account!.email).toBeUndefined();
    expect(account!.emailConfirmed).toBe(false);
  });

  it('allows more than one email-less account', async () => {
    await Account.syncIndexes();
    const { app, facebookAuthClient } = createTestApp();
    facebookAuthClient.registerCode('code-a', { facebookId: 'fb-a', name: 'A' });
    facebookAuthClient.registerCode('code-b', { facebookId: 'fb-b', name: 'B' });

    const first = await request(app).post('/auth/facebook').send({ code: 'code-a' });
    const second = await request(app).post('/auth/facebook').send({ code: 'code-b' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await Account.countDocuments()).toBe(2);
  });

  it('rejects a code Facebook does not accept', async () => {
    const { app } = createTestApp();

    const res = await request(app).post('/auth/facebook').send({ code: 'forged-code' });

    expect(res.status).toBe(401);
  });

  it('rejects a request with no code', async () => {
    const { app } = createTestApp();

    const res = await request(app).post('/auth/facebook').send({});

    expect(res.status).toBe(400);
  });
});
