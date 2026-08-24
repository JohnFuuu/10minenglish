# Video calls use a static, Buddy-supplied Zoom link, not platform-generated meeting links

The source flow diagram specifies Google Meet, with the platform implicitly generating a meeting per Lesson. Product direction switched the provider to Zoom, which raised two blocking constraints on the "platform generates meetings via API" approach:

- Zoom's Basic (free) plan caps all meetings, including 1:1s, at 40 minutes as of a 2025 policy change — no longer viable for lesson-length calls without a paid plan.
- A single Zoom host/licensed user can only host 1-2 concurrent meetings; a "one company account" API integration would break as soon as two Buddies taught simultaneously. Working around this requires either a pool of licensed host users the backend round-robins bookings onto, or per-Buddy connected Zoom accounts — both add real integration, licensing-cost, and onboarding complexity.

We rejected both API-based options (host-license pool, per-Buddy OAuth) in favor of the simplest model: each Buddy sets one static, persistent Zoom link (their personal meeting room) once on their profile, reused for every Lesson they teach. This has zero API integration, zero licensing/concurrency ceiling, and no per-Lesson link-management step. The tradeoff is that Buddies must own a working personal Zoom room capable of the call lengths and quality the product needs, and a Buddy cannot appear as bookable until that link is set (see domain glossary: Buddy).
