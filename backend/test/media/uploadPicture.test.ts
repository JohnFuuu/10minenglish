import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Account } from '../../src/models/Account.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import { createTestApp } from '../testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

const PNG_BYTES = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

describe('POST /api/me/picture', () => {
  it('rejects a request with no token', async () => {
    const { app } = createTestApp();
    const res = await request(app).post('/api/me/picture').attach('picture', PNG_BYTES, 'avatar.png');

    expect(res.status).toBe(401);
  });

  it('rejects a request with no file attached', async () => {
    const account = await Account.create({ role: 'user', email: 'sarah@example.com' });
    const token = signAccountToken({ accountId: account.id, role: account.role });
    const { app } = createTestApp();

    const res = await request(app).post('/api/me/picture').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('rejects an unsupported file type', async () => {
    const account = await Account.create({ role: 'user', email: 'sarah@example.com' });
    const token = signAccountToken({ accountId: account.id, role: account.role });
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/me/picture')
      .set('Authorization', `Bearer ${token}`)
      .attach('picture', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
  });

  it('rejects a file over 5MB', async () => {
    const account = await Account.create({ role: 'user', email: 'sarah@example.com' });
    const token = signAccountToken({ accountId: account.id, role: account.role });
    const { app } = createTestApp();

    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);
    const res = await request(app)
      .post('/api/me/picture')
      .set('Authorization', `Bearer ${token}`)
      .attach('picture', oversized, { filename: 'huge.png', contentType: 'image/png' });

    expect(res.status).toBe(413);
  });

  it('uploads the picture and saves the returned URL on the Account, for a User', async () => {
    const account = await Account.create({ role: 'user', email: 'sarah@example.com' });
    const token = signAccountToken({ accountId: account.id, role: account.role });
    const { app, mediaStorage } = createTestApp();

    const res = await request(app)
      .post('/api/me/picture')
      .set('Authorization', `Bearer ${token}`)
      .attach('picture', PNG_BYTES, { filename: 'avatar.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.picture).toMatch(/^https:\/\/fake-r2\.test\/profile-pictures\//);

    const updated = await Account.findById(account.id);
    expect(updated!.picture).toBe(res.body.picture);

    expect(mediaStorage.uploaded).toHaveLength(1);
    expect(mediaStorage.uploaded[0].contentType).toBe('image/png');
    expect(mediaStorage.uploaded[0].key).toContain(account.id);
  });

  it('uploads the picture for a Buddy account too — this endpoint is role-agnostic', async () => {
    const buddy = await Account.create({ role: 'buddy', email: 'maria@example.com' });
    const token = signAccountToken({ accountId: buddy.id, role: buddy.role });
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/me/picture')
      .set('Authorization', `Bearer ${token}`)
      .attach('picture', PNG_BYTES, { filename: 'avatar.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    const updated = await Account.findById(buddy.id);
    expect(updated!.picture).toBe(res.body.picture);
  });
});
