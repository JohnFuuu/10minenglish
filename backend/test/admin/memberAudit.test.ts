import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Account } from '../../src/models/Account.js';
import { Tag } from '../../src/models/Tag.js';
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

const PATH = '/api/admin/members/audit-log';

async function setup() {
  const admin = await Account.create({ role: 'admin', email: 'admin@10me.test', name: 'Ada Admin' });
  const tag = await Tag.create({ name: 'low-income', nameKey: 'low-income' });
  const sarah = await Account.create({ role: 'user', email: 'sarah@example.com', name: 'Sarah', memberTags: [{ tagId: tag._id, addedBy: admin._id, addedAt: new Date() }] });
  const tom = await Account.create({ role: 'user', email: 'tom@example.com', name: 'Tom' });
  const buddy = await Account.create({ role: 'buddy', email: 'bea@example.com', name: 'Bea' });
  const target = (a: typeof sarah) => ({ type: 'member' as const, id: String(a._id), label: a.name! });

  // Member actions for both members, plus non-member actions that must never show.
  await recordAdminAction(admin.id, 'member.tag_added', target(sarah), { tag: 'low-income' });
  await recordAdminAction(admin.id, 'member.credits_awarded', target(tom), { amount: 2, reason: 'Gift', balanceAfter: 2 });
  await recordAdminAction(admin.id, 'member.credits_awarded', target(sarah), { amount: 5, reason: 'Sorry', balanceAfter: 5 });
  await recordAdminAction(admin.id, 'buddy.created', { type: 'buddy', id: String(buddy._id), label: 'Bea' }, {});
  await recordAdminAction(admin.id, 'tag.created', { type: 'tag', id: String(tag._id), label: 'low-income' }, {});

  const token = signAccountToken({ accountId: admin.id, role: 'admin' });
  return { token, tag, sarah, tom };
}

const summary = (body: { entries: { action: string; target: { label: string } }[] }) =>
  body.entries.map((e) => `${e.action}:${e.target.label}`);

describe('GET /api/admin/members/audit-log', () => {
  it('refuses a non-Admin', async () => {
    const user = await Account.create({ role: 'user', email: 'u@example.com' });
    const { app } = createTestApp();
    const res = await request(app).get(PATH).set('Authorization', `Bearer ${signAccountToken({ accountId: user.id, role: 'user' })}`);
    expect(res.status).toBe(403);
  });

  it('with no filter, lists only member actions, newest first', async () => {
    const { token } = await setup();
    const { app } = createTestApp();

    const res = await request(app).get(PATH).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(summary(res.body)).toEqual([
      'member.credits_awarded:Sarah',
      'member.credits_awarded:Tom',
      'member.tag_added:Sarah',
    ]);
  });

  it('follows the search box: only members whose name or email matches', async () => {
    const { token } = await setup();
    const { app } = createTestApp();

    const res = await request(app).get(PATH).query({ q: 'tom@' }).set('Authorization', `Bearer ${token}`);

    expect(summary(res.body)).toEqual(['member.credits_awarded:Tom']);
  });

  it('follows the tag filter: only members who have that tag', async () => {
    const { token, tag } = await setup();
    const { app } = createTestApp();

    const res = await request(app).get(PATH).query({ tagId: tag.id }).set('Authorization', `Bearer ${token}`);

    expect(summary(res.body)).toEqual(['member.credits_awarded:Sarah', 'member.tag_added:Sarah']);
  });

  it('is empty when no member matches', async () => {
    const { token } = await setup();
    const { app } = createTestApp();

    const res = await request(app).get(PATH).query({ q: 'nobody-matches' }).set('Authorization', `Bearer ${token}`);

    expect(res.body).toEqual({ entries: [], nextCursor: null });
  });

  it('pages with a cursor', async () => {
    const { token } = await setup();
    const { app } = createTestApp();

    const first = await request(app).get(PATH).query({ limit: '2' }).set('Authorization', `Bearer ${token}`);
    expect(first.body.entries).toHaveLength(2);
    expect(first.body.nextCursor).toBeTruthy();
    const second = await request(app).get(PATH).query({ limit: '2', before: first.body.nextCursor }).set('Authorization', `Bearer ${token}`);
    expect(summary(second.body)).toEqual(['member.tag_added:Sarah']);
    expect(second.body.nextCursor).toBeNull();
  });
});
