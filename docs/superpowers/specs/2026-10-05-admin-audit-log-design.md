# Admin audit log — design

**Date:** 2026-10-05 · **Status:** approved in conversation, pending spec review

## Goal

Keep a permanent, read-only history of every change an Admin makes, viewable on a new **AUDIT LOG** tab in the Admin bottom bar. It is for accountability — who changed what, when — especially for sensitive labels like "low-income" and for live price changes. It is Admin-only: it records only Admin actions and only Admins can read it.

## Decisions

| Question | Decision |
|---|---|
| What is recorded | Admin actions only (table below). No member, Buddy, login, or system activity. |
| When an entry is written | After the change succeeds and only if something actually changed. Rejected attempts and no-ops (e.g. adding a tag a member already has, renaming a tag to the identical name, setting a price to its current value) write nothing. |
| Mutability | Append-only. No endpoint edits or deletes entries. Kept indefinitely. |
| Snapshots | Names/emails of the Admin and target are copied into the entry, so it still reads correctly after a rename, a deletion, or an Admin account being removed. |
| If writing the entry fails | The Admin's change stands; the failure is logged to the server console. No MongoDB transactions (would need a replica-set deployment). |
| History | Starts empty when this ships; no back-filling. |

## Recorded actions

| `action` | Target | `details` |
|---|---|---|
| `tag.created` | tag | — |
| `tag.renamed` | tag | `{ from, to }` |
| `tag.deleted` | tag | `{ removedFromMembers }` |
| `member.tag_added` | member | `{ tag }` (tag name) |
| `member.tag_removed` | member | `{ tag }` |
| `buddy.created` | Buddy | — |
| `buddy.activated` | Buddy | — |
| `buddy.deactivated` | Buddy | `{ cancelledLessons }` |
| `price.changed` | Credit Pack | `{ packSize, fromCents, toCents }` |

Categories for the filter: **tags** (`tag.*`), **memberTags** (`member.*`), **buddies** (`buddy.*`), **pricing** (`price.*`).

## Data model

**`AuditEntry`** — new collection:

| Field | Notes |
|---|---|
| `action` | One of the actions above |
| `admin` | `{ id, name }` — `name` is the Admin's name, falling back to email, captured at write time |
| `target` | `{ type: 'tag' \| 'member' \| 'buddy' \| 'creditPack', id?, label }` — `label` is the tag name, the member/Buddy name (or email), or "N credits" |
| `details` | Action-specific object (table above) |
| `createdAt` | Write time |

Newest-first order uses `_id` (monotonic), which also serves as the paging cursor.

## API

`GET /api/admin/audit-log?category=&before=` — `requireAuth` + `requireRole('admin')`.

- Returns `{ entries: [{ id, action, admin: { id, name }, target: { type, id?, label }, details, createdAt }], nextCursor }`, newest first, 50 per page.
- `category` (optional): `tags` | `memberTags` | `buddies` | `pricing`; an unknown value returns an empty page.
- `before` (optional): an entry id; returns entries older than it. A malformed id returns an empty page.
- `nextCursor` is the last entry's id when more may follow, otherwise `null`.

No other audit endpoints exist (append-only).

## Recording

A single helper, `recordAdminAction(adminId, action, target, details?)`, looks up the Admin's display name, writes the entry, and swallows-and-logs any error. Each Admin route calls it after its change succeeds:

- `routes/adminMembers.ts`: tag create/rename/delete; member tag add/remove (only when the conditional update actually modified the member).
- `routes/admin.ts`: Buddy create; activate/deactivate (only when `active` actually changed).
- `routes/creditPacks.ts`: price change (only when the price actually changed).

## UI

A fifth Admin tab, **AUDIT LOG** (`/admin/audit`), behind `RequireAdmin`, using `AdminLayout`:

- Filter dropdown (the app-styled `Select`): All actions / Tags / Member tags / Buddies / Pricing.
- Compact list (one bordered panel, divider rows), newest first. Each row is a sentence plus timestamp, e.g. *"Demo Admin added **low-income** to **Ziang FU**"* · *5 Oct 2026, 3:04 pm*; *"Demo Admin changed **30 credits** from $30.00 to $25.00"*.
- **Load more** button while `nextCursor` is non-null.
- Empty state: "Nothing recorded yet."

## Out of scope

Filtering by Admin or date range; export; member/Buddy activity; back-filling past actions; tamper-evidence beyond "no API can change it".

## Testing

Backend (test-first):
- Each recorded action writes exactly one entry with the right `action`, `admin`, `target`, `details`.
- Rejected requests and no-ops write nothing.
- Read endpoint: newest first, page size 50 with a working `before` cursor and `nextCursor`, category filter, malformed `before`/unknown `category` → empty page, non-Admin → 403.
- A failing write does not fail the Admin's action.

Frontend: typecheck/build plus a scripted browser walkthrough (tab present, entries render as sentences, filter, load more, non-Admin redirected).
