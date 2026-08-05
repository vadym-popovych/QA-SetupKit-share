#!/usr/bin/env bash
# Security-Testing kit — OWASP ZAP wrapper (Docker).
# Usage:
#   ./run-zap.sh baseline https://staging.example.com   # passive only — SAFE, always start here
#   ./run-zap.sh full     https://staging.example.com   # active attack payloads — AUTHORIZED staging only
set -euo pipefail

MODE="${1:-baseline}"
TARGET="${2:?Usage: ./run-zap.sh <baseline|full> <https://target>}"
OUT="results"
mkdir -p "$OUT"
STAMP="$(date +%Y%m%d-%H%M%S)"   # ok in a shell script; scripts (not Claude) may use date

case "$MODE" in
  baseline)
    echo ">> ZAP BASELINE (passive) on $TARGET"
    docker run --rm -v "$(pwd)/$OUT:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
      zap-baseline.py -t "$TARGET" -r "zap-baseline-$STAMP.html" -J "zap-baseline-$STAMP.json" || true
    ;;
  full)
    echo ">> ZAP FULL (ACTIVE attack) on $TARGET"
    echo ">> Confirm this host is authorized for active scanning before continuing."
    docker run --rm -v "$(pwd)/$OUT:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
      zap-full-scan.py -t "$TARGET" -r "zap-full-$STAMP.html" -J "zap-full-$STAMP.json" || true
    ;;
  *) echo "unknown mode: $MODE (use baseline|full)"; exit 1 ;;
esac

echo ">> report: $OUT/zap-$MODE-$STAMP.html  — triage false positives, then file BUG-NNN (SECURITY)."
