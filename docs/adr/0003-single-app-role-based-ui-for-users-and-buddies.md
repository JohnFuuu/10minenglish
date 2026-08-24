# Users and Buddies are separate account types sharing one application

The source flow spec only documents a User-facing flow — there is no signup, dashboard, or any screen described for Buddies, even though Buddies clearly need to do things the spec assumes exist (set an Availability Schedule, set a Zoom link, see which Lessons they're teaching). This gap had to be resolved with two stacked decisions.

First, whether one account could hold both roles: we chose **strictly separate account types** (an Account is a User or a Buddy, never both) over a dual-role model, because nothing in the spec suggests self-service "become a Buddy" signup — Buddy onboarding is assumed to be curated/separate from the public signup flow in Section 3.

Second, given separate account types, whether they need separate applications: we chose **one application with role-based UI** (single login; the backend routes to a User dashboard or a Buddy dashboard based on account type) over a fully separate Buddy portal, since account type is unambiguous at login and a single codebase avoids duplicating shared surfaces (profile editing, notifications, auth).

Net effect: a Buddy-side dashboard is now in scope and needs its own design pass (availability editor, Zoom link field, list of Lessons to teach) — none of which exists in the original diagram.
