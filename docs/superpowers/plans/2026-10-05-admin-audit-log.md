# Admin Audit Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record every successful Admin change in an append-only log and show it on a fifth Admin tab, AUDIT LOG.

**Architecture:** A new `AuditEntry` collection plus one helper, `recordAdminAction()`, that the existing Admin routes call after a change succeeds (never throws). A new Admin-only read endpoint pages entries newest-first by `_id` cursor with a category filter. The frontend adds an `AdminAuditPage` behind `RequireAdmin` and a fifth tab in the Admin bottom bar.

**Tech Stack:** Express 5 + TypeScript + Mongoose (Vitest + supertest + mongodb-memory-server); React + TypeScript + Vite + Tailwind (verified by `tsc`, `npm run build`, scripted Playwright walkthrough).

**Spec:** `docs/superpowers/specs/2026-10-05-admin-audit-log-design.md`

## Global Constraints

- Only Admin actions are recorded: `tag.created`, `tag.renamed`, `tag.deleted`, `member.tag_added`, `member.tag_removed`, `buddy.created`, `buddy.activated`, `buddy.deactivated`, `price.changed`.
- An entry is written only after the change succeeds and only if something actually changed; rejected requests and no-ops write nothing.
- Append-only: the only audit endpoint is `GET /api/admin/audit-log` (`requireAuth` + `requireRole('admin')`).
- Admin and target names are snapshotted into the entry; Admin name falls back to email, then `'Removed admin'`.
- A failed audit write never fails the Admin's action; it is reported with `console.error`.
- Page size 50, newest first by `_id`; `before` cursor; `nextCursor` is the last entry's id when more may follow, else `null`.
- Categories: `tags` → `tag.*`, `memberTags` → `member.*`, `buddies` → `buddy.*`, `pricing` → `price.*`; unknown category or malformed `before` → empty page.

## Review Focus

1. **`category` set to an Object prototype key** (`constructor`, `__proto__`, `toString`) must return an empty page, not crash or match everything — lookup uses `Object.hasOwn`; test in Task 1.
2. **No-op actions** (adding a tag a member already has, double clicks, renaming to the identical name, re-setting a price, PATCHing a Buddy to the state it's already in) must write no entry — guarded by `modifiedCount` / before-after comparison; tests in Task 2.
3. **An Admin with no name** must appear by email — test in Task 2.
4. **A failing audit write** must not turn a successful Admin change into an error — test in Task 2.
5. **Removing a tag from a member after the tag itself was deleted** must not write a bogus entry — the earlier delete already pulled it, so the `$pull` modifies nothing; covered by the no-op guard and tested in Task 2.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/src/models/AuditEntry.ts` (create) | Entry schema, action list, filter categories |
| `backend/src/services/auditLog.ts` (create) | `recordAdminAction()`, `accountLabel()` |
| `backend/src/routes/adminAudit.ts` (create) | `GET /api/admin/audit-log` |
| `backend/src/app.ts` (modify) | Mount the audit router |
| `backend/src/routes/adminMembers.ts`, `admin.ts`, `creditPacks.ts` (modify) | Call `recordAdminAction()` after each change |
| `backend/test/admin/auditLog.test.ts` (create) | Read-endpoint tests |
| `backend/test/admin/auditRecording.test.ts` (create) | One test group per recorded action + no-ops + failure |
| `frontend/src/lib/api.ts` (modify) | `AuditLogEntry` type, `fetchAuditLog()` |
| `frontend/src/pages/admin/AdminAuditPage.tsx` (create) | The tab: filter, sentence rows, load more |
| `frontend/src/components/BottomNav.tsx`, `frontend/src/App.tsx` (modify) | Fifth tab + route |
| `CONTEXT.md` (modify) | Glossary entry |

---

### Task 1: AuditEntry model, recorder, and read endpoint

**Files:**
- Create: `backend/src/models/AuditEntry.ts`, `backend/src/services/auditLog.ts`, `backend/src/routes/adminAudit.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/test/admin/auditLog.test.ts`

**Interfaces:**
- Produces: `AUDIT_ACTIONS`, `type AuditAction`, `type AuditTargetType = 'tag' | 'member' | 'buddy' | 'creditPack'`, `AUDIT_CATEGORIES: Record<string, AuditAction[]>`, `AuditEntry` model; `recordAdminAction(adminId: string, action: AuditAction, target: { type: AuditTargetType; id?: string; label: string }, details?: Record<string, unknown>): Promise<void>`; `accountLabel(account: { name?: string; email?: string }): string`; `createAdminAuditRouter(): Router`; endpoint response `{ entries: { id, action, admin: { id, name }, target: { type, id?, label }, details, createdAt }[], nextCursor: string | null }`.

- [ ] **Step 1: Write the failing tests**

Create `backend/test/admin/auditLog.test.ts`:

```ts
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

    for (const query of [{ category: 'nope' }, { category: 'constructor' }, { category: '__proto__' }, { before: 'not-an-id' }]) {
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run test/admin/auditLog.test.ts`
Expected: FAIL — `Cannot find module '../../src/models/AuditEntry.js'`.

- [ ] **Step 3: Create the model**

Create `backend/src/models/AuditEntry.ts`:

```ts
import mongoose, { Schema } from 'mongoose';

// Append-only record of Admin changes (see
// docs/superpowers/specs/2026-10-05-admin-audit-log-design.md). Nothing in
// the API updates or deletes these.
export const AUDIT_ACTIONS = [
  'tag.created',
  'tag.renamed',
  'tag.deleted',
  'member.tag_added',
  'member.tag_removed',
  'buddy.created',
  'buddy.activated',
  'buddy.deactivated',
  'price.changed',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditTargetType = 'tag' | 'member' | 'buddy' | 'creditPack';

// The Audit log tab's filter options.
export const AUDIT_CATEGORIES: Record<string, AuditAction[]> = {
  tags: ['tag.created', 'tag.renamed', 'tag.deleted'],
  memberTags: ['member.tag_added', 'member.tag_removed'],
  buddies: ['buddy.created', 'buddy.activated', 'buddy.deactivated'],
  pricing: ['price.changed'],
};

export interface AuditEntryDocument extends mongoose.Document {
  action: AuditAction;
  // Snapshotted at write time, so the entry still reads correctly after a
  // rename, a deletion, or an Admin account being removed.
  admin: { id: mongoose.Types.ObjectId; name: string };
  target: { type: AuditTargetType; id?: string; label: string };
  details: Record<string, unknown>;
  createdAt: Date;
}

const adminSnapshotSchema = new Schema(
  { id: { type: Schema.Types.ObjectId, required: true }, name: { type: String, required: true } },
  { _id: false },
);

const targetSnapshotSchema = new Schema(
  {
    type: { type: String, required: true, enum: ['tag', 'member', 'buddy', 'creditPack'] },
    id: { type: String },
    label: { type: String, required: true },
  },
  { _id: false },
);

const auditEntrySchema = new Schema<AuditEntryDocument>(
  {
    action: { type: String, required: true, enum: AUDIT_ACTIONS },
    admin: { type: adminSnapshotSchema, required: true },
    target: { type: targetSnapshotSchema, required: true },
    details: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  // Keep `details: {}` rather than dropping the empty object.
  { minimize: false },
);

export const AuditEntry = mongoose.model<AuditEntryDocument>('AuditEntry', auditEntrySchema);
```

- [ ] **Step 4: Create the recorder**

Create `backend/src/services/auditLog.ts`:

```ts
import { Account } from '../models/Account.js';
import { AuditEntry, type AuditAction, type AuditTargetType } from '../models/AuditEntry.js';

export interface AuditTarget {
  type: AuditTargetType;
  id?: string;
  label: string;
}

// How the log names a member, Buddy, or Admin.
export function accountLabel(account: { name?: string; email?: string }): string {
  return account.name ?? account.email ?? 'Unknown account';
}

// Records one Admin change. Call it after the change has succeeded. Never
// throws: a failed write is reported in the server log rather than undoing
// the Admin's change (no MongoDB transactions in this deployment).
export async function recordAdminAction(
  adminId: string,
  action: AuditAction,
  target: AuditTarget,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    const admin = await Account.findById(adminId, { name: 1, email: 1 });
    await AuditEntry.create({
      action,
      admin: { id: adminId, name: admin ? accountLabel(admin) : 'Removed admin' },
      target,
      details,
    });
  } catch (err) {
    console.error(`Audit log write failed for ${action}`, err);
  }
}
```

- [ ] **Step 5: Create the read endpoint and mount it**

Create `backend/src/routes/adminAudit.ts`:

```ts
import { Router } from 'express';
import { Types } from 'mongoose';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { AUDIT_CATEGORIES, AuditEntry, type AuditEntryDocument } from '../models/AuditEntry.js';

const PAGE_SIZE = 50;
const EMPTY_PAGE = { entries: [], nextCursor: null };

function entryResponse(entry: AuditEntryDocument) {
  return {
    id: String(entry._id),
    action: entry.action,
    admin: { id: String(entry.admin.id), name: entry.admin.name },
    target: { type: entry.target.type, id: entry.target.id, label: entry.target.label },
    details: entry.details ?? {},
    createdAt: entry.createdAt.toISOString(),
  };
}

// Read-only on purpose: the audit log is append-only, so this is the only
// audit endpoint there is.
export function createAdminAuditRouter(): Router {
  const router = Router();

  router.get('/api/admin/audit-log', requireAuth, requireRole('admin'), async (req, res) => {
    const { category, before } = req.query;
    const filter: Record<string, unknown> = {};

    if (category !== undefined && category !== '') {
      // hasOwn, so "constructor"/"__proto__" can't resolve to a prototype value.
      if (typeof category !== 'string' || !Object.hasOwn(AUDIT_CATEGORIES, category)) {
        res.status(200).json(EMPTY_PAGE);
        return;
      }
      filter.action = { $in: AUDIT_CATEGORIES[category] };
    }
    if (before !== undefined && before !== '') {
      if (typeof before !== 'string' || !/^[a-f0-9]{24}$/i.test(before)) {
        res.status(200).json(EMPTY_PAGE);
        return;
      }
      filter._id = { $lt: new Types.ObjectId(before) };
    }

    // One extra row tells us whether another page follows.
    const found = await AuditEntry.find(filter).sort({ _id: -1 }).limit(PAGE_SIZE + 1);
    const page = found.slice(0, PAGE_SIZE);
    res.status(200).json({
      entries: page.map(entryResponse),
      nextCursor: found.length > PAGE_SIZE ? String(page[page.length - 1]._id) : null,
    });
  });

  return router;
}
```

In `backend/src/app.ts`, add next to the other admin router imports:

```ts
import { createAdminAuditRouter } from './routes/adminAudit.js';
```

and mount right after `app.use(createAdminMembersRouter());`:

```ts
  app.use(createAdminAuditRouter());
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && npx tsc --noEmit -p . && npx vitest run test/admin/auditLog.test.ts`
Expected: PASS (6 tests), no type errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/models/AuditEntry.ts backend/src/services/auditLog.ts backend/src/routes/adminAudit.ts backend/src/app.ts backend/test/admin/auditLog.test.ts
git commit -m "Add append-only Admin audit log store and read endpoint"
```

---

### Task 2: Record every Admin action

**Files:**
- Modify: `backend/src/routes/adminMembers.ts`, `backend/src/routes/admin.ts`, `backend/src/routes/creditPacks.ts`
- Test: `backend/test/admin/auditRecording.test.ts`

**Interfaces:**
- Consumes (Task 1): `recordAdminAction`, `accountLabel`, `AuditEntry`.

- [ ] **Step 1: Write the failing tests**

Create `backend/test/admin/auditRecording.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run test/admin/auditRecording.test.ts`
Expected: FAIL — entries lists are empty (`expected [] to deeply equal [...]`). The "audit write fails" test may already pass (nothing records yet); that's expected.

- [ ] **Step 3: Record tag and member tag changes**

In `backend/src/routes/adminMembers.ts`, add the import:

```ts
import { accountLabel, recordAdminAction } from '../services/auditLog.js';
```

In `POST /api/admin/tags`, after `const tag = await Tag.create(...)` and before responding:

```ts
      await recordAdminAction(req.account!.accountId, 'tag.created', { type: 'tag', id: String(tag._id), label: tag.name });
```

In `PATCH /api/admin/tags/:id`, capture the old name before assigning (`const previousName = tag.name;` right before `tag.name = name;`), and after the successful `save()` (before responding):

```ts
    if (previousName !== name) {
      await recordAdminAction(req.account!.accountId, 'tag.renamed', { type: 'tag', id: String(tag._id), label: name }, { from: previousName, to: name });
    }
```

In `DELETE /api/admin/tags/:id`, after `await tag.deleteOne();`:

```ts
    await recordAdminAction(
      req.account!.accountId,
      'tag.deleted',
      { type: 'tag', id: String(tag._id), label: tag.name },
      { removedFromMembers: result.modifiedCount },
    );
```

In `POST /api/admin/members/:id/tags`, capture the update result (`const result = await Account.updateOne(...)`) and after it:

```ts
    if (result.modifiedCount > 0) {
      await recordAdminAction(
        req.account!.accountId,
        'member.tag_added',
        { type: 'member', id: String(member._id), label: accountLabel(member) },
        { tag: tag.name },
      );
    }
```

In `DELETE /api/admin/members/:id/tags/:tagId`, replace the `$pull` block with:

```ts
    if (isObjectIdString(req.params.tagId)) {
      const result = await Account.updateOne({ _id: member._id }, { $pull: { memberTags: { tagId: req.params.tagId } } });
      if (result.modifiedCount > 0) {
        const tag = await Tag.findById(req.params.tagId);
        await recordAdminAction(
          req.account!.accountId,
          'member.tag_removed',
          { type: 'member', id: String(member._id), label: accountLabel(member) },
          { tag: tag?.name ?? 'deleted tag' },
        );
      }
    }
```

- [ ] **Step 4: Record Buddy and price changes**

In `backend/src/routes/admin.ts`, add `import { accountLabel, recordAdminAction } from '../services/auditLog.js';`.

In `POST /api/admin/buddies`, after `const buddy = await Account.create(...)`:

```ts
    await recordAdminAction(req.account!.accountId, 'buddy.created', { type: 'buddy', id: String(buddy._id), label: accountLabel(buddy) });
```

In `PATCH /api/admin/buddies/:id`, after the cancellation loop and before responding:

```ts
    if (wasActive !== active) {
      await recordAdminAction(
        req.account!.accountId,
        active ? 'buddy.activated' : 'buddy.deactivated',
        { type: 'buddy', id: String(buddy._id), label: accountLabel(buddy) },
        active ? {} : { cancelledLessons },
      );
    }
```

In `backend/src/routes/creditPacks.ts`, add `import { recordAdminAction } from '../services/auditLog.js';`. Capture `const fromCents = pack.priceCents;` before `pack.priceCents = priceCents;`, and after `await pack.save();`:

```ts
    if (fromCents !== priceCents) {
      await recordAdminAction(
        req.account!.accountId,
        'price.changed',
        { type: 'creditPack', id: String(packSize), label: `${packSize} credits` },
        { packSize, fromCents, toCents: priceCents },
      );
    }
```

- [ ] **Step 5: Run tests to verify they pass, then the full suite**

Run: `cd backend && npx tsc --noEmit -p . && npx vitest run test/admin test/payments/creditPacks.test.ts && npm test`
Expected: all PASS (6 + 6 new). If the known-flaky `test/profile.test.ts › leaves fields the request omitted untouched` (#26) fails, re-run once and note it.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/adminMembers.ts backend/src/routes/admin.ts backend/src/routes/creditPacks.ts backend/test/admin/auditRecording.test.ts
git commit -m "Record every Admin change in the audit log"
```

---

### Task 3: AUDIT LOG tab

**Files:**
- Modify: `frontend/src/lib/api.ts`, `frontend/src/components/BottomNav.tsx`, `frontend/src/App.tsx`, `CONTEXT.md`
- Create: `frontend/src/pages/admin/AdminAuditPage.tsx`

**Interfaces:**
- Consumes (Task 1): the endpoint response shape.
- Produces: `AuditLogEntry` type; `fetchAuditLog(token: string, filters: { category?: string; before?: string }): Promise<{ entries: AuditLogEntry[]; nextCursor: string | null }>`; `AdminAuditPage`; route `/admin/audit`; tab `AUDIT LOG`.

- [ ] **Step 1: Write the failing browser test**

Create a scratchpad script `audit-tab.mjs` (Playwright, Chrome channel) that:
1. Mints an Admin token for `demo-admin@10me.test` (via `signAccountToken` with the backend's `JWT_SECRET`) and a User token for `demo-user@10me.test`.
2. Via the API as the Admin: creates tag `e2e-audit`, renames it to `e2e-audit-2`, adds it to Demo User, removes it, deletes it; creates Buddy `e2e-audit-buddy@example.com`, deactivates and reactivates it; changes the 1-credit pack to 150 cents and back to its original.
3. Inserts 55 extra `tag.created` entries with labels `e2e-bulk-<n>` directly into `auditentries` (to exercise Load more).
4. Opens `/dashboard` at 390px: asserts the bottom bar is `MEMBERS, TAGS, BUDDIES, PRICING, AUDIT LOG`; taps AUDIT LOG → `/admin/audit`.
5. Asserts 50 rows show, then **Load more** brings in more and the sentences include: `renamed tag e2e-audit to e2e-audit-2`, `added e2e-audit-2 to Demo User`, `removed e2e-audit-2 from Demo User`, `deactivated e2e Audit Buddy (0 upcoming lessons cancelled and refunded)`, `changed 1 credits from $1.00 to $1.50`.
6. Picks **Pricing** in the filter → only price rows.
7. No horizontal overflow at 390px; screenshot.
8. As the User, `/admin/audit` redirects to `/dashboard`.
9. Cleanup: deletes the e2e Buddy account and every audit entry whose `target.label` starts with `e2e` (test-only data; restores the price if needed).

Run: `node audit-tab.mjs`
Expected: FAIL — no AUDIT LOG tab.

- [ ] **Step 2: Add the API client**

Append to `frontend/src/lib/api.ts`:

```ts
// Admin-only, read-only history of Admin changes.
export interface AuditLogEntry {
  id: string;
  action: string;
  admin: { id: string; name: string };
  target: { type: string; id?: string; label: string };
  details: Record<string, unknown>;
  createdAt: string;
}

export function fetchAuditLog(token: string, filters: { category?: string; before?: string }) {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.before) params.set('before', filters.before);
  return request<{ entries: AuditLogEntry[]; nextCursor: string | null }>(`/api/admin/audit-log?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

- [ ] **Step 3: Create the page**

Create `frontend/src/pages/admin/AdminAuditPage.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import { Button, Select } from '../../components';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import { fetchAuditLog, type AuditLogEntry } from '../../lib/api';
import { AdminLayout } from './AdminLayout';

const CATEGORY_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'tags', label: 'Tags' },
  { value: 'memberTags', label: 'Member tags' },
  { value: 'buddies', label: 'Buddies' },
  { value: 'pricing', label: 'Pricing' },
];

const dollars = (cents: unknown) => `$${(Number(cents) / 100).toFixed(2)}`;
const plural = (n: unknown, word: string) => `${Number(n)} ${word}${Number(n) === 1 ? '' : 's'}`;

// One entry as a plain sentence, e.g. "Ada added low-income to Sarah".
function describe(entry: AuditLogEntry): ReactNode {
  const who = entry.admin.name;
  const target = <strong className="text-text-heading">{entry.target.label}</strong>;
  const tag = <strong className="text-text-heading">{String(entry.details.tag ?? '')}</strong>;
  switch (entry.action) {
    case 'tag.created':
      return <>{who} created tag {target}</>;
    case 'tag.renamed':
      return (
        <>
          {who} renamed tag <strong className="text-text-heading">{String(entry.details.from)}</strong> to{' '}
          <strong className="text-text-heading">{String(entry.details.to)}</strong>
        </>
      );
    case 'tag.deleted':
      return <>{who} deleted tag {target} (removed from {plural(entry.details.removedFromMembers, 'member')})</>;
    case 'member.tag_added':
      return <>{who} added {tag} to {target}</>;
    case 'member.tag_removed':
      return <>{who} removed {tag} from {target}</>;
    case 'buddy.created':
      return <>{who} created Buddy account {target}</>;
    case 'buddy.activated':
      return <>{who} activated {target}</>;
    case 'buddy.deactivated':
      return <>{who} deactivated {target} ({plural(entry.details.cancelledLessons, 'upcoming lesson')} cancelled and refunded)</>;
    case 'price.changed':
      return <>{who} changed {target} from {dollars(entry.details.fromCents)} to {dollars(entry.details.toCents)}</>;
    default:
      return <>{who} · {entry.action} · {target}</>;
  }
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Read-only history of every Admin change (append-only on the backend).
export function AdminAuditPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [category, setCategory] = useState('');
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    if (!token) return;
    let superseded = false;
    setIsLoaded(false);
    fetchAuditLog(token, { category })
      .then((res) => {
        if (superseded) return;
        setEntries(res.entries);
        setNextCursor(res.nextCursor);
        setIsLoaded(true);
      })
      .catch(() => {
        if (!superseded) showToast('Could not load the audit log.', 'error');
      });
    return () => {
      superseded = true;
    };
  }, [token, category, showToast]);

  async function loadMore() {
    if (!token || !nextCursor) return;
    setIsLoadingMore(true);
    try {
      const res = await fetchAuditLog(token, { category, before: nextCursor });
      setEntries((prev) => [...prev, ...res.entries]);
      setNextCursor(res.nextCursor);
    } catch {
      showToast('Could not load more entries.', 'error');
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <AdminLayout title="Audit log">
      <p className="mb-4 text-sm font-medium text-text-secondary">Every change made by an Admin, newest first.</p>
      <Select aria-label="Filter actions" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} className="mb-4" />

      {isLoaded && entries.length === 0 && <p className="text-sm text-text-secondary">Nothing recorded yet.</p>}

      {entries.length > 0 && (
        <ul className="divide-y-2 divide-border overflow-hidden rounded-md border-2 border-b-4 border-border-strong bg-bg-surface">
          {entries.map((entry) => (
            <li key={entry.id} className="px-4 py-2.5">
              <p className="text-sm text-text-body">{describe(entry)}</p>
              <p className="mt-0.5 text-xs text-text-secondary">{formatWhen(entry.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}

      {nextCursor && (
        <Button variant="secondary" className="mt-4 w-full" disabled={isLoadingMore} onClick={loadMore}>
          {isLoadingMore ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </AdminLayout>
  );
}
```

- [ ] **Step 4: Add the tab and route**

In `frontend/src/components/BottomNav.tsx`, add an icon before `const USER_TABS`:

```tsx
const AUDIT_ICON = (active: boolean) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : INACTIVE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="13" y2="16" />
  </svg>
);
```

and append to `ADMIN_TABS`: `{ path: '/admin/audit', label: 'AUDIT LOG', icon: AUDIT_ICON },`.

In `frontend/src/App.tsx`, import `AdminAuditPage` from `./pages/admin/AdminAuditPage` and add after the pricing route:

```tsx
            <Route path="/admin/audit" element={<RequireAdmin><AdminAuditPage /></RequireAdmin>} />
```

- [ ] **Step 5: Glossary**

In `CONTEXT.md`, after the **Member tag** entry, add:

```markdown
**Audit log**:
An append-only history of every change an Admin makes — tag create/rename/delete, tagging and untagging members, creating and (de)activating Buddies, and Credit Pack price changes — each recording which Admin, what, the target, and when, with names snapshotted at the time. Admin-only to read; nothing can edit or delete an entry. Member and Buddy activity is not part of it (see docs/superpowers/specs/2026-10-05-admin-audit-log-design.md).
_Avoid_: History, activity feed
```

- [ ] **Step 6: Typecheck, build, and run the browser test**

Run: `cd frontend && npx tsc --noEmit -p . && npm run build`, then `node audit-tab.mjs`, then re-run the existing Admin walkthroughs (`admin-nav.mjs` with its tab-order check updated to include `AUDIT LOG`).
Expected: build passes; every check PASSes; e2e data cleaned up.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/pages/admin/AdminAuditPage.tsx frontend/src/components/BottomNav.tsx frontend/src/App.tsx CONTEXT.md
git commit -m "Add the AUDIT LOG tab to the Admin bottom bar"
```
