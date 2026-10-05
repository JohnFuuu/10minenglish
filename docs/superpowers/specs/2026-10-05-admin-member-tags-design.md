# Admin-only member tags — design

**Date:** 2026-10-05 · **Status:** approved in conversation, pending spec review

## Goal

Let Admins label Users with tags from a managed list (e.g. "low-income") and see who is in which group. Users must never be able to see their own tags. Tags have no effect on the app yet, but are the foundation for a later rule such as "give low-income members vouchers each week".

## Decisions

| Question | Decision |
|---|---|
| What tags do now | Record-keeping and filtering only; no pricing or voucher effect in this work. |
| Tag vocabulary | A managed list Admins create, rename, and delete. Members reference tags by ID, not by text, so a future rule can rely on a tag. |
| Who can be tagged | Users only (not Buddies or Admins). A User can carry any number of tags. |
| Visibility | Admin-only endpoints. Never in `/api/me`, `/api/profile`, Buddy-facing data, or any email. |
| Audit | Each tag on a member records who added it and when. Removals are not kept (no history). |

## Data model

**`Tag`** — new collection.

| Field | Notes |
|---|---|
| `name` | Display name as typed, trimmed. Required. |
| `nameKey` | `name` lowercased, **unique** — so "Low-income" and "low-income" can't both exist. |

**`Account.memberTags`** — new array on User accounts, default `[]`:

```ts
{ tagId: ObjectId /* → Tag */, addedBy: ObjectId /* → Admin Account */, addedAt: Date }
```

A tag appears at most once per member. Renaming a Tag changes only the `Tag` document; members pick it up automatically. Deleting a Tag removes it from every member (`$pull`) and then deletes the Tag.

**Joined date** — Accounts have no `createdAt` field; the member list derives it from the ObjectId's embedded timestamp (`_id.getTimestamp()`), which needs no migration.

## API (all `requireAuth` + `requireRole('admin')`)

| Method & path | Body / query | Result |
|---|---|---|
| `GET /api/admin/tags` | — | `[{ id, name, memberCount }]`, sorted by name |
| `POST /api/admin/tags` | `{ name }` | `201` tag · `400` blank · `409` name taken (case-insensitive) |
| `PATCH /api/admin/tags/:id` | `{ name }` | `200` tag · `400` blank · `404` · `409` name taken |
| `DELETE /api/admin/tags/:id` | — | `200 { removedFromMembers }` · `404` |
| `GET /api/admin/members` | `?q=` (name/email, case-insensitive substring) `&tagId=` | `[{ id, name, email, joinedAt, credits, tags: [{ id, name, addedAt, addedBy: { id, name } }] }]`, newest first, capped at 200 |
| `POST /api/admin/members/:id/tags` | `{ tagId }` | `200` member (as above). Adding a tag the member already has is a no-op (keeps the original `addedBy`/`addedAt`). `404` unknown member (or not a User) / unknown tag. |
| `DELETE /api/admin/members/:id/tags/:tagId` | — | `200` member. Removing a tag the member doesn't have is a no-op. `404` unknown member. |

`addedBy.name` falls back to the Admin's email when the Admin has no name.

## Admin UI (added to `AdminDashboard`)

1. **Member tags** section — list of tags with member counts; create (inline input), rename (inline edit), delete (confirm stating the member count: "Remove 'low-income' from 12 members?").
2. **Members** section — search box (name/email) and a tag filter dropdown; rows show name, email, joined date, credits, and tag chips. Selecting a member opens a detail panel listing their tags with "added by X, date", a remove control per tag, and a picker to add any tag they don't have yet.

## Keeping tags hidden

- Tags are only read and written through the Admin endpoints above.
- `/api/me`'s and `/api/profile`'s responses are built field by field (no spreading of the Account document), so `memberTags` cannot leak through them; tests assert this explicitly for a tagged User.
- No email or Notification template references tags.

## Built for vouchers later

A future weekly-voucher job finds eligible members with the same query the tag filter uses: `Account.find({ role: 'user', 'memberTags.tagId': tagId })`. Nothing in this work grants anything.

## Out of scope

Vouchers or any pricing effect; tags on Buddies; bulk tagging; CSV export; removal history; pagination beyond the 200-row cap.

## Testing

Backend (Vitest + in-memory Mongo, test-first):
- Tags: create, duplicate (case-insensitive) rejected, blank rejected, rename (and duplicate on rename), delete removes from members and reports the count, member counts.
- Members: search by name and by email, filter by tag, only Users listed, joined date present.
- Assign/unassign: records `addedBy`/`addedAt`, idempotent add keeps the original record, remove, unknown member/tag 404, Buddy target 404.
- Access: every endpoint refuses non-Admins (User → 403).
- Privacy: a tagged User's `/api/me` and `/api/profile` responses contain no tag data.

Frontend: typecheck/build plus a scripted browser walkthrough of both Admin sections.
