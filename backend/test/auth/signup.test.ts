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

describe('POST /auth/signup', () => {
  it('creates an unconfirmed User account and emails a confirmation link', async () => {
    const { app, emailSender } = createTestApp();

    const res = await request(app).post('/auth/signup').send(validSignup);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: validSignup.email });

    const account = await Account.findOne({ email: validSignup.email });
    expect(account).not.toBeNull();
    expect(account!.role).toBe('user');
    expect(account!.emailConfirmed).toBe(false);
    expect(account!.name).toBe(validSignup.name);
    expect(account!.passwordHash).toBeTruthy();
    expect(account!.passwordHash).not.toBe(validSignup.password);

    expect(emailSender.sent).toHaveLength(1);
    expect(emailSender.sent[0].to).toBe(validSignup.email);
  });

  it('rejects a signup with an email that is already registered', async () => {
    const { app } = createTestApp();
    await request(app).post('/auth/signup').send(validSignup);

    const res = await request(app).post('/auth/signup').send(validSignup);

    expect(res.status).toBe(409);
  });

  it('rejects a signup missing required fields', async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post('/auth/signup')
      .send({ email: 'incomplete@example.com', password: 'x' });

    expect(res.status).toBe(400);
  });
});
