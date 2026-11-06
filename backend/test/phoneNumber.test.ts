import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Account } from '../src/models/Account.js';
import { signAccountToken } from '../src/middleware/auth.js';
import { createTestApp } from './testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from './dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

async function login(role: 'user' | 'buddy', overrides: Record<string, unknown> = {}) {
  const account = await Account.create({ role, email: `${role}@example.com`, name: 'Pat', emailConfirmed: true, ...overrides });
  return { account, token: signAccountToken({ accountId: account.id, role }) };
}

// Members edit theirs at /api/profile, Buddies at /api/buddy/profile.
const PROFILE_PATH = { user: '/api/profile', buddy: '/api/buddy/profile' } as const;

describe.each(['user', 'buddy'] as const)('optional phone number — %s', (role) => {
  const path = PROFILE_PATH[role];

  it('saves a phone number, tidying the spacing, and returns it', async () => {
    const { account, token } = await login(role);
    const { app } = createTestApp();

    const res = await request(app).patch(path).set('Authorization', `Bearer ${token}`).send({ phoneNumber: '  +64 21  123 4567 ' });

    expect(res.status).toBe(200);
    expect((await Account.findById(account.id))!.phoneNumber).toBe('+64 21 123 4567');
    const got = await request(app).get(path).set('Authorization', `Bearer ${token}`);
    expect(got.body.phoneNumber).toBe('+64 21 123 4567');
  });

  it('clears the phone number when sent blank (it is optional)', async () => {
    const { account, token } = await login(role, { phoneNumber: '+64211234567' });
    const { app } = createTestApp();

    const res = await request(app).patch(path).set('Authorization', `Bearer ${token}`).send({ phoneNumber: '   ' });

    expect(res.status).toBe(200);
    expect((await Account.findById(account.id))!.phoneNumber).toBeUndefined();
  });

  it('rejects something that is not a phone number, changing nothing', async () => {
    const { account, token } = await login(role, { phoneNumber: '+64211234567' });
    const { app } = createTestApp();

    for (const phoneNumber of ['call me', '12', '+64 21 123 4567 ext 9', 'x'.repeat(40), 12345678]) {
      const res = await request(app).patch(path).set('Authorization', `Bearer ${token}`).send({ phoneNumber });
      expect(res.status, String(phoneNumber)).toBe(400);
    }
    expect((await Account.findById(account.id))!.phoneNumber).toBe('+64211234567');
  });

  it('leaves the phone number alone when the request does not mention it', async () => {
    const { account, token } = await login(role, { phoneNumber: '+64211234567' });
    const { app } = createTestApp();

    await request(app).patch(path).set('Authorization', `Bearer ${token}`).send({ name: 'Pat Two' });

    expect((await Account.findById(account.id))!.phoneNumber).toBe('+64211234567');
  });
});

describe('who sees a phone number', () => {
  it('does not show a Buddy\'s phone number to members in the Buddy list', async () => {
    await Account.create({ role: 'buddy', email: 'b@example.com', name: 'Bea', phoneNumber: '+64211234567', active: true, meetingLink: 'https://zoom.us/j/1', timezone: 'Pacific/Auckland' });
    const { token } = await login('user');
    const { app } = createTestApp();

    const res = await request(app).get('/api/buddies').set('Authorization', `Bearer ${token}`);

    expect(JSON.stringify(res.body)).toContain('Bea');
    expect(JSON.stringify(res.body)).not.toContain('1234567');
  });
});

describe('Admins see phone numbers', () => {
  async function adminToken() {
    const a = await Account.create({ role: 'admin', email: 'admin@10me.test', name: 'Ada' });
    return signAccountToken({ accountId: a.id, role: 'admin' });
  }

  it('in the member list', async () => {
    const token = await adminToken();
    await Account.create({ role: 'user', email: 'm@example.com', name: 'Mo', phoneNumber: '+64 21 123 4567' });
    const { app } = createTestApp();

    const res = await request(app).get('/api/admin/members').set('Authorization', `Bearer ${token}`);

    expect(res.body.members[0]).toMatchObject({ name: 'Mo', phoneNumber: '+64 21 123 4567' });
  });

  it('in a Buddy\'s details', async () => {
    const token = await adminToken();
    const buddy = await Account.create({ role: 'buddy', email: 'b@example.com', name: 'Bea', phoneNumber: '+64 21 765 4321' });
    const { app } = createTestApp();

    const res = await request(app).get(`/api/admin/buddies/${buddy.id}`).set('Authorization', `Bearer ${token}`);

    expect(res.body.phoneNumber).toBe('+64 21 765 4321');
  });
});
