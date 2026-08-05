# Load Testing kit (k6 + Postman MCP)

Reusable QA workflow for **load / stress testing an API**, driven from its Postman
collection. Built first for the *<Project>* book-generation API, but stack-agnostic.

The idea: instead of hand-writing endpoints, connect the **Postman MCP** so Claude
reads the real collection (endpoints, auth, bodies, environments), then generates a
**k6** test harness from it. Run smoke → load → stress against **staging**, collect
p95/p99 + breaking point, and report results the same way as any other QA artefact.

> **Teammate onboarding (set this up for YOUR project):** added the shared
> `QA-SetupKit/` to your IDE? Point your Claude at **[`SETUP.md`](SETUP.md)** — it
> walks through installing k6, connecting the Postman MCP, scaffolding the harness for
> your own API, and (optionally) Grafana Cloud dashboards. Paste
> [`CLAUDE.starter.md`](CLAUDE.starter.md) into your `CLAUDE.md` so it triggers
> automatically.

## Kit contents
| File | Purpose |
|------|---------|
| [`SETUP.md`](SETUP.md) | Step-by-step for Claude: k6 + Postman MCP + scaffold + Grafana Cloud |
| [`LOAD_TESTING_RULES.md`](LOAD_TESTING_RULES.md) | Condensed rules to paste into a workspace `CLAUDE.md` |
| [`CLAUDE.starter.md`](CLAUDE.starter.md) | Ready-to-paste `CLAUDE.md` block for teammates |
| [`template/`](template/) | Stack-agnostic k6 harness to copy as `<Project>/Load-Testing/` (config, lib/auth, scenarios, run.sh, seed-users) |

---

## 1. Tooling

| Tool | Role | Install |
|------|------|---------|
| **k6** (Grafana) | Load generator — JS scenarios, p95/p99 metrics, thresholds | `brew install k6` |
| **Postman MCP** | Lets Claude read the API's Postman collection to build the scenarios | remote server, see §2 |

Why k6 over JMeter: scripts are plain JS (version-controllable, CI-friendly),
first-class p95/p99 + custom metrics, no GUI/JVM baggage. Locust (Python) is the
alternative when scenarios need complex, code-heavy user flows.

> ⚠️ **LLM-backed APIs cost money.** If generation calls a real external LLM, every
> request burns tokens. Run against **staging** with a mocked/cheap model where
> possible, start with a smoke test, and cap stress `PEAK`. Never blast production.

---

## 2. Connect the Postman MCP

The Postman MCP is a **hosted remote server** — no local source, per-user auth.

1. Add it to the workspace `.mcp.json` (canonical snippet lives in
   [`../../MCP-configurations/README.md`](../../MCP-configurations/README.md) §5):
   ```json
   "postman": {
     "type": "http",
     "url": "https://mcp.postman.com/mcp"
   }
   ```
   - **US account:** URL above, auth via **OAuth** (no API key).
   - **EU account:** use `https://mcp.eu.postman.com/mcp` and an **API key**
     (`Authorization: Bearer <key>` header) — a key is mandatory on EU + local.
2. **Restart Claude Code** — new MCP servers are only picked up at startup. Approve
   the project-scoped MCP trust prompt.
3. Run **`/mcp`** → select **postman** → **Authenticate** → complete the browser flow.
4. Confirm `/mcp` shows `postman` as `connected`.

If OAuth is blocked (corporate SSO), fall back to the API-key header variant — get a
key from Postman → *Settings → API keys*.

---

## 3. Workflow

1. **Read the collection** (via Postman MCP): endpoints, auth scheme, request bodies,
   environment (staging base URL), example responses.
2. **Confirm the generation flow** — is it synchronous (one call returns the book),
   async (POST returns a job id → poll a status endpoint), or streaming (SSE)? This
   decides the scenario shape.
3. **Agree on targets** — target concurrent users, latency SLA (p95/p99), acceptable
   error rate.
4. **Generate k6 scenarios** from the real endpoints (see the reference harness in
   `<Project>/Load-Testing/` at the workspace root):
   - `smoke.js` — 1 VU sanity check. **Always run first.**
   - `load.js` — ramp → hold → down at target concurrency; generate → poll flow;
     end-to-end "content ready" metric; separate p95/p99 budgets for heavy vs light
     calls (via k6 tags).
   - `stress.js` — ramp past the ceiling to find the breaking point + recovery;
     tracks 429/rate-limit behaviour.
5. **Run against staging**, export a JSON summary:
   ```bash
   k6 run -e BASE_URL=https://staging.example -e TOKEN=$TOKEN \
     --summary-export=results/load-summary.json scenarios/load.js
   ```
6. **Report** — throughput, p95/p99, error rate, concurrency ceiling, breaking point.
   File any failures/regressions as bugs following the workspace QA process (same
   Google Sheet + `BUG-NNN` convention as the emulator/checklist kits).

---

## 4. What we measure

- **Concurrency ceiling** — max parallel users before errors/latency climb.
- **Latency p95/p99** — split `generate` (heavy, LLM) vs `poll` (light) via tags.
- **Queue / rate-limit behaviour** — how the API degrades: 429s, queueing, backpressure.
- **Breaking point + recovery** — where 5xx appears and whether it recovers on ramp-down.

---

## 5. Sharing with teammates

This folder is a **self-contained shareable kit**. To onboard a teammate: share the
whole `QA-SetupKit/Testing-Types/Load-Testing/` folder and tell them (or their Claude) to follow
[`SETUP.md`](SETUP.md), then paste [`CLAUDE.starter.md`](CLAUDE.starter.md) into their
`CLAUDE.md`. Their Claude will: install k6, connect the Postman MCP with **their own**
Postman account, copy [`template/`](template/) into their workspace as
`<Project>/Load-Testing/`, fill it from their collection, and run smoke → load → stress —
optionally streaming to **their own** Grafana Cloud stack.

No secrets travel in this kit — base URLs and tokens are passed at run time via
`-e KEY=value`, `users.json` is gitignored, and the Grafana token lives only in each
user's local `k6 cloud login` config.

Postman MCP snippet reference: [`../../MCP-configurations/README.md`](../../MCP-configurations/README.md) §5.
