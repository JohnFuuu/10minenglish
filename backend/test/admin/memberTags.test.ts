import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Types } from 'mongoose';
import { Account } from '../../src/models/Account.js';
import { Tag } from '../../src/models/Tag.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import { createTestApp } from '../testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(async () => {
  await clearTestDb();
  await Tag.syncIndexes();
});

async function admin() {
  const account = await Account.create({ role: 'admin', email: 'admin@10me.test', name: 'Ada Admin' });
  return { account, token: signAccountToken({ accountId: account.id, role: 'admin' }) };
}

async function userToken() {
  const account = await Account.create({ role: 'user', email: 'sarah@example.com' });
  return signAccountToken({ accountId: account.id, role: 'user' });
}

describe('Admin tag management', () => {
  it('refuses a non-Admin', async () => {
    const token = await userToken();
    const { app } = createTestApp();

    const res = await request(app).get('/api/admin/tags').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('creates a tag, trimming its name', async () => {
    const { token } = await admin();
    const { app } = createTestApp();

    const res = await request(app)
      .post('/api/admin/tags')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '  Low-income  ' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Low-income', memberCount: 0 });
    expect(res.body.id).toBeTruthy();
  });

  it('rejects a blank name', async () => {
    const { token } = await admin();
    const { app } = createTestApp();

    const res = await request(app).post('/api/admin/tags').set('Authorization', `Bearer ${token}`).send({ name: '   ' });

    expect(res.status).toBe(400);
  });

  it('rejects a name that differs from an existing tag only by case', async () => {
    const { token } = await admin();
    const { app } = createTestApp();
    await request(app).post('/api/admin/tags').set('Authorization', `Bearer ${token}`).send({ name: 'low-income' });

    const res = await request(app).post('/api/admin/tags').set('Authorization', `Bearer ${token}`).send({ name: 'Low-Income' });

    expect(res.status).toBe(409);
    expect(await Tag.countDocuments()).toBe(1);
  });

  it('lists tags by name with how many members carry each', async () => {
    const { account: adminAccount, token } = await admin();
    const lowIncome = await Tag.create({ name: 'low-income', nameKey: 'low-income' });
    await Tag.create({ name: 'Alumni', nameKey: 'alumni' });
    await Account.create({
      role: 'user',
      email: 'a@example.com',
      memberTags: [{ tagId: lowIncome._id, addedBy: adminAccount._id, addedAt: new Date() }],
    });
    const { app } = createTestApp();

    const res = await request(app).get('/api/admin/tags').set('Authorization', `Bearer ${token}`);

    expect(res.body.tags).toEqual([
      { id: expect.any(String), name: 'Alumni', memberCount: 0 },
      { id: lowIncome.id, name: 'low-income', memberCount: 1 },
    ]);
  });

  it('renames a tag', async () => {
    const { token } = await admin();
    const tag = await Tag.create({ name: 'low-income', nameKey: 'low-income' });
    const { app } = createTestApp();

    const res = await request(app)
      .patch(`/api/admin/tags/${tag.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Low income (verified)' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: tag.id, name: 'Low income (verified)' });
  });

  it('lets a tag be renamed to a different capitalisation of itself', async () => {
    const { token } = await admin();
    const tag = await Tag.create({ name: 'low-income', nameKey: 'low-income' });
    const { app } = createTestApp();

    const res = await request(app)
      .patch(`/api/admin/tags/${tag.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Low-income' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Low-income');
  });

  it('rejects renaming a tag onto another tag’s name', async () => {
    const { token } = await admin();
    await Tag.create({ name: 'Alumni', nameKey: 'alumni' });
    const tag = await Tag.create({ name: 'low-income', nameKey: 'low-income' });
    const { app } = createTestApp();

    const res = await request(app).patch(`/api/admin/tags/${tag.id}`).set('Authorization', `Bearer ${token}`).send({ name: 'alumni' });

    expect(res.status).toBe(409);
  });

  it('404s a malformed or unknown tag id', async () => {
    const { token } = await admin();
    const { app } = createTestApp();

    const malformed = await request(app).patch('/api/admin/tags/not-an-id').set('Authorization', `Bearer ${token}`).send({ name: 'x' });
    const unknown = await request(app).delete('/api/admin/tags/0123456789abcdef01234567').set('Authorization', `Bearer ${token}`);

    expect(malformed.status).toBe(404);
    expect(unknown.status).toBe(404);
  });

  it('deletes a tag and removes it from every member carrying it', async () => {
    const { account: adminAccount, token } = await admin();
    const tag = await Tag.create({ name: 'low-income', nameKey: 'low-income' });
    const other = await Tag.create({ name: 'Alumni', nameKey: 'alumni' });
    const entry = (tagId: Types.ObjectId) => ({ tagId, addedBy: adminAccount._id, addedAt: new Date() });
    const a = await Account.create({ role: 'user', email: 'a@example.com', memberTags: [entry(tag._id), entry(other._id)] });
    await Account.create({ role: 'user', email: 'b@example.com', memberTags: [entry(tag._id)] });
    const { app } = createTestApp();

    const res = await request(app).delete(`/api/admin/tags/${tag.id}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ removedFromMembers: 2 });
    expect(await Tag.findById(tag._id)).toBeNull();
    const reloaded = await Account.findById(a._id);
    expect(reloaded!.memberTags.map((t) => String(t.tagId))).toEqual([other.id]);
  });
});
