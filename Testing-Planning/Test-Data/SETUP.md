# Test-Data — setup

Self-contained setup a teammate's Claude can follow. Standardizes how test accounts,
synthetic data, and seed/teardown scripts are provisioned for a project.

## Install

```bash
# Faker for synthetic data (Node projects)
npm install --save-dev @faker-js/faker
# Python projects:  pip install faker
```

Everything else (Node, the Postman MCP for reading the API to seed against) you already
have from the other kits.

## Scaffold the project folder

Create `<Project>/Test-Data/` (per the Project-Configuration convention):

```
<Project>/Test-Data/
├── DATA.md                 # what exists on staging; safe-to-mutate vs never-touch
├── users.json              # the real account pool (GITIGNORED)
├── users.example.json      # committed template — roles/tiers/limits documented
├── generate.mjs            # seeded Faker generator for payloads/records
├── seed.mjs                # put backend into a known state before a run
├── teardown.mjs            # undo what seed created
└── fixtures/               # boundary-value + injection-ish reusable inputs
    └── boundary-values.json
```

`users.json` and any file with real creds/tokens are **gitignored**; commit only the
`*.example.*` sibling.

## Account-pool pattern

Document each account's *state*, not just its credentials, so any kit picks the right one:

```jsonc
// users.example.json
[
  { "email": "qa+free1@example.com",    "password": "REPLACE_ME", "role": "member",  "tier": "free",    "notes": "no subscription — for paywall/402 tests" },
  { "email": "qa+premium1@example.com", "password": "REPLACE_ME", "role": "member",  "tier": "premium", "notes": "active sub until <date>; 4 slots" },
  { "email": "qa+admin1@example.com",   "password": "REPLACE_ME", "role": "admin",   "tier": "premium", "notes": "admin routes; use for allow-side of access-control matrix" },
  { "email": "qa+victim1@example.com",  "password": "REPLACE_ME", "role": "member",  "tier": "free",    "notes": "owns objects account A tries to reach — IDOR target" }
]
```

Rules: 1 account per parallel worker (VU) to avoid state collisions; read live state
where the API allows (`GET /me/subscription`) instead of assuming; keep a backup of the
pool if you rotate it.

## Seeded synthetic data

Always seed the generator so a run is reproducible (a failing case can be re-created):

```js
// generate.mjs
import { faker } from '@faker-js/faker'
const SEED = Number(process.env.SEED ?? 42)
faker.seed(SEED)                       // deterministic — same SEED → same data

export function makeUser(i = 0) {
  return {
    email: `qa+${SEED}-${i}@example.com`,   // obviously test data, unique per run
    name: faker.person.fullName(),
    password: faker.internet.password({ length: 12 }),
  }
}
```

Vary by index (`i`), never by `Math.random()`, for data you need to reproduce.

## Seed + teardown pair

Every script that creates backend state ships a matching teardown so staging stays clean:

```js
// seed.mjs   → create N records, return their ids to a run file
// teardown.mjs → read that run file, delete each id
```

Where the backend can't delete (no API), document the residue in `DATA.md` instead of
leaving it silent.

## Boundary-value fixtures

A reusable set the API / security / UI kits all pull from:

```jsonc
// fixtures/boundary-values.json
{
  "strings":  ["", " ", "a", "<255 chars>", "<256 chars>", "  trim me  ", "emoji 🎉", "RTL ‏مرحبا"],
  "numbers":  [0, -1, 1, 2147483647, 2147483648, 1e309],
  "injection":["' OR 1=1 --", "<script>alert(1)</script>", "../../etc/passwd", "${7*7}"]
}
```

## First run
1. Fill `users.json` from `users.example.json` (real creds, gitignored) and verify each
   account's state (sign-in + subscription/role check).
2. Write `DATA.md`: what's on staging, what's safe to mutate, what's off-limits.
3. Seed any records the suite needs; keep the returned ids for teardown.
4. Point the API / security / UI suites at this folder for accounts + fixtures.
