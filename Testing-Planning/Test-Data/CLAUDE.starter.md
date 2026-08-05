# Test-Data starter rules — paste into YOUR workspace CLAUDE.md

## Managing test data — Test-Data kit
- **Home for test accounts, fixtures, seeds and generated data:** `QA-SetupKit/Testing-Planning/Test-Data/`.
  When the user asks to "згенерувати тестові дані", "set up a test account pool", "seed
  the backend", "потрібні boundary-value / fake дані" or similar → follow
  `QA-SetupKit/Testing-Planning/Test-Data/SETUP.md` and `TEST_DATA_RULES.md`.
- **Deterministic** — always seed the generator (`faker.seed(N)`), vary by index, never
  `Math.random()`, so a failing case reproduces exactly.
- **Isolated & self-cleaning** — each test provisions its own data with a unique run-id
  prefix; 1 account per parallel worker (VU); every seed script has a matching teardown;
  document any residue that can't be cleaned in the project's `DATA.md`.
- **Realistic but safe** — synthetic PII only, never real customer/production data; emails
  obviously test-only (`+tag` aliases / a domain you control).
- **State-aware account pools** — document each account's role/tier/subscription/limits
  and what it's for; commit `users.example.json`, keep real `users.json` gitignored; read
  live state where the API allows instead of assuming.
- **Cover the categories:** valid, boundary values, format/encoding, auth states,
  injection-ish, roles/tiers, volume. Boundary + injection fixtures are shared with the
  API-Testing and Security-Testing kits.
- **Artefacts land in `<Project>/Test-Data/`** per the Project-Configuration convention;
  secrets gitignored with an `*.example.*` sibling.
