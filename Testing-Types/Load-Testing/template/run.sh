#!/usr/bin/env bash
# Two ways to run the k6 tests.
#
#   ./run.sh local <scenario> [extra k6 args...]
#       Runs entirely on this machine, results in the terminal.
#       Free and UNLIMITED — no account, no quota. Limited only by your machine
#       and the target API.
#
#   ./run.sh cloud <scenario> [extra k6 args...]
#       Executes LOCALLY (your free compute) but STREAMS metrics to the Grafana
#       Cloud k6 dashboards (`k6 run -o cloud`). Authenticate once:
#           k6 cloud login --token <token> --stack <slug-or-URL>
#       Only the metric INGEST counts toward the Grafana Cloud free tier, not the
#       load generation (that stays local).
#
# Examples:
#   ./run.sh local scenarios/smoke.js
#   ./run.sh local scenarios/load.js  -e VUS=20
#   ./run.sh cloud scenarios/load.js  -e VUS=20
set -euo pipefail
cd "$(dirname "$0")"

MODE="${1:-}"; SCRIPT="${2:-}"
if [[ -z "$MODE" || -z "$SCRIPT" ]]; then
  echo "usage: ./run.sh local|cloud <scenario.js> [extra k6 args...]" >&2
  exit 2
fi
shift 2

COMMON=()
[[ -f "$PWD/users.json" ]] && COMMON+=(-e "USERS_FILE=$PWD/users.json")

case "$MODE" in
  local)
    exec k6 run "${COMMON[@]}" "$@" "$SCRIPT"
    ;;
  cloud)
    if [[ -z "${K6_CLOUD_TOKEN:-}" ]] && ! k6 cloud login -s 2>/dev/null | grep -q "token:"; then
      echo "❌ Not authenticated with Grafana Cloud k6." >&2
      echo "   Run once:   k6 cloud login --token <token> --stack <slug>" >&2
      echo "   or export:  K6_CLOUD_TOKEN=<token>" >&2
      exit 1
    fi
    exec k6 run -o cloud "${COMMON[@]}" "$@" "$SCRIPT"
    ;;
  *)
    echo "unknown mode: $MODE (use 'local' or 'cloud')" >&2
    exit 2
    ;;
esac
