# Security-Testing — setup

Self-contained setup a teammate's Claude can follow. Reuses tooling you likely already
have from the other kits; the only new dependency is **OWASP ZAP**.

## Prerequisites (auto-detect first)

Before doing security work, check what's present and only set up what's missing:

1. **Postman MCP** — needed to read the real API for abuse cases. If `.mcp.json` has no
   `postman` entry → follow [`../API-Testing/POSTMAN_MCP_SETUP.md`](../API-Testing/POSTMAN_MCP_SETUP.md).
   (One connection serves API-Testing, Load-Testing, and Security-Testing.)
2. **Playwright** — for UI-driven checks (XSS, cookie flags, CSP). If absent, install in
   the session scratchpad the same way [`../UI-Automation/SETUP.md`](../UI-Automation/SETUP.md) does.
3. **OWASP ZAP** — the one new tool (see below).
4. **Target authorization** — confirm with the owner: which staging/dev host is in scope,
   which account(s) to use, and that active scanning is permitted. Record it in the
   project config. **No scope confirmed → don't scan.**

## Install OWASP ZAP

Two options — pick per environment:

**A. Docker (recommended — no local install, easy to pin a version):**
```bash
docker pull ghcr.io/zaproxy/zaproxy:stable
# baseline (passive, safe, fast — good first pass):
docker run --rm -v "$(pwd)/results:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t https://staging.example.com -r zap-baseline.html
# full active scan (⚠️ sends attack payloads — staging + authorized only):
docker run --rm -v "$(pwd)/results:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
  zap-full-scan.py -t https://staging.example.com -r zap-full.html
```

**B. macOS app / CLI:**
```bash
brew install --cask zap        # GUI + zap.sh CLI
# headless daemon for API-driven scans:
zap.sh -daemon -port 8090 -config api.key=<key>
```

- `zap-baseline.py` = spider + **passive** scan only → safe to run anywhere in scope,
  reports missing headers, cookie flags, info leaks. **Always start here.**
- `zap-full-scan.py` = adds **active** attack payloads (injection, XSS probes) → only on
  staging/dev you're authorized to actively scan.
- For an app behind login, pass a context/auth script or a session token so ZAP scans
  authenticated pages (see ZAP's authentication docs — capture a logged-in context).

## Scaffold the project folder

Copy the kit's [`template/`](template/) into `<Project>/Security-Testing/` (per the
Project-Configuration convention), then fill `config.json` from `config.example.json`:

```
<Project>/Security-Testing/
├── config.json            # from config.example.json — target, accounts, scope flags, sheet id (GITIGNORED)
├── headers-check.mjs      # security-headers + cookie + CORS probe (ready to run)
├── run-zap.sh             # OWASP ZAP baseline/full wrapper (Docker)
├── checks/
│   ├── access-control.mjs # IDOR / access-control matrix (attacker vs victim vs anon)
│   └── auth-session.mjs    # token-after-logout, login rate-limit, verbose errors
├── OWASP_TOP10_CHECKLIST.md # copy of the fill-in checklist for this project
├── scans/                 # ZAP HTML/JSON reports per run (gitignored)
└── findings.md            # triaged findings before they become BUG-NNN rows (gitignored)
```

The scripts are **skeletons** — adapt endpoint paths, the token field returned by
`/auth/login`, and the resource list in `config.json.idorResources` to the real API
(read it via the Postman MCP first). Nothing project-specific goes back into the kit —
the kit holds the template + docs only. `config.json`, `scans/`, `findings.md` are
gitignored (see `template/.gitignore`).

## Quick win — security-headers probe

The template ships `headers-check.mjs` — a non-destructive Node script (18+, no deps)
that checks the important response headers, cookie flags, and CORS in one shot and prints
severity-tagged findings:

```bash
node headers-check.mjs https://staging.example.com    # or: node headers-check.mjs config.json
```

For a one-liner without Node:

```bash
curl -sSI https://staging.example.com | grep -iE \
  'strict-transport-security|content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|set-cookie'
```

Missing `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`, or a
`Set-Cookie` without `HttpOnly; Secure; SameSite` → Medium findings worth a BUG-NNN.

## First run (recommended order)
1. Security-headers probe (above) — instant.
2. ZAP **baseline** scan → triage passive findings.
3. **Access-control / IDOR matrix** — for each resource, with account A's token try to
   read/modify account B's object id; try anon; try a normal user on admin routes.
4. **Auth & session** — token reuse after logout, expiry, reset-flow abuse, login
   rate-limit (bounded burst — don't lock accounts).
5. ZAP **full** scan (if authorized) → triage active findings, drop false positives.
6. File confirmed issues as `BUG-NNN` (tagged `SECURITY`) with safe repro + severity.
