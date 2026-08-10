import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp, type FakeEmailSender } from '../testApp.js';
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

async function signUpAndConfirm(app: Express, emailSender: FakeEmailSender) {
  await request(app).post('/auth/signup').send(validSignup);
  const token = emailSender.sent[0].body.match(/token=([a-f0-9]+)/)![1];
  await request(app).get(`/auth/confirm-email?token=${token}`);
}

describe('POST /auth/login', () => {
  it('rejects login before the email is confirmed, with a resend hint', async () => {
    const { app, emailSender } = createTestApp();
    await request(app).post('/auth/signup').send(validSignup);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: validSignup.email, password: validSignup.password });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'EMAIL_NOT_CONFIRMED' });
    expect(emailSender.sent).toHaveLength(1);
  });

  it('logs in successfully with the correct password once confirmed', async () => {
    const { app, emailSender } = createTestApp();
    await signUpAndConfirm(app, emailSender);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: validSignup.email, password: validSignup.password });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toMatchObject({ role: 'user' });
  });

  it('rejects an unknown email', async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever' });

    expect(res.status).toBe(401);
  });

  it('rejects the wrong password', async () => {
    const { app, emailSender } = createTestApp();
    await signUpAndConfirm(app, emailSender);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: validSignup.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('locks the account for 15 minutes after 5 failed attempts', async () => {
    const { app, emailSender } = createTestApp();
    await signUpAndConfirm(app, emailSender);

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: validSignup.email, password: 'wrong-password' });
      expect(res.status).toBe(401);
    }

    // 6th attempt, even with the CORRECT password, is now locked out.
    const lockedRes = await request(app)
      .post('/auth/login')
      .send({ email: validSignup.email, password: validSignup.password });

    expect(lockedRes.status).toBe(423);
    expect(lockedRes.body).toHaveProperty('lockedUntil');
  });
});
