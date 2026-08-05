#!/usr/bin/env node
// Memory-Eval — headless net runner and effort sweeper.
//
// The same net as the Workflow-tool runner, driven from the CLI: one `claude -p` subprocess
// per agent, retriever and judge structurally separate (MEMORY_EVAL_RULES §5.1), structured
// output via --json-schema, retrievals cached so a second axis need not pay for them twice.
//
// WHY THIS EXISTS: the Workflow tool is not present on every host, and a missing tool
// announces nothing — the script simply never runs. That was not hypothetical: it was absent
// in a live headless run, which is where an eval is least able to notice it measured nothing.
// This runner needs only node + the `claude` CLI, so the fallback path is the plain one.
//
// Run conditions (model, retrieve effort, judge effort) are the instrument, not defaults:
// they come from env/flags and are recorded INTO the result (§2). Nothing is hardcoded here —
// a nailed-shut model in a shipped tool is the kit contradicting its own rule in its own repo.
//
// Usage:  node sweep-runner.mjs --help

import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve, basename, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))

// Effort levels this runner knows about. An unknown level is passed through with a warning,
// never blocked: the harness may grow levels faster than this file does.
const KNOWN_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max']

// Exit codes — the contract callers script against.
const EXIT_OK = 0        // every planned cell produced a verdict (pass or fail)
const EXIT_NOT_RUN = 1   // completed, but >= 1 cell is not-run (§6) — a partial measurement
const EXIT_USAGE = 2     // usage/config error, fail-closed: nothing ran
const EXIT_BLOCKED = 3   // the net shrank to nothing — blocked, never green (§6)

// ----------------------------------------------------------------------------- prompts
//
// §5.1 wants ONE judge prompt in a shared module every runner imports: forked copies drift,
// and when they do, the calibration test grades a different judge than the net does — both
// results become worthless with nothing to announce it. These two builders are exported for
// exactly that reason: a sibling runner imports them, it never re-types them. If a shared
// prompt module later lands in this folder, move these there and import — do not copy.

export function buildRetrievePrompt(file, scenario) {
  return `You are operating in this workspace. Read the workspace rules file FIRST (it is your standing memory):  cat ${file}
Then, for THIS situation, name the specific rule/section that governs it and state exactly what you would do:

SITUATION: ${scenario.situation}

Answer only from what the file actually says. If nothing in the file covers it, say so in governingRule.`
}

export function buildJudgePrompt(scenario, retrieval) {
  return `Judge whether this agent retrieved the correct rule for the situation. Do NOT be lenient.
SITUATION: ${scenario.situation}
ORACLE — the rule that MUST surface: ${scenario.oracleRule}
ORACLE — the correct behavior it must produce: ${scenario.oracleCheck}
AGENT ANSWER — governingRule: ${retrieval ? retrieval.governingRule : '(none)'}
AGENT ANSWER — action: ${retrieval ? retrieval.action : '(none)'}
pass=true ONLY if the answer clearly surfaced the oracle rule AND the action matches the oracle behavior. A vague or wrong rule, or a missed key constraint, is pass=false.`
}

export const RETRIEVE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['governingRule', 'action'],
  properties: {
    governingRule: { type: 'string' },
    action: { type: 'string' },
  },
}

export const JUDGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pass', 'reason'],
  properties: {
    pass: { type: 'boolean' },
    reason: { type: 'string' },
  },
}

// ----------------------------------------------------------------------------- CLI

const HELP = `sweep-runner.mjs — Memory-Eval net runner / effort sweeper (headless-safe)

Runs one cell per (scenario x retrieve-effort x judge-effort). A cell = 2 agents: a retriever
that reads the memory file and a judge that never sees it (maker-checker, RULES §5.1).

USAGE
  node sweep-runner.mjs --file <memory-file> --scenarios <set.json> --out <result.json>
                        [--model <id>] [--retrieve-effort <lvl>] [--judge-effort <lvl>]
                        [--sweep-retrieve <csv>] [--sweep-judge <csv>]
                        [--cache-from <result.json>] [--only <ids>] [--label <text>]
                        [--concurrency <n>] [--timeout <sec>] [--claude-bin <path>]
                        [--dry-run] [--help]

REQUIRED (flag, or the env var in brackets — the flag wins)
  --file <path>            The memory file under measurement.            [EVAL_TARGET]
  --scenarios <path>       Scenario set: a JSON array, or an object      [EVAL_SCENARIOS]
                           {"id": "...", "scenarios": [...]}. Each entry needs
                           id, situation, oracleRule, oracleCheck (+ oracleSource anchor).
  --out <path>             Result JSON. Parent dirs are created. May NOT be inside this
                           module: results quote the measured file verbatim (RULES §10).
  --model <id>             Model for both agents. No default — an unpinned  [EVAL_MODEL]
                           run is not-run for baseline purposes (RULES §2).

EFFORT — pinned, or swept; pinned separately because they confound
  --retrieve-effort <lvl>  Retriever effort.                       [EVAL_RETRIEVE_EFFORT]
  --judge-effort <lvl>     Judge effort.                              [EVAL_JUDGE_EFFORT]
  --sweep-retrieve <csv>   Sweep the retriever over these levels, e.g. low,medium,high,xhigh.
                           Replaces --retrieve-effort.
  --sweep-judge <csv>      Sweep the judge over these levels. Replaces --judge-effort.
                           Both sweeps together = the full cross product.
                           Known levels: ${KNOWN_EFFORTS.join(', ')} (others pass through with a warning).

OPTIONAL
  --cache-from <path>      Reuse retrievals from a prior result file, keyed by
                           (scenario id, retrieve effort). Refused unless that run used the
                           SAME model and the SAME memory-file hash — a retrieval against
                           another file is not evidence about this one.
  --only <id,id>           Run a subset by scenario id (dry-runs). Empty selection = blocked.
  --label <text>           Run label recorded in the result.               [EVAL_LABEL]
  --concurrency <n>        Parallel cells. Default 3.                [EVAL_CONCURRENCY]
  --timeout <sec>          Per-agent wall limit; a timed-out cell is    [EVAL_TIMEOUT_SEC]
                           not-run, never a fail. Default 600.
  --claude-bin <path>      The CLI to spawn. Default "claude".         [EVAL_CLAUDE_BIN]
  --dry-run                Print the plan (cells, agents, conditions) and exit. No spawn,
                           no cost. Use it for the 🟡 launch gate, then WAIT (RULES §9).
  --help, -h               This text.

EXIT CODES
  0  every planned cell produced a verdict. Reds are in the file — a red is a question,
     not an error (RULES §3), so it is NOT an exit code.
  1  the run finished but >= 1 cell is not-run (crash / timeout / session limit / no
     structured output). The result names them; the denominator does not shrink (RULES §6).
  2  usage or config error (unknown flag, missing --file/--scenarios/--out/--model,
     unpinned effort, unreadable or invalid scenario set, cache from a different
     file or model, --out inside this module). Nothing ran.
  3  blocked: the net is empty (no scenarios, or --only matched none). Never green.

EXAMPLES
  # a 2-scenario dry-run, conditions pinned in env
  export EVAL_TARGET=/abs/path/CLAUDE.md EVAL_MODEL=<model-id>
  export EVAL_RETRIEVE_EFFORT=medium EVAL_JUDGE_EFFORT=medium
  node sweep-runner.mjs --scenarios ./my-scenarios.json --only s1,s2 \\
                        --out ./runs/2026-01-01-dry-run/result.json --label dry-run

  # the full net
  node sweep-runner.mjs --scenarios ./my-scenarios.json \\
                        --out ./runs/2026-01-01-baseline/result.json --label baseline

  # sweep the retriever, judge pinned; then sweep the judge reusing those retrievals
  node sweep-runner.mjs --scenarios ./s.json --sweep-retrieve low,medium,high,xhigh \\
       --judge-effort medium --out ./runs/2026-01-01-sweep/retrieve.json --label sweep-retrieve
  node sweep-runner.mjs --scenarios ./s.json --sweep-judge low,high --retrieve-effort medium \\
       --cache-from ./runs/2026-01-01-sweep/retrieve.json \\
       --out ./runs/2026-01-01-sweep/judge.json --label sweep-judge
`

const BOOLEAN_FLAGS = new Set(['dry-run', 'help', 'h'])
const KNOWN_FLAGS = new Set([
  'file', 'scenarios', 'out', 'model', 'retrieve-effort', 'judge-effort',
  'sweep-retrieve', 'sweep-judge', 'cache-from', 'only', 'label',
  'concurrency', 'timeout', 'claude-bin', 'dry-run', 'help', 'h',
])

// An honest parser: it rejects what it does not know instead of silently swallowing a typo.
// The predecessor took the NEXT token as any flag's value, so `--dry-run --file x` read the
// file as "--file". A flag misspelled is a run measuring something other than you think.
function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]
    if (!tok.startsWith('--') && !(tok === '-h')) {
      throw new UsageError(`unexpected argument: ${tok}`)
    }
    const body = tok === '-h' ? 'h' : tok.slice(2)
    const eq = body.indexOf('=')
    const name = eq === -1 ? body : body.slice(0, eq)
    if (!KNOWN_FLAGS.has(name)) throw new UsageError(`unknown flag: --${name}`)
    if (BOOLEAN_FLAGS.has(name)) {
      out[name] = true
      continue
    }
    let value
    if (eq !== -1) value = body.slice(eq + 1)
    else {
      value = argv[++i]
      if (value === undefined || value.startsWith('--')) {
        throw new UsageError(`flag --${name} needs a value`)
      }
    }
    out[name] = value
  }
  return out
}

class UsageError extends Error {}

function csv(value) {
  return String(value).split(',').map((s) => s.trim()).filter(Boolean)
}

function checkEffort(level, what, warnings) {
  if (!KNOWN_EFFORTS.includes(level)) {
    warnings.push(`${what} effort "${level}" is not one of ${KNOWN_EFFORTS.join('/')} — passing it through unchanged`)
  }
  return level
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

// ----------------------------------------------------------------------------- config

function buildConfig(argv, env) {
  const args = parseArgs(argv)
  if (args.help || args.h) return { help: true }

  const warnings = []
  const file = args.file || env.EVAL_TARGET
  const scenariosPath = args.scenarios || env.EVAL_SCENARIOS
  const out = args.out
  const model = args.model || env.EVAL_MODEL

  if (!file) throw new UsageError('no memory file: pass --file <path> or set EVAL_TARGET')
  if (!scenariosPath) throw new UsageError('no scenario set: pass --scenarios <path> or set EVAL_SCENARIOS')
  if (!out) throw new UsageError('no output path: pass --out <path>')
  // §2: the model is part of the instrument. No default, not even a "sensible" one — a
  // default model is an unrecorded condition, and a score whose conditions are unknown is
  // comparable to nothing, including its own baseline.
  if (!model) throw new UsageError('no model: pass --model <id> or set EVAL_MODEL (RULES §2 — an unpinned run is not-run)')

  if (!existsSync(file)) throw new UsageError(`memory file not found: ${file}`)
  if (!existsSync(scenariosPath)) throw new UsageError(`scenario set not found: ${scenariosPath}`)

  // §10: a result embeds the agents' answers, which quote the memory file VERBATIM — every
  // name, id, host and path it carries. Writing one into the module is how a shared kit
  // acquires somebody's private config; the leak on record went through a file that looked
  // like data ABOUT the format. Results live beside the scenario set they measure.
  const outAbs = resolve(out)
  if (outAbs === MODULE_DIR || outAbs.startsWith(MODULE_DIR + sep)) {
    throw new UsageError(
      `--out is inside this module (${MODULE_DIR}).\n` +
      'Results quote the measured file verbatim and never ship (RULES §10) — write them beside\n' +
      'your scenario set, e.g. <scenario-dir>/runs/<YYYY-MM-DD-slug>/result.json'
    )
  }

  const sweepRetrieve = args['sweep-retrieve'] ? csv(args['sweep-retrieve']) : null
  const sweepJudge = args['sweep-judge'] ? csv(args['sweep-judge']) : null
  const retrieveEffort = args['retrieve-effort'] || env.EVAL_RETRIEVE_EFFORT || null
  const judgeEffort = args['judge-effort'] || env.EVAL_JUDGE_EFFORT || null

  if (!sweepRetrieve && !retrieveEffort) {
    throw new UsageError('retriever effort unpinned: pass --retrieve-effort <lvl>, set EVAL_RETRIEVE_EFFORT, or sweep it with --sweep-retrieve')
  }
  if (!sweepJudge && !judgeEffort) {
    throw new UsageError('judge effort unpinned: pass --judge-effort <lvl>, set EVAL_JUDGE_EFFORT, or sweep it with --sweep-judge')
  }
  if (sweepRetrieve && args['retrieve-effort']) {
    throw new UsageError('--sweep-retrieve and --retrieve-effort are exclusive: the sweep pins the retriever per cell')
  }
  if (sweepJudge && args['judge-effort']) {
    throw new UsageError('--sweep-judge and --judge-effort are exclusive: the sweep pins the judge per cell')
  }

  const retrieveLevels = sweepRetrieve || [retrieveEffort]
  const judgeLevels = sweepJudge || [judgeEffort]
  retrieveLevels.forEach((l) => checkEffort(l, 'retrieve', warnings))
  judgeLevels.forEach((l) => checkEffort(l, 'judge', warnings))

  const concurrency = parseInt(args.concurrency || env.EVAL_CONCURRENCY || '3', 10)
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new UsageError(`--concurrency must be a positive integer, got: ${args.concurrency || env.EVAL_CONCURRENCY}`)
  }
  const timeoutSec = parseInt(args.timeout || env.EVAL_TIMEOUT_SEC || '600', 10)
  if (!Number.isInteger(timeoutSec) || timeoutSec < 1) {
    throw new UsageError(`--timeout must be a positive integer (seconds), got: ${args.timeout || env.EVAL_TIMEOUT_SEC}`)
  }

  return {
    help: false,
    file: resolve(file),
    scenariosPath: resolve(scenariosPath),
    out: outAbs,
    model,
    retrieveLevels,
    judgeLevels,
    sweeping: !!(sweepRetrieve || sweepJudge),
    cacheFrom: args['cache-from'] ? resolve(args['cache-from']) : null,
    only: args.only ? csv(args.only) : null,
    label: args.label || env.EVAL_LABEL || 'unlabeled',
    concurrency,
    timeoutSec,
    claudeBin: args['claude-bin'] || env.EVAL_CLAUDE_BIN || 'claude',
    dryRun: !!args['dry-run'],
    warnings,
  }
}

// ----------------------------------------------------------------------------- scenarios

function loadScenarios(path, only, warnings) {
  let raw
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    throw new UsageError(`scenario set is not valid JSON (${path}): ${e.message}`)
  }
  const list = Array.isArray(raw) ? raw : raw.scenarios
  const setId = Array.isArray(raw) ? basename(path).replace(/\.json$/, '') : (raw.id || basename(path).replace(/\.json$/, ''))
  if (!Array.isArray(list)) {
    throw new UsageError(`scenario set must be a JSON array, or an object with a "scenarios" array (${path})`)
  }

  // Fail closed on a malformed entry. An absent oracleCheck would leave the judge grading
  // against `undefined` — it would still print pass/fail, and that verdict would be noise
  // wearing a score's clothes. At grading time the oracle IS the source of truth (§1.1).
  const required = ['id', 'situation', 'oracleRule', 'oracleCheck']
  const problems = []
  const seen = new Set()
  list.forEach((s, i) => {
    for (const k of required) {
      if (typeof s?.[k] !== 'string' || !s[k].trim()) problems.push(`scenario[${i}]: "${k}" missing or empty`)
    }
    if (s?.id) {
      if (seen.has(s.id)) problems.push(`scenario[${i}]: duplicate id "${s.id}" (ids key the cache — they must be unique)`)
      seen.add(s.id)
    }
  })
  if (problems.length) {
    throw new UsageError(`invalid scenario set (${path}):\n  ${problems.join('\n  ')}`)
  }

  // §1.5: every oracle carries an anchor. Warned, not enforced — an unanchored oracle is a
  // weak instrument, but the runner is not the authority on what a private set may anchor to.
  const unanchored = list.filter((s) => !s.oracleSource).map((s) => s.id)
  if (unanchored.length) {
    warnings.push(`no oracleSource anchor (RULES §1.5) on: ${unanchored.join(', ')}`)
  }
  // §1.2: an oracle stating only what satisfies it is unfalsifiable — an answer and its
  // negation both pass. The greppable "WRONG if" clause is the set's own lint.
  const unfalsifiable = list.filter((s) => !/WRONG if/i.test(s.oracleCheck)).map((s) => s.id)
  if (unfalsifiable.length) {
    warnings.push(`oracleCheck has no explicit "WRONG if…" clause (RULES §1.2) on: ${unfalsifiable.join(', ')}`)
  }

  let selected = list
  if (only) {
    const known = new Set(list.map((s) => s.id))
    const missing = only.filter((id) => !known.has(id))
    if (missing.length) throw new UsageError(`--only names unknown scenario id(s): ${missing.join(', ')}`)
    selected = list.filter((s) => only.includes(s.id))
  }
  return { setId, all: list, selected }
}

// ----------------------------------------------------------------------------- cache

// Cross-run reuse is only sound when the retrieval was produced from the SAME file by the
// SAME model. Reusing an answer read out of a previous version of the memory file would score
// this run against text it never saw — a fabricated result, and an invisible one.
function loadCache(cacheFrom, cfg, targetHash) {
  const cache = new Map()
  if (!cacheFrom) return cache
  if (!existsSync(cacheFrom)) throw new UsageError(`--cache-from not found: ${cacheFrom}`)
  let prior
  try {
    prior = JSON.parse(readFileSync(cacheFrom, 'utf8'))
  } catch (e) {
    throw new UsageError(`--cache-from is not valid JSON (${cacheFrom}): ${e.message}`)
  }
  const priorHash = prior?.target?.sha256
  const priorModel = prior?.conditions?.model
  if (!priorHash || !priorModel) {
    throw new UsageError(
      `--cache-from (${cacheFrom}) does not record its target hash and model, so its retrievals\n` +
      'cannot be shown to be about this file. Re-run that axis with this runner, or drop --cache-from.'
    )
  }
  if (priorHash !== targetHash) {
    throw new UsageError(
      `--cache-from measured a DIFFERENT memory file (hash ${priorHash.slice(0, 12)}… vs ${targetHash.slice(0, 12)}…).\n` +
      'Reusing those retrievals would score this run against text it never read. Drop --cache-from.'
    )
  }
  if (priorModel !== cfg.model) {
    throw new UsageError(
      `--cache-from used model "${priorModel}", this run pins "${cfg.model}". Model is part of the\n` +
      'instrument (RULES §2) — mixing them makes the score comparable to nothing. Drop --cache-from.'
    )
  }
  for (const r of prior.results || []) {
    if (r.status === 'graded' && r.governingRule && r.retrieveEffort) {
      cache.set(`${r.id}::${r.retrieveEffort}`, { governingRule: r.governingRule, action: r.action })
    }
  }
  return cache
}

// ----------------------------------------------------------------------------- agents

function runClaude(cfg, { prompt, effort, schema, allowBash }) {
  return new Promise((res) => {
    const claudeArgs = [
      '-p',
      '--model', cfg.model,
      '--effort', effort,
      '--output-format', 'json',
      '--json-schema', JSON.stringify(schema),
    ]
    if (allowBash) claudeArgs.push('--allowedTools', 'Bash')

    // The spawned CLI inherits this process's environment and permissions — worth knowing
    // before a sweep is launched from an unattended runner.
    const child = spawn(cfg.claudeBin, claudeArgs, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (v) => {
      if (settled) return
      settled = true
      clearTimeout(killTimer)
      clearTimeout(hardTimer)
      res(v)
    }

    // No timeout meant one wedged subprocess held a pool slot forever and the run neither
    // finished nor failed — the worst shape for an unattended job. A timeout is not-run (§6).
    const killTimer = setTimeout(() => {
      child.kill('SIGTERM')
      finish({ error: `timeout after ${cfg.timeoutSec}s` })
    }, cfg.timeoutSec * 1000)
    const hardTimer = setTimeout(() => child.kill('SIGKILL'), (cfg.timeoutSec + 10) * 1000)
    hardTimer.unref?.()

    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', (e) => finish({ error: `spawn ${cfg.claudeBin}: ${e.message}` }))
    child.on('close', (code) => {
      if (code !== 0) return finish({ error: `exit ${code}: ${stderr.slice(0, 500)}` })
      try {
        const parsed = JSON.parse(stdout)
        if (parsed.is_error) return finish({ error: parsed.result || 'is_error' })
        const so = parsed.structured_output
        // No structured output = nothing to grade. NOT a fail: a cell that returned nothing
        // is not-run, or an agent that died on the session limit silently becomes a red.
        if (!so) return finish({ error: 'no structured_output', raw: parsed.result })
        return finish({ output: so, cost: parsed.total_cost_usd, durationMs: parsed.duration_ms })
      } catch (e) {
        return finish({ error: `parse: ${e.message}`, raw: stdout.slice(0, 500) })
      }
    })
    child.stdin.on('error', () => {})
    child.stdin.write(prompt)
    child.stdin.end()
  })
}

// ----------------------------------------------------------------------------- run

function planCells(scenarios, cfg) {
  const cells = []
  for (const rE of cfg.retrieveLevels) {
    for (const jE of cfg.judgeLevels) {
      for (const s of scenarios) cells.push({ scenario: s, retrieveEffort: rE, judgeEffort: jE })
    }
  }
  return cells
}

async function main() {
  let cfg
  try {
    cfg = buildConfig(process.argv.slice(2), process.env)
  } catch (e) {
    if (e instanceof UsageError) {
      console.error(`sweep-runner: ${e.message}\n\nRun with --help for the full contract.`)
      process.exit(EXIT_USAGE)
    }
    throw e
  }
  if (cfg.help) {
    console.log(HELP)
    process.exit(EXIT_OK)
  }

  let scenarios, targetHash, cache
  try {
    targetHash = sha256(readFileSync(cfg.file, 'utf8'))
    scenarios = loadScenarios(cfg.scenariosPath, cfg.only, cfg.warnings)
    cache = loadCache(cfg.cacheFrom, cfg, targetHash)
  } catch (e) {
    if (e instanceof UsageError) {
      console.error(`sweep-runner: ${e.message}`)
      process.exit(EXIT_USAGE)
    }
    throw e
  }

  for (const w of cfg.warnings) console.error(`[sweep] WARNING: ${w}`)

  const cells = planCells(scenarios.selected, cfg)
  // §6: a net that shrank to nothing is BLOCKED, not green. No result file is written —
  // an empty result is exactly the artifact a later reader mistakes for a clean run.
  if (cells.length === 0) {
    console.error('[sweep] BLOCKED: the net is empty (no scenarios selected) — nothing measured, no result written.')
    process.exit(EXIT_BLOCKED)
  }

  const conditions = {
    model: cfg.model,
    retrieveEffort: cfg.retrieveLevels.length === 1 ? cfg.retrieveLevels[0] : null,
    judgeEffort: cfg.judgeLevels.length === 1 ? cfg.judgeLevels[0] : null,
    sweepRetrieve: cfg.retrieveLevels.length > 1 ? cfg.retrieveLevels : null,
    sweepJudge: cfg.judgeLevels.length > 1 ? cfg.judgeLevels : null,
    concurrency: cfg.concurrency,
    timeoutSec: cfg.timeoutSec,
    claudeBin: cfg.claudeBin,
  }
  const cachedHits = cells.filter((c) => cache.has(`${c.scenario.id}::${c.retrieveEffort}`)).length
  const uniqueRetrievals = new Set(
    cells.filter((c) => !cache.has(`${c.scenario.id}::${c.retrieveEffort}`))
      .map((c) => `${c.scenario.id}::${c.retrieveEffort}`)
  ).size
  const agents = uniqueRetrievals + cells.length

  console.error(`[sweep] label=${cfg.label} file=${basename(cfg.file)} hash=${targetHash.slice(0, 12)}…`)
  console.error(`[sweep] set=${scenarios.setId} scenarios=${scenarios.selected.length}/${scenarios.all.length} cells=${cells.length}`)
  console.error(`[sweep] model=${cfg.model} retrieve=${cfg.retrieveLevels.join('|')} judge=${cfg.judgeLevels.join('|')} concurrency=${cfg.concurrency}`)
  console.error(`[sweep] agents to spawn: ${agents} (${uniqueRetrievals} retrieve + ${cells.length} judge; ${cachedHits} retrievals reused)`)

  if (cfg.dryRun) {
    // No dollar figure: cost depends on the model's pricing and on your scenarios' size.
    // Quoting someone else's number here would be someone else's plan wearing your label.
    console.error('[sweep] --dry-run: plan only, nothing spawned. Cost = the agent count above at YOUR model\'s rate;')
    console.error('[sweep] launching is a 🟡 gate (RULES §9): show count + conditions + estimate to the owner, then WAIT.')
    process.exit(EXIT_OK)
  }

  mkdirSync(dirname(cfg.out), { recursive: true })

  const results = new Array(cells.length)
  const inFlight = new Map()

  const writeResult = (inProgress) => {
    const flat = results.filter(Boolean)
    const graded = flat.filter((r) => r.status === 'graded')
    const notRun = flat.filter((r) => r.status === 'not-run')
    const passed = graded.filter((r) => r.pass === true).length
    const costs = flat.reduce((a, r) => a + (r.retrieveCost || 0) + (r.judgeCost || 0), 0)
    const payload = {
      schemaVersion: 1,
      tool: 'sweep-runner.mjs',
      label: cfg.label,
      generatedAt: new Date().toISOString(),
      inProgress,
      // §2 — the conditions travel INSIDE the artifact that carries the score. A number whose
      // conditions live only in a chat or a commit message is permanently uninterpretable.
      target: { path: cfg.file, sha256: targetHash },
      scenarioSet: {
        id: scenarios.setId,
        path: cfg.scenariosPath,
        count: scenarios.all.length,
        selected: scenarios.selected.length,
        only: cfg.only,
      },
      conditions,
      cacheFrom: cfg.cacheFrom,
      summary: {
        totalCells: cells.length,
        completed: flat.length,
        graded: graded.length,
        passed,
        failed: graded.length - passed,
        notRun: notRun.length,
        // Denominator = planned cells, never the survivors: a not-run cell that quietly
        // leaves the denominator turns a broken run into a clean-looking score (§6).
        score: `${passed}/${cells.length}`,
        totalCostUsd: costs,
        costIncomplete: flat.some((r) => r.retrieveCached),
      },
      notRun: notRun.map((r) => ({ id: r.id, retrieveEffort: r.retrieveEffort, judgeEffort: r.judgeEffort, reason: r.reason })),
      results: flat,
    }
    writeFileSync(cfg.out, JSON.stringify(payload, null, 2))
    return payload
  }

  // Incremental checkpoint after every cell: a crash or a session limit mid-net leaves the
  // completed cells on disk, flagged inProgress, instead of losing a paid run entirely.
  writeResult(true)

  async function retrieve(scenario, effort) {
    const key = `${scenario.id}::${effort}`
    if (cache.has(key)) return { cached: true, output: cache.get(key) }
    // Two cells sharing a retrieval must not both pay for it — that is what the cache is for.
    // Followers share the leader's outcome, error included: a failure reported as an empty
    // answer would be graded, and a not-run cell must never wear a verdict (§6).
    if (inFlight.has(key)) {
      const shared = await inFlight.get(key)
      return shared.output ? { cached: true, output: shared.output } : shared
    }
    const p = runClaude(cfg, {
      prompt: buildRetrievePrompt(cfg.file, scenario),
      effort,
      schema: RETRIEVE_SCHEMA,
      allowBash: true, // the retriever must read the memory file; the judge never may (§5.1)
    })
    inFlight.set(key, p)
    let r
    try {
      r = await p
    } finally {
      inFlight.delete(key)
    }
    if (r.output) cache.set(key, r.output)
    return r
  }

  let nextIndex = 0

  async function worker() {
    for (;;) {
      const i = nextIndex++
      if (i >= cells.length) return
      const cell = cells[i]
      const t0 = Date.now()
      const label = `${cell.scenario.id} rE=${cell.retrieveEffort} jE=${cell.judgeEffort}`
      console.error(`[sweep] [${i + 1}/${cells.length}] START ${label}`)

      const base = {
        id: cell.scenario.id,
        scenarioSetId: scenarios.setId,
        situation: cell.scenario.situation,
        oracleRule: cell.scenario.oracleRule,
        oracleSource: cell.scenario.oracleSource ?? null,
        model: cfg.model,
        retrieveEffort: cell.retrieveEffort,
        judgeEffort: cell.judgeEffort,
      }

      let ret
      try {
        ret = await retrieve(cell.scenario, cell.retrieveEffort)
      } catch (e) {
        ret = { error: `retrieve threw: ${e.message}` }
      }
      if (ret.error || !ret.output) {
        console.error(`[sweep] [${i + 1}/${cells.length}] NOT-RUN ${label}: ${ret.error}`)
        results[i] = {
          ...base,
          status: 'not-run',
          governingRule: null, action: null, pass: null,
          reason: `retrieve failed: ${ret.error}`,
          retrieveCached: false,
          wallMs: Date.now() - t0,
        }
        writeResult(true)
        continue
      }

      const jud = await runClaude(cfg, {
        prompt: buildJudgePrompt(cell.scenario, ret.output),
        effort: cell.judgeEffort,
        schema: JUDGE_SCHEMA,
        allowBash: false,
      })
      const wallMs = Date.now() - t0

      if (jud.error || typeof jud.output?.pass !== 'boolean') {
        console.error(`[sweep] [${i + 1}/${cells.length}] NOT-RUN ${label}: judge ${jud.error || 'returned no verdict'}`)
        results[i] = {
          ...base,
          status: 'not-run',
          governingRule: ret.output.governingRule,
          action: ret.output.action,
          pass: null,
          reason: `judge failed: ${jud.error || 'no verdict'}`,
          retrieveCached: !!ret.cached,
          retrieveCost: ret.cost,
          wallMs,
        }
        writeResult(true)
        continue
      }

      console.error(`[sweep] [${i + 1}/${cells.length}] DONE  ${label} pass=${jud.output.pass} (${wallMs}ms)`)
      results[i] = {
        ...base,
        status: 'graded',
        governingRule: ret.output.governingRule,
        action: ret.output.action,
        pass: jud.output.pass,
        reason: jud.output.reason,
        retrieveCached: !!ret.cached,
        retrieveCost: ret.cost,
        judgeCost: jud.cost,
        wallMs,
      }
      writeResult(true)
    }
  }

  let interrupted = false
  const onSignal = () => {
    if (interrupted) process.exit(EXIT_NOT_RUN)
    interrupted = true
    console.error('\n[sweep] interrupted — flushing the completed cells; the rest stay not-run.')
    writeResult(true)
    process.exit(EXIT_NOT_RUN)
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)

  await Promise.all(Array.from({ length: Math.min(cfg.concurrency, cells.length) }, worker))

  const final = writeResult(false)
  const { passed, failed, notRun, score, totalCostUsd, costIncomplete } = final.summary
  console.error(`[sweep] ${score} passed · ${failed} failed · ${notRun} not-run · cost ~$${totalCostUsd.toFixed(2)}${costIncomplete ? ' (excludes reused retrievals)' : ''}`)
  console.error(`[sweep] result: ${cfg.out}`)
  if (notRun > 0) {
    // Loud, because the failure mode is a partial net read as a whole one.
    console.error(`[sweep] ${notRun} cell(s) NOT-RUN — this is a partial measurement, not a score against ${final.summary.totalCells}. Re-run them.`)
    process.exit(EXIT_NOT_RUN)
  }
  if (passed < final.summary.graded) {
    // A red is a QUESTION (RULES §3), never an exit-code verdict: adjudicate config vs oracle.
    console.error('[sweep] reds are questions, not verdicts (RULES §3): is the config wrong, or is the oracle? Adjudicate against a source of truth.')
  }
  process.exit(EXIT_OK)
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) await main()
