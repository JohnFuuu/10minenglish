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

  it('signs the new User straight in, before they confirm their email', async () => {
    const { app } = createTestApp();

    const res = await request(app).post('/auth/signup').send(validSignup);

    expect(res.body.token).toBeTruthy();
    const me = await request(app).get('/api/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ role: 'user', emailConfirmed: false });
  });

  // The banner on the Dashboard lets them resend, so a delivery hiccup
  // shouldn't stop the account being created and signed in.
  it('still creates and signs in the User when the confirmation email fails to send', async () => {
    const { app, emailSender } = createTestApp();
    emailSender.send = async () => {
      throw new Error('Resend is down');
    };

    const res = await request(app).post('/auth/signup').send(validSignup);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(await Account.countDocuments({ email: validSignup.email })).toBe(1);
  });

  it('rejects a signup with an email that is already registered and confirmed', async () => {
    const { app } = createTestApp();
    await request(app).post('/auth/signup').send(validSignup);
    await Account.updateOne({ email: validSignup.email }, { emailConfirmed: true });

    const res = await request(app).post('/auth/signup').send(validSignup);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Email already registered');
  });

  it('re-sends the confirmation email when an unconfirmed email signs up again', async () => {
    const { app, emailSender } = createTestApp();
    await request(app).post('/auth/signup').send(validSignup);

    const res = await request(app).post('/auth/signup').send(validSignup);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('EMAIL_NOT_CONFIRMED');
    expect(emailSender.sent).toHaveLength(2);
    expect(emailSender.sent[1].to).toBe(validSignup.email);
    expect(await Account.countDocuments({ email: validSignup.email })).toBe(1);
  });

  it('rejects a signup missing required fields', async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post('/auth/signup')
      .send({ email: 'incomplete@example.com', password: 'x' });

    expect(res.status).toBe(400);
  });
});
