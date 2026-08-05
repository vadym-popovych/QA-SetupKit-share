# Mega.nz — QA evidence uploads (20 GB free tier)
**Quota is a planning constraint, not a puzzle:** never create additional free accounts to work around
it. It breaks the provider's terms and scatters evidence across logins nobody will be able to reassemble.

- **Credentials:** `credentials.json` (gitignored) — Mega account email + password. The owner
  pastes them HIMSELF — never through chat. Backed up via the encrypted secrets bundle.
- **Tooling:** MegaCMD — the `mega-*` commands on PATH. macOS: `brew install megacmd`, which
  installs an app bundle, so both scripts append `/Applications/MEGAcmd.app/Contents/MacOS`
  and `/opt/homebrew/bin` to PATH to find the binaries inside it. Those two appends are the
  only macOS-specific lines here: MEGAcmd is packaged for Linux and Windows as well, and both
  scripts keep the inherited `$PATH` first, so they run unchanged once `mega-login` is on it.
- **One-time auth:** fill `credentials.json` → `./mega-auth.sh` — logs in and stores the
  session in `~/.megaCmd`; uploads then need no further auth (re-run only after an explicit
  logout or password change; if the password changes, also flag `backup-secrets.sh`).
- **Upload:** `./mega-upload.sh <file> <remote-folder> [--name <name>]` — uploads
  (overwrite-on-rerun) and prints a public link (includes the decryption key).
  The remote folder is required (e.g. `/MyApp/Bug Evidence`) — no default; a placeholder
  default used to misfile uploads silently. `--check` prints account + storage usage.
- **Evidence mode (standard for QA attachments):** `./mega-upload.sh --evidence <Project> <file>`
  → `/Attachments/<Project>/<Screenshots|Screen records>/<dd.mm.yyyy>/dd.mm.yyyy - screenshotN.ext`
  (kind auto-detected from the extension; N auto-increments within the date folder — never
  overwrites).
- Free tier: 20 GB storage; transfer quota on free accounts is limited per ~6h window —
  fine for screenshots/screencasts, not for bulk archives.
