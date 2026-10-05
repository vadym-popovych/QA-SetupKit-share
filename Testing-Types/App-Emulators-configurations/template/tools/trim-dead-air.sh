#!/usr/bin/env bash
# Cut the dead air off a repro clip: the recorder is already rolling while the driver boots and
# connects, so a raw capture opens with ~10 s of a motionless screen — a reviewer reads that as
# "nothing happens" and stops watching. Keeps ~1 s of lead-in before the first real movement and
# 1.5 s of tail after the last, so the clip still opens on the starting state.
#
#   tools/trim-dead-air.sh <in.mp4> [out.mp4]      # out defaults to in-place
#
# It runs up to 3 passes: one stray flicker early in the capture (a status-bar clock tick, the
# driver's own first screenshot) satisfies the motion test while the screen is still idle, so a
# single pass can leave seconds of stillness behind. Each pass re-measures and stops as soon as
# the head is short enough — measuring once and trusting it is what left 2 s in the first cut.
set -euo pipefail
IN="${1:?usage: trim-dead-air.sh <in.mp4> [out.mp4]}"
OUT="${2:-$IN}"
LEAD="${LEAD:-1.0}"
TAIL="${TAIL:-1.5}"
MAX_HEAD="${MAX_HEAD:-1.4}"      # acceptable stillness at the start, seconds

[ "$OUT" != "$IN" ] && cp "$IN" "$OUT"
ORIG=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")

for pass in 1 2 3; do
  DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
  LOG=$(ffmpeg -hide_banner -nostats -i "$OUT" -vf "freezedetect=n=-60dB:d=0.4" -map 0:v -f null - 2>&1 || true)

  HEAD_END=$(echo "$LOG" | awk '
    /freeze_start/ { s=$NF }
    /freeze_end/   { if (s+0 <= 0.3 && !done) { print $NF; done=1 } }' | head -1)
  TAIL_START=$(echo "$LOG" | awk '
    /freeze_start/ { s=$NF; open=1 }
    /freeze_end/   { open=0 }
    END { if (open) print s }')

  START=$(python3 -c "print(max(0.0, ${HEAD_END:-0} - $LEAD))")
  if [ -n "$TAIL_START" ]; then END=$(python3 -c "print(min($DUR, $TAIL_START + $TAIL))"); else END="$DUR"; fi

  # nothing worth cutting on this pass → done
  if python3 -c "import sys; sys.exit(0 if ($START < 0.2 and $END > $DUR - 0.2) else 1)"; then break; fi

  TMP="${OUT%.mp4}.trimmed.mp4"
  ffmpeg -hide_banner -loglevel error -y -ss "$START" -to "$END" -i "$OUT" \
    -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p -movflags +faststart "$TMP"
  mv "$TMP" "$OUT"

  HEAD_NOW=$(ffmpeg -hide_banner -nostats -i "$OUT" -vf "freezedetect=n=-60dB:d=0.4" -map 0:v -f null - 2>&1 \
    | awk '/freeze_start/{s=$NF} /freeze_end/{if(s+0<=0.3){print $NF; exit}}')
  if python3 -c "import sys; sys.exit(0 if ${HEAD_NOW:-0} <= $MAX_HEAD else 1)"; then break; fi
done

NEW=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")
HEAD_FINAL=$(ffmpeg -hide_banner -nostats -i "$OUT" -vf "freezedetect=n=-60dB:d=0.4" -map 0:v -f null - 2>&1 \
  | awk '/freeze_start/{s=$NF} /freeze_end/{if(s+0<=0.3){print $NF; exit}}')
printf '%s: %.1fs -> %.1fs  still at start: %ss\n' "$(basename "$OUT")" "$ORIG" "$NEW" "${HEAD_FINAL:-0}"
