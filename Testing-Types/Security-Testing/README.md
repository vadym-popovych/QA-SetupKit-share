# Security-Testing kit

Home for **application security testing from a QA perspective** — verifying that the
app resists the common, high-frequency abuse cases before it ships. This is **grey-box
QA security testing**, not a full pentest / red-team engagement: we exercise the running
app and its API the way an attacker with a normal user account would, using the same
tools we already use for functional and load testing (Postman MCP, Playwright, k6),
plus one dedicated scanner (OWASP ZAP).

> **Scope & ethics.** Test **only staging/dev of apps you are authorized to test**
> (the app under test in your engagement). Never point these checks at production,
> third-party services, or anything outside the agreed scope. This kit is for
> **defensive verification** — finding holes so they get fixed — not exploitation.
> When a check would be destructive (data-wiping, DoS, mass account lockout), STOP and
> confirm with the owner first; default is non-destructive probing.

## What lives here (scope)

QA-level security checks, built up incrementally, organized around the **OWASP Top 10**
but pruned to what a QA can realistically verify by driving the app:

1. **Authentication & session** — weak/again-usable tokens, expiry not enforced,
   session fixation, password reset abuse, missing rate-limit on login (brute force).
2. **Authorization / access control (IDOR, BOLA)** — can user A read/modify user B's
   objects by changing an id? Can a normal user hit admin-only endpoints? This is the
   single highest-value QA security check for APIs.
3. **Injection & input handling** — SQLi, NoSQLi, command injection, XSS (stored &
   reflected), template injection, path traversal in file params.
4. **Rate limiting & resource abuse** — is there a limit on expensive/paid endpoints?
   (You already hit 402/429 on <Project> — this formalizes checking it.)
5. **Sensitive data exposure** — secrets/PII in responses, verbose errors/stack traces,
   tokens in URLs/logs, missing TLS, data returned that the UI hides but the API leaks.
6. **Security misconfiguration & headers** — missing/weak security headers (CSP, HSTS,
   X-Frame-Options), CORS too permissive, directory listing, default creds, debug on.
7. **Business-logic abuse** — negative quantities, price/param tampering, race conditions
   on limited resources (e.g. redeeming a one-time slot twice), replaying requests.
8. **Dependency / known-CVE surface** — flag outdated libs with known CVEs (informational;
   dev fixes).

## Approach — three layers, reusing existing tooling

| Layer | Tool | What it does |
|---|---|---|
| **1. API abuse checks** | **Postman MCP** (read real collection) + JS/k6 requests | IDOR, auth bypass, validation, rate-limit — the highest-value, mostly-manual-logic checks. Read the collection first, then craft the abuse cases. |
| **2. Automated scan** | **OWASP ZAP** (baseline + full scan) | crawl the app, passive + active scan for headers, XSS, injection, misconfig. Fast broad coverage; triage its findings (lots of false positives). |
| **3. UI-driven checks** | **Playwright** (from the UI-Automation kit) | stored XSS via forms, session/cookie flags, client-side auth checks, CSP violations in console. |

- **Read the API from Postman first** (same connection as API-Testing / Load-Testing) —
  craft abuse cases against the real endpoints/auth, don't guess.
- **File findings as `BUG-NNN`** in the team QA Google Sheet, same convention as every
  other kit — but tag the row **`SECURITY`** and set Severity by real impact
  (Critical/High for auth-bypass/IDOR/injection; Medium for missing headers/rate-limit;
  Low/Info for verbose errors). Include a **safe, minimal repro** and the affected
  endpoint — never a weaponized payload.
- Prefer **non-destructive** proofs: read someone else's object id to prove IDOR rather
  than deleting it; hit the rate limit with a bounded burst, not an unbounded flood.

## Setup

Follow **[`SETUP.md`](SETUP.md)** — installs OWASP ZAP, confirms Postman MCP + Playwright
(shared with the other kits), and scaffolds `<Project>/Security-Testing/` by copying the
[`template/`](template/) folder (ready-to-run `headers-check.mjs`, `run-zap.sh`,
`checks/access-control.mjs`, `checks/auth-session.mjs`, `config.example.json`).

**[`OWASP_TOP10_CHECKLIST.md`](OWASP_TOP10_CHECKLIST.md)** is the fill-in deliverable —
copy it per project, record Pass/Fail + evidence per row, map failures to `BUG-NNN`.

## Roadmap (fill in as we go)
- [ ] OWASP ZAP baseline scan wired to the target staging URL
- [ ] Auth & session abuse suite (Postman/JS)
- [ ] Access-control / IDOR matrix (per resource: owner vs other-user vs anon)
- [ ] Rate-limit / paid-endpoint abuse checks
- [ ] Security-headers + CORS check (quick, automatable)
- [ ] Business-logic abuse cases (per project)
- [ ] `SECURITY_TESTING_RULES.md` + `CLAUDE.starter.md` once patterns stabilize

## Relationship to the other kits
- **Postman MCP** — shared; canonical config in [`../../MCP-configurations/README.md`](../../MCP-configurations/README.md).
- **Playwright** — reuse the capture setup from [`../UI-Automation/`](../UI-Automation/).
- **k6** — the rate-limit / resource-abuse checks overlap with [`../Load-Testing/`](../Load-Testing/);
  use k6 when the abuse is volume-based, ZAP/Postman when it's logic-based.
- Artefacts land in `<Project>/Security-Testing/` per [`../../Rules-Guide/Project-Configuration/README.md`](../../Rules-Guide/Project-Configuration/README.md).
