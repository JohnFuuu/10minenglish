# 10ME

An English-speaking practice platform. Users buy lesson credits and book 1:1 speaking sessions over Google Meet.

## Language

**Account**:
A login identity with exactly one type — User, Buddy, or Admin, never more than one. All three types share one application (single login, role-based UI), but are strictly separate populations: a Buddy is provisioned by an Admin (not through the User signup flow in Section 3), and a User can never become a Buddy or Admin on the same account. Admin is a minimal internal role for low-frequency operational tasks (provisioning Buddy accounts, editing Credit Pack pricing, toggling a Buddy active/inactive) — not a customer-facing role. Deactivating a Buddy auto-cancels their existing upcoming Lessons (same auto-refund path as Buddy-initiated cancellation), since deactivation means the Buddy will not be teaching those Lessons.
_Avoid_: Profile (Profile is the editable data on an Account, not the identity/role itself)

**Buddy**:
The person a User books a 1:1 session with. Single canonical role — the spec's "teacher" and "practice partner" are the same entity, just inconsistent naming from the source diagram. Each Buddy has one persistent Zoom link (their personal meeting room) set on their profile and reused for every Lesson they teach — the platform does not generate meeting links via the Zoom API. Buddies log into the same app as Users but see a distinct role-based view (their upcoming Lessons to teach, Availability Schedule editor, Zoom link setting) — this Buddy-side interface isn't described anywhere in the source flow spec, which only documents the User-facing flow. Buddies are volunteers, not paid staff or contractors — there is no compensation/earnings/payout concept anywhere in this domain. Profile fields: Name, picture, bio, location, timezone, Zoom link, Availability Schedule — all self-editable by the Buddy. The only Admin-controlled field is the active/inactive flag; Admin provisions the account but does not maintain its content afterward.
_Avoid_: Teacher, practice partner, tutor

**Lesson**:
A single booked 1:1 slot between a User and a Buddy at a specific time, consuming one credit. A recurring booking creates multiple independent Lessons up front rather than one grouping/series object — there is no separate "Session" concept.
_Avoid_: Session, meeting, booking (booking is the act, Lesson is the resulting record)

**Credit**:
A fixed-cost, fungible unit purchased in packs (1/10/20/30) and consumed one-per-Lesson at booking time. Cost is flat regardless of Buddy or duration — packs are bulk-discount bundles of the same unit, not different products.
_Avoid_: Token, balance (balance is the count of Credits a User holds, not the unit itself)

**Buddy Availability Schedule**:
A Buddy-set recurring weekly window of hours (e.g. "Mon/Wed/Fri 9am–1pm") defining when they can be booked, stored against the Buddy's explicit IANA timezone field (not derived from the free-text Location signup field). Displayed to Users converted into their own explicit timezone. A time slot is bookable only if it falls inside this schedule AND has no conflicting Lesson already booked. Not described in the source flow diagram — identified as a modeling gap during the walkthrough. MVP scope: recurring pattern only, no one-off date exceptions/time-off (fast-follow).
_Avoid_: Calendar (Calendar is the UI view; this is the underlying rule data)

**Credit Pack**:
A purchasable bundle (sizes: 1/10/20/30 credits) with a price that is not fixed at build time — pricing must be configurable/changeable without a code deploy (e.g. admin-editable), not hardcoded constants.
_Avoid_: Plan, tier

**Notification**:
A message about something the User/Buddy didn't just trigger themselves — either event-driven (e.g. a Buddy cancelling a Lesson) or time-scheduled (a pre-lesson reminder sent ahead of a normal, non-cancelled Lesson, to both User and Buddy). Always delivered two ways: an in-app banner/badge for when the recipient happens to be in the Dashboard, and an email for reliable delivery when they're not — the in-app view is a convenience layer on top of email, not the primary channel. Persists with read/unread state in a Notification inbox (a new Dashboard section) rather than disappearing once dismissed. Distinct from a success/failure Message (Section 10), which is a synchronous response to the User's own action, shown in-app only, and not persisted.
_Avoid_: Alert, message (Message is reserved for synchronous success/failure feedback)

**Payment**:
A provider-agnostic record of a Credit Pack purchase attempt. Two independent providers exist — Stripe (card) and POLi (NZ bank transfer) — each with their own success/failure callback wiring, but both resolve to the same outcome: credits added to the User's balance on success. A User only sees the POLi option if their Location is New Zealand; everyone sees Stripe.
_Avoid_: Transaction, Order (this domain has no separate "order" concept — a Payment either succeeds and grants Credits, or it doesn't)
