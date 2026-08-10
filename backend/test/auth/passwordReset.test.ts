import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
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

describe('POST /auth/forgot-password', () => {
  it('emails a reset link for a known account', async () => {
    const { app, emailSender } = createTestApp();
    await request(app).post('/auth/signup').send(validSignup);

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: validSignup.email });

    expect(res.status).toBe(200);
    expect(emailSender.sent).toHaveLength(2); // signup confirmation + reset
    expect(emailSender.sent[1].body).toContain('token=');
  });

  it('returns 200 without leaking whether the email exists', async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
  });
});

describe('POST /auth/reset-password', () => {
  it('resets the password given a valid token, and the new password logs in', async () => {
    const { app, emailSender } = createTestApp();
    await request(app).post('/auth/signup').send(validSignup);
    await request(app).post('/auth/forgot-password').send({ email: validSignup.email });
    const resetToken = emailSender.sent[1].body.match(/token=([a-f0-9]+)/)![1];

    const resetRes = await request(app)
      .post('/auth/reset-password')
      .send({ token: resetToken, newPassword: 'a brand new password' });

    expect(resetRes.status).toBe(200);

    // Confirm email so we can isolate login behavior to the password change.
    const confirmToken = emailSender.sent[0].body.match(/token=([a-f0-9]+)/)![1];
    await request(app).get(`/auth/confirm-email?token=${confirmToken}`);

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: validSignup.email, password: 'a brand new password' });

    expect(loginRes.status).toBe(200);
  });

  it('rejects an invalid or expired token', async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'not-a-real-token', newPassword: 'whatever' });

    expect(res.status).toBe(400);
  });
});
