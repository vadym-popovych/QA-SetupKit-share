#!/usr/bin/env node
// skill-usage-audit.mjs — which installed skills actually fire, and what the idle ones cost.
//
// A skill's frontmatter `description` is injected into the system prompt of EVERY session,
// invoked or not. This audit answers the only question that matters before pruning:
// over the whole local history, which skills has this machine ever actually invoked?
//
// Reads (never writes):
//   $CLAUDE_HOME/projects/**/*.jsonl        — session transcripts, for real `Skill` tool_use calls
//   $CLAUDE_HOME/plugins/installed_plugins.json + each installPath/skills/*/SKILL.md
//   $CLAUDE_HOME/skills/*/SKILL.md          — user-level skills
//   ./.claude/skills/*/SKILL.md             — project-level skills
//
// Usage:  node skill-usage-audit.mjs [--json]
//
// The count is evidence, not a verdict: a skill installed yesterday has no history, and a
// never-used skill may still be one you want. Decide per row; the tool only supplies the number.

import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import path from 'node:path';

const HOME = process.env.CLAUDE_HOME || path.join(homedir(), '.claude');
const JSON_OUT = process.argv.includes('--json');

/** Every *.jsonl under a directory, recursively. */
function walkJsonl(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkJsonl(p, out);
    else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

/** Parse the YAML frontmatter fields we care about — name and description. */
function frontmatter(file) {
  const text = readFileSync(file, 'utf8');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return null;
  const fm = m[1];
  const name = /^name:\s*(.+)$/m.exec(fm);
  // description may be a folded/multi-line scalar: take everything up to the next top-level key
  const desc = /^description:\s*([\s\S]*?)(?=\n[A-Za-z_-]+:|$)/m.exec(fm);
  return {
    name: name ? name[1].trim() : path.basename(path.dirname(file)),
    description: desc ? desc[1].replace(/\s+/g, ' ').trim() : '',
  };
}

function collectSkills() {
  const skills = [];
  const addDir = (skillsDir, source, prefix) => {
    if (!existsSync(skillsDir) || !statSync(skillsDir).isDirectory()) return;
    for (const e of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const f = path.join(skillsDir, e.name, 'SKILL.md');
      if (!existsSync(f)) continue;
      const fm = frontmatter(f);
      if (!fm) continue;
      const id = prefix ? `${prefix}:${fm.name}` : fm.name;
      // What the session listing actually costs: "- <id>: <description>\n"
      skills.push({ id, source, dir: path.join(skillsDir, e.name), chars: `- ${id}: ${fm.description}\n`.length });
    }
  };

  const registry = path.join(HOME, 'plugins', 'installed_plugins.json');
  if (existsSync(registry)) {
    let reg = {};
    try { reg = JSON.parse(readFileSync(registry, 'utf8')); } catch { /* unreadable registry — skip */ }
    for (const [key, insts] of Object.entries(reg.plugins || {})) {
      const pluginName = key.split('@')[0];
      for (const inst of insts) {
        if (inst.installPath) addDir(path.join(inst.installPath, 'skills'), `plugin:${key}`, pluginName);
      }
    }
  }
  addDir(path.join(HOME, 'skills'), 'user', '');
  addDir(path.join(process.cwd(), '.claude', 'skills'), 'project', '');
  return skills;
}

async function countInvocations() {
  const counts = new Map();
  const files = walkJsonl(path.join(HOME, 'projects'));
  for (const f of files) {
    const rl = createInterface({ input: createReadStream(f, { encoding: 'utf8' }), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.includes('"Skill"')) continue;   // cheap prefilter, the vast majority of lines
      let d;
      try { d = JSON.parse(line); } catch { continue; }
      const content = d?.message?.content;
      if (!Array.isArray(content)) continue;
      for (const blk of content) {
        if (blk?.type === 'tool_use' && blk?.name === 'Skill') {
          const s = blk.input?.skill;
          if (s) counts.set(s, (counts.get(s) || 0) + 1);
        }
      }
    }
  }
  return { counts, transcripts: files.length };
}

const skills = collectSkills();
const { counts, transcripts } = await countInvocations();

const rows = skills
  .map((s) => ({ ...s, uses: counts.get(s.id) || 0 }))
  .sort((a, b) => a.uses - b.uses || b.chars - a.chars);

const idle = rows.filter((r) => r.uses === 0);
const reclaimable = idle.reduce((n, r) => n + r.chars, 0);

if (JSON_OUT) {
  console.log(JSON.stringify({ transcripts, totalSkills: rows.length, idle: idle.length, reclaimableChars: reclaimable, rows }, null, 2));
} else {
  console.log(`scanned ${transcripts} transcript(s) under ${path.join(HOME, 'projects')}\n`);
  console.log('uses   chars  skill'.padEnd(60) + 'source');
  for (const r of rows) {
    console.log(`${String(r.uses).padStart(4)}  ${String(r.chars).padStart(6)}  ${r.id.padEnd(48)}${r.source}`);
  }
  console.log(`\n${rows.length} skill(s) installed · ${idle.length} never invoked here`);
  console.log(`~${reclaimable} chars of always-on listing text sit behind the never-invoked ones`);
  console.log('\nA zero is evidence, not a verdict — a freshly installed skill has no history.');
}
