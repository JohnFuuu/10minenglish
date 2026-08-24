# 10ME — Figma Prompts for the Core 4 Screens

> **STALE.** Written against the coral/teal Figma tokens, which `docs/design-system.md` has now superseded — the "10ME Design" Figma file's components weren't repainted with the new Duolingo-style palette. Don't reuse these prompts as-is; the color/component references below are outdated even though the screen breakdown itself is still accurate.

For building the real screens in the `10ME Design` Figma file (https://www.figma.com/design/dujPReqbSQDytThwmZbLK9), either pasted into Figma's AI generation if your plan has it, or used as your own manual build brief. Scoped to the four screens behind the priority tickets: **#3** (auth), **#6** (credits), **#7** (booking), **#8** (lessons management), plus the Dashboard hub that connects them.

Unlike the Stitch brief, these prompts explicitly call out reusing what's already in the file — the point is to extend the existing design system, not generate a new one.

## Before you start

- Fix or delete the broken Dashboard frame left over from the earlier session (rendering bug from the rate-limit interruption) before adding new screens.
- Every prompt below assumes: **reuse the existing Button, Input, Card, NavItem, Badge, and Avatar components as instances** — don't redraw them. Reuse the existing color/spacing/radius variables and the Plus Jakarta Sans text styles (Heading/XL, Heading/L, Heading/M, Body/L, Body/M, Body/S, Label/M) already defined in this file. Build every screen as an auto-layout frame, not absolute positioning.
- Name each frame exactly as shown below (e.g. "Login", "Dashboard — User") so a shared link's node-id is unambiguous later.

## 1. Login / Sign Up (ticket #3)

> Build a frame named "Login" — a centered auth card (max-width ~440px) on the bg/page background. Use the existing Input component instances for email/password fields and Button instances (primary variant) for the main action. Two states in the same file, as separate frames "Login" and "Sign Up":
>
> **Login**: email Input, password Input, "Forgot password?" text link, primary Button "Log in", a secondary text link "Don't have an account? Sign up", and a secondary-style "Continue with Google" button above a divider.
>
> **Sign Up**: Input instances for Name, Email, Password, Phone number, Location, Nationality, Date of birth, plus a goal-selector section using pill-style tags (reuse Badge's rounded-full shape/radius token) for: Build confidence speaking English / Improve my pronunciation / Practise real-life conversations / Fix common grammar mistakes / Expand my vocabulary / Not sure yet / Other (with a text input). Selected pills use brand/primary fill; unselected use border/default outline.

## 2. Dashboard — User (hub, connects all four)

> Build a frame named "Dashboard — User", 1440px wide: a left sidebar (240px, NavItem instances — Dashboard/Profile/Credits/Book Lesson/Lessons/Buddies/Notifications, Notifications carrying a Badge instance) plus a main content area using Card instances for: a Credits summary (brand/secondary teal fill, balance + "Buy Credits" Button instance), an "Upcoming Lessons" section (Card instances per lesson: Avatar, name, time, Join/Cancel Button instances), and a "Favourite Buddies" row (Card instances: Avatar, name, "Book" Button instance).

## 3. Buy Credits (ticket #6)

> Build a frame named "Buy Credits": current balance at top (reuse the Dashboard's credits display pattern), then 4 Card instances in a row — one per pack size (1/10/20/30 credits) — each showing a price placeholder and a selectable state (border/default outline vs. brand/primary outline + subtle fill when selected). Highlight the 30-pack with a small "Best value" Badge-style tag.
>
> Add a second frame "Payment" showing a provider selector (Stripe always visible; POLi shown only in a "NZ user" variant of this frame) leading to a payment form placeholder, plus success (green check, "Payment successful") and failure (error icon, "Payment failed") states as separate frames or variants.

## 4. Book a Lesson (ticket #7)

> Build a frame named "Book a Lesson — Step 1" covering both entry paths:
> - **By Buddy**: a grid of Buddy Card instances (Avatar, name, bio snippet) → clicking one advances to a time-slot grid (available slots highlighted brand/primary, unavailable/booked slots muted with border/default).
> - **By Time**: a date/time picker first, then a resulting list of available Buddy Card instances at that time, with a "no teachers free at this time" empty state.
>
> Add "Book a Lesson — Step 2 (Recurring)": a toggle "Make this recurring", frequency selector (Daily / Every X days / Weekly), "Include weekends?" toggle, session-count stepper, and a confirmation Card listing each session's date/time — including a partial-fill variant where 1–2 rows show a warning icon + "skipped, unavailable" instead of a confirmed time, with a "4 of 5 credits deducted" summary line using Button instances for the final "Confirm" action.

## 5. Lessons Management (ticket #8)

> Build a frame named "Lessons — Upcoming / Previous" with a two-tab layout (reuse NavItem's active-state styling for the tab indicator). **Upcoming**: a stack of lesson Card instances (Avatar, name, time, Edit/Cancel Button instances), with a cancel-confirmation modal Card for the <12h "no refund" warning vs. the ≥12h "credit refunded" case, and a "Join Lesson" primary Button instance replacing Edit/Cancel when a lesson starts within 10 minutes. Include the empty state ("No lessons booked yet" + Button instance CTA). **Previous**: lesson Card instances with "Book this time again" / "Book this buddy again" secondary Button instances.

## When you're done

Share the frame-specific link for each screen (right-click → Copy link to selection) and I'll implement it against the matching ticket's routes/components once that ticket's backend work is in place.
