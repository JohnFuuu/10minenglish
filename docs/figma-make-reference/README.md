# Figma Make Reference — "Mobile Web App for Education"

Rough mockup code exported from Figma Make, preserved here for reference since the source `/make/` link isn't readable by any of the Figma tools and the export otherwise only lived in a temp directory.

**This is reference, not implementation.** Mock data, fake `setTimeout` calls instead of real requests, and no wiring to our actual backend. Screens are a starting point for layout/visual pattern — always check field names and behavior against the real ticket's acceptance criteria before copying, the same way `OnboardingScreen.tsx` turned out to ask questions that don't map to any real Account field.

Style system lifted from this export is documented at `docs/design-system.md` (canonical) — implemented in `frontend/src/index.css` and the shared component library.

## Screen → ticket map

| File | Ticket | Status |
|---|---|---|
| `src/screens/AuthScreen.tsx` | #3 — Signup/login/lockout | Done — applied to `frontend/src/pages/{Login,Signup,ForgotPassword,ResetPassword}.tsx` |
| `src/screens/DashboardScreen.tsx` | #2/#3 (hub) | Style tokens applied; stub content still in `Dashboard.tsx` |
| `src/screens/ProfileScreen.tsx` | #4 — User Profile view/edit | Not started |
| `src/screens/AdminPanel.tsx` | #5 / #14 — Admin provisions Buddy / active-inactive toggle | Not started |
| `src/screens/BuddyDashboard.tsx` | #6 — Buddy Profile, Availability, Zoom link | Not started |
| `src/screens/CreditsScreen.tsx` | #7 — Credit Packs + Buy Credits | Not started |
| `src/screens/BookingScreen.tsx` | #8 — Book a Lesson | Not started |
| `src/screens/LessonsScreen.tsx` | #9 — Lessons management | Not started |
| `src/screens/NotificationsScreen.tsx` | #10 / #11 — Notifications + reminders | Not started |
| `src/screens/BuddiesScreen.tsx` | #12 — Buddies directory | Not started |
| `src/screens/OnboardingScreen.tsx` | — | **Don't use as-is** — asks marketing/self-assessment questions with no corresponding Account field. Not part of any ticket's contract. |
