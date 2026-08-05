# Test-Data rules

Reusable rules for managing test data. Mirror new rules of this kind here (+ into
`CLAUDE.starter.md` and the workspace `CLAUDE.md`) so they travel with the kit.

## Principles
- **Deterministic** — seed every synthetic-data generator (`faker.seed(N)`); vary by
  index, never `Math.random()`, so a failing case can be reproduced exactly.
- **Isolated** — each test/run provisions its own data with a unique key (prefix a run
  id); don't depend on leftovers from another test. 1 account per parallel worker (VU).
- **Self-cleaning** — every seed script has a matching teardown; runs that create records
  delete them (or use a disposable account). If cleanup is impossible, document the
  residue in the project's `DATA.md`.
- **Realistic but safe** — synthetic PII only; never real customer data or production
  dumps. Emails obviously test-only (a domain you control / `+tag` aliases).
- **State-aware** — know each account's state (tier, role, subscription, usage limits)
  before using it; read it live where the API allows rather than assuming.

## Account pools
- Document *state* per account, not just credentials: role, tier, subscription status,
  limits, and what it's for (e.g. "IDOR victim", "paywall/402", "admin-side of access
  matrix"). Commit a `users.example.json` with this documented; keep the real
  `users.json` gitignored.
- Keep a backup when rotating a pool (as the <Project> pool kept `users.backup-*.json`).
- Verify the whole pool after any change: sign-in works + state matches the docs.

## Categories to cover when provisioning
Valid/happy-path · boundary values (empty, 1, max, max+1, 0, negative, huge) · format/
encoding (unicode, emoji, RTL, whitespace, very long) · auth states (anon, logged-in,
expired, wrong role, no-sub, paywalled) · injection-ish (for security) · roles/tiers
(free/premium, admin/member, owner/other-user) · volume (empty list, N, pagination edges).

## Sharing & secrets
- Kit holds templates + rules only; filled `users.json`, tokens, seeded run files are
  gitignored and never committed. Ship an `*.example.*` sibling.
- Artefacts land in `<Project>/Test-Data/` per the Project-Configuration convention.

## Relationship
- Security-Testing pulls owner-vs-other-user accounts + injection fixtures from here.
- API-Testing pulls boundary-value fixtures + seed/teardown for CRUD.
- Load-Testing's account-pool + `seed-users.mjs` pattern is the origin of these rules;
  keep the two consistent.
