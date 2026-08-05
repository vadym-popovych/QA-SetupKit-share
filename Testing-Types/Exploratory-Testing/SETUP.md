# Exploratory-Testing — SETUP (Claude-followable)

Prerequisites: a way to drive the app (emulator kit for mobile, Playwright/UI-Automation
for web, Postman MCP for API-level exploration) + test accounts (Test-Data). No new
tooling — this kit is a discipline over existing drivers.

## Procedure

### 1. Pick charters (before touching the app)
Sources, in order: strategy risk matrix (risk ≥ 7 areas owed exploratory depth) ·
bug clusters from past rounds ("where there was one…") · fresh features with thin
specs · the owner's "щось мене турбує X". Write each as ONE sentence:
*"Explore <area> with <tour pattern> to find <risk kind>"*. 2–4 charters per round.

### 2. Run the session (per charter)
1. Copy [`template/SESSION.template.md`](template/SESSION.template.md) →
   `<Project>/Exploratory/sessions/<date>-<slug>.md`; fill the header.
2. Set the time-box: human 30–90 min; agent ≈ a tool-call budget (default ~40 calls)
   — note it and STOP at it.
3. Drive the app along the tour, logging AS YOU GO (observation → what you did →
   what happened). Every anomaly gets the oracle question: inconsistent with WHAT
   (History/Claims/Product-itself/…)? No oracle → note as a question, not a finding.
4. Stay on charter: promising off-charter smells become NEW charter candidates in
   the debrief, not detours (max one 5-min side-look per session).

### 3. Debrief (the deliverable — 10 min, same file)
- **Findings:** each → dedup check → `BUG-NNN` (evidence: the session notes line) or
  a question for the owner.
- **Feed-forward:** confirmed surprises → new invariant (invariants.md) and/or a
  regression `TC-NNN`; new charter candidates listed.
- **Coverage honesty:** % of charter actually explored + what was NOT touched.
- **Session verdict** for the round report: charters run, findings count, feed-forward.

### 4. Wire into rounds
new-build playbook: 1–2 sessions on changed areas (step 3 depth `deep`);
release-candidate: sessions on every risk ≥ 7 unit whose plan Results this cycle
list no exploratory session file (the RTM tracks aggregate state, not per-discipline
coverage — the plans' LINKS are where session files are recorded). Session files
listed in the plan's Results LINKS.
