# 10 Minute English (10ME)

A web app connecting English learners (Users) with volunteer conversation partners (Buddies) for scheduled practice Lessons, with a minimal Admin surface for provisioning Buddies and pricing.

- **Domain model & terminology:** `CONTEXT.md`
- **Architectural decisions:** `docs/adr/`
- **Product spec / user stories:** `10SE-Flow-Spec.md` and GitHub issue #1
- **Work is tracked as GitHub Issues** on this repo (see `docs/agents/issue-tracker.md` for the agent-facing conventions)

## Tech stack

- **Backend:** Express + TypeScript + MongoDB (Mongoose), tested with Vitest against a real (in-memory) MongoDB instance — see `backend/test/`
- **Frontend:** React + TypeScript + Vite + Tailwind — no automated frontend test suite yet; frontend changes are verified with `npm run build` plus manual/exploratory testing in the browser (see `CONTEXT.md`'s Testing Decision)

## Prerequisites

- Node.js (v20+)
- A local MongoDB instance reachable at the URI you put in `backend/.env` — either:
  - a native `mongod` on `localhost:27017`, or
  - Docker: `docker run -d --name mongo-10me -p 27017:27017 mongo:7`
- [GitHub CLI](https://cli.github.com/) (`gh`) if you'll be working with issues/PRs from the terminal

## Setup

1. Install dependencies:

   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. Create your env files from the examples and fill in the values:

   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

   `backend/.env` fields:
   - `MONGODB_URI` — your local Mongo connection string
   - `JWT_SECRET` — any value for local dev
   - `PORT` — backend port (defaults to `4000`)
   - `FRONTEND_URL` — used for links in outbound emails (defaults to `http://localhost:5173`)
   - `GOOGLE_CLIENT_ID` — only needed if you're testing the Google OAuth signup/login path
   - `PAYMENTS_MOCK` — set to `true` for local dev to auto-succeed Stripe/POLi checkout without real provider credentials

3. Start MongoDB (see Prerequisites above).

4. (Optional) Seed a demo User + Buddy so you don't have to sign up and get a Buddy admin-provisioned by hand:

   ```bash
   cd backend && npx tsx scripts/seed-demo-account.ts
   ```

   This creates:
   - a User (`demo-user@10me.test` / `DemoPass123!`) with 10 Credits already on the account
   - a Buddy (`demo-buddy@10me.test` / `DemoPass123!`) bookable 07:00–22:00 every day (Pacific/Auckland), so most times you pick in the booking flow should show as available

5. Run both dev servers (separate terminals):

   ```bash
   cd backend && npm run dev    # http://localhost:4000
   cd frontend && npm run dev   # http://localhost:5173
   ```

   Outbound "emails" (confirmation links, password resets, notifications) aren't actually sent in dev — they're logged to the backend terminal (`[email] to=... subject="..." ...`). Copy links from there when testing flows that require them.

## Testing

```bash
cd backend && npm run test    # Vitest — the only automated test suite in this repo
cd frontend && npm run build  # tsc + vite build — the frontend's correctness gate
```

## Working on a ticket

Tickets live as GitHub Issues (see `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`). The established pattern for this repo, per recent merged PRs, is one isolated git branch/worktree per ticket, a written implementation plan, then execution and a PR back into `fza/dev` — see the git history for examples (search commit/PR titles for "ticket-").
