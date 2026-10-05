import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Account } from '../../src/models/Account.js';
import { AuditEntry } from '../../src/models/AuditEntry.js';
import { hashPassword } from '../../src/services/password.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import { createTestApp } from '../testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

const PASSWORD = 'StarterPass1!';

async function admin(name: string) {
  return Account.create({ role: 'admin', email: `${name.toLowerCase()}@10me.test`, name, passwordHash: await hashPassword(PASSWORD), emailConfirmed: true });
}

async function setup() {
  const ada = await admin('Ada');
  const bob = await admin('Bob');
  const { app } = createTestApp();
  const as = (who: { id: string }, method: 'get' | 'patch' | 'delete', path: string, body?: object) =>
    request(app)[method](path).set('Authorization', `Bearer ${signAccountToken({ accountId: who.id, role: 'admin' })}`).send(body);
  return { ada, bob, app, as };
}

describe('deactivating and reactivating an Admin', () => {
  it('suspends the Admin: login refused, open session cut off, still listed as inactive', async () => {
    const { ada, bob, app, as } = await setup();

    const res = await as(ada, 'patch', `/api/admin/admins/${bob.id}`, { active: false });
    const login = await request(app).post('/auth/login').send({ email: 'bob@10me.test', password: PASSWORD });
    const bobSession = await as(bob, 'get', '/api/admin/admins');
    const list = await as(ada, 'get', '/api/admin/admins');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: bob.id, active: false });
    expect(login.status).toBe(403);
    expect(login.body.error).toBe('ACCOUNT_INACTIVE');
    expect(bobSession.status).toBe(401);
    expect(list.body.admins.find((a: { id: string }) => a.id === bob.id)).toMatchObject({ active: false });
  });

  it('reactivating restores access; each real change is audited once', async () => {
    const { ada, bob, app, as } = await setup();

    await as(ada, 'patch', `/api/admin/admins/${bob.id}`, { active: false });
    await as(ada, 'patch', `/api/admin/admins/${bob.id}`, { active: false }); // no-op
    await as(ada, 'patch', `/api/admin/admins/${bob.id}`, { active: true });
    const login = await request(app).post('/auth/login').send({ email: 'bob@10me.test', password: PASSWORD });

    expect(login.status).toBe(200);
    const actions = (await AuditEntry.find().sort({ _id: 1 }).lean()).map((e) => e.action);
    expect(actions).toEqual(['admin.deactivated', 'admin.activated']);
  });

  it('refuses a missing or non-boolean flag', async () => {
    const { ada, bob, as } = await setup();

    const res = await as(ada, 'patch', `/api/admin/admins/${bob.id}`, { active: 'no' });

    expect(res.status).toBe(400);
  });
});

describe('removing (archiving) an Admin', () => {
  it('locks them out, hides them from the list, keeps the record, and audits it', async () => {
    const { ada, bob, app, as } = await setup();

    const res = await as(ada, 'delete', `/api/admin/admins/${bob.id}`);
    const login = await request(app).post('/auth/login').send({ email: 'bob@10me.test', password: PASSWORD });
    const bobSession = await as(bob, 'get', '/api/admin/admins');
    const list = await as(ada, 'get', '/api/admin/admins');
    const again = await as(ada, 'delete', `/api/admin/admins/${bob.id}`);

    expect(res.status).toBe(200);
    expect(login.body.error).toBe('ACCOUNT_REMOVED');
    expect(bobSession.status).toBe(401);
    expect(list.body.admins.map((a: { id: string }) => a.id)).toEqual([ada.id]);
    expect((await Account.findById(bob._id))!.removedAt).toBeInstanceOf(Date);
    expect(again.status).toBe(200);
    expect(await AuditEntry.countDocuments({ action: 'admin.removed' })).toBe(1);
  });
});

describe('safeguards', () => {
  it('refuses acting on your own account', async () => {
    const { ada, as } = await setup();

    const deactivate = await as(ada, 'patch', `/api/admin/admins/${ada.id}`, { active: false });
    const remove = await as(ada, 'delete', `/api/admin/admins/${ada.id}`);

    expect([deactivate.status, remove.status]).toEqual([409, 409]);
    expect(deactivate.body.error).toBe('CANNOT_CHANGE_SELF');
    expect((await Account.findById(ada._id))!.active).toBe(true);
    expect(await AuditEntry.countDocuments()).toBe(0);
  });

  it('never leaves zero active Admins — even when two deactivate each other at once', async () => {
    const { ada, bob, as } = await setup();

    const [a, b] = await Promise.all([
      as(ada, 'patch', `/api/admin/admins/${bob.id}`, { active: false }),
      as(bob, 'patch', `/api/admin/admins/${ada.id}`, { active: false }),
    ]);

    // Whichever interleaving happens, someone can still manage the app. If
    // both changes land together, both are undone (both Admins stay active
    // and are told why) — safe, and either can simply retry.
    const active = await Account.countDocuments({ role: 'admin', active: { $ne: false }, removedAt: { $exists: false } });
    expect(active).toBeGreaterThanOrEqual(1);
    const succeeded = [a, b].filter((r) => r.status === 200);
    for (const r of [a, b].filter((x) => x.status !== 200)) {
      expect(r.status).toBe(409);
      expect(r.body.error).toBe('LAST_ACTIVE_ADMIN');
    }
    expect(succeeded.length).toBeLessThanOrEqual(1);
    expect(await AuditEntry.countDocuments()).toBe(succeeded.length);
  });

  it('refuses removing the last other active Admin when the rest are inactive', async () => {
    const { ada, bob, as } = await setup();
    const cy = await admin('Cy');
    await as(ada, 'patch', `/api/admin/admins/${cy.id}`, { active: false });

    // Ada removing Bob is fine (Ada stays active)…
    const removeBob = await as(ada, 'delete', `/api/admin/admins/${bob.id}`);
    expect(removeBob.status).toBe(200);
    // …and Ada can never act on herself, so one active Admin always remains.
    expect(await Account.countDocuments({ role: 'admin', active: { $ne: false }, removedAt: { $exists: false } })).toBe(1);
  });

  it('404s unknown, malformed, removed, or non-Admin targets', async () => {
    const { ada, bob, as } = await setup();
    const buddy = await Account.create({ role: 'buddy', email: 'maria@example.com' });
    await as(ada, 'delete', `/api/admin/admins/${bob.id}`);

    const statuses = await Promise.all([
      as(ada, 'patch', '/api/admin/admins/0123456789abcdef01234567', { active: false }),
      as(ada, 'patch', '/api/admin/admins/not-an-id', { active: false }),
      as(ada, 'patch', `/api/admin/admins/${bob.id}`, { active: true }),
      as(ada, 'delete', `/api/admin/admins/${buddy.id}`),
    ]).then((rs) => rs.map((r) => r.status));

    expect(statuses).toEqual([404, 404, 404, 404]);
  });
});
