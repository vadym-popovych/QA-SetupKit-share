# Redmine (the team's board) — API access

- **Instance:** https://tracker.example.com
- **Token file:** `.token` (gitignored) — the personal Redmine API key, ONE line, nothing else.
  - Where to get it: https://tracker.example.com/my/account → right sidebar → **API access key** → *Show* → copy.
  - The owner pastes the key into `.token` HIMSELF — never through chat.
  - Backed up via the encrypted secrets bundle (`~/claude-workspace-config/backup-secrets.sh`,
    path already in `SECRETS=(…)`).
- **Auth:** every request carries the header `X-Redmine-API-Key: <key>`.
- **Usage:** bug filing tool `QA-Documentation/Bug-Reports/template/tools/redmine-bug.mjs`
  (plan: `<Project>/QA-Documentation/redmine-integration-NOTES.md`).
- Verify access: `curl -s -H "X-Redmine-API-Key: $(cat .token)" https://tracker.example.com/users/current.json`
