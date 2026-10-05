import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { Account } from '../../src/models/Account.js';
import { AuditEntry } from '../../src/models/AuditEntry.js';
import { signAccountToken } from '../../src/middleware/auth.js';
import { createTestApp } from '../testApp.js';
import { clearTestDb, startTestDb, stopTestDb } from '../dbTestSetup.js';

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await startTestDb();
}, 30000);
afterAll(stopTestDb, 30000);
beforeEach(clearTestDb);

async function setup() {
  const me = await Account.create({ role: 'admin', email: 'ada@10me.test', name: 'Ada Admin', emailConfirmed: true });
  const token = signAccountToken({ accountId: me.id, role: 'admin' });
  const { app } = createTestApp();
  const as = (method: 'get' | 'post', path: string, body?: object) =>
    request(app)[method](path).set('Authorization', `Bearer ${token}`).send(body);
  return { me, app, as };
}

const newAdmin = { name: 'Jane Admin', email: 'jane@10me.test', password: 'StarterPass1!' };

describe('Admin accounts', () => {
  it('refuses non-Admins, for both listing and creating', async () => {
    const user = await Account.create({ role: 'user', email: 'sarah@example.com' });
    const { app } = createTestApp();
    const token = signAccountToken({ accountId: user.id, role: 'user' });

    const list = await request(app).get('/api/admin/admins').set('Authorization', `Bearer ${token}`);
    const create = await request(app).post('/api/admin/admins').set('Authorization', `Bearer ${token}`).send(newAdmin);

    expect(list.status).toBe(403);
    expect(create.status).toBe(403);
    expect(await Account.countDocuments({ role: 'admin' })).toBe(0);
  });

  it('lists only Admin accounts, by name', async () => {
    const { as } = await setup();
    await Account.create({ role: 'admin', email: 'bob@10me.test', name: 'Bob Admin' });
    await Account.create({ role: 'buddy', email: 'maria@example.com', name: 'Maria' });
    await Account.create({ role: 'user', email: 'sarah@example.com', name: 'Sarah' });

    const res = await as('get', '/api/admin/admins');

    expect(res.status).toBe(200);
    expect(res.body.admins.map((a: { name: string }) => a.name)).toEqual(['Ada Admin', 'Bob Admin']);
    expect(res.body.admins[0]).toEqual({ id: expect.any(String), name: 'Ada Admin', email: 'ada@10me.test', active: true, isSuperAdmin: false });
  });

  it('creates a confirmed Admin who can log in with the starter password', async () => {
    const { app, as } = await setup();

    const res = await as('post', '/api/admin/admins', newAdmin);
    const login = await request(app).post('/auth/login').send({ email: newAdmin.email, password: newAdmin.password });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: 'jane@10me.test', role: 'admin' });
    const created = await Account.findOne({ email: 'jane@10me.test' });
    expect(created).toMatchObject({ role: 'admin', name: 'Jane Admin', emailConfirmed: true });
    expect(created!.passwordHash).not.toBe(newAdmin.password);
    expect(login.status).toBe(200);
    expect(login.body.role).toBe('admin');
  });

  it('records the new Admin in the audit log, without the password', async () => {
    const { me, as } = await setup();

    await as('post', '/api/admin/admins', newAdmin);

    const entries = await AuditEntry.find().lean();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: 'admin.created',
      admin: { name: 'Ada Admin' },
      target: { type: 'admin', label: 'Jane Admin' },
    });
    expect(String(entries[0].admin.id)).toBe(me.id);
    expect(JSON.stringify(entries[0])).not.toContain(newAdmin.password);
  });

  it('refuses missing fields and an email already registered to any account', async () => {
    const { as } = await setup();
    await Account.create({ role: 'user', email: 'sarah@example.com' });

    const missing = await as('post', '/api/admin/admins', { name: 'No Email', password: 'x' });
    const blank = await as('post', '/api/admin/admins', { name: '  ', email: 'blank@10me.test', password: 'x' });
    const takenByUser = await as('post', '/api/admin/admins', { ...newAdmin, email: '  Sarah@Example.com ' });

    expect(missing.status).toBe(400);
    expect(blank.status).toBe(400);
    expect(takenByUser.status).toBe(409);
    expect(await Account.countDocuments({ role: 'admin' })).toBe(1);
    expect(await AuditEntry.countDocuments()).toBe(0);
  });

  it('shows admin.created under an "admins" audit filter', async () => {
    const { as } = await setup();
    await as('post', '/api/admin/admins', newAdmin);

    const res = await as('get', '/api/admin/audit-log?category=admins');

    expect(res.body.entries.map((e: { action: string }) => e.action)).toEqual(['admin.created']);
  });
});
