# 10ME

An English-speaking practice platform. Users buy lesson credits and book 1:1 speaking sessions over a Buddy-supplied video call link — Zoom, Google Meet, or any provider a Buddy already uses (see ADR 0002 for why this is a static link rather than a platform-generated meeting).

## Language

**Account**:
A login identity with exactly one type — User, Buddy, or Admin, never more than one. All three types share one application (single login, role-based UI), but are strictly separate populations: a Buddy is provisioned by an Admin (not through the User signup flow in Section 3), and a User can never become a Buddy or Admin on the same account. Admin is a minimal internal role for low-frequency operational tasks (provisioning Buddy accounts, editing Credit Pack pricing, toggling a Buddy active/inactive) — not a customer-facing role. Deactivating a Buddy auto-cancels their existing upcoming Lessons (same auto-refund path as Buddy-initiated cancellation), since deactivation means the Buddy will not be teaching those Lessons. A password-signup User is signed in straight away but cannot book a Lesson or buy Credits until they confirm their email; the confirmation link also signs them in. A Facebook sign-up that shares no email gets an Account with no email at all, and must add and confirm one before booking or buying (see ADR 0007).
_Avoid_: Profile (Profile is the editable data on an Account, not the identity/role itself)

**Buddy**:
The person a User books a 1:1 session with. Single canonical role — the spec's "teacher" and "practice partner" are the same entity, just inconsistent naming from the source diagram. Each Buddy has one persistent meeting link (Zoom, Google Meet, or any provider — their personal meeting room) set on their profile and reused for every Lesson they teach — the platform does not generate meeting links via any provider's API. Buddies log into the same app as Users but see a distinct role-based view (their upcoming Lessons to teach, Availability Schedule editor, meeting link setting) — this Buddy-side interface isn't described anywhere in the source flow spec, which only documents the User-facing flow. Buddies are volunteers, not paid staff or contractors — there is no compensation/earnings/payout concept anywhere in this domain. Profile fields: Name, picture, bio, location, timezone, meeting link, Availability Schedule — all self-editable by the Buddy. The only Admin-controlled field is the active/inactive flag; Admin provisions the account but does not maintain its content afterward. An Admin can also **remove** a Buddy: an archive, not a deletion — their upcoming Lessons are cancelled and refunded, they can no longer sign in (any open session is cut off), and they disappear from every roster and directory, but the record stays so Users' past Lessons still name them and the audit log stays meaningful; their email stays reserved.
_Avoid_: Teacher, practice partner, tutor

**Lesson**:
A single booked 1:1 slot between a User and a Buddy at a specific time, costing the current Lesson Price in credits (recorded on the Lesson, so a cancellation refunds exactly what was paid even if the price has since changed). A recurring booking creates multiple independent Lessons up front rather than one grouping/series object — there is no separate "Session" concept. A Lesson's status is `upcoming` until either it's cancelled or its scheduled time elapses, at which point it's automatically marked `completed` — there is no verified-attendance concept (see ADR 0006).
_Avoid_: Session, meeting, booking (booking is the act, Lesson is the resulting record)

**Credit**:
A fixed-cost, fungible unit purchased in packs (1/10/20/30/50), or awarded by an Admin with a reason, and spent at booking time — each Lesson costs the Lesson Price, a single Admin-set number of credits (starting at 1), the same regardless of Buddy. Never assume one credit per Lesson. Packs are bundles of the same unit, not different products.
_Avoid_: Token, balance (balance is the count of Credits a User holds, not the unit itself)

**Buddy Availability Schedule**:
A Buddy-set recurring weekly window of hours (e.g. "Mon/Wed/Fri 9am–1pm") defining when they can be booked, stored against the Buddy's explicit IANA timezone field (not derived from the free-text Location signup field). Displayed to Users converted into their own explicit timezone. A time slot is bookable only if it falls inside this schedule AND has no conflicting Lesson already booked. Not described in the source flow diagram — identified as a modeling gap during the walkthrough. MVP scope: recurring pattern only, no one-off date exceptions/time-off (fast-follow).
_Avoid_: Calendar (Calendar is the UI view; this is the underlying rule data)

**Credit Pack**:
A purchasable bundle (sizes: 1/10/20/30/50 credits) with a price that is not fixed at build time — pricing must be configurable/changeable without a code deploy (e.g. admin-editable), not hardcoded constants.
_Avoid_: Plan, tier

**Member tag**:
An Admin-managed label on a User (e.g. "low-income"), chosen from a managed list Admins create, rename, and delete. Private: it never appears anywhere the User or a Buddy can see it, and each tag on a member records which Admin added it and when. Tags have no effect on what a User can do or pay today; they are the hook for future rules such as weekly vouchers for a group (see docs/superpowers/specs/2026-10-05-admin-member-tags-design.md).
_Avoid_: Label, category, segment

**Audit log**:
An append-only history of every change an Admin makes — tag create/rename/delete, tagging and untagging members, awarding credits to a member (always with a reason), creating and (de)activating Buddies, and Credit Pack price changes — each recording which Admin, what, the target, and when, with names snapshotted at the time. Admin-only to read; nothing can edit or delete an entry. Member and Buddy activity is not part of it (see docs/superpowers/specs/2026-10-05-admin-audit-log-design.md).
_Avoid_: History, activity feed

**Notification**:
A message about something the User/Buddy didn't just trigger themselves — either event-driven (e.g. a Buddy cancelling a Lesson) or time-scheduled (a pre-lesson reminder sent ahead of a normal, non-cancelled Lesson, to both User and Buddy). Always delivered two ways: an in-app banner/badge for when the recipient happens to be in the Dashboard, and an email for reliable delivery when they're not — the in-app view is a convenience layer on top of email, not the primary channel. Persists with read/unread state in a Notification inbox (a new Dashboard section) rather than disappearing once dismissed. Distinct from a success/failure Message (Section 10), which is a synchronous response to the User's own action, shown in-app only, and not persisted.
_Avoid_: Alert, message (Message is reserved for synchronous success/failure feedback)

**Payment**:
A provider-agnostic record of a Credit Pack purchase attempt. Two independent providers exist — Stripe (card) and POLi (NZ bank transfer) — each with their own success/failure callback wiring, but both resolve to the same outcome: credits added to the User's balance on success. A User only sees the POLi option if their Location is New Zealand; everyone sees Stripe.
_Avoid_: Transaction, Order (this domain has no separate "order" concept — a Payment either succeeds and grants Credits, or it doesn't)

**Support Ticket**:
A question or problem raised by a User or a Buddy (from the Help icon on their dashboard), with a topic and an optional related Lesson, handled by Admins on the SUPPORT tab. One back-and-forth thread per ticket: an Admin reply marks it `answered` and notifies the sender (in the app and by email); a sender reply sets it back to `open`, even after it was `closed`; only an Admin closes or reopens it. Admin replies and status changes are in the Audit Log.
_Avoid_: Complaint, case, issue (Issue means a GitHub issue in this repo)
