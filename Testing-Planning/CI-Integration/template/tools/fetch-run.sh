#!/usr/bin/env bash
# fetch-run.sh — pull a CI run's artefacts into the kit's own home for triage.
#
# The pipeline runs on an ephemeral runner: it writes run-result.json / details.json /
# candidates.md into artifacts/ and uploads them to the provider's artefact store. It CANNOT
# write into your QA workspace. This script is the missing half — it makes
# <Project>/CI-Integration/runs/<run-id>/ real instead of aspirational.
#
# Usage (from <Project>/CI-Integration/):
#   ./tools/fetch-run.sh <github-run-id>            # GitHub Actions (needs `gh auth login`)
#   ./tools/fetch-run.sh <pipeline-id> --gitlab     # GitLab CI (needs `glab auth login`)
#
# Then triage: candidates.md → dedup → severity branch → owner confirmation (BUG_REPORTS_RULES).
# Nothing here files a bug, and nothing here writes into the app's repository.

set -euo pipefail

RUN_ID="${1:-}"
PROVIDER="${2:---github}"
[ -n "$RUN_ID" ] || { echo "usage: $0 <run-id> [--gitlab]"; exit 2; }

DEST="runs/$RUN_ID"
mkdir -p "$DEST"

case "$PROVIDER" in
  --github)
    command -v gh >/dev/null || { echo "gh CLI not found (brew install gh && gh auth login)"; exit 1; }
    gh run download "$RUN_ID" --dir "$DEST"
    ;;
  --gitlab)
    command -v glab >/dev/null || { echo "glab CLI not found (brew install glab && glab auth login)"; exit 1; }
    glab ci artifact "$RUN_ID" --path "$DEST" 2>/dev/null \
      || { echo "could not download artefacts for pipeline $RUN_ID"; exit 1; }
    ;;
  *) echo "unknown provider $PROVIDER (use --github or --gitlab)"; exit 2 ;;
esac

echo
echo "Downloaded → $DEST"
find "$DEST" -name 'run-result.json' -print0 | while IFS= read -r -d '' f; do
  node -e '
    const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const mark = r.verdict === "pass" ? "PASS" : r.verdict.toUpperCase();
    console.log(`${mark.padEnd(8)} ${r.discipline.padEnd(20)} ${r.runId}`);
    for (const c of r.thresholds?.crossed ?? []) console.log(`         · ${c}`);
  ' "$f"
done

echo
echo "Candidates (NOT bugs — triage through the funnel):"
find "$DEST" -name 'candidates.md' -exec echo "  {}" \; || true
