## Starting a fresh session on this repo

Before doing any work, get current: read `CONTEXT.md` + `docs/adr/` (domain/architecture), then `gh issue list --state all` and `gh pr list --state all --limit 30` plus recent `git log` to see what's built, merged, and still open. Don't assume history — reconstruct it from GitHub Issues/PRs and git, not from memory of a prior session. `README.md` has local setup (env vars, MongoDB, demo seed script, dev servers).

**Branches:** `develop` is the default/shared integration branch — target it for new ticket PRs. `fza/dev` is a maintainer's personal branch; don't merge into or base new ticket work on it.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`JohnFuuu/10minenglish`, via `gh` CLI); external PRs are not pulled into triage. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
