# Exploratory-Testing rules (paste into your workspace CLAUDE.md)

Reusable rules for session-based exploration. Machine-specific paths do NOT belong
here. Mirror new rules of this kind here (+ into `CLAUDE.starter.md` and the
workspace `CLAUDE.md`) so they travel with the kit.

- **No charter, no session.** Every exploratory session has a one-sentence charter
  ("Explore <area> with <tour> to find <risk>"), a time-box (human 30–90 min; agent —
  a stated tool-call budget, default ~40 tool-calls), and a debrief. "Поклацати подивитись" without these is
  not testing and doesn't claim coverage.

- **Log as you go, oracle every anomaly:** each observation records what was done →
  what happened → inconsistent with WHAT (HICCUPPS: History, Image, Comparable
  products, Claims, User expectations, Product itself, Purpose, Statutes). An anomaly
  with no articulable oracle is a QUESTION for the owner, not a finding.

- **Stay on charter:** off-charter smells become new charter candidates in the
  debrief (max one 5-min side-look per session) — an agent that wanders covers
  nothing verifiably.

- **Findings feed forward, always:** confirmed bug → `BUG-NNN` (dedup first, session
  notes as evidence); confirmed surprise → new invariant and/or regression `TC-NNN`.
  An exploratory find that doesn't harden into an invariant/case will regress
  silently later.

- **Coverage honesty in every debrief:** % of the charter actually explored + what
  was NOT touched. Exploration claims charter coverage, never area coverage.

- **Charters come from risk:** strategy risk ≥ 7 areas, bug clusters, thin-spec
  features, owner worries. Artefacts → `<Project>/Exploratory/sessions/<date>-<slug>.md`
  (append-only), listed in the round's plan Results LINKS.
