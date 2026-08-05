#!/bin/bash
# One-time Mega.nz login from the gitignored credentials.json (password never
# passes through chat or shell history). Session persists in ~/.megaCmd —
# uploads need no further auth until an explicit mega-logout.
set -euo pipefail
# Official MEGAcmd ships as a macOS app bundle (brew cask) — binaries live inside it
export PATH="$PATH:/Applications/MEGAcmd.app/Contents/MacOS:/opt/homebrew/bin:/usr/local/bin"
DIR="$(cd "$(dirname "$0")" && pwd)"

EMAIL=$(node -e "process.stdout.write(require('$DIR/credentials.json').email)")
PASS=$(node -e "process.stdout.write(require('$DIR/credentials.json').password)")
case "$EMAIL" in PASTE_*) echo "Fill credentials.json first." >&2; exit 1;; esac

mega-logout >/dev/null 2>&1 || true
# password via env -> stdin-safe: megacmd accepts it as 2nd arg; keep it out of
# `set -x`/history by passing through a subshell variable only
mega-login "$EMAIL" "$PASS"
mega-whoami
echo "OK — session stored in ~/.megaCmd"
