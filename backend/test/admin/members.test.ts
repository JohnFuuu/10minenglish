import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
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
beforeEach(clearTestDb);

async function admin(name = 'Ada Admin') {
  const account = await Account.create({ role: 'admin', email: 'admin@10me.test', name });
  return { account, token: signAccountToken({ accountId: account.id, role: 'admin' }) };
}

const lowIncome = () => Tag.create({ name: 'low-income', nameKey: 'low-income' });

describe('GET /api/admin/members', () => {
  it('refuses a non-Admin', async () => {
    const user = await Account.create({ role: 'user', email: 'sarah@example.com' });
    const { app } = createTestApp();

    const res = await request(app)
      .get('/api/admin/members')
      .set('Authorization', `Bearer ${signAccountToken({ accountId: user.id, role: 'user' })}`);

    expect(res.status).toBe(403);
  });

  it('lists only Users, newest first, with joined date and credits', async () => {
    const { token } = await admin();
    await Account.create({ role: 'buddy', email: 'buddy@example.com', name: 'Buddy' });
    const older = await Account.create({ role: 'user', email: 'old@example.com', name: 'Old', credits: 2 });
    const newer = await Account.create({ role: 'user', email: 'new@example.com', name: 'New', credits: 5 });
    const { app } = createTestApp();

    const res = await request(app).get('/api/admin/members').set('Authorization', `Bearer ${token}`);

    expect(res.body.members.map((m: { id: string }) => m.id)).toEqual([newer.id, older.id]);
    expect(res.body.members[0]).toMatchObject({ name: 'New', email: 'new@example.com', credits: 5, tags: [] });
    expect(new Date(res.body.members[0].joinedAt).getTime()).toBe(newer._id.getTimestamp().getTime());
  });

  it('searches name and email case-insensitively, including email-less members', async () => {
    const { token } = await admin();
    await Account.create({ role: 'user', email: 'sarah@example.com', name: 'Sarah Lee' });
    await Account.create({ role: 'user', email: 'tom@example.com', name: 'Tom' });
    await Account.create({ role: 'user', facebookId: 'fb-1', name: 'Phone Only' });
    const { app } = createTestApp();
    const search = (q: string) =>
      request(app).get('/api/admin/members').query({ q }).set('Authorization', `Bearer ${token}`);

    expect((await search('SARAH')).body.members.map((m: { name: string }) => m.name)).toEqual(['Sarah Lee']);
    expect((await search('tom@')).body.members.map((m: { name: string }) => m.name)).toEqual(['Tom']);
    const phoneOnly = (await search('phone')).body.members;
    expect(phoneOnly.map((m: { name: string }) => m.name)).toEqual(['Phone Only']);
    expect(phoneOnly[0]).not.toHaveProperty('email');
  });

  it('matches regex characters in the search literally', async () => {
    const { token } = await admin();
    await Account.create({ role: 'user', email: 'a+b@example.com', name: 'Plus' });
    await Account.create({ role: 'user', email: 'aab@example.com', name: 'Not plus' });
    const { app } = createTestApp();

    const plus = await request(app).get('/api/admin/members').query({ q: 'a+b' }).set('Authorization', `Bearer ${token}`);
    const paren = await request(app).get('/api/admin/members').query({ q: '(' }).set('Authorization', `Bearer ${token}`);

    expect(plus.body.members.map((m: { name: string }) => m.name)).toEqual(['Plus']);
    expect(paren.status).toBe(200);
    expect(paren.body.members).toEqual([]);
  });

  it('filters by tag, and treats a malformed tag id as matching nobody', async () => {
    const { account: adminAccount, token } = await admin();
    const tag = await lowIncome();
    await Account.create({
      role: 'user',
      email: 'tagged@example.com',
      name: 'Tagged',
      memberTags: [{ tagId: tag._id, addedBy: adminAccount._id, addedAt: new Date() }],
    });
    await Account.create({ role: 'user', email: 'plain@example.com', name: 'Plain' });
    const { app } = createTestApp();

    const filtered = await request(app).get('/api/admin/members').query({ tagId: tag.id }).set('Authorization', `Bearer ${token}`);
    const malformed = await request(app).get('/api/admin/members').query({ tagId: 'nope' }).set('Authorization', `Bearer ${token}`);

    expect(filtered.body.members.map((m: { name: string }) => m.name)).toEqual(['Tagged']);
    expect(malformed.status).toBe(200);
    expect(malformed.body.members).toEqual([]);
  });

  it('pages 20 members at a time, newest first, with the total that match', async () => {
    const { token } = await admin();
    await Account.insertMany(
      Array.from({ length: 45 }, (_, i) => ({ role: 'user', email: `m${i}@example.com`, name: `Member ${i}` })),
    );
    const { app } = createTestApp();
    const page = (n?: string) =>
      request(app).get('/api/admin/members').query(n === undefined ? {} : { page: n }).set('Authorization', `Bearer ${token}`);

    const first = await page();
    expect(first.body).toMatchObject({ page: 1, pageSize: 20, total: 45 });
    expect(first.body.members).toHaveLength(20);
    expect(first.body.members[0].name).toBe('Member 44');

    const third = await page('3');
    expect(third.body.page).toBe(3);
    expect(third.body.members.map((m: { name: string }) => m.name)).toEqual([
      'Member 4',
      'Member 3',
      'Member 2',
      'Member 1',
      'Member 0',
    ]);

    // Past the end: nothing on the page, but the total still says how many exist.
    const beyond = await page('9');
    expect(beyond.body).toMatchObject({ page: 9, total: 45, members: [] });
  });

  it('treats a missing or malformed page as page 1', async () => {
    const { token } = await admin();
    await Account.create({ role: 'user', email: 'only@example.com', name: 'Only' });
    const { app } = createTestApp();

    for (const bad of ['0', '-2', 'abc', '1.5']) {
      const res = await request(app).get('/api/admin/members').query({ page: bad }).set('Authorization', `Bearer ${token}`);
      expect(res.body).toMatchObject({ page: 1, total: 1 });
      expect(res.body.members.map((m: { name: string }) => m.name)).toEqual(['Only']);
    }
  });

  it('counts the total after search and tag filters', async () => {
    const { token } = await admin();
    await Account.create({ role: 'user', email: 'sarah@example.com', name: 'Sarah' });
    await Account.create({ role: 'user', email: 'sara@example.com', name: 'Sara' });
    await Account.create({ role: 'user', email: 'tom@example.com', name: 'Tom' });
    const { app } = createTestApp();

    const res = await request(app).get('/api/admin/members').query({ q: 'sar' }).set('Authorization', `Bearer ${token}`);

    expect(res.body.total).toBe(2);
    const malformedTag = await request(app).get('/api/admin/members').query({ tagId: 'nope' }).set('Authorization', `Bearer ${token}`);
    expect(malformedTag.body).toMatchObject({ members: [], total: 0, page: 1 });
  });
});

describe('assigning tags to a member', () => {
  it('adds a tag, recording which Admin added it and when', async () => {
    const { account: adminAccount, token } = await admin();
    const tag = await lowIncome();
    const member = await Account.create({ role: 'user', email: 'sarah@example.com', name: 'Sarah' });
    const { app } = createTestApp();

    const res = await request(app)
      .post(`/api/admin/members/${member.id}/tags`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tagId: tag.id });

    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual([
      { id: tag.id, name: 'low-income', addedAt: expect.any(String), addedBy: { id: adminAccount.id, name: 'Ada Admin' } },
    ]);
  });

  it('shows the Admin’s email when the Admin has no name', async () => {
    // No name on this Admin (admin()'s default would supply one).
    const nameless = await Account.create({ role: 'admin', email: 'admin@10me.test' });
    const token = signAccountToken({ accountId: nameless.id, role: 'admin' });
    const tag = await lowIncome();
    const member = await Account.create({ role: 'user', email: 'sarah@example.com' });
    const { app } = createTestApp();

    const res = await request(app).post(`/api/admin/members/${member.id}/tags`).set('Authorization', `Bearer ${token}`).send({ tagId: tag.id });

    expect(res.body.tags[0].addedBy.name).toBe('admin@10me.test');
  });

  it('never duplicates a tag added twice, keeping the original record', async () => {
    const { token } = await admin();
    const tag = await lowIncome();
    const member = await Account.create({ role: 'user', email: 'sarah@example.com' });
    const { app } = createTestApp();
    const add = () =>
      request(app).post(`/api/admin/members/${member.id}/tags`).set('Authorization', `Bearer ${token}`).send({ tagId: tag.id });

    const first = await add();
    await Promise.all([add(), add()]);

    const reloaded = await Account.findById(member._id);
    expect(reloaded!.memberTags).toHaveLength(1);
    expect(reloaded!.memberTags[0].addedAt.toISOString()).toBe(first.body.tags[0].addedAt);
  });

  it('can tag an email-less member', async () => {
    const { token } = await admin();
    const tag = await lowIncome();
    const member = await Account.create({ role: 'user', facebookId: 'fb-1', name: 'Phone Only' });
    const { app } = createTestApp();

    const res = await request(app).post(`/api/admin/members/${member.id}/tags`).set('Authorization', `Bearer ${token}`).send({ tagId: tag.id });

    expect(res.status).toBe(200);
    expect(res.body.tags).toHaveLength(1);
  });

  it('removes a tag, and removing one the member lacks is harmless', async () => {
    const { account: adminAccount, token } = await admin();
    const tag = await lowIncome();
    const member = await Account.create({
      role: 'user',
      email: 'sarah@example.com',
      memberTags: [{ tagId: tag._id, addedBy: adminAccount._id, addedAt: new Date() }],
    });
    const { app } = createTestApp();
    const remove = () =>
      request(app).delete(`/api/admin/members/${member.id}/tags/${tag.id}`).set('Authorization', `Bearer ${token}`);

    const first = await remove();
    const again = await remove();

    expect(first.status).toBe(200);
    expect(first.body.tags).toEqual([]);
    expect(again.status).toBe(200);
  });

  it('404s an unknown or malformed member, a non-User target, and an unknown tag', async () => {
    const { token } = await admin();
    const tag = await lowIncome();
    const buddy = await Account.create({ role: 'buddy', email: 'buddy@example.com' });
    const member = await Account.create({ role: 'user', email: 'sarah@example.com' });
    const { app } = createTestApp();
    const add = (memberId: string, tagId: string) =>
      request(app).post(`/api/admin/members/${memberId}/tags`).set('Authorization', `Bearer ${token}`).send({ tagId });

    expect((await add('not-an-id', tag.id)).status).toBe(404);
    expect((await add('0123456789abcdef01234567', tag.id)).status).toBe(404);
    expect((await add(buddy.id, tag.id)).status).toBe(404);
    expect((await add(member.id, '0123456789abcdef01234567')).status).toBe(404);
    expect((await add(member.id, 'nope')).status).toBe(404);
  });
});

describe('keeping tags hidden from the member', () => {
  it('leaves no trace of tags in the tagged User’s own /api/me and /api/profile', async () => {
    const { account: adminAccount } = await admin();
    const tag = await lowIncome();
    const member = await Account.create({
      role: 'user',
      email: 'sarah@example.com',
      name: 'Sarah',
      memberTags: [{ tagId: tag._id, addedBy: adminAccount._id, addedAt: new Date() }],
    });
    const token = signAccountToken({ accountId: member.id, role: 'user' });
    const { app } = createTestApp();

    const me = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    const profile = await request(app).get('/api/profile').set('Authorization', `Bearer ${token}`);

    for (const res of [me, profile]) {
      expect(res.status).toBe(200);
      const raw = JSON.stringify(res.body);
      expect(raw).not.toMatch(/memberTags|low-income/);
      expect(raw).not.toContain(tag.id);
    }
  });
});
