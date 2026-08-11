import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { Account } from '../../src/models/Account.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

describe('GET /api/buddies', () => {
  it('excludes Buddies with no Zoom link set', async () => {
    await Account.create({ role: 'buddy', email: 'no-link@example.com', name: 'No Link' });
    await Account.create({
      role: 'buddy',
      email: 'bookable@example.com',
      name: 'Bookable',
      zoomLink: 'https://zoom.us/j/1234567890',
    });
    const requester = await Account.create({ role: 'user', email: 'sarah@example.com' });
    const token = signAccountToken({ accountId: requester.id, role: requester.role });

    const app = createApp();
    const res = await request(app).get('/api/buddies').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.buddies).toHaveLength(1);
    expect(res.body.buddies[0]).toMatchObject({ name: 'Bookable' });
  });

  it('rejects a request with no token', async () => {
    const app = createApp();
    const res = await request(app).get('/api/buddies');

    expect(res.status).toBe(401);
  });
});
