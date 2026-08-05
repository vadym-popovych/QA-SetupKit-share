# glossary — controlled QA vocabulary

Cross-cutting infrastructure (underscore-prefixed, like `Rules-Guide/schemas/`): ONE place where
every load-bearing term the kits use is defined once and OWNED by exactly one kit.
The glossary prevents semantic drift — two kits using "covered" or "verified" with
slightly different meanings is how traceability quietly breaks.

## Rules

> This section IS the kit's rules file (no separate `GLOSSARY_RULES.md` — the kit is
> two files by design). Mirror new rules of this kind here (+ into
> `CLAUDE.starter.md` and the workspace `CLAUDE.md`) so they travel with the kit.

- **Every entry names its OWNER** (the kit whose docs define it) and, when the term
  is machine-read, its **schema home** (`Rules-Guide/schemas/*.json` enum). The glossary POINTS,
  it never redefines — on conflict, the owner kit's definition wins and the glossary
  entry gets fixed.
- **New load-bearing term → glossary entry in the same change.** A term used by ≥ 2
  kits without an entry here is a defect (file it against the kit that coined it).
- **Renames are breaking changes:** treat like schema evolution — update the owner
  kit, the glossary, and every referencing kit in one change, or don't rename.

See [`GLOSSARY.md`](GLOSSARY.md) for the terms.
