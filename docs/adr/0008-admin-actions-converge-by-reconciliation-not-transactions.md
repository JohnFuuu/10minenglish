# Admin actions converge by reconciliation, not transactions

Deactivating or removing a Buddy is several writes: flip the Buddy's flag, then cancel, refund, and notify each upcoming Lesson (email included), then write the audit entry. A crash part-way left the Buddy inactive/removed with some Lessons still booked, and a retry did nothing because the flag had already flipped (#29).

The options were MongoDB multi-document transactions, a saga with compensating steps, an outbox with a background worker, or "desired state + idempotent reconciliation".

We chose **desired state + reconciliation**. A Buddy's `active` / `removedAt` flag is the source of truth — an inactive or removed Buddy has no upcoming Lessons — and everything after the flag is follow-up work that can always be finished later:

- Deactivate and remove still do the work immediately, and now **always** cancel whatever upcoming Lessons remain, even if the flag was already set — so retrying an interrupted request finishes it (only an actual flip is audited).
- A sweep (`services/buddyReconciliation.ts`, every 60s alongside the reminder and completion sweeps) cancels any upcoming Lesson still attached to an inactive or removed Buddy — covering crashes and a booking that races a deactivation — and drops member references to deleted tags.
- Every step is idempotent: each Lesson is claimed with one "only if still upcoming" update, so it is cancelled, refunded, and notified (emails too) at most once, whichever path gets there first.

Transactions were not chosen because they can't cover the irreversible part — emails already sent can't be rolled back — and they need a replica-set deployment (local Docker and the test database would need reconfiguring). A saga needs "un-cancel"/"un-refund" steps and still can't unsend an email. An outbox adds a queue the app doesn't otherwise need.

Consequences: in the worst case a Buddy shows inactive while a Lesson stays booked for up to one sweep interval, then heals automatically; nothing is cancelled, refunded, or notified twice. If the app later runs on MongoDB Atlas, a transaction around the database writes can be added on top — the sweep stays as the safety net for side effects. Audit writes remain best-effort (failures go to the server log); a missing entry is not reconstructed by the sweep.
