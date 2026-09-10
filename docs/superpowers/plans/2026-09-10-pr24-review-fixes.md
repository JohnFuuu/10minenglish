# PR #24 Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the real defects found by the Standards+Spec review of the merged PR #24 (`git diff 1f57858...f562204` on `develop`), and record why the rest of the review's findings turned out not to need code changes.

**Architecture:** Four small, independent, single-file patches — one test-determinism fix found while verifying a clean baseline (Task 0), one glossary-copy fix, one documentation-comment fix, and one dependency-wiring fix in the server composition root. No new abstractions, no schema changes, no new endpoints.

**Note on Task 0:** Not part of the original review. Running `cd backend && npm test` as the baseline check before Task 1 turned up a reproducible failure in `test/lessons/reschedule.test.ts`, unrelated to the 3 review-driven tasks. Confirmed with the human partner as worth fixing before proceeding rather than deferring.

**Tech Stack:** Backend: Express + TypeScript + MongoDB/Mongoose, tested with Vitest against a real in-memory MongoDB (no mocking — see `README.md`). Frontend: React + TypeScript + Vite + Tailwind, no automated test suite — verified with `npm run build` plus manual/exploratory testing in the browser.

**Spec:** The Standards+Spec review conducted in this session against `git diff 1f57858...f562204` (PR #24: closes #4, #12, #14, #11, #25, #1), cross-checked against `CONTEXT.md` and `docs/adr/0002`, `docs/adr/0005`. No separate spec file exists; the findings are restated in full below so this plan is self-contained.

## Global Constraints

- Domain glossary terms are fixed by `CONTEXT.md` — never reintroduce an explicitly "avoided" synonym (e.g. Buddy's persistent meeting room must always be called **Zoom link**, never "meeting link", per ADR-0002).
- Backend changes must keep `createApp()` returning a bare Express app — dozens of existing test files (`backend/test/**/*.test.ts`) call `createApp()` or `createApp({ ...deps })` and pass the return value straight into `supertest()`. Do not change that return shape.
- Frontend has no automated test suite (README, "Tech stack"). Frontend tasks are verified by `npm run build` (type-check) plus a manual check in the browser, not by writing new tests.
- Every task must leave `cd backend && npm test` green and `cd backend && npm run build` / `cd frontend && npm run build` clean before committing.
- Tests must not depend on wall-clock date/day — a test asserting behavior tied to a specific day-of-week or narrow time window must compute its fixture deterministically relative to "now", never via a fixed hour-offset that happens to work only on some days.

---

## Findings disposition (why only 3 of the 9 original review findings get a task)

The original review (Standards + Spec sub-agents against the diff) reported 9 findings. Before turning each into a fix task, each was re-verified directly against the current code. Six turned out not to need a code change:

| # | Finding | Verified outcome |
| --- | --- | --- |
| Spec (a) | #4: email Save doesn't immediately change the visible email | **Not a bug.** `frontend/src/pages/ProfileScreen.tsx:112-114` already shows "Changes saved. Confirm `<email>` from your inbox to finish switching your email." and a persistent "Pending: ... — confirm it from your inbox to switch" banner (`ProfileScreen.tsx:169-172`). The UI already makes the two-step nature explicit; no change needed. |
| Spec (b) | Pending-email confirmation workflow is scope creep beyond #4's AC | **Deliberate, not creep.** Prevents an email typo from locking a User out — a real correctness property, already justified in the PR body. No revert. |
| Spec (b) | Admin Deactivate→Confirm dialog is scope creep beyond #14's AC | **Deliberate.** A two-step confirm on an action that auto-cancels a Buddy's upcoming Lessons is a reasonable safeguard, not unwanted behavior. No revert. |
| Spec (b) | `hasZoomLink` field on `GET /api/admin/buddies` is scope creep beyond #14's AC | **Used, not dead.** `frontend/src/pages/AdminDashboard.tsx:147` reads it to show "· no zoom link yet" in the roster. Cheap and in use. No action. |
| Spec (c) | Deactivated favourited Buddy silently disappears from the Favourites tab | **Deliberate, documented in this same diff.** `backend/src/services/lessonBooking.ts:137-140` (added by commit for #14): "One definition of 'a Buddy a User may book' ... Every list and every booking path filters on this, so a deactivated Buddy disappears from all of them at once." This is the stated design, not an oversight. No change. |
| Spec (c) | Reschedule returns `403` instead of `404` for another User's Lesson | **Not an inconsistency.** `backend/src/routes/lessons.ts`'s existing cancel handler (lines ~361-365, ~391-395) uses the identical pattern — `404` for lesson-not-found, `403` for wrong-owner. Reschedule (lines ~283, ~287) matches it exactly. No change. |

The 3 that are real and get a task below (plus Task 0, found during baseline verification):

| Task | Finding | File |
| --- | --- | --- |
| 0 | Flaky, date-dependent test: asserts a fixed `hoursFromNow(100)` offset lands outside a Monday-only availability window — true only on some calendar days | `backend/test/lessons/reschedule.test.ts:142-155` |
| 1 | Glossary violation: "meeting link" should be "Zoom link" (ADR-0002 / `CONTEXT.md`) | `frontend/src/pages/BuddyScreen.tsx:103` |
| 2 | `REFUND_CUTOFF_HOURS` lacks the "mirrors the backend" comment every other mirrored constant in the same file has, understating that ADR-0005's "cannot drift apart" guarantee doesn't hold end-to-end for this one | `frontend/src/pages/LessonsScreen.tsx:16` |
| 3 | Reminder sweep in `server.ts` hardcodes `consoleEmailSender` independently of `createApp`'s dependency resolution — if a real `EmailSender` is ever wired into `createApp`, reminders would silently keep going to the console-only sender instead | `backend/src/server.ts` |

---

## File Structure

No new files. Four existing files get a small, localized edit each:

- `backend/test/lessons/reschedule.test.ts` — replace one flaky fixture computation with a deterministic one.
- `frontend/src/pages/BuddyScreen.tsx` — fix one string.
- `frontend/src/pages/LessonsScreen.tsx` — add one comment line.
- `backend/src/server.ts` — resolve `emailSender` once in `main()` and share it between `createApp()` and the reminder sweep, instead of resolving it twice.

---

### Task 0: Fix flaky date-dependent test in reschedule.test.ts

**Files:**
- Modify: `backend/test/lessons/reschedule.test.ts:142-155`

**Interfaces:** None — test-only change, no production code or exported signature touched.

**Root cause:** The test sets the Buddy's only availability block to `{ dayOfWeek: 1 (Monday), startTime: '09:00', endTime: '10:00' }` (UTC — `createPair()` sets `timezone: 'UTC'`), then asserts `hoursFromNow(100)` is rejected as outside that window. `hoursFromNow(100)` is `Date.now() + 100h`, a fixed offset with no relationship to which day-of-week or time-of-day "now" actually is. Confirmed today (2026-09-10, run at 05:40 UTC): `new Date(Date.now() + 100*3600*1000)` = `2026-09-14T09:40:46Z`, which is a Monday at 09:40 UTC — *inside* the 09:00-10:00 window the test is trying to be outside of, so the assertion (`expect(res.status).toBe(409)`) fails with `200` instead. On a different day of the month this same code can pass. The fix must not depend on which day it runs.

- [ ] **Step 1: Confirm the failure and its cause**

Run: `cd backend && npx vitest run test/lessons/reschedule.test.ts -t "rejects a time outside the Buddy's availability"`

Expected (current, broken state): `AssertionError: expected 200 to be 409`.

- [ ] **Step 2: Replace the fixed offset with a deterministic non-Monday instant**

Current (`backend/test/lessons/reschedule.test.ts:142-155`):

```ts
  it("rejects a time outside the Buddy's availability", async () => {
    const { user, buddy, token } = await createPair();
    await Account.updateOne(
      { _id: buddy.id },
      { availabilityBlocks: [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }] },
    );
    const lesson = await createLesson(user.id, buddy.id, 48);

    const { app } = createTestApp();
    const res = await request(app)
      .patch(`/api/lessons/${lesson.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startTime: hoursFromNow(100) });

    expect(res.status).toBe(409);
  });
```

Change to:

```ts
  it("rejects a time outside the Buddy's availability", async () => {
    const { user, buddy, token } = await createPair();
    await Account.updateOne(
      { _id: buddy.id },
      { availabilityBlocks: [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' }] },
    );
    const lesson = await createLesson(user.id, buddy.id, 48);

    const { app } = createTestApp();
    const res = await request(app)
      .patch(`/api/lessons/${lesson.id}`)
      .set('Authorization', `Bearer ${token}`)
      // The Buddy's only availability block above is Monday-only, so any
      // instant that isn't a Monday is guaranteed outside it regardless of
      // what day this test happens to run on.
      .send({ startTime: firstNonMondayInstant(48) });

    expect(res.status).toBe(409);
  });
```

Add the helper next to `hoursFromNow` (`backend/test/lessons/reschedule.test.ts:54-56`):

Current:

```ts
function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * HOUR_MS).toISOString();
}
```

Change to:

```ts
function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * HOUR_MS).toISOString();
}

// Walks forward a day at a time from `startHoursAhead` until landing on a
// day that isn't Monday (UTC), so tests asserting "outside a Monday-only
// availability block" don't depend on which day they happen to run.
function firstNonMondayInstant(startHoursAhead: number): string {
  const date = new Date(Date.now() + startHoursAhead * HOUR_MS);
  while (date.getUTCDay() === 1) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString();
}
```

- [ ] **Step 3: Run the fixed test**

Run: `cd backend && npx vitest run test/lessons/reschedule.test.ts -t "rejects a time outside the Buddy's availability"`

Expected: passes (`1 passed`).

- [ ] **Step 4: Run the full backend suite**

Run: `cd backend && npm test`

Expected: `Test Files  28 passed (28)`, `Tests  165 passed (165)` — the one previously-failing test now passes, no other regressions.

- [ ] **Step 5: Commit**

```bash
git add backend/test/lessons/reschedule.test.ts
git commit -m "fix: make reschedule availability test independent of the current day of week"
```

---

### Task 1: Fix glossary violation in BuddyScreen.tsx

**Files:**
- Modify: `frontend/src/pages/BuddyScreen.tsx:103`

**Interfaces:** None — this is a string literal change with no signature impact.

- [ ] **Step 1: Confirm this is the only remaining "meeting link" reference**

Run: `grep -rn "meeting link" frontend/src backend/src`

Expected: exactly one hit — `frontend/src/pages/BuddyScreen.tsx:103:              This buddy hasn't set up a meeting link yet, so they can't be booked.`

If there are other hits, add them to this task's Step 2 before continuing.

- [ ] **Step 2: Fix the copy**

Current (`frontend/src/pages/BuddyScreen.tsx:101-105`):

```tsx
          {!buddy.bookable && (
            <p className="mt-2 text-center text-sm text-text-secondary">
              This buddy hasn't set up a meeting link yet, so they can't be booked.
            </p>
          )}
```

Change to:

```tsx
          {!buddy.bookable && (
            <p className="mt-2 text-center text-sm text-text-secondary">
              This buddy hasn't set up a Zoom link yet, so they can't be booked.
            </p>
          )}
```

- [ ] **Step 3: Re-run the grep to confirm zero remaining hits**

Run: `grep -rn "meeting link" frontend/src backend/src`

Expected: no output.

- [ ] **Step 4: Type-check the frontend**

Run: `cd frontend && npm run build`

Expected: builds cleanly, same warnings as before this change (two pre-existing fast-refresh warnings per PR #24's own verification notes — no new ones).

- [ ] **Step 5: Manual check in the browser**

Start the frontend dev server (`npm run dev` from `frontend/`), sign in as a User, open a Buddy's page for a Buddy with no Zoom link set (or temporarily clear one in Mongo), and confirm the page now reads "This buddy hasn't set up a Zoom link yet, so they can't be booked."

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/BuddyScreen.tsx
git commit -m "fix: use glossary term Zoom link instead of meeting link in BuddyScreen"
```

---

### Task 2: Document that LessonsScreen's cutoff constant mirrors the backend

**Files:**
- Modify: `frontend/src/pages/LessonsScreen.tsx:16`

**Interfaces:** None — comment-only change, no runtime behavior change.

- [ ] **Step 1: Confirm the current state**

Run: `sed -n '14,32p' frontend/src/pages/LessonsScreen.tsx`

Expected to see `const REFUND_CUTOFF_HOURS = 12;` on line 16 with no explanatory comment above it, while `JOIN_WINDOW_MINUTES_BEFORE` two constants below it does have a "Mirrors the backend's ..." comment (lines 18-20) — that's the local convention this constant is missing.

- [ ] **Step 2: Add the mirroring comment**

Current (`frontend/src/pages/LessonsScreen.tsx:16`):

```tsx
const REFUND_CUTOFF_HOURS = 12;
```

Change to:

```tsx
// Mirrors the backend's CANCELLATION_REFUND_CUTOFF_HOURS (lessonBooking.ts),
// which both the cancellation-refund rule and the reschedule rule read from
// (see docs/adr/0005) — update both places together if this ever changes.
const REFUND_CUTOFF_HOURS = 12;
```

- [ ] **Step 3: Type-check the frontend**

Run: `cd frontend && npm run build`

Expected: clean build, no new warnings (comment-only change).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/LessonsScreen.tsx
git commit -m "docs: note that LessonsScreen's refund cutoff mirrors the backend constant"
```

---

### Task 3: Share one resolved emailSender between createApp and the reminder sweep

**Files:**
- Modify: `backend/src/server.ts`

**Interfaces:**
- Consumes: `createApp(deps: AppDependencies)` from `backend/src/app.ts` — `AppDependencies.emailSender?: EmailSender`, defaults to `consoleEmailSender` inside `createApp` today.
- Consumes: `sendDueLessonReminders(deps: { emailSender: EmailSender })` from `backend/src/services/lessonReminders.ts` — signature unchanged by this task.
- Produces: nothing new consumed elsewhere — `server.ts`'s `main()` is the process entrypoint, not imported by any test.

Today, `main()` in `server.ts` builds its `emailSender` independently of `createApp`'s own default-resolution (`deps.emailSender ?? consoleEmailSender` in `app.ts:27`). Both currently resolve to the same `consoleEmailSender`, so there's no observable bug yet — but the two resolutions are separate code paths with no shared source, exactly the DI pattern the rest of this PR (`createMeRouter({ emailSender })`, `createAdminRouter({ emailSender })`, etc.) was built to guarantee against. If a real `EmailSender` is ever passed into `createApp` (the same way `PAYMENTS_MOCK` already swaps in mock payment clients), the reminder sweep would keep silently using `consoleEmailSender` and pre-lesson reminder emails would never actually be delivered. Fixing this now, while it's a one-line diff, is cheaper than fixing it after it's a live bug.

There is no unit test for `server.ts`'s `main()` (it isn't imported by any file under `backend/test/`, consistent with it being the process composition root — same reason `app.ts`'s test coverage goes through `createApp()` directly, not through `server.ts`). This task is verified by `npm run build` (type-check) and a manual run, per the Global Constraints.

- [ ] **Step 1: Confirm current behavior**

Run: `sed -n '1,40p' backend/src/server.ts`

Expected to see (current `backend/src/server.ts`):

```ts
async function main() {
  await connectToDatabase(MONGODB_URI!);
  const app = createApp(
    PAYMENTS_MOCK ? { stripeClient: mockStripeClient, poliClient: mockPoliClient } : {},
  );
  if (PAYMENTS_MOCK) {
    console.log('PAYMENTS_MOCK=true — Stripe/POLi checkout will auto-succeed, no real provider calls.');
  }
  app.listen(PORT, () => {
    console.log(`10ME backend listening on port ${PORT}`);
  });

  // Reminders are time-scheduled rather than request-driven, so the server
  // sweeps for them itself. Swap this for an external scheduler calling
  // sendDueLessonReminders if the app is ever run as more than one instance.
  const emailSender = consoleEmailSender;
  setInterval(() => {
    sendDueLessonReminders({ emailSender }).catch((err) => {
      console.error('Lesson reminder sweep failed', err);
    });
  }, REMINDER_SWEEP_INTERVAL_MS);
  console.log(`Lesson reminders sweeping every ${REMINDER_SWEEP_INTERVAL_MS / 1000}s, ${REMINDER_LEAD_MINUTES}min ahead of each lesson.`);
}
```

- [ ] **Step 2: Resolve emailSender once and pass it to both consumers**

Replace the body of `main()` shown above with:

```ts
async function main() {
  await connectToDatabase(MONGODB_URI!);
  const emailSender = consoleEmailSender;
  const app = createApp(
    PAYMENTS_MOCK
      ? { emailSender, stripeClient: mockStripeClient, poliClient: mockPoliClient }
      : { emailSender },
  );
  if (PAYMENTS_MOCK) {
    console.log('PAYMENTS_MOCK=true — Stripe/POLi checkout will auto-succeed, no real provider calls.');
  }
  app.listen(PORT, () => {
    console.log(`10ME backend listening on port ${PORT}`);
  });

  // Reminders are time-scheduled rather than request-driven, so the server
  // sweeps for them itself. Swap this for an external scheduler calling
  // sendDueLessonReminders if the app is ever run as more than one instance.
  // Uses the same emailSender passed into createApp above, so there is one
  // place — not two — that decides how this process sends email.
  setInterval(() => {
    sendDueLessonReminders({ emailSender }).catch((err) => {
      console.error('Lesson reminder sweep failed', err);
    });
  }, REMINDER_SWEEP_INTERVAL_MS);
  console.log(`Lesson reminders sweeping every ${REMINDER_SWEEP_INTERVAL_MS / 1000}s, ${REMINDER_LEAD_MINUTES}min ahead of each lesson.`);
}
```

- [ ] **Step 3: Run the full backend test suite**

Run: `cd backend && npm test`

Expected: all existing tests still pass (this file isn't imported by any test, so the expectation is simply "no regressions" — count should match the Task 0 baseline, 165 tests across 28 files, all passing).

- [ ] **Step 4: Type-check the backend**

Run: `cd backend && npm run build`

Expected: clean compile, no type errors.

- [ ] **Step 5: Manual smoke check**

With a local MongoDB running and `.env` set per `README.md`, run `cd backend && npm run dev` (or the repo's documented dev command) and confirm in the console log that:
- The server starts and logs `10ME backend listening on port ...`.
- The reminder sweep log line still appears (`Lesson reminders sweeping every ...`).
- No new errors appear on startup.

- [ ] **Step 6: Commit**

```bash
git add backend/src/server.ts
git commit -m "fix: resolve emailSender once in server.ts and share it between createApp and the reminder sweep"
```

---

## Self-Review

**Spec coverage:** All 3 real findings from the review have a task (Tasks 1-3), plus Task 0 for the flaky test found during baseline verification. All 6 false-positive findings are explicitly accounted for in the "Findings disposition" table with the verification evidence, so nothing from the original 9 was silently dropped.

**Placeholder scan:** No TBD/TODO markers; every step shows the actual before/after code or the actual command to run.

**Type consistency:** `EmailSender`, `AppDependencies`, `createApp`, and `sendDueLessonReminders` are used in Task 3 exactly as they're already defined in `backend/src/app.ts` and `backend/src/services/lessonReminders.ts` — no new types introduced, no renames. `firstNonMondayInstant` in Task 0 is a new test-local helper, used only within the one test file it's added to.
