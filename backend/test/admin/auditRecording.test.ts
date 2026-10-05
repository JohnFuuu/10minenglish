import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Account } from '../../src/models/Account.js';
import { AuditEntry } from '../../src/models/AuditEntry.js';
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
afterEach(() => vi.restoreAllMocks());

async function setup() {
  const adminAccount = await Account.create({ role: 'admin', email: 'admin@10me.test', name: 'Ada Admin' });
  const token = signAccountToken({ accountId: adminAccount.id, role: 'admin' });
  const { app } = createTestApp();
  const as = (method: 'get' | 'post' | 'patch' | 'delete', path: string, body?: object) =>
    request(app)[method](path).set('Authorization', `Bearer ${token}`).send(body);
  return { adminAccount, as };
}

const entries = () => AuditEntry.find().sort({ _id: 1 }).lean();

describe('recording tag changes', () => {
  it('records create, rename, and delete with their details', async () => {
    const { adminAccount, as } = await setup();
    const created = await as('post', '/api/admin/tags', { name: 'low-income' });
    await Account.create({
      role: 'user',
      email: 'a@example.com',
      memberTags: [{ tagId: created.body.id, addedBy: adminAccount._id, addedAt: new Date() }],
    });
    await as('patch', `/api/admin/tags/${created.body.id}`, { name: 'Low income' });
    await as('delete', `/api/admin/tags/${created.body.id}`);

    const log = await entries();
    expect(log.map((e) => e.action)).toEqual(['tag.created', 'tag.renamed', 'tag.deleted']);
    expect(log[0]).toMatchObject({ admin: { name: 'Ada Admin' }, target: { type: 'tag', id: created.body.id, label: 'low-income' } });
    expect(log[1].details).toEqual({ from: 'low-income', to: 'Low income' });
    expect(log[2]).toMatchObject({ target: { label: 'Low income' }, details: { removedFromMembers: 1 } });
  });

  it('records nothing for a rejected create or a rename to the identical name', async () => {
    const { as } = await setup();
    const created = await as('post', '/api/admin/tags', { name: 'low-income' });
    await as('post', '/api/admin/tags', { name: 'LOW-INCOME' }); // 409
    await as('post', '/api/admin/tags', { name: '  ' }); // 400
    await as('patch', `/api/admin/tags/${created.body.id}`, { name: 'low-income' }); // unchanged

    expect((await entries()).map((e) => e.action)).toEqual(['tag.created']);
  });
});

describe('recording member tag changes', () => {
  it('records add and remove once each, naming the member and tag', async () => {
    const { as } = await setup();
    const tag = await as('post', '/api/admin/tags', { name: 'low-income' });
    const member = await Account.create({ role: 'user', email: 'sarah@example.com', name: 'Sarah' });
    const add = () => as('post', `/api/admin/members/${member.id}/tags`, { tagId: tag.body.id });

    await add();
    await Promise.all([add(), add()]); // no-ops
    await as('delete', `/api/admin/members/${member.id}/tags/${tag.body.id}`);
    await as('delete', `/api/admin/members/${member.id}/tags/${tag.body.id}`); // no-op

    const log = (await entries()).filter((e) => e.action.startsWith('member.'));
    expect(log.map((e) => e.action)).toEqual(['member.tag_added', 'member.tag_removed']);
    expect(log[0]).toMatchObject({ target: { type: 'member', id: member.id, label: 'Sarah' }, details: { tag: 'low-income' } });
    expect(log[1].details).toEqual({ tag: 'low-income' });
  });

  it('names an email-less member by name and writes nothing for an untag after the tag was deleted', async () => {
    const { as } = await setup();
    const tag = await as('post', '/api/admin/tags', { name: 'low-income' });
    const member = await Account.create({ role: 'user', facebookId: 'fb-1', name: 'Phone Only' });
    await as('post', `/api/admin/members/${member.id}/tags`, { tagId: tag.body.id });
    await as('delete', `/api/admin/tags/${tag.body.id}`);
    await as('delete', `/api/admin/members/${member.id}/tags/${tag.body.id}`); // already gone

    const log = await entries();
    expect(log.map((e) => e.action)).toEqual(['tag.created', 'member.tag_added', 'tag.deleted']);
    expect(log[1].target.label).toBe('Phone Only');
  });
});

describe('recording Buddy changes', () => {
  it('records create, deactivate (with cancelled count), and activate — not unchanged PATCHes', async () => {
    const { as } = await setup();
    const created = await as('post', '/api/admin/buddies', { name: 'Maria', email: 'maria@example.com', password: 'StarterPass1!' });
    await as('patch', `/api/admin/buddies/${created.body.id}`, { active: true }); // already active
    await as('patch', `/api/admin/buddies/${created.body.id}`, { active: false });
    await as('patch', `/api/admin/buddies/${created.body.id}`, { active: true });
    await as('post', '/api/admin/buddies', { name: 'Maria', email: 'maria@example.com', password: 'x' }); // 409

    const log = await entries();
    expect(log.map((e) => e.action)).toEqual(['buddy.created', 'buddy.deactivated', 'buddy.activated']);
    expect(log[0].target).toMatchObject({ type: 'buddy', id: created.body.id, label: 'Maria' });
    expect(log[1].details).toEqual({ cancelledLessons: 0 });
  });
});

describe('recording price changes', () => {
  it('records old and new price, and nothing for an unchanged or rejected price', async () => {
    const { as } = await setup();
    await as('get', '/api/credit-packs'); // seeds default packs
    await as('patch', '/api/admin/credit-packs/10', { priceCents: 900 });
    await as('patch', '/api/admin/credit-packs/10', { priceCents: 900 }); // unchanged
    await as('patch', '/api/admin/credit-packs/10', { priceCents: -5 }); // 400

    const log = await entries();
    expect(log.map((e) => e.action)).toEqual(['price.changed']);
    expect(log[0]).toMatchObject({
      target: { type: 'creditPack', id: '10', label: '10 credits' },
      details: { packSize: 10, fromCents: 1000, toCents: 900 },
    });
  });
});

describe('when the audit write fails', () => {
  it('still completes the Admin’s change', async () => {
    const { as } = await setup();
    vi.spyOn(AuditEntry, 'create').mockRejectedValue(new Error('disk full'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await as('post', '/api/admin/tags', { name: 'low-income' });

    expect(res.status).toBe(201);
    expect(await Tag.countDocuments()).toBe(1);
  });
});

describe('double-submitted requests', () => {
  it('record one entry for two identical concurrent changes', async () => {
    const { as } = await setup();
    const buddy = await as('post', '/api/admin/buddies', { name: 'Maria', email: 'maria@example.com', password: 'StarterPass1!' });
    const tag = await as('post', '/api/admin/tags', { name: 'low-income' });
    await as('get', '/api/credit-packs');

    await Promise.all([
      as('patch', `/api/admin/buddies/${buddy.body.id}`, { active: false }),
      as('patch', `/api/admin/buddies/${buddy.body.id}`, { active: false }),
    ]);
    await Promise.all([
      as('patch', '/api/admin/credit-packs/10', { priceCents: 900 }),
      as('patch', '/api/admin/credit-packs/10', { priceCents: 900 }),
    ]);
    await Promise.all([
      as('patch', `/api/admin/tags/${tag.body.id}`, { name: 'Low income' }),
      as('patch', `/api/admin/tags/${tag.body.id}`, { name: 'Low income' }),
    ]);

    const counts = (await entries()).reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.action]: (acc[e.action] ?? 0) + 1 }), {});
    expect(counts).toMatchObject({ 'buddy.deactivated': 1, 'price.changed': 1, 'tag.renamed': 1 });
  });
});
