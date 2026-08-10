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

const validSignup = {
  name: 'Sarah Lee',
  email: 'sarah@example.com',
  password: 'correct horse battery staple',
  phoneNumber: '+64211234567',
  location: 'Auckland, NZ',
  nationality: 'New Zealander',
  dateOfBirth: '1995-03-14',
  learningGoals: ['Build confidence speaking English'],
};

function extractToken(body: string): string {
  const match = body.match(/token=([a-f0-9]+)/);
  if (!match) throw new Error(`no token found in email body: ${body}`);
  return match[1];
}

describe('GET /auth/confirm-email', () => {
  it('confirms the account for a valid token', async () => {
    const { app, emailSender } = createTestApp();
    await request(app).post('/auth/signup').send(validSignup);
    const token = extractToken(emailSender.sent[0].body);

    const res = await request(app).get(`/auth/confirm-email?token=${token}`);

    expect(res.status).toBe(200);
    const account = await Account.findOne({ email: validSignup.email });
    expect(account!.emailConfirmed).toBe(true);
    expect(account!.emailConfirmationToken).toBeUndefined();
  });

  it('rejects an invalid token', async () => {
    const { app } = createTestApp();

    const res = await request(app).get('/auth/confirm-email?token=not-a-real-token');

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/resend-confirmation', () => {
  it('sends a new confirmation email for an unconfirmed account', async () => {
    const { app, emailSender } = createTestApp();
    await request(app).post('/auth/signup').send(validSignup);

    const res = await request(app)
      .post('/auth/resend-confirmation')
      .send({ email: validSignup.email });

    expect(res.status).toBe(200);
    expect(emailSender.sent).toHaveLength(2);
  });

  it('returns 200 without leaking whether the email exists', async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post('/auth/resend-confirmation')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
  });
});
