# 10ME — UI Design Brief for Stitch

> **DEPRECATED.** Superseded by `docs/design-system.md` — a Duolingo-style system adopted from a Figma Make export, now implemented in `frontend/src/index.css` and the component library. The coral/teal palette and prompts below no longer reflect the product's visual direction. Kept for history only.

This is a working brief for generating 10ME's UI in [Stitch](https://stitch.withgoogle.com). It's organized as one **global style prompt** (paste at the start of every new screen, or into Stitch's theme/style settings if it offers one) followed by **one ready-to-paste prompt per screen**. Generate screens in the order listed — later ones reference elements (nav, cards) established earlier, so Stitch's continuity works in your favor.

Source of truth for behavior is `10SE-Flow-Spec.md`, `CONTEXT.md`, and `docs/adr/0001`–`0004`, plus the engineering breakdown in GitHub issues #1–#14. This brief translates that into visual/UX prompts — it doesn't introduce new product decisions.

---

## 1. Global Style Prompt

Paste this before your first screen prompt, or whenever Stitch lets you set a persistent style:

> Design a warm, friendly, energetic web app for **10ME**, an English-speaking practice platform where learners book 1:1 video conversations with volunteer practice partners ("Buddies"). Avoid a generic corporate-SaaS look — this should feel approachable and human, like a language-exchange community, not a enterprise dashboard.
>
> **Color palette:**
> - Primary/brand accent: warm coral-orange `#FF6B47` (hover/pressed: `#E5502E`) — used for primary buttons, active nav state, key CTAs
> - Secondary accent: deep teal `#1F7A6C` — used for the credits/balance module and secondary emphasis
> - Page background: warm off-white `#FDFBF7`
> - Surface/card background: white `#FFFFFF`
> - Border: soft warm gray `#E7E2DC`
> - Text primary: near-black warm gray `#231F1A`
> - Text secondary: muted warm gray `#736C63`
> - Success: `#2E9E6D` · Error: `#DC3545` · Warning background: `#FFF3E0`
>
> **Typography:** Plus Jakarta Sans throughout (Bold for headings, SemiBold for subheadings, Medium for labels/buttons, Regular for body text). Rounded, friendly letterforms — no default system fonts.
>
> **Shape language:** generously rounded corners (12–20px on cards and buttons, fully round on avatars/badges/pills). Soft, subtle drop shadows on cards (`0px 2px 8px rgba(35,31,26,0.08)`) — no harsh borders as the primary separator.
>
> **Layout:** left sidebar navigation (240px) + main content area, standard responsive web app shell. Generous whitespace, comfortable padding (16–32px).

---

## 2. Screens

Generate **2.0 (Kitchen Sink)** first — it locks down every component's styling in one place, so the rest of the screens can reference "the same button/card/badge style as before" instead of re-describing them each time.

### 2.0 Kitchen Sink / Component Style Guide

> A single reference page showing every UI component and state for 10ME side by side, organized in labeled sections on the warm off-white background. This is a style-guide screen, not a real app screen — lay components out in a simple grid with small caption labels under each, like a design system documentation page.
>
> **Typography scale:** show each text style stacked with its label — Heading/XL (32px Bold), Heading/L (24px Bold), Heading/M (20px SemiBold), Body/L (16px Regular), Body/M (14px Regular), Body/S (12px Regular), Label/M (14px Medium) — all in Plus Jakarta Sans.
>
> **Color swatches:** a row of labeled color chips for each token — bg/page, bg/surface, border/default, text/primary, text/secondary, text/inverse, brand/primary, brand/primary-hover, brand/secondary, semantic/success, semantic/error, semantic/warning-bg — each swatch shows its hex value beneath it.
>
> **Buttons:** primary (coral fill, white text) and secondary (white fill, coral outline + text) side by side, each shown in default, hover, and disabled states, plus a small/regular size pair.
>
> **Inputs:** a text field shown in default (placeholder text, gray border), focused (coral border), filled (real value, dark text), error (red border + small red helper text below), and disabled (grey background, muted text) states.
>
> **Badges & pills:** the small circular unread-count badge (coral/red circle with white number), a goal-selector pill in both unselected (outlined) and selected (filled coral) states, and a status pill for "Active" (green) vs "Inactive" (gray).
>
> **Avatars:** circular avatar with initials at three sizes (32px, 40px, 56px), plus one with a placeholder photo fill.
>
> **Cards:** the generic content card (title + supporting text, soft shadow, rounded corners), the lesson card (Buddy avatar + name, date/time, action buttons), and the buddy card (avatar, name, location, favourite icon, Book button) — shown together to confirm shared corner radius, shadow, and padding.
>
> **Nav item:** the sidebar navigation item in default, active (coral background + coral text), and active-with-badge states.
>
> **Toggles & tabs:** an on/off toggle switch (off = gray, on = coral), and a two-tab segmented control (e.g. "Upcoming / Previous") showing the active tab underlined or filled in coral.
>
> **Notification row:** one unread row (bold text, coral dot) and one read row (muted text, no dot), same width, stacked.
>
> **Empty state:** a small placeholder illustration/icon + muted heading text + one action button, matching the "No lessons booked yet" pattern used elsewhere.
>
> **Modal/dialog:** a small centered confirmation dialog (e.g. the cancel-lesson warning) with a heading, body text, and two buttons (secondary "Cancel", primary "Confirm") — shown as an overlay card, not full-screen.

### 2.1 Auth — Login / Sign Up

> Two-state auth screen for 10ME (see global style). Centered card (max-width ~440px) on the warm off-white background, 10ME logo/wordmark above it.
>
> **Login state:** email field, password field, "Forgot password?" link, primary "Log in" button, secondary link "Don't have an account? Sign up". Include a subtle Google OAuth button ("Continue with Google") above or below the divider "or".
>
> **Sign up state:** fields for Name, Email, Password, Phone number, Location, Nationality, Date of birth, and a "What are you hoping to get from 10ME?" section with selectable goal chips/pills (Build confidence speaking English / Improve my pronunciation / Practise real-life conversations / Fix common grammar mistakes / Expand my vocabulary / Not sure yet — I'm exploring! / Other with a text input) — multi-select pill/tag style, coral when selected.
>
> Include an inline error state below the password field for "Incorrect email or password" and a locked-out state message ("Too many attempts — try again in 15 minutes").

### 2.2 User Dashboard (home)

> Main authenticated home screen. Left sidebar: 10ME logo, nav items — Dashboard (active), Profile, Credits, Book Lesson, Lessons, Buddies, Notifications (with a small coral/red unread-count badge).
>
> Main content, top to bottom:
> - Header row: "Welcome back, [Name]" heading + circular avatar (top right)
> - A teal "Credits" summary card: "Your Credits — 12 remaining" with a white pill "Buy Credits" button
> - "Upcoming Lessons" section: 2 side-by-side cards, each showing Buddy name, date/time, and two actions — a coral "Join Lesson" primary button (shown when the lesson is starting soon) or "Edit", plus an outlined "Cancel" button
> - "Favourite Buddies" section: a horizontal row of 3 buddy cards — circular avatar with initials, name, and a small coral "Book" button

### 2.3 Book a Lesson — Buddy Selection & Calendar

> Booking flow, step 1 of 2 — reachable from either "Book by Buddy" or "Book by Time" entry points.
>
> **Book by Buddy variant:** a searchable grid of Buddy cards (avatar, name, short bio snippet, location) — clicking one advances to a calendar/time-slot picker showing that Buddy's available slots as a weekly grid, greyed-out where unavailable or already booked. A prominent toggle/link "Or pick a time first instead" for switching flow direction.
>
> **Book by Time variant:** a date + time picker first, then a resulting list of Buddy cards who are available at that exact time (avatar, name, "Select" button), with a "no teachers free at this time — try another time" empty state.
>
> Include a persistent bottom confirmation bar showing the selected Buddy + time and a primary "Confirm Booking (1 credit)" button once both are chosen.

### 2.4 Book a Lesson — Recurring Options & Confirmation

> Step 2 of the booking flow: an optional "Make this recurring" toggle/section.
>
> When enabled, show: frequency selector (Daily / Every [X] days / Weekly as a segmented control or dropdown), an "Include weekends?" toggle, and a "Number of sessions" stepper input.
>
> Final confirmation screen/card: a summary list of the sessions about to be booked (date + time per row), a note "You can edit or cancel individual sessions later in the dashboard", the total credits to be deducted, and a primary "Confirm" button. Include a secondary "partial fill" result state: a list where a couple of rows show a warning icon + "This time wasn't available — skipped" instead of a confirmed time, above a "Credits deducted: 4 of 5 requested" summary line.

### 2.5 Lessons — Upcoming & Previous

> Two-tab (or two-section) view: "Upcoming" and "Previous", accessed from the sidebar "Lessons" nav item.
>
> **Upcoming tab:** list/stack of lesson cards (Buddy avatar+name, date/time, status). Each card has "Edit" and "Cancel" actions; clicking Cancel on a lesson <12h away opens a warning modal ("This lesson is less than 12 hours away — no refund will be given. Cancel anyway?") vs. a lesson ≥12h away opens a simpler confirm ("Your credit will be refunded"). Show a "Join Lesson" primary button instead of Edit/Cancel when a lesson starts within 10 minutes. Include an empty state illustration + "No lessons booked yet — book your first lesson" CTA.
>
> **Previous tab:** list of past lesson cards (Buddy, date/time) each with two secondary actions: "Book this time again" and "Book this Buddy again".

### 2.6 Buddies Directory & Buddy Profile Page

> **Directory view:** sidebar "Buddies" nav item leads here. Three sub-tabs/filters: All / Recent / Favourites. Grid of Buddy cards (avatar, name, location, short bio, a heart/star favourite-toggle icon in the corner, "View Profile" or "Book" button).
>
> **Buddy profile page (detail):** larger header with avatar, name, location, full bio, a filled/outlined heart favourite toggle, and a prominent coral "Book this Buddy" button that leads into the booking flow (2.3) pre-selected to this Buddy.

### 2.7 Credits & Payment

> "Buy Credits" screen: current balance shown at top, then a set of 4 selectable pack cards (1 / 10 / 20 / 30 credits) each showing price (use placeholder pricing, e.g. "$X"), a highlighted "Best value" badge on the 30-pack.
>
> Payment step: a provider selector — Stripe (card icon) always shown, POLi (bank icon) shown only in a variant labeled "NZ user view" — then the relevant provider's embedded payment form placeholder. Include a success state (green checkmark, "Payment successful — 10 credits added") and a failure state (error icon, "Payment failed — please try again", button back to pack selection).

### 2.8 Notifications Inbox

> A dedicated inbox view (sidebar "Notifications" item) — vertical list of notification rows, unread ones visually distinct (bold text + a small coral dot). Row types to include: "Buddy cancelled your upcoming lesson — credit refunded" (with inline "Book another session" / "Dismiss" actions), and "Reminder: your lesson with [Buddy] starts in 1 hour". Mark-all-as-read control at the top.

### 2.9 Buddy Dashboard (distinct role view)

> A visually related but distinct dashboard for the Buddy role — same sidebar shell/branding, different nav items: Dashboard, Profile, Availability, Lessons to Teach. Make it feel like the same product family as the User dashboard (2.2) but clearly a different "mode".
>
> Main content: "Lessons to Teach" — Upcoming list (Learner name, time, Join/Cancel actions) and Previous list, same card style as 2.5.

### 2.10 Buddy Profile & Availability Editor

> **Profile section:** editable fields — Name, picture upload, bio (textarea), location, timezone (dropdown), and a "Zoom Link" field with helper text "This link will be used for all your lessons — make sure it's your personal meeting room." Show a warning banner if the Zoom link is empty: "Set your Zoom link to become bookable."
>
> **Availability editor:** a weekly grid (Mon–Sun columns × hour rows) where the Buddy click-drags to mark available blocks (highlighted coral/teal), with the Buddy's timezone shown clearly at the top. Save button at the bottom.

### 2.11 Admin (minimal internal screens)

> Simple, utilitarian internal tool aesthetic (can be plainer than the learner-facing screens — think internal ops tool, still on-brand but lower visual investment).
>
> Three small screens/sections: (1) "Provision Buddy" — a form (name, email, initial fields) with a "Create Buddy Account" button; (2) "Credit Pack Pricing" — an editable table of the 4 pack sizes and their prices with inline edit + save; (3) "Manage Buddies" — a table of Buddies with an active/inactive toggle per row, and a confirm modal on deactivate: "Deactivating will auto-cancel [N] upcoming lessons and refund affected learners. Continue?"

---

## 3. After Generating in Stitch

- Export/hand off to Figma if you want to reconcile with the existing `10ME Design` Figma file (foundation tokens + components already started there — see prior session), or export code directly if going straight to implementation reference.
- Treat Stitch's output as **visual/UX exploration**, not the engineering spec — the actual build tickets (#1–#14 on GitHub, `ready-for-agent`) are the source of truth for behavior, edge cases, and acceptance criteria.
