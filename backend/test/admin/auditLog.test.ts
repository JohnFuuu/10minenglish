import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Account } from '../../src/models/Account.js';
import { AuditEntry } from '../../src/models/AuditEntry.js';
import { recordAdminAction } from '../../src/services/auditLog.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import { createTestApp } from '../testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

async function admin() {
  const account = await Account.create({ role: 'admin', email: 'admin@10me.test', name: 'Ada Admin' });
  return { account, token: signAccountToken({ accountId: account.id, role: 'admin' }) };
}

const read = (app: Parameters<typeof request>[0], token: string, query: Record<string, string> = {}) =>
  request(app).get('/api/admin/audit-log').query(query).set('Authorization', `Bearer ${token}`);

describe('GET /api/admin/audit-log', () => {
  it('refuses a non-Admin', async () => {
    const user = await Account.create({ role: 'user', email: 'sarah@example.com' });
    const { app } = createTestApp();

    const res = await read(app, signAccountToken({ accountId: user.id, role: 'user' }));

    expect(res.status).toBe(403);
  });

  it('returns entries newest first with admin, target, and details', async () => {
    const { account, token } = await admin();
    await recordAdminAction(account.id, 'tag.created', { type: 'tag', id: 't1', label: 'low-income' });
    await recordAdminAction(account.id, 'tag.renamed', { type: 'tag', id: 't1', label: 'Low income' }, { from: 'low-income', to: 'Low income' });
    const { app } = createTestApp();

    const res = await read(app, token);

    expect(res.status).toBe(200);
    expect(res.body.entries.map((e: { action: string }) => e.action)).toEqual(['tag.renamed', 'tag.created']);
    expect(res.body.entries[0]).toMatchObject({
      admin: { id: account.id, name: 'Ada Admin' },
      target: { type: 'tag', id: 't1', label: 'Low income' },
      details: { from: 'low-income', to: 'Low income' },
    });
    expect(res.body.entries[0].createdAt).toEqual(expect.any(String));
    expect(res.body.nextCursor).toBeNull();
  });

  it('pages 50 at a time with a working cursor', async () => {
    const { account, token } = await admin();
    for (let i = 0; i < 53; i++) {
      await recordAdminAction(account.id, 'tag.created', { type: 'tag', label: `tag-${i}` });
    }
    const { app } = createTestApp();

    const first = await read(app, token);
    const second = await read(app, token, { before: first.body.nextCursor });

    expect(first.body.entries).toHaveLength(50);
    expect(first.body.entries[0].target.label).toBe('tag-52');
    expect(first.body.nextCursor).toBe(first.body.entries[49].id);
    expect(second.body.entries.map((e: { target: { label: string } }) => e.target.label)).toEqual(['tag-2', 'tag-1', 'tag-0']);
    expect(second.body.nextCursor).toBeNull();
  });

  it('filters by category', async () => {
    const { account, token } = await admin();
    await recordAdminAction(account.id, 'tag.created', { type: 'tag', label: 'low-income' });
    await recordAdminAction(account.id, 'price.changed', { type: 'creditPack', id: '10', label: '10 credits' }, { packSize: 10, fromCents: 1000, toCents: 900 });
    await recordAdminAction(account.id, 'buddy.created', { type: 'buddy', label: 'Maria' });
    const { app } = createTestApp();

    const pricing = await read(app, token, { category: 'pricing' });

    expect(pricing.body.entries.map((e: { action: string }) => e.action)).toEqual(['price.changed']);
  });

  it('returns an empty page for an unknown category, a prototype key, or a malformed cursor', async () => {
    const { account, token } = await admin();
    await recordAdminAction(account.id, 'tag.created', { type: 'tag', label: 'low-income' });
    const { app } = createTestApp();

    const queries: Record<string, string>[] = [{ category: 'nope' }, { category: 'constructor' }, { category: '__proto__' }, { before: 'not-an-id' }];
    for (const query of queries) {
      const res = await read(app, token, query);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ entries: [], nextCursor: null });
    }
  });

  it('records an Admin with no name by email, and a removed Admin as such', async () => {
    const nameless = await Account.create({ role: 'admin', email: 'nameless@10me.test' });
    await recordAdminAction(nameless.id, 'tag.created', { type: 'tag', label: 'a' });
    await recordAdminAction('0123456789abcdef01234567', 'tag.created', { type: 'tag', label: 'b' });

    const entries = await AuditEntry.find().sort({ _id: 1 });

    expect(entries.map((e) => e.admin.name)).toEqual(['nameless@10me.test', 'Removed admin']);
  });
});
