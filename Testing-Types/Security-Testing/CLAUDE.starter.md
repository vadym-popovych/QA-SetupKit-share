# Security-Testing starter rules — paste into YOUR workspace CLAUDE.md

## QA-level security testing — Security-Testing kit
- **Home for grey-box QA security testing:** `QA-SetupKit/Testing-Types/Security-Testing/`. When the
  user asks to "перевірити застосунок на безпеку", "check for IDOR / auth bypass",
  "run a security scan", "перевірити headers / rate-limiting" or similar → follow
  `QA-SetupKit/Testing-Types/Security-Testing/SETUP.md` and `SECURITY_TESTING_RULES.md` exactly.
- **Authorized staging/dev only, defensive intent, non-destructive by default.** Never
  production, never out-of-scope hosts. Confirm scope + accounts + active-scan permission
  with the owner before scanning. Prove issues with safe minimal repro, never weaponized
  payloads. Anything destructive → STOP and ask first.
- **Highest-value checks first:** access-control/IDOR matrix (owner vs other-user vs anon
  per resource), auth & session abuse, rate limiting on paid/expensive endpoints, and the
  fast automatable win — security headers + CORS + cookie flags.
- **Three layers, reusing existing tooling:** Postman MCP (read real API → craft logic
  abuse cases: IDOR, auth bypass) · OWASP ZAP (`zap-baseline.py` passive first, then
  `zap-full-scan.py` active when authorized — triage its false positives) · Playwright
  from the UI-Automation kit (stored XSS, cookie flags, CSP).
- **File findings as `BUG-NNN` tagged `SECURITY`** in the team QA Google Sheet; severity
  by real impact (Critical/High = auth bypass/IDOR/injection/PII leak; Medium = headers/
  rate-limit; Low/Info = best-practice). Never paste live tokens/creds into the sheet.
- **Artefacts land in `<Project>/Security-Testing/`** (`scans/`, `checks/`, `findings.md`)
  per the Project-Configuration convention; secrets gitignored with an `*.example.*` sibling.
