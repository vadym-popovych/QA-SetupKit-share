#!/usr/bin/env node
// File bugs into a Redmine board in the team format. Read-only discovery + issue
// creation; never edits other people's issues.
//
// KIT TEMPLATE — copy to <Project>/QA-Documentation/tools/ and configure. Nothing here is
// project-specific: the board lives in env vars, so a fresh clone cannot accidentally file
// a bug into someone else's project.
//
//   REDMINE_URL         board base URL            (default placeholder — SET THIS to your board)
//   REDMINE_PROJECT_ID  numeric project id        (REQUIRED — find it via `whoami`/board URL)
//   REDMINE_TOKEN_FILE  path to the API key file  (default: QA-SetupKit/MCP-configurations/redmine/.token)
//
// Usage:
//   node redmine-bug.mjs whoami
//   node redmine-bug.mjs get <issue-id>
//   node redmine-bug.mjs create <bug-spec.json> [--dry-run]
//   node redmine-bug.mjs update <issue-id> <bug-spec.json> [--dry-run]
//       rebuilds subject+description from the spec and PUTs ONLY those fields
//       (status/assignee/sprint are left to the team's workflow)
//   node redmine-bug.mjs comment <issue-id> "<text>"
//
// Bug spec JSON:
// {
//   "layer": "App",                       // App | BE | FE -> prefix [BUG-App]/[BUG-BE]/[BUG-FE]
//   "subject": "Notifications screen shows hardcoded mock data",   // no prefix here
//   "build": "36",                        // optional -> "(Directly on the 36 build)"
//   "preconditions": ["Install 36 build", "Log in as ..."],
//   "steps": ["Open the Home screen", "Tap the bell icon"],
//   "actual": "...",
//   "expected": "...",
//   "screenshots": ["https://drive.google.com/..."],   // links line (team style)
//   "notes": ["..."],                     // optional
//   "attachments": ["/abs/path/annotated.png"],        // uploaded INTO the issue
//   "priority": "Normal",                 // Low|Normal|High|Urgent|Immediately
//   "assignee": "<frontend dev>",        // optional, name or numeric id
//   "sprint": "Sprint 7",                 // optional, version name or id
//   "status": "Backlog",                  // optional; omit = Redmine default
//   "custom_fields": [{"id": 8, "value": "..."}]       // optional passthrough
// }
//
// Token: gitignored QA-SetupKit/MCP-configurations/redmine/.token
// (override with REDMINE_TOKEN_FILE). Base URL override: REDMINE_URL.

import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.REDMINE_URL || 'https://redmine.example.com';  // placeholder — set REDMINE_URL to your board
// No default: filing a bug into the wrong board is not something to guess at.
const PROJECT_ID = process.env.REDMINE_PROJECT_ID;
if (!PROJECT_ID) {
  console.error('redmine-bug: REDMINE_PROJECT_ID is not set — refusing to guess which board to file into.');
  console.error('  Set it in your shell or in <Project>/CLAUDE.md-documented project config.');
  process.exit(2);
}
const TRACKER_BUG = 3;
const PRIORITIES = { Low: 5, Normal: 6, High: 7, Urgent: 8, Immediately: 9 };
const STATUSES = {
  Backlog: 1, 'To do': 5, Analysis: 9, 'In progress': 2, Reopened: 8,
  'To test': 3, 'QA in progress': 10, 'PM Acceptance': 4, Deployed: 6,
};

function findTokenFile() {
  if (process.env.REDMINE_TOKEN_FILE) return process.env.REDMINE_TOKEN_FILE;
  let dir = process.cwd();
  while (true) {
    const c = path.join(dir, 'QA-SetupKit/MCP-configurations/redmine/.token');
    if (fs.existsSync(c)) return c;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('redmine .token not found — set REDMINE_TOKEN_FILE or run from the workspace');
}
const TOKEN = fs.readFileSync(findTokenFile(), 'utf8').trim();

async function api(ep, opts = {}) {
  const r = await fetch(`${BASE}${ep}`, {
    ...opts,
    headers: {
      'X-Redmine-API-Key': TOKEN,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${ep} -> ${r.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;  // PUT returns 204/empty body
}

async function resolveUser(v) {
  if (typeof v === 'number' || /^\d+$/.test(v)) return Number(v);
  const { memberships } = await api(`/projects/${PROJECT_ID}/memberships.json?limit=100`);
  const hit = memberships.map(m => m.user || m.group).find(u => u && u.name === v);
  if (!hit) throw new Error(`assignee "${v}" is not a member of project ${PROJECT_ID}`);
  return hit.id;
}

// Team rule (Vadym, 11/07/2026): the sprint CHANGES over time — always resolve it
// LIVE at creation time and file into the currently ACTIVE sprint. Never cache,
// never hardcode sprint names in specs ("sprint": "active" is the standard).
async function resolveVersion(v) {
  const { versions } = await api(`/projects/${PROJECT_ID}/versions.json`);
  let hit;
  if (typeof v === 'number' || /^\d+$/.test(v)) hit = versions.find(x => x.id === Number(v));
  else if (v === 'active') hit = versions.find(x => x.status === 'active');
  else hit = versions.find(x => x.name === v);
  if (!hit) throw new Error(`sprint/version "${v}" not found (have: ${versions.map(x => `${x.name}[${x.status}]`).join(', ')})`);
  console.log(`sprint resolved: ${hit.name} (id ${hit.id}, status ${hit.status})`);
  return hit.id;
}

// Subject prefix by defect layer (Vadym, 11/07/2026):
// mobile app -> [BUG-App], backend -> [BUG-BE], website front -> [BUG-FE]
function bugPrefix(s) {
  const map = { app: '[BUG-App]', be: '[BUG-BE]', fe: '[BUG-FE]' };
  return map[(s.layer || '').toLowerCase()] || '[BUG]';
}

// Team description format (Textile), 1:1 with Bug #60982
function buildDescription(s) {
  const L = ['*Preconditions:*'];
  for (const p of s.preconditions || []) L.push(`* ${p}`);
  L.push('', '*Steps to reproduce:*');
  for (const st of s.steps || []) L.push(`# ${st}`);
  L.push('', '', `*Actual result:* ${s.actual}`);
  L.push('', `*Expected result:* ${s.expected}`);
  if (s.screenshots?.length) {
    // entries are strings or {label, url}; labeled entries render as their own
    // bold-label paragraphs (blank line between), replacing the generic header
    for (const x of s.screenshots) {
      if (typeof x === 'string') L.push('', `*Screenshot:* ${x}`);
      else L.push('', `*${x.label}:* ${x.url}`);
    }
  }
  if (s.notes?.length) {
    L.push('', '*Notes:*');
    for (const n of s.notes) L.push(`* ${n}`);
  }
  return L.join('\n');
}

async function uploadFile(file) {
  const name = path.basename(file);
  const r = await api(`/uploads.json?filename=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: fs.readFileSync(file),
  });
  const ext = path.extname(name).toLowerCase();
  const ct = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp4': 'video/mp4' }[ext]
    || 'application/octet-stream';
  return { token: r.upload.token, filename: name, content_type: ct };
}

async function create(specPath, dryRun) {
  const s = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  for (const k of ['subject', 'actual', 'expected']) {
    if (!s[k]) throw new Error(`spec is missing required field "${k}"`);
  }
  const issue = {
    project_id: PROJECT_ID,
    tracker_id: TRACKER_BUG,
    subject: `${bugPrefix(s)} ${s.subject}${s.build ? ` (Directly on the ${s.build} build)` : ''}`,
    description: buildDescription(s),
    priority_id: PRIORITIES[s.priority || 'Normal'] || PRIORITIES.Normal,
  };
  // Team defaults (Vadym, 11/07/2026): bug reports are created with status "To do";
  // "Backlog" is allowed ONLY for very minor bugs/improvements (set it explicitly in
  // the spec). Sprint -> the currently active one. Spec values override.
  const status = s.status || 'To do';
  if (!STATUSES[status]) throw new Error(`unknown status "${status}"`);
  issue.status_id = STATUSES[status];
  if (s.assignee) issue.assigned_to_id = await resolveUser(s.assignee);
  issue.fixed_version_id = await resolveVersion(s.sprint || 'active');
  if (s.custom_fields) issue.custom_fields = s.custom_fields;

  if (dryRun) {
    console.log('--- DRY RUN (nothing sent) ---');
    console.log(JSON.stringify({ issue }, null, 2));
    console.log(`--- attachments to upload: ${(s.attachments || []).join(', ') || '(none)'}`);
    return;
  }

  if (s.attachments?.length) {
    issue.uploads = [];
    for (const f of s.attachments) {
      issue.uploads.push(await uploadFile(f));
      console.log(`uploaded: ${path.basename(f)}`);
    }
  }
  const r = await api('/issues.json', { method: 'POST', body: JSON.stringify({ issue }) });
  console.log(`created: #${r.issue.id}  ${BASE}/issues/${r.issue.id}`);
  console.log(`subject: ${r.issue.subject}`);
}

async function update(id, specPath, dryRun) {
  const s = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const issue = {
    subject: `${bugPrefix(s)} ${s.subject}${s.build ? ` (Directly on the ${s.build} build)` : ''}`,
    description: buildDescription(s),
  };
  if (dryRun) {
    console.log(`--- DRY RUN (PUT /issues/${id}.json not sent) ---`);
    console.log(JSON.stringify({ issue }, null, 2));
    return;
  }
  await api(`/issues/${id}.json`, { method: 'PUT', body: JSON.stringify({ issue }) });
  console.log(`updated: #${id}  ${BASE}/issues/${id} (subject + description)`);
}

const [cmd, arg, arg2] = process.argv.slice(2);
const dryRun = process.argv.includes('--dry-run');
try {
  if (cmd === 'whoami') {
    const { user } = await api('/users/current.json');
    console.log(`${user.firstname} ${user.lastname} (id ${user.id}, ${user.login})`);
  } else if (cmd === 'get') {
    const { issue } = await api(`/issues/${arg}.json?include=attachments`);
    console.log(JSON.stringify(issue, null, 2));
  } else if (cmd === 'create') {
    await create(arg, dryRun);
  } else if (cmd === 'update') {
    await update(arg, arg2, dryRun);
  } else if (cmd === 'comment') {
    await api(`/issues/${arg}.json`, { method: 'PUT', body: JSON.stringify({ issue: { notes: arg2 } }) });
    console.log(`commented on #${arg}  ${BASE}/issues/${arg}`);
  } else {
    console.log('usage: redmine-bug.mjs whoami | get <id> | create <spec.json> [--dry-run] | update <id> <spec.json> [--dry-run] | comment <id> "<text>"');
    process.exit(1);
  }
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}
