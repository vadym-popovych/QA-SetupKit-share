#!/usr/bin/env bash
# Publish a self-contained HTML QA document to YOUR OWN private GitHub repo — the one
# QA_DOCS_REPO_DIR points at (<Type>/<YYYY-MM-DD>/<file>.html — the project name must NEVER
# appear in the path/link) — and print the browser link. The site is served by CLOUDFLARE
# PAGES (project <qa-docs-repo> -> <your-site>.pages.dev) connected to that private repo;
# auto-deploys ~30-60s after the push.
# (Until 28/07/2026 this line named the author's own account and repo, in a tool whose
# runtime is entirely env-driven — so it read as an instruction to publish into somebody
# else's repository. The comment is the only place that name ever appeared.)
#
#   tools/publish-report.sh <file.html> [Type] [public]
#     Type defaults to "Reports" (run reports); other kinds pass their own type.
#     DEFAULT = PRIVATE (Vadym, 09/07/2026): published under Private/<Type>/...,
#     the browser asks login/password (Basic Auth; creds file:
#     QA-SetupKit/MCP-configurations/cloudflare/basic-auth.txt — always share
#     its link together with the report link). Pass 3rd arg "public" for an
#     unprotected link-accessible publication.
#
# Date folder: taken from a YYYY-MM-DD prefix in the file name if present,
# otherwise today. ⚠️ Site is link-accessible — dev/test-stand artefacts only.
set -euo pipefail

# Both of these are YOUR hosting, not the kit author's. There is no working default:
#   · a default REPO_DIR produced a raw `git fatal: cannot change to …` on a teammate's first run;
#   · a default BASE_URL was worse — it silently handed them a link to somebody else's site.
# So: fail closed, and say exactly what to create. (Never guess where someone's reports go.)
REPO_DIR="${QA_DOCS_REPO_DIR:-$HOME/qa-public-reports}"
BASE_URL="${QA_DOCS_BASE_URL:-}"

if [ ! -d "$REPO_DIR/.git" ]; then
  cat >&2 <<MSG
publish-report: no report repo at $REPO_DIR

  This tool publishes an HTML report to a git repo that a static host serves (the author uses a
  private GitHub repo + Cloudflare Pages). It is YOUR repo — the kit cannot supply one.

  1. Create a private repo for published reports and clone it, e.g.
       git clone git@github.com:<you>/qa-reports.git ~/qa-public-reports
  2. Point this tool at it (and at the site that serves it):
       export QA_DOCS_REPO_DIR=~/qa-public-reports
       export QA_DOCS_BASE_URL=https://<your-site>          # no trailing slash
  See QA-Documentation/Custom-Reports/HTML-Reports/SETUP.md.
MSG
  exit 2
fi

if [ -z "$BASE_URL" ]; then
  echo "publish-report: QA_DOCS_BASE_URL is not set — refusing to print a link to a site you don't own." >&2
  echo "  export QA_DOCS_BASE_URL=https://<your-site>   (see QA-Documentation/Custom-Reports/HTML-Reports/SETUP.md)" >&2
  exit 2
fi

FILE="${1:?usage: publish-report.sh <file.html> [Type]}"
TYPE="${2:-Reports}"
[ "${3:-}" != "public" ] && TYPE="Private/$TYPE"
[ -f "$FILE" ] || { echo "no such file: $FILE" >&2; exit 1; }
case "$FILE" in *.html) ;; *) echo "only .html files are published (got: $FILE)" >&2; exit 1 ;; esac

NAME="$(basename "$FILE")"
if [[ "$NAME" =~ ^([0-9]{4}-[0-9]{2}-[0-9]{2}) ]]; then
  DATE="${BASH_REMATCH[1]}"
else
  DATE="$(date +%F)"
fi

# keep the local clone fresh so concurrent publishes don't conflict
git -C "$REPO_DIR" pull -q --rebase

DEST_DIR="$REPO_DIR/$TYPE/$DATE"
mkdir -p "$DEST_DIR"
cp "$FILE" "$DEST_DIR/$NAME"

git -C "$REPO_DIR" add "$TYPE/$DATE/$NAME"
if git -C "$REPO_DIR" diff --cached --quiet; then
  echo "already published (no changes)"
else
  git -C "$REPO_DIR" commit -q -m "Publish $TYPE/$DATE/$NAME"
  git -C "$REPO_DIR" push -q origin HEAD
fi

echo "$BASE_URL/$TYPE/$DATE/${NAME%.html}"
case "$TYPE" in Private/*) echo "login/pass: <workspace>/QA-SetupKit/MCP-configurations/cloudflare/basic-auth.txt (gitignored — create your own)" ;; esac
