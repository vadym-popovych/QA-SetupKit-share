#!/usr/bin/env bash
# Record a multi-step reproduction as ONE clip: start the screen recording, drive the flow,
# stop cleanly. A bug whose point is a SEQUENCE ("confirm → nothing happens", "set → go back →
# it is gone") is not provable by stills; this is the evidence for those.
#
#   tools/record-repro.sh <flow.yaml> <out-name> [device-udid]
#
# Writes runs/<date>/clips/<out-name>.mp4. The recording is stopped with SIGINT, which is what
# simctl needs to finalise the container — kill -9 leaves an unplayable file.
set -euo pipefail
cd "$(dirname "$0")/.."

FLOW="${1:?usage: record-repro.sh <flow.yaml> <out-name> [udid]}"
NAME="${2:?usage: record-repro.sh <flow.yaml> <out-name> [udid]}"
UDID="${3:-${DEVICE_ID:-}}"
[ -n "$UDID" ] || { echo "record-repro: no device — pass a udid or set DEVICE_ID" >&2; exit 2; }

DATE="$(date +%Y-%m-%d)"
OUT_DIR="${OUT_DIR:-runs/$DATE/clips}"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/$NAME.mp4"
rm -f "$OUT"

RLOG="$(mktemp)"
xcrun simctl io "$UDID" recordVideo --codec h264 --force "$OUT" >"$RLOG" 2>&1 &
REC=$!
for _ in $(seq 1 50); do grep -q "Recording started" "$RLOG" && break; sleep 0.2; done
T0=$(python3 -c 'import time; print(int(time.time() * 1000))')   # first frame, for the tap overlay
sleep 1                                   # let the recorder attach before the first tap

set +e
maestro --device "$UDID" test "$FLOW"
FLOW_RC=$?
set -e

sleep 2                                   # let the last frame land
kill -INT "$REC" 2>/dev/null || true
wait "$REC" 2>/dev/null || true

[ -s "$OUT" ] || { echo "record-repro: no video was produced" >&2; exit 1; }
rm -f "$RLOG"

# simctl captures no touches (EMULATOR_RULES §3.7b): draw Maestro's taps BEFORE the trim, while
# the clip still starts at T0. NO_TAPS=1 keeps the raw capture.
if [ -z "${NO_TAPS:-}" ]; then
  python3 "$(dirname "$0")/tap-overlay.py" "$OUT" --t0 "$T0" || echo "record-repro: tap overlay failed, clip kept without taps" >&2
fi

# The recorder is rolling while the driver boots and connects, so a raw capture opens with ~10 s
# of a motionless screen. A reviewer reads that as "nothing happens" and stops watching, so the
# clip is trimmed to 1 s of lead-in before the first movement. NO_TRIM=1 keeps the raw capture.
if [ -z "${NO_TRIM:-}" ] && command -v ffmpeg >/dev/null 2>&1; then
  "$(dirname "$0")/trim-dead-air.sh" "$OUT"
fi

SIZE=$(du -h "$OUT" | cut -f1)
echo "clip: $OUT ($SIZE)  flow exit: $FLOW_RC"
