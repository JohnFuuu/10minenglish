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

async function buddyToken() {
  const account = await Account.create({ role: 'buddy', email: 'maria@example.com', name: 'Maria' });
  return { account, token: signAccountToken({ accountId: account.id, role: account.role }) };
}

describe('GET /api/buddy/profile', () => {
  it('rejects a non-buddy account', async () => {
    const user = await Account.create({ role: 'user', email: 'sarah@example.com' });
    const token = signAccountToken({ accountId: user.id, role: user.role });

    const app = createApp();
    const res = await request(app).get('/api/buddy/profile').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("returns the buddy's own profile", async () => {
    const { token } = await buddyToken();
    const app = createApp();
    const res = await request(app).get('/api/buddy/profile').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Maria', email: 'maria@example.com' });
  });
});

describe('PATCH /api/buddy/profile', () => {
  it('updates name, picture, bio, location, timezone, and zoom link', async () => {
    const { account, token } = await buddyToken();
    const app = createApp();

    const res = await request(app)
      .patch('/api/buddy/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Maria Santos',
        picture: 'https://example.com/maria.jpg',
        bio: 'I love teaching conversational English!',
        location: 'Lisbon, Portugal',
        timezone: 'Europe/Lisbon',
        zoomLink: 'https://zoom.us/j/1234567890',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Maria Santos', timezone: 'Europe/Lisbon' });

    const updated = await Account.findById(account.id);
    expect(updated!.name).toBe('Maria Santos');
    expect(updated!.picture).toBe('https://example.com/maria.jpg');
    expect(updated!.bio).toBe('I love teaching conversational English!');
    expect(updated!.location).toBe('Lisbon, Portugal');
    expect(updated!.timezone).toBe('Europe/Lisbon');
    expect(updated!.zoomLink).toBe('https://zoom.us/j/1234567890');
  });

  it('rejects an unrecognized IANA timezone', async () => {
    const { token } = await buddyToken();
    const app = createApp();

    const res = await request(app)
      .patch('/api/buddy/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ timezone: 'Not/A_Real_Zone' });

    expect(res.status).toBe(400);
  });
});
