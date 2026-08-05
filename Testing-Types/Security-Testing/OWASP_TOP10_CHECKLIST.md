# OWASP Top 10 — QA verification checklist (fill-in per project)

Copy this into `<Project>/Security-Testing/` and fill Status (Pass / Fail / N/A / Not-run)
+ evidence per row. Framed as **what a QA can verify** by driving the app/API — not a full
pentest. Map failed rows to `BUG-NNN` (tagged `SECURITY`). Based on OWASP Top 10 (2021).

| # | Category | QA-verifiable checks | How | Status | Evidence / BUG |
|---|----------|----------------------|-----|--------|----------------|
| A01 | **Broken Access Control** | IDOR: attacker reads/edits victim's object by id · normal user hits admin route · anonymous hits authed route | `checks/access-control.mjs` | | |
| A02 | **Cryptographic Failures** | HTTPS enforced (HSTS) · no secrets/tokens in URL · sensitive data not in plain responses/logs | `headers-check.mjs` + manual | | |
| A03 | **Injection** | SQLi/NoSQLi on inputs · reflected & stored XSS in forms · template/command injection · path traversal in file params | ZAP full + Playwright form probes + `fixtures/injection` | | |
| A04 | **Insecure Design** | business-logic abuse: negative qty, price/param tamper, replay, race on limited resource (double-spend a slot) | manual per project | | |
| A05 | **Security Misconfiguration** | security headers present · CORS not `*`+credentials · no directory listing · debug/verbose errors off · default creds gone | `headers-check.mjs` + ZAP baseline | | |
| A06 | **Vulnerable Components** | known-CVE libs flagged (informational; dev fixes) | `npm audit` / dependency scan | | |
| A07 | **Auth & Session Failures** | token invalid after logout · expiry enforced · login rate-limited (brute-force) · reset token single-use/short-lived | `checks/auth-session.mjs` | | |
| A08 | **Data Integrity Failures** | unsigned/mutable update channels · insecure deserialization surface (mostly dev-side; flag) | manual / review | | |
| A09 | **Logging & Monitoring** | failed logins / access-control denials produce logs (confirm with dev/Grafana) · no sensitive data in logs | dev + Grafana MCP | | |
| A10 | **SSRF** | user-supplied URLs (webhooks, image-by-url, imports) can't reach internal hosts/metadata endpoints | manual per project | | |

## Severity guide
- **Critical/High:** A01 (IDOR/broken access), A03 (injection), A07 (auth bypass), A10 (SSRF), PII leak.
- **Medium:** missing headers, weak/absent rate-limit, CORS gaps, verbose errors.
- **Low/Info:** best-practice gaps, server-version leak, outdated deps with no proven exploit.

## Workflow
1. Confirm scope + accounts + active-scan permission → set `scopeConfirmed`/`activeScanAuthorized` in `config.json`.
2. `node headers-check.mjs config.json` (instant) → fill A02/A05.
3. `./run-zap.sh baseline <target>` → triage → fill A03/A05.
4. `node checks/access-control.mjs config.json` → fill A01.
5. `node checks/auth-session.mjs config.json` → fill A07.
6. `./run-zap.sh full <target>` (if authorized) → deepen A03.
7. Manual per-project passes for A04/A08/A09/A10.
8. Map every Fail → `BUG-NNN` (SECURITY) with safe minimal repro.
