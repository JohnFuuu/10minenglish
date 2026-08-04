# 10ME — Product Flow Spec

*Derived from `🌊 10SE Flow.pdf`. Draft for walkthrough & optimization.*

## 1. Overview

10ME is an English-speaking practice platform. Users sign up, buy lesson credits, and book 1:1 sessions ("lessons") with teachers/practice partners ("buddies") over Google Meet. Core loops: **Auth → Profile → Credits (Stripe) → Book a lesson (by buddy or by time) → Attend/manage lessons → Favourite buddies**.

## 2. Legend / Component Types

| Type | Meaning |
|---|---|
| Dashboard component | Section reachable from the Dashboard |
| Page | Full page/screen |
| Fields | Data captured from user |
| Selection Options | Choice list presented to user |
| Conditions | Branch logic (if/else) |
| Action | User- or system-triggered action |
| Buttons | Clickable CTA |
| Toggles | Binary switch |
| External flow | Handoff to a third-party flow (e.g. Stripe) |
| Option list | Enumerated choices |
| Message | Success/failure/system message shown to user |
| External actions | Side effects outside the app (e.g. email trigger) |
| Notification | Only appears conditionally, on an event |

## 3. Auth Flow

**Entry page** → **Login page** or **Sign up page**

### Login
- Fields: (email, password — implied)
- On fail → **Login fail** message → loop back to Login page
- Forgot password → **Password forget** flow → triggers password reset email (external action)
- On success → **Login success** → Home page → Dashboard

### Sign up
- Fields: Name, Email, Password, Phone number, Location, Nationality, Date of birth, "What are you hoping to get from 10ME?"
- Goal options (single/multi-select, with free text): 
  - Build confidence speaking English
  - Improve my pronunciation
  - Practise real-life conversations
  - Fix common grammar mistakes
  - Expand my vocabulary
  - Not sure yet – I'm exploring!
  - Other (free text entry)
- On success → **Sign up success** message → external action: confirmation email sent
- User must confirm email by clicking link in email → unlocks Dashboard access

**Open question:** what happens if user tries to log in before confirming email?

## 4. Dashboard

Central hub after login. Branches to:
1. Profile (view/edit)
2. Credits (buy/balance)
3. Book Lesson (by Buddy / by Time)
4. Upcoming / Previous Lessons
5. Buddies (all / recent / favourites)

## 5. Profile

- **View profile**: shows Profile pic, Name, current field values
- **Edit profile** → Profile Settings page, editable fields: Name, Email, Password, Phone number, Location, Nationality, Date of birth, learning goal (same option list as signup)
- **Save changes** button commits edits

## 6. Credits & Payments

- Dashboard shows Credits (icon: `+` button / # of credits remaining)
- **Buy credits** → choose pack: 1 credit / 10 credits / 20 credits / 30 credits
- → **Payment flow (Stripe)** (external flow)
  - If payment success → **Payment success** message → credits added to account
  - If payment fails → **Payment failed** message → return to Buy credits

**Open question:** pricing per pack not specified in the diagram — confirm with product/finance.

## 7. Book a Lesson

Two entry paths from Dashboard: **Book by Buddy** and **Book by Time**. Booking requires credits > 0 (if credits = 0, user is routed to Buy credits).

### 7a. Book by Buddy
1. Choose buddy
2. Choose time on selected buddy's calendar
3. Condition: teachers available > 0?
   - No → "No teachers free at this time" → user chooses a different time
   - Yes → Confirm → **Book lesson** (consumes 1 credit)

### 7b. Book by Time
1. Choose a time when user wants a lesson
2. Select teacher
3. Condition: credits > 0? (same gate as above)
4. Confirm → **Book lesson**

### 7c. Recurring Bookings
From the booking flow, user can opt into recurring lessons:
- Choose frequency: **Daily** / **Every X days** (with day-frequency selector) / **Weekly**
- "Include weekends?" toggle
- Two sub-paths depending on entry point:
  - With a specific buddy: select the next **[number of credits]** sessions when **[buddy]** is available, at the chosen time/frequency
  - Without a specific buddy: system chooses next available sessions with **first available teacher**, at chosen time/frequency
- Confirmation page: "You can edit or change individual sessions later in the dashboard"
- Deducts **-[X] credits** (one per session)
- External action: emails time(s) and Google Meet link(s) for all booked sessions

**Open question:** what happens if a recurring series can't fully fill (e.g. buddy unavailable for session #4 of 5)? Diagram doesn't show a partial-failure branch.

## 8. Lessons Management

Dashboard → **Upcoming lessons** and **Previous lessons**, gated by whether any exist:
- If lessons booked = 0 → "No lessons booked" state
- If lessons booked > 0 → list of upcoming lessons

### Upcoming lesson actions
- **Edit** / **Cancel**
  - If lesson < 12 hours away → cancel with warning ("no refund will be given as <12h") → **Cancel lesson, no refund**
  - If lesson ≥ 12 hours away → **Cancel lesson and refund**
- **Join lesson**: available if lesson is <10 minutes away → opens meeting in Google Meet

### Previous lessons
- List of previously booked lessons
- Actions: **Book this lesson time again**, **Book this buddy again**

### Upcoming lesson notification (event-driven, only appears if triggered)
- If buddy cancels session:
  - If session is >1 hour away → notify "Buddy cancelled upcoming session" → prompt "Refund credit?" → credit refunded, notification closed
  - If session is ≤1 hour away *(implied by diagram's second cancellation branch)* → "Buddy cancelled upcoming session, credit was automatically refunded"
- After refund/notification: prompt "Book another session?" or "Dismiss" → notification closed

**Open question:** the exact time-threshold branch for the second buddy-cancellation case isn't explicitly labeled in the extracted text — confirm the condition (likely "≤1 hour away") during walkthrough.

## 9. Buddies

- Dashboard → **Buddies** → **All buddies** / **Recent buddies** / **Favourite buddies**
- **Buddy page**: Name, picture, bio, location
- Actions from buddy page/list:
  - **Book this buddy** → enters Book by Buddy flow
  - **Favourite/unfavourite this buddy** toggle
    - If buddy is a favourite → "Removes buddy from favourite list"
    - If buddy is not a favourite → "Adds buddy to favourite list"

## 10. Cross-Cutting Notifications & Messages

- Success messages: Sign up success, Login success, Payment success
- Failure messages: Login fail, Payment failed
- Event notification: Upcoming lesson notification, Buddy-cancelled notification
- External actions (emails): password reset trigger, email confirmation link, recurring-booking confirmation emails with Meet links

## 11. Open Questions for Walkthrough

1. Email-confirmation gating on login before verification — what's the UX?
2. Credit pack pricing not shown — needs input.
3. Partial-fill behavior for recurring bookings when a buddy/teacher isn't available for all sessions in the series.
4. Exact time threshold for the second buddy-cancellation branch (assumed ≤1 hour).
5. Is "buddy" a distinct role from "teacher," or are they the same entity referred to differently in Book-by-Buddy vs Book-by-Time flows? The diagram uses both terms without an explicit mapping.
6. What happens on repeated login failures (lockout, rate limit)?
