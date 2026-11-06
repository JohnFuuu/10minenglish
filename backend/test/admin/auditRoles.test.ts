import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
beforeEach(async () => {
  await clearTestDb();
  process.env.SUPER_BACKEND_ADMIN = 'fred@10me.test';
});
afterEach(() => {
  delete process.env.SUPER_BACKEND_ADMIN;
});

// The log reads "SuperAdmin (Fred) …" or "Admin (James) …", so whether each
// Admin was a super admin is stored with the entry, as it was at the time.
describe('audit entries record SuperAdmin vs Admin', () => {
  it('marks the actor as a SuperAdmin or an Admin', async () => {
    const fred = await Account.create({ role: 'admin', email: 'fred@10me.test', name: 'Fred' });
    const james = await Account.create({ role: 'admin', email: 'james@10me.test', name: 'James' });

    await recordAdminAction(fred.id, 'tag.created', { type: 'tag', id: 't1', label: 'A' });
    await recordAdminAction(james.id, 'tag.created', { type: 'tag', id: 't2', label: 'B' });

    const [byFred, byJames] = await AuditEntry.find().sort({ _id: 1 });
    expect(byFred.admin.superAdmin).toBe(true);
    expect(byJames.admin.superAdmin).toBe(false);
  });

  it('marks an Admin being acted on as a SuperAdmin or an Admin', async () => {
    const fred = await Account.create({ role: 'admin', email: 'fred@10me.test', name: 'Fred' });
    const james = await Account.create({ role: 'admin', email: 'james@10me.test', name: 'James' });

    await recordAdminAction(james.id, 'admin.created', { type: 'admin', id: fred.id, label: 'Fred' });
    await recordAdminAction(fred.id, 'admin.deactivated', { type: 'admin', id: james.id, label: 'James' });

    const [aboutFred, aboutJames] = await AuditEntry.find().sort({ _id: 1 });
    expect(aboutFred.target.superAdmin).toBe(true);
    expect(aboutJames.target.superAdmin).toBe(false);
  });

  it('keeps what it was at the time, even after the setting changes', async () => {
    const fred = await Account.create({ role: 'admin', email: 'fred@10me.test', name: 'Fred' });
    await recordAdminAction(fred.id, 'tag.created', { type: 'tag', id: 't1', label: 'A' });
    process.env.SUPER_BACKEND_ADMIN = '';
    const token = signAccountToken({ accountId: fred.id, role: 'admin' });
    const { app } = createTestApp();

    const res = await request(app).get('/api/admin/audit-log').set('Authorization', `Bearer ${token}`);

    expect(res.body.entries[0].admin).toMatchObject({ name: 'Fred', superAdmin: true });
  });
});
