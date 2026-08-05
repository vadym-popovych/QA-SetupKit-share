# Cloudflare API token (Pages management)

Token file: `.token` in this folder (gitignored — NEVER commit, never paste in chat).
Owner writes it himself. Used by Claude via `CLOUDFLARE_API_TOKEN` for the
Cloudflare REST API / wrangler: managing the `<qa-docs-repo>` Pages project
(create/configure/deployments) connected to the private `QA-Documents` repo.

Create at: dash.cloudflare.com → My Profile → API Tokens → Create Token →
Custom token → Permissions: **Account · Cloudflare Pages · Edit** →
Account Resources: include → your account → Continue → Create → copy into `.token`.

Verify: `CLOUDFLARE_API_TOKEN=$(cat .token) curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" https://api.cloudflare.com/client/v4/user/tokens/verify`
