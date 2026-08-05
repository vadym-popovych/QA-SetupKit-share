# Security-Testing rules

Reusable rules for QA-level application security testing. Mirror new rules of this kind
here (+ into `CLAUDE.starter.md` and the workspace `CLAUDE.md`) so they travel with the kit.

## Scope & ethics (non-negotiable)
- **Authorized targets only** — the staging/dev app under your engagement. Never
  production, never third-party hosts, never anything outside the agreed scope.
- **Defensive intent** — the goal is to find and fix, not to exploit. Findings ship as
  bug reports with **safe, minimal repro**, never as weaponized payloads.
- **Non-destructive by default** — prove IDOR by *reading* another user's object, not
  deleting it; hit rate limits with a *bounded* burst, not an unbounded flood. Anything
  destructive (data loss, DoS, mass lockout) → STOP and confirm with the owner first.
- **Active scanning needs a green light** — ZAP baseline (passive) is safe; ZAP full
  scan and injection probes send attack traffic → only with explicit authorization.

## Highest-value QA checks (do these first, every project)
1. **Access control / IDOR (BOLA)** — for every resource, build a matrix: owner vs
   other-user vs anonymous. Change an object id to another account's and see if it's
   readable/modifiable. This is the #1 QA-findable, high-impact API bug. A normal user
   hitting an admin-only endpoint is the same class.
2. **Auth & session** — token still valid after logout; expiry enforced; password-reset
   token single-use and short-lived; login rate-limited (brute-force). Test with a
   bounded burst so you don't lock real accounts.
3. **Rate limiting on expensive/paid endpoints** — confirm 429/402 actually fires
   (overlaps with load testing; use k6 when it's volume-based).
4. **Security headers + CORS** — the fast automatable win: HSTS, CSP, X-Frame-Options,
   X-Content-Type-Options, cookie flags (`HttpOnly; Secure; SameSite`), CORS not `*`
   with credentials.

## Tooling split
- **Logic bugs (IDOR, auth bypass, business-logic abuse)** → Postman MCP + hand-crafted
  JS/k6 requests. These are the ones scanners miss and QA finds.
- **Broad passive/active coverage (headers, XSS, injection surface)** → OWASP ZAP
  (`zap-baseline.py` first, `zap-full-scan.py` when authorized). Expect false positives —
  triage before filing.
- **UI-side (stored XSS via forms, cookie flags, CSP console violations)** → Playwright,
  reusing the UI-Automation capture setup.

## Reporting
- File as **`BUG-NNN`** in the team QA Google Sheet (same convention as other kits),
  **tagged `SECURITY`**.
- **Severity by real impact:** Critical/High = auth bypass, IDOR/BOLA, injection, PII
  leak; Medium = missing headers, weak rate-limit, verbose errors; Low/Info = best-practice
  gaps, outdated deps with no proven exploit.
- Each finding: affected endpoint/screen, safe repro steps, expected vs actual, impact,
  and a fix hint. Never paste a live token/credential into the sheet.

## Read the API first
- Always read the real Postman collection (endpoints, auth, bodies, environments) before
  crafting abuse cases — same connection as API-Testing / Load-Testing. Don't guess routes.

## Artefacts
- Everything lands in `<Project>/Security-Testing/` (scans, checks, findings) per the
  Project-Configuration convention — never at the workspace root, never in the kit.
- Secrets (target tokens, account creds) are gitignored, never committed; ship an
  `*.example.*` alongside.
