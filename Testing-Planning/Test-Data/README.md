# Test-Data kit

Home for **managing test data** across all testing types — the accounts, fixtures,
seeds, and generated data that every other kit consumes. Today this data is scattered
(e.g. the <Project> 20-account load pool in `users.json`); this kit makes it a
first-class, reusable concern with consistent rules.

> **Why a dedicated kit.** Checklists, emulator runs, load tests, API tests, security
> tests all need *the right data in the right state* — valid accounts, accounts with/
> without a subscription, boundary-value inputs, seeded records to read/update/delete.
> Bad or shared-mutable test data is the #1 cause of flaky results and false bugs. This
> kit standardizes how we provision, name, isolate, and clean up that data.

## What lives here (scope)

1. **Account pools** — sets of test accounts with known state (tiers, subscriptions,
   roles, limits), documented so any kit can pick the right one. Generalizes the
   <Project> `grafana1..20` pool pattern.
2. **Synthetic data generation** — deterministic, realistic fake data (names, emails,
   addresses, payloads) via **Faker**, with a fixed seed for reproducibility.
3. **Seed / setup scripts** — put a backend into a known state before a run (create N
   records, provision a user with a subscription) and **tear it down** after.
4. **Fixtures** — canned request bodies / boundary-value sets (valid, empty, max-length,
   unicode, injection-ish, negative numbers) reused across API / security / UI tests.
5. **Data-state documentation** — a per-project `DATA.md` describing what exists on
   staging, which accounts are safe to mutate, and what must never be touched.

## Core principles

- **Deterministic** — seed the generator (`faker.seed(N)`) so a run is reproducible and
  a failing case can be re-created exactly. Never `Math.random()` for test data you need
  to reproduce.
- **Isolated** — a test creates the data it needs and doesn't depend on data another test
  left behind. Prefer per-test/per-run unique keys (prefix with a run id) so parallel
  runs don't collide — this is exactly why the load pool uses 1-account-per-VU.
- **Self-cleaning** — a seed script has a matching teardown; runs that create records
  clean them up (or use a disposable account) so staging doesn't rot. Where cleanup is
  impossible, document the residue.
- **Realistic but safe** — synthetic PII only. Never real customer data, never production
  dumps. Emails use a domain you control / `+tag` aliases so they're obviously test data.
- **State-aware** — know each account's state before using it (subscription, role, usage
  limits) and read it live where the API allows (e.g. `GET /me/subscription`) rather than
  assuming.

## Categories of test data (checklist when provisioning)

| Need | Example |
|---|---|
| **Valid / happy-path** | a normal user, a well-formed payload |
| **Boundary values** | empty, 1 char, max length, max+1, 0, negative, huge number |
| **Format / encoding** | unicode, emoji, RTL, leading/trailing spaces, very long strings |
| **Auth states** | anon, logged-in, expired token, wrong role, no subscription, paywalled |
| **Injection-ish** (for security) | `' OR 1=1`, `<script>`, `../../etc/passwd`, `${7*7}` |
| **Roles / tiers** | free vs premium, admin vs member, owner vs other-user (for IDOR) |
| **Volume** | 1 record, N records, empty list, pagination boundaries |

## Setup

Follow **[`SETUP.md`](SETUP.md)** — installs Faker, scaffolds `<Project>/Test-Data/`,
and shows the account-pool + seed/teardown patterns.

## Roadmap (fill in as we go)
- [ ] Faker-based generator template (seeded, per-project payload shapes)
- [ ] Account-pool schema + `users.example.json` (roles/tiers/limits documented)
- [ ] Seed + teardown script pair template
- [ ] Boundary-value fixture library (reusable across API/security/UI kits)
- [ ] `TEST_DATA_RULES.md` + `CLAUDE.starter.md` once patterns stabilize

## Relationship to the other kits
- **Load-Testing** already ships an account-pool + `seed-users.mjs` pattern
  ([`../../Testing-Types/Load-Testing/template/`](../../Testing-Types/Load-Testing/template/)) — this kit generalizes it so
  API / security / emulator tests share the same discipline.
- **Security-Testing** consumes the owner-vs-other-user accounts (IDOR) and the
  injection-ish fixtures from here.
- **API-Testing** consumes boundary-value fixtures and seed/teardown for CRUD suites.
- Artefacts land in `<Project>/Test-Data/` per [`../../Rules-Guide/Project-Configuration/README.md`](../../Rules-Guide/Project-Configuration/README.md).
