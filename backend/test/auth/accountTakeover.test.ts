import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
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

// Account pre-hijacking: someone signs up with another person's email and a
// password of their own, never confirming it. When the real owner later
// signs in with Google or Facebook (which prove the email), they get the
// account — and the squatter's password and logins must stop working.

const EMAIL = 'aaaa@gmail.com';
const SQUATTER_PASSWORD = 'squatter-password-123';

// A login token issued a minute ago, like one the squatter got at sign-up.
function earlierToken(accountId: string) {
  return jwt.sign({ accountId, role: 'user', iat: Math.floor(Date.now() / 1000) - 60 }, 'test-secret', { expiresIn: '7d' });
}

async function passwordAccount(emailConfirmed: boolean) {
  return Account.create({
    role: 'user',
    email: EMAIL,
    name: 'Squatter',
    passwordHash: await hashPassword(SQUATTER_PASSWORD),
    emailConfirmed,
    passwordResetToken: 'pending-reset',
    passwordResetExpires: new Date(Date.now() + 3_600_000),
  });
}

const providers = [
  {
    name: 'Google',
    signIn: async (setup: ReturnType<typeof createTestApp>) => {
      setup.googleTokenVerifier.registerToken('owner-token', { googleId: 'g-1', email: EMAIL, name: 'Owner' });
      return request(setup.app).post('/auth/google').send({ idToken: 'owner-token' });
    },
  },
  {
    name: 'Facebook',
    signIn: async (setup: ReturnType<typeof createTestApp>) => {
      setup.facebookAuthClient.registerCode('owner-code', { facebookId: 'fb-1', email: EMAIL, name: 'Owner' });
      return request(setup.app).post('/auth/facebook').send({ code: 'owner-code' });
    },
  },
];

describe.each(providers)('$name sign-in to an email someone else registered', ({ signIn }) => {
  it('takes back an UNCONFIRMED account: the old password and old logins stop working', async () => {
    const squatted = await passwordAccount(false);
    const squatterSession = earlierToken(squatted.id);
    const setup = createTestApp();

    const res = await signIn(setup);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(squatted.id);
    const account = await Account.findById(squatted.id);
    expect(account!.emailConfirmed).toBe(true);
    expect(account!.passwordHash).toBeUndefined();
    expect(account!.passwordResetToken).toBeUndefined();

    const squatterLogin = await request(setup.app).post('/auth/login').send({ email: EMAIL, password: SQUATTER_PASSWORD });
    expect(squatterLogin.status).toBe(401);
    const squatterRequest = await request(setup.app).get('/api/me').set('Authorization', `Bearer ${squatterSession}`);
    expect(squatterRequest.status).toBe(401);

    // The owner's own fresh login works.
    const ownerRequest = await request(setup.app).get('/api/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(ownerRequest.status).toBe(200);
  });

  it('links a CONFIRMED account without touching its password or logins', async () => {
    const owned = await passwordAccount(true);
    const existingSession = earlierToken(owned.id);
    const setup = createTestApp();

    const res = await signIn(setup);

    expect(res.body.id).toBe(owned.id);
    expect((await request(setup.app).post('/auth/login').send({ email: EMAIL, password: SQUATTER_PASSWORD })).status).toBe(200);
    expect((await request(setup.app).get('/api/me').set('Authorization', `Bearer ${existingSession}`)).status).toBe(200);
  });
});
