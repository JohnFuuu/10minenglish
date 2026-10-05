# Admin-only Member Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins can create a managed list of tags, label Users with them, and search/filter Users by tag — with tags never visible to the Users themselves.

**Architecture:** A new `Tag` collection holds the managed list; each User Account gets a `memberTags` array of `{ tagId, addedBy, addedAt }` references. A new Admin-only Express router (`routes/adminMembers.ts`) serves tag CRUD, the member list, and assign/unassign. The Admin dashboard gains two sections, each in its own file under `frontend/src/pages/admin/`.

**Tech Stack:** Express 5 + TypeScript + Mongoose (backend, Vitest + supertest + mongodb-memory-server); React + TypeScript + Vite + Tailwind (frontend, no unit test suite — verified by `tsc`, `npm run build`, and a scripted Playwright walkthrough).

**Spec:** `docs/superpowers/specs/2026-10-05-admin-member-tags-design.md`

## Global Constraints

- Every new endpoint uses `requireAuth` + `requireRole('admin')`; a User token gets `403`.
- Tags are never returned by `/api/me`, `/api/profile`, any Buddy-facing route, or any email.
- Only Accounts with `role: 'user'` can be tagged or appear in the member list.
- Tag names are trimmed; uniqueness is case-insensitive (`nameKey` = trimmed, lowercased name).
- Member list: newest first, capped at 200 rows.
- List endpoints return wrapped objects (`{ tags }`, `{ members }`), matching the existing `GET /api/admin/buddies` → `{ buddies }` shape. (The spec's API table shows bare arrays; this wrapping is the only deviation and is deliberate, for consistency.)
- Joined date comes from the Account ObjectId (`_id.getTimestamp()`); no schema migration.
- `addedBy.name` falls back to the Admin's email, then `'Removed admin'`.

## Review Focus

1. **Search text with regex characters** (e.g. `a+b`, `(`) must be matched literally, not crash with a 500 — test in Task 2.
2. **Malformed ids** in `:id` / `:tagId` / `tagId` (e.g. `not-an-id`) must give `404` (or an empty list for the filter), not a Mongoose CastError 500 — tests in Tasks 1 and 2.
3. **Renaming a tag to a case-only variant of itself** ("low-income" → "Low-income") must succeed, not 409 against its own name — test in Task 1.
4. **Email-less members** (Facebook sign-ups without an email) must still be listed, searchable by name, and taggable — test in Task 2; UI shows "No email" — Task 4.
5. **Adding the same tag twice** (double click / two Admins at once) must never create a duplicate entry — implemented with a single conditional `updateOne`, tested in Task 2.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/src/models/Tag.ts` (create) | The managed tag list: schema, `tagNameKey()` |
| `backend/src/models/Account.ts` (modify) | Add `memberTags` field |
| `backend/src/routes/adminMembers.ts` (create) | All Admin tag + member endpoints and the member response builder |
| `backend/src/app.ts` (modify) | Mount the new router |
| `backend/test/admin/memberTags.test.ts` (create) | Tag CRUD tests |
| `backend/test/admin/members.test.ts` (create) | Member list, assign/unassign, privacy tests |
| `frontend/src/lib/api.ts` (modify) | Admin tag/member API client + types |
| `frontend/src/pages/admin/MemberTagsSection.tsx` (create) | Create/rename/delete tags UI |
| `frontend/src/pages/admin/MembersSection.tsx` (create) | Search/filter members, member detail with tag add/remove |
| `frontend/src/pages/AdminDashboard.tsx` (modify) | Own the tag list, render both sections |
| `CONTEXT.md` (modify) | Glossary entry for Member tag |

---

### Task 1: Tag model and tag management endpoints

**Files:**
- Create: `backend/src/models/Tag.ts`
- Modify: `backend/src/models/Account.ts` (interface ~line 35 area, schema after `availabilityBlocks`)
- Create: `backend/src/routes/adminMembers.ts`
- Modify: `backend/src/app.ts:45` (mount router)
- Test: `backend/test/admin/memberTags.test.ts`

**Interfaces:**
- Produces: `Tag` model (`name`, `nameKey`), `tagNameKey(name: string): string`, `AccountDocument.memberTags: { tagId: Types.ObjectId; addedBy: Types.ObjectId; addedAt: Date }[]`, `createAdminMembersRouter(): Router`, helpers `isObjectIdString(v: unknown): v is string` and `isDuplicateKeyError(err: unknown): boolean` (module-private in `adminMembers.ts`, reused by Task 2).
- Endpoints: `GET /api/admin/tags` → `{ tags: { id, name, memberCount }[] }`; `POST /api/admin/tags` `{ name }` → `201 { id, name, memberCount }`; `PATCH /api/admin/tags/:id` `{ name }` → `200 { id, name, memberCount }`; `DELETE /api/admin/tags/:id` → `200 { removedFromMembers }`.

- [ ] **Step 1: Write the failing tests**

Create `backend/test/admin/memberTags.test.ts`:

```ts
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
    const entry = (tagId: unknown) => ({ tagId, addedBy: adminAccount._id, addedAt: new Date() });
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run test/admin/memberTags.test.ts`
Expected: FAIL — `Cannot find module '../../src/models/Tag.js'`.

- [ ] **Step 3: Create the Tag model**

Create `backend/src/models/Tag.ts`:

```ts
import mongoose, { Schema } from 'mongoose';

// An Admin-managed label for Users (e.g. "low-income") that the User never
// sees. Members reference a Tag by id (Account.memberTags), so renaming a Tag
// here renames it everywhere, and a future rule (e.g. weekly vouchers) can
// rely on it.
export interface TagDocument extends mongoose.Document {
  name: string;
  // Trimmed, lowercased name — makes "Low-income" and "low-income" one tag.
  nameKey: string;
}

const tagSchema = new Schema<TagDocument>({
  name: { type: String, required: true, trim: true },
  nameKey: { type: String, required: true, unique: true },
});

export const Tag = mongoose.model<TagDocument>('Tag', tagSchema);

export function tagNameKey(name: string): string {
  return name.trim().toLowerCase();
}
```

- [ ] **Step 4: Add `memberTags` to Account**

In `backend/src/models/Account.ts`, add to the `AccountDocument` interface (next to `availabilityBlocks`):

```ts
  // Admin-only labels from the managed Tag list (User accounts only). Never
  // returned by any User- or Buddy-facing route — see routes/adminMembers.ts.
  memberTags: { tagId: mongoose.Types.ObjectId; addedBy: mongoose.Types.ObjectId; addedAt: Date }[];
```

And to the schema, right after the `availabilityBlocks` field:

```ts
  memberTags: {
    type: [
      {
        tagId: { type: Schema.Types.ObjectId, ref: 'Tag', required: true },
        // The Admin who added it, and when — the spec's audit trail.
        addedBy: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
        addedAt: { type: Date, required: true },
        _id: false,
      },
    ],
    default: [],
  },
```

- [ ] **Step 5: Create the router with the tag endpoints**

Create `backend/src/routes/adminMembers.ts`:

```ts
import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { Account } from '../models/Account.js';
import { Tag, tagNameKey, type TagDocument } from '../models/Tag.js';

// Admin-only member tags (see docs/superpowers/specs/2026-10-05-admin-member-tags-design.md).
// Everything about tags lives behind these routes: no User- or Buddy-facing
// response includes them.
const adminOnly = [requireAuth, requireRole('admin')];

// Route params and filters come straight from the URL; anything that isn't a
// well-formed id is treated as "not found" instead of reaching Mongoose and
// failing as a CastError (500).
function isObjectIdString(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

function readTagName(body: unknown): string | null {
  const name = (body as { name?: unknown } | undefined)?.name;
  if (typeof name !== 'string' || name.trim() === '') return null;
  return name.trim();
}

async function memberCount(tagId: unknown): Promise<number> {
  return Account.countDocuments({ role: 'user', 'memberTags.tagId': tagId });
}

function tagResponse(tag: TagDocument, count: number) {
  return { id: tag.id as string, name: tag.name, memberCount: count };
}

export function createAdminMembersRouter(): Router {
  const router = Router();

  router.get('/api/admin/tags', ...adminOnly, async (_req, res) => {
    const tags = await Tag.find().sort({ nameKey: 1 });
    const counts = await Account.aggregate<{ _id: unknown; count: number }>([
      { $match: { role: 'user' } },
      { $unwind: '$memberTags' },
      { $group: { _id: '$memberTags.tagId', count: { $sum: 1 } } },
    ]);
    const countByTag = new Map(counts.map((c) => [String(c._id), c.count]));

    res.status(200).json({ tags: tags.map((tag) => tagResponse(tag, countByTag.get(tag.id) ?? 0)) });
  });

  router.post('/api/admin/tags', ...adminOnly, async (req, res) => {
    const name = readTagName(req.body);
    if (!name) {
      res.status(400).json({ error: 'name cannot be empty' });
      return;
    }

    try {
      const tag = await Tag.create({ name, nameKey: tagNameKey(name) });
      res.status(201).json(tagResponse(tag, 0));
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      res.status(409).json({ error: 'A tag with that name already exists' });
    }
  });

  router.patch('/api/admin/tags/:id', ...adminOnly, async (req, res) => {
    const tag = isObjectIdString(req.params.id) ? await Tag.findById(req.params.id) : null;
    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    const name = readTagName(req.body);
    if (!name) {
      res.status(400).json({ error: 'name cannot be empty' });
      return;
    }

    tag.name = name;
    tag.nameKey = tagNameKey(name);
    try {
      await tag.save();
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      res.status(409).json({ error: 'A tag with that name already exists' });
      return;
    }

    res.status(200).json(tagResponse(tag, await memberCount(tag._id)));
  });

  router.delete('/api/admin/tags/:id', ...adminOnly, async (req, res) => {
    const tag = isObjectIdString(req.params.id) ? await Tag.findById(req.params.id) : null;
    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    // Untag everyone first, so no member is ever left pointing at a deleted tag.
    const result = await Account.updateMany(
      { 'memberTags.tagId': tag._id },
      { $pull: { memberTags: { tagId: tag._id } } },
    );
    await tag.deleteOne();

    res.status(200).json({ removedFromMembers: result.modifiedCount });
  });

  return router;
}
```

Renaming to a case-only variant works without a special case: the tag's own `nameKey` is unchanged, so `save()` hits no duplicate.

- [ ] **Step 6: Mount the router**

In `backend/src/app.ts`, add the import next to the admin router import:

```ts
import { createAdminMembersRouter } from './routes/adminMembers.js';
```

and mount it right after `app.use(createAdminRouter({ emailSender }));`:

```ts
  app.use(createAdminMembersRouter());
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && npx tsc --noEmit -p . && npx vitest run test/admin/memberTags.test.ts`
Expected: PASS (10 tests), no type errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/models/Tag.ts backend/src/models/Account.ts backend/src/routes/adminMembers.ts backend/src/app.ts backend/test/admin/memberTags.test.ts
git commit -m "Add Admin-managed member tag list (create, rename, delete)"
```

---

### Task 2: Member list and tag assignment endpoints

**Files:**
- Modify: `backend/src/routes/adminMembers.ts`
- Test: `backend/test/admin/members.test.ts`

**Interfaces:**
- Consumes (Task 1): `Tag`, `AccountDocument.memberTags`, `isObjectIdString`, `adminOnly` in `adminMembers.ts`.
- Produces: `GET /api/admin/members?q=&tagId=` → `{ members: AdminMember[] }`; `POST /api/admin/members/:id/tags` `{ tagId }` → `AdminMember`; `DELETE /api/admin/members/:id/tags/:tagId` → `AdminMember`, where
  `AdminMember = { id: string; name?: string; email?: string; joinedAt: string /* ISO */; credits: number; tags: { id: string; name: string; addedAt: string /* ISO */; addedBy: { id: string; name: string } }[] }`.

- [ ] **Step 1: Write the failing tests**

Create `backend/test/admin/members.test.ts`:

```ts
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

async function admin(name: string | undefined = 'Ada Admin') {
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
    expect((await search('phone')).body.members).toEqual([
      expect.objectContaining({ name: 'Phone Only', email: undefined }),
    ]);
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
    const { token } = await admin(undefined);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run test/admin/members.test.ts`
Expected: FAIL — member endpoints return `404` (routes don't exist). The privacy test should already PASS (it guards existing behaviour; that's expected and fine).

- [ ] **Step 3: Add the member response builder**

In `backend/src/routes/adminMembers.ts`, change the Account import to also bring the document type:

```ts
import { Account, type AccountDocument } from '../models/Account.js';
import type { HydratedDocument } from 'mongoose';
```

and add, below `tagResponse`:

```ts
const MEMBER_LIST_LIMIT = 200;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Builds the Admin view of members in one pass: looks up every referenced
// Tag and Admin together rather than once per member.
async function memberResponses(members: HydratedDocument<AccountDocument>[]) {
  const tagIds = new Set<string>();
  const adminIds = new Set<string>();
  for (const member of members) {
    for (const entry of member.memberTags) {
      tagIds.add(String(entry.tagId));
      adminIds.add(String(entry.addedBy));
    }
  }
  const [tags, admins] = await Promise.all([
    Tag.find({ _id: { $in: [...tagIds] } }),
    Account.find({ _id: { $in: [...adminIds] } }, { name: 1, email: 1 }),
  ]);
  const tagById = new Map(tags.map((t) => [t.id as string, t]));
  const adminById = new Map(admins.map((a) => [a.id as string, a]));

  return members.map((member) => ({
    id: member.id as string,
    name: member.name,
    email: member.email,
    joinedAt: member._id.getTimestamp().toISOString(),
    credits: member.credits,
    tags: member.memberTags
      .filter((entry) => tagById.has(String(entry.tagId)))
      .map((entry) => {
        const addedBy = adminById.get(String(entry.addedBy));
        return {
          id: String(entry.tagId),
          name: tagById.get(String(entry.tagId))!.name,
          addedAt: entry.addedAt.toISOString(),
          addedBy: { id: String(entry.addedBy), name: addedBy?.name ?? addedBy?.email ?? 'Removed admin' },
        };
      }),
  }));
}

async function findMember(id: unknown) {
  return isObjectIdString(id) ? Account.findOne({ _id: id, role: 'user' }) : null;
}
```

- [ ] **Step 4: Add the member endpoints**

Inside `createAdminMembersRouter`, before `return router;`:

```ts
  router.get('/api/admin/members', ...adminOnly, async (req, res) => {
    const { q, tagId } = req.query;
    const filter: Record<string, unknown> = { role: 'user' };

    if (typeof q === 'string' && q.trim() !== '') {
      const pattern = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }];
    }
    if (tagId !== undefined && tagId !== '') {
      if (!isObjectIdString(tagId)) {
        res.status(200).json({ members: [] });
        return;
      }
      filter['memberTags.tagId'] = tagId;
    }

    const members = await Account.find(filter).sort({ _id: -1 }).limit(MEMBER_LIST_LIMIT);
    res.status(200).json({ members: await memberResponses(members) });
  });

  router.post('/api/admin/members/:id/tags', ...adminOnly, async (req, res) => {
    const { tagId } = req.body ?? {};
    const tag = isObjectIdString(tagId) ? await Tag.findById(tagId) : null;
    const member = await findMember(req.params.id);
    if (!member || !tag) {
      res.status(404).json({ error: member ? 'Tag not found' : 'Member not found' });
      return;
    }

    // One conditional update, so a double click or two Admins at once can
    // never add the same tag twice; an existing entry keeps its original
    // addedBy/addedAt.
    await Account.updateOne(
      { _id: member._id, 'memberTags.tagId': { $ne: tag._id } },
      { $push: { memberTags: { tagId: tag._id, addedBy: req.account!.accountId, addedAt: new Date() } } },
    );

    const reloaded = await Account.findById(member._id);
    res.status(200).json((await memberResponses([reloaded!]))[0]);
  });

  router.delete('/api/admin/members/:id/tags/:tagId', ...adminOnly, async (req, res) => {
    const member = await findMember(req.params.id);
    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    if (isObjectIdString(req.params.tagId)) {
      await Account.updateOne({ _id: member._id }, { $pull: { memberTags: { tagId: req.params.tagId } } });
    }

    const reloaded = await Account.findById(member._id);
    res.status(200).json((await memberResponses([reloaded!]))[0]);
  });
```

- [ ] **Step 5: Run tests to verify they pass, then the full suite**

Run: `cd backend && npx tsc --noEmit -p . && npx vitest run test/admin && npm test`
Expected: all PASS (Task 1's 10 + Task 2's 12 new tests; full suite green). If the known-flaky `test/profile.test.ts › leaves fields the request omitted untouched` (#26) fails, re-run once and note it.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/adminMembers.ts backend/test/admin/members.test.ts
git commit -m "Add Admin member list with search, tag filter, and tag assignment"
```

---

### Task 3: Frontend API client and Member tags section

**Files:**
- Modify: `frontend/src/lib/api.ts` (append after `setBuddyActive`, ~line 510)
- Create: `frontend/src/pages/admin/MemberTagsSection.tsx`
- Modify: `frontend/src/pages/AdminDashboard.tsx`

**Interfaces:**
- Consumes (Tasks 1–2): the endpoints above.
- Produces: types `AdminTag`, `AdminMemberTag`, `AdminMember`; functions `fetchAdminTags(token)`, `createAdminTag(token, name)`, `renameAdminTag(token, tagId, name)`, `deleteAdminTag(token, tagId)`, `fetchAdminMembers(token, { q?, tagId? })`, `addMemberTag(token, memberId, tagId)`, `removeMemberTag(token, memberId, tagId)`; component `MemberTagsSection({ tags, onChanged })`.

- [ ] **Step 1: Add the API client**

Append to `frontend/src/lib/api.ts`:

```ts
// Admin-only member tags — never fetched by any User-facing screen.
export interface AdminTag {
  id: string;
  name: string;
  memberCount: number;
}

export interface AdminMemberTag {
  id: string;
  name: string;
  addedAt: string;
  addedBy: { id: string; name: string };
}

export interface AdminMember {
  id: string;
  name?: string;
  email?: string;
  joinedAt: string;
  credits: number;
  tags: AdminMemberTag[];
}

export function fetchAdminTags(token: string) {
  return request<{ tags: AdminTag[] }>('/api/admin/tags', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createAdminTag(token: string, name: string) {
  return request<AdminTag>('/api/admin/tags', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  });
}

export function renameAdminTag(token: string, tagId: string, name: string) {
  return request<AdminTag>(`/api/admin/tags/${tagId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  });
}

export function deleteAdminTag(token: string, tagId: string) {
  return request<{ removedFromMembers: number }>(`/api/admin/tags/${tagId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function fetchAdminMembers(token: string, filters: { q?: string; tagId?: string }) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.tagId) params.set('tagId', filters.tagId);
  return request<{ members: AdminMember[] }>(`/api/admin/members?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function addMemberTag(token: string, memberId: string, tagId: string) {
  return request<AdminMember>(`/api/admin/members/${memberId}/tags`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tagId }),
  });
}

export function removeMemberTag(token: string, memberId: string, tagId: string) {
  return request<AdminMember>(`/api/admin/members/${memberId}/tags/${tagId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

- [ ] **Step 2: Create the Member tags section**

Create `frontend/src/pages/admin/MemberTagsSection.tsx`:

```tsx
import { useState } from 'react';
import { Button, Input } from '../../components';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import { ApiError, createAdminTag, deleteAdminTag, renameAdminTag, type AdminTag } from '../../lib/api';

const SECTION_HEADING =
  'mb-1 inline-block rounded-md bg-accent-lime-light px-3 py-1 text-sm font-bold uppercase tracking-wide text-success';

function tagErrorMessage(err: unknown): string {
  return err instanceof ApiError && err.status === 409
    ? 'A tag with that name already exists.'
    : 'Could not save that tag. Please try again.';
}

// The managed tag list. Tags are Admin-only labels (e.g. "low-income") that
// members never see; members carry them by reference, so a rename here
// applies to everyone tagged.
export function MemberTagsSection({ tags, onChanged }: { tags: AdminTag[]; onChanged: () => void }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      showToast(success, 'success');
      onChanged();
      return true;
    } catch (err) {
      showToast(tagErrorMessage(err), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (await run(() => createAdminTag(token!, name), `Tag "${name}" created.`)) setNewName('');
  }

  async function handleRename(tag: AdminTag) {
    const name = editName.trim();
    if (!name) return;
    if (await run(() => renameAdminTag(token!, tag.id, name), `Renamed to "${name}".`)) setEditingId(null);
  }

  async function handleDelete(tag: AdminTag) {
    if (await run(() => deleteAdminTag(token!, tag.id), `Tag "${tag.name}" deleted.`)) setConfirmingDeleteId(null);
  }

  return (
    <section className="mb-10">
      <h2 className={SECTION_HEADING}>Member tags</h2>
      <p className="mb-4 text-sm font-medium text-text-secondary">
        Private labels for grouping members, e.g. "low-income". Members never see their tags.
      </p>

      <form onSubmit={handleCreate} className="mb-4 flex items-end gap-2">
        <div className="flex-1">
          <Input label="New tag" placeholder="e.g. low-income" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </div>
        <Button type="submit" size="sm" disabled={busy || !newName.trim()}>
          Add tag
        </Button>
      </form>

      {tags.length === 0 && <p className="text-sm text-text-secondary">No tags yet.</p>}

      <div className="flex flex-col gap-2">
        {tags.map((tag) => (
          <div
            key={tag.id}
            className="flex items-center justify-between gap-3 rounded-md border-2 border-b-4 border-border-strong bg-bg-surface p-3"
          >
            {editingId === tag.id ? (
              <>
                <input
                  aria-label={`Rename ${tag.name}`}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border-2 border-border px-2 py-1 text-sm"
                />
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" disabled={busy || !editName.trim()} onClick={() => handleRename(tag)}>
                    Save
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : confirmingDeleteId === tag.id ? (
              <>
                <p className="min-w-0 flex-1 text-sm font-bold text-text-body">
                  Remove "{tag.name}" from {tag.memberCount} member{tag.memberCount === 1 ? '' : 's'} and delete it?
                </p>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" disabled={busy} onClick={() => handleDelete(tag)}>
                    Delete
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setConfirmingDeleteId(null)}>
                    Keep
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="min-w-0">
                  <p className="truncate font-bold text-text-heading">{tag.name}</p>
                  <p className="text-xs font-bold uppercase tracking-wide text-text-secondary">
                    {tag.memberCount} member{tag.memberCount === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setEditName(tag.name);
                      setEditingId(tag.id);
                    }}
                  >
                    Rename
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setConfirmingDeleteId(tag.id)}>
                    Delete
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Wire it into the dashboard**

In `frontend/src/pages/AdminDashboard.tsx`:
1. Add `fetchAdminTags` and `type AdminTag` to the `../lib/api` import, and `import { MemberTagsSection } from './admin/MemberTagsSection';`.
2. Inside `AdminDashboard`, after the `rosterKey` state, add:

```tsx
  const { showToast } = useToast();
  // Owned here so the Members section's tag picker and filter stay in step
  // with the Member tags section.
  const [tags, setTags] = useState<AdminTag[]>([]);
  const loadTags = useCallback(async () => {
    if (!token) return;
    try {
      setTags((await fetchAdminTags(token)).tags);
    } catch {
      showToast('Could not load member tags.', 'error');
    }
  }, [token, showToast]);
  useEffect(() => {
    loadTags();
  }, [loadTags]);
```

3. Render `<MemberTagsSection tags={tags} onChanged={loadTags} />` right after `<BuddyRoster refreshKey={rosterKey} />`.

- [ ] **Step 4: Typecheck and build**

Run: `cd frontend && npx tsc --noEmit -p . && npm run build`
Expected: no errors; `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/pages/admin/MemberTagsSection.tsx frontend/src/pages/AdminDashboard.tsx
git commit -m "Add Member tags section to the Admin dashboard"
```

---

### Task 4: Members section, browser walkthrough, and docs

**Files:**
- Create: `frontend/src/pages/admin/MembersSection.tsx`
- Modify: `frontend/src/pages/AdminDashboard.tsx`
- Modify: `CONTEXT.md` (new glossary entry after **Credit Pack**)

**Interfaces:**
- Consumes (Task 3): `fetchAdminMembers`, `addMemberTag`, `removeMemberTag`, `AdminMember`, `AdminTag`; the dashboard's `tags` state and `loadTags`.
- Produces: component `MembersSection({ tags, onTagsChanged })`.

- [ ] **Step 1: Create the Members section**

Create `frontend/src/pages/admin/MembersSection.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../toast/ToastContext';
import { addMemberTag, fetchAdminMembers, removeMemberTag, type AdminMember, type AdminTag } from '../../lib/api';

const SECTION_HEADING =
  'mb-1 inline-block rounded-md bg-accent-lime-light px-3 py-1 text-sm font-bold uppercase tracking-wide text-success';
const FIELD = 'rounded-md border-2 border-border bg-bg-surface px-3 py-2 text-sm text-text-body';
const SEARCH_DEBOUNCE_MS = 300;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function TagChip({ name }: { name: string }) {
  return (
    <span className="rounded-full bg-accent-lime-light px-2 py-0.5 text-xs font-bold text-success">{name}</span>
  );
}

// Admin-only list of Users with search, tag filter, and per-member tagging.
export function MembersSection({ tags, onTagsChanged }: { tags: AdminTag[]; onTagsChanged: () => void }) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Re-run when the search, the filter, or the tag list itself changes (a
  // rename or delete in the Member tags section changes what rows show).
  useEffect(() => {
    if (!token) return;
    const timer = setTimeout(() => {
      fetchAdminMembers(token, { q: query.trim(), tagId: tagFilter })
        .then((res) => setMembers(res.members))
        .catch(() => showToast('Could not load members.', 'error'));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [token, query, tagFilter, tags, showToast]);

  const selected = members.find((m) => m.id === selectedId) ?? null;

  async function change(action: () => Promise<AdminMember>) {
    setBusy(true);
    try {
      const updated = await action();
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      onTagsChanged(); // member counts on the tag list
    } catch {
      showToast('Could not update that member’s tags.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-10">
      <h2 className={SECTION_HEADING}>Members</h2>
      <p className="mb-4 text-sm font-medium text-text-secondary">Find a member to see or change their tags.</p>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="Search members"
          placeholder="Search name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${FIELD} flex-1`}
        />
        <select aria-label="Filter by tag" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className={FIELD}>
          <option value="">All members</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              Tagged: {tag.name}
            </option>
          ))}
        </select>
      </div>

      {members.length === 0 && <p className="text-sm text-text-secondary">No members match.</p>}

      <div className="flex flex-col gap-2">
        {members.map((member) => (
          <div key={member.id} className="rounded-md border-2 border-b-4 border-border-strong bg-bg-surface">
            <button
              type="button"
              onClick={() => setSelectedId(selectedId === member.id ? null : member.id)}
              className="flex w-full flex-col items-start gap-1 p-3 text-left"
            >
              <span className="font-bold text-text-heading">{member.name ?? 'No name'}</span>
              <span className="text-xs text-text-secondary">
                {member.email ?? 'No email'} · joined {formatDate(member.joinedAt)} · {member.credits} credit
                {member.credits === 1 ? '' : 's'}
              </span>
              {member.tags.length > 0 && (
                <span className="flex flex-wrap gap-1">
                  {member.tags.map((t) => (
                    <TagChip key={t.id} name={t.name} />
                  ))}
                </span>
              )}
            </button>

            {selected?.id === member.id && (
              <div className="flex flex-col gap-2 border-t-2 border-border p-3">
                {member.tags.length === 0 && <p className="text-sm text-text-secondary">No tags yet.</p>}
                {member.tags.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <TagChip name={t.name} />
                      <p className="mt-0.5 text-xs text-text-secondary">
                        added by {t.addedBy.name}, {formatDate(t.addedAt)}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${t.name}`}
                      disabled={busy}
                      onClick={() => change(() => removeMemberTag(token!, member.id, t.id))}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 border-border"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}

                {tags.some((tag) => !member.tags.some((t) => t.id === tag.id)) && (
                  <select
                    aria-label="Add a tag"
                    value=""
                    disabled={busy}
                    onChange={(e) => e.target.value && change(() => addMemberTag(token!, member.id, e.target.value))}
                    className={FIELD}
                  >
                    <option value="">Add a tag…</option>
                    {tags
                      .filter((tag) => !member.tags.some((t) => t.id === tag.id))
                      .map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Render it on the dashboard**

In `frontend/src/pages/AdminDashboard.tsx`, add `import { MembersSection } from './admin/MembersSection';` and render `<MembersSection tags={tags} onTagsChanged={loadTags} />` directly after `<MemberTagsSection … />`.

- [ ] **Step 3: Typecheck and build**

Run: `cd frontend && npx tsc --noEmit -p . && npm run build`
Expected: no errors; `✓ built`.

- [ ] **Step 4: Browser walkthrough**

With the backend (`:4000`) and frontend (`:5173`) dev servers running, run a scratchpad Playwright script that:
1. Mints an Admin session token for `demo-admin@10me.test` (sign with the backend's `JWT_SECRET` via `signAccountToken`) and sets it in `localStorage['10me.token']` before loading `/dashboard`.
2. Creates tag `e2e-low-income`; asserts it appears with "0 members".
3. Tries to create `E2E-LOW-INCOME`; asserts the "already exists" toast.
4. In Members, searches `Demo User`, opens the row, picks `e2e-low-income` from "Add a tag…"; asserts the chip and "added by Demo Admin".
5. Filters by "Tagged: e2e-low-income"; asserts only that member is listed; asserts the tag now shows "1 member".
6. Renames the tag to `e2e-renamed`; asserts the member's chip updates.
7. Logs in as `demo-user@10me.test` (password `DemoPass123!`) via `POST /auth/login`, fetches `/api/me` and `/api/profile`, asserts neither response text contains `e2e-renamed` or `memberTags`.
8. Deletes the tag (confirm shows "from 1 member"); asserts it's gone and the member has no chip.
9. Takes a phone-width (390px) screenshot of the Admin dashboard and checks there's no horizontal overflow (`document.documentElement.scrollWidth <= 390`).

Expected: every assertion passes; no tag data left in the DB afterwards (`db.tags.countDocuments({name:/^e2e-/}) === 0`).

- [ ] **Step 5: Add the glossary entry**

In `CONTEXT.md`, after the **Credit Pack** entry, add:

```markdown
**Member tag**:
An Admin-managed label on a User (e.g. "low-income"), chosen from a managed list Admins create, rename, and delete. Private: it never appears anywhere the User or a Buddy can see it, and each tag on a member records which Admin added it and when. Tags have no effect on what a User can do or pay today; they are the hook for future rules such as weekly vouchers for a group (see docs/superpowers/specs/2026-10-05-admin-member-tags-design.md).
_Avoid_: Label, category, segment
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/admin/MembersSection.tsx frontend/src/pages/AdminDashboard.tsx CONTEXT.md
git commit -m "Add Admin Members section with search, tag filter, and tagging"
```
