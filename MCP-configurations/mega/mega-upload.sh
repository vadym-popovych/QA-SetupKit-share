#!/bin/bash
# Upload a file to Mega.nz and print a public shared link.
# Usage:
#   ./mega-upload.sh <local-file> <remote-folder> [--name <name>]
#   ./mega-upload.sh --check     # verify session / storage usage
# The remote folder is REQUIRED (e.g. "/MyApp/Bug Evidence") — no default: a placeholder
# default silently misfiles uploads into a literal placeholder folder (28/07/2026).
# Re-upload of the same name OVERWRITES (delete + put) so re-runs stay idempotent,
# matching drive-upload.mjs behaviour.
#
# One-time login (session persists in ~/.megaCmd): run ./mega-auth.sh next to this script.
# It reads credentials.json from its OWN directory and pipes the password to mega-login, so
# nothing here depends on where the kit was cloned. (Until 28/07/2026 these lines spelled the
# author's absolute path twice — invisible to kit-lint L3, which only read docs, never tools.)

set -euo pipefail
# Official MEGAcmd ships as a macOS app bundle (brew cask) — binaries live inside it
export PATH="$PATH:/Applications/MEGAcmd.app/Contents/MacOS:/opt/homebrew/bin:/usr/local/bin"

if [ "${1:-}" = "--check" ]; then
  mega-whoami
  mega-df -h | head -3
  exit 0
fi

# Evidence mode (Vadym, 11/07/2026): ./mega-upload.sh --evidence <Project> <file>
# Structure: /Attachments/<Project>/<Screenshots|Screen records>/<dd.mm.yyyy>/
# Naming:    dd.mm.yyyy - screenshotN.ext | dd.mm.yyyy - videoN.ext
# (dots, not slashes — "/" is the path separator in Mega; N auto-increments
# per date+kind within the date folder, so evidence never overwrites)
if [ "${1:-}" = "--evidence" ]; then
  PROJECT="${2:?usage: mega-upload.sh --evidence <Project> <file>}"
  FILE="${3:?usage: mega-upload.sh --evidence <Project> <file>}"
  [ -f "$FILE" ] || { echo "no such file: $FILE" >&2; exit 1; }
  EXT="${FILE##*.}"; EXT=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')
  case "$EXT" in
    png|jpg|jpeg|gif|webp) KIND=screenshot; SUB="Screenshots";;
    mp4|mov|webm|mkv)      KIND=video;      SUB="Screen records";;
    *) echo "unknown evidence type .$EXT (image or video expected)" >&2; exit 1;;
  esac
  DATE=$(date +%d.%m.%Y)
  FOLDER="/Attachments/$PROJECT/$SUB/$DATE"
  mega-mkdir -p "$FOLDER" 2>/dev/null || true
  # grep -c exits 1 on zero matches (first file of the day) — don't let set -e kill us
  N=$(mega-ls "$FOLDER" 2>/dev/null | grep -c "^$DATE - $KIND" || true)
  N=$((N + 1))
  NAME="$DATE - $KIND$N.$EXT"
  REMOTE="$FOLDER/$NAME"
  # progress bars corrupt piped stdout (MEGAcmd rewinds the shared fd) — silence them
  mega-put "$FILE" "$REMOTE" >/dev/null 2>&1
  echo "uploaded: $REMOTE"
  LINK=$(mega-export -a -f "$REMOTE" 2>/dev/null | grep -o 'https://mega\.nz/[^ ]*' || true)
  [ -n "$LINK" ] || { echo "export failed for $REMOTE" >&2; exit 1; }
  echo "link: $LINK"
  exit 0
fi

FILE="${1:?usage: mega-upload.sh <file> <remote-folder> [--name <name>] | --check}"
[ -f "$FILE" ] || { echo "no such file: $FILE" >&2; exit 1; }
# Fail closed: no placeholder default — uploading into a literal placeholder folder is a
# silent misfile (28/07/2026). Evidence mode (--evidence) builds the folder itself.
FOLDER="${2:?mega-upload.sh: remote folder required, e.g. \"/MyApp/Bug Evidence\"}"
case "$FOLDER" in --*) echo "mega-upload.sh: remote folder must come before flags, e.g. \"/MyApp/Bug Evidence\"" >&2; exit 2;; esac
NAME="$(basename "$FILE")"
for ((i=1; i<=$#; i++)); do
  if [ "${!i}" = "--name" ]; then j=$((i+1)); NAME="${!j}"; fi
done

REMOTE="${FOLDER%/}/$NAME"
mega-mkdir -p "$FOLDER" 2>/dev/null || true
mega-rm "$REMOTE" 2>/dev/null || true            # overwrite-on-rerun
# progress bars corrupt piped stdout (MEGAcmd rewinds the shared fd) — silence them
mega-put "$FILE" "$REMOTE" >/dev/null 2>&1
echo "uploaded: $REMOTE"
# -a creates (or returns existing) public link incl. decryption key; -f accepts
# the copyright-notice prompt non-interactively
LINK=$(mega-export -a -f "$REMOTE" 2>/dev/null | grep -o 'https://mega\.nz/[^ ]*' || true)
[ -n "$LINK" ] || { echo "export failed for $REMOTE" >&2; exit 1; }
echo "link: $LINK"
