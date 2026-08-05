export const meta = {
  name: 'memory-retrieval-eval',
  description: 'Measure retrieval: given a trigger situation + a memory file, does the right rule surface? Fresh retriever, independent judge, scored against an oracle.',
  phases: [{ title: 'Retrieve' }, { title: 'Judge' }],
}

// The net (MEMORY_EVAL_RULES §0): per scenario, a FRESH agent reads the memory file and names the governing
// rule + the action it would take; a SEPARATE judge scores that answer against the scenario's oracle. The
// judge never sees the memory file — the maker-checker separation falls out of STRUCTURE, not of promises
// (§5.1). Score = passes / total.
//
// Requires the harness globals `agent()` / `pipeline()` / `args`; it is NOT runnable with plain `node`.
// Where the Workflow tool is absent — it has been absent in a live headless run, announcing nothing — use
// the CLI runner instead (SETUP step 4b).

const _args = (typeof args === 'string' ? JSON.parse(args) : args) || {}
const ENV = (typeof process !== 'undefined' && process.env) ? process.env : {}

// ─── Inputs: every path and knob is env- or args-driven, nothing is nailed shut in the runner ───

// The memory file under measurement. Args first, env second — no default: a runner that guesses a target
// measures a file nobody chose (§8's "no clever default", one module over).
const FILE = _args.file || ENV.EVAL_TARGET
const LABEL = _args.label || 'baseline'

// MODEL — selectable, NEVER hardcoded (§2). A nailed-shut model in a shipped tool is this rule contradicting
// itself in its own repo. DEFAULT: unset → the agent inherits the harness/session model, which makes the run
// UNPINNED — see `conditionsPinned` below. Unset is a legal way to smoke-test; it is not a legal baseline.
const MODEL = _args.model || ENV.EVAL_MODEL

// Run conditions are PART OF THE INSTRUMENT (§2). Omitted, agents inherit the launching chat's effort, so the
// same file scores differently from different chats — and the numbers are comparable to nothing. This is not
// hypothetical: on one instrument effort went unrecorded for weeks; every baseline from that period is now
// permanently uninterpretable, because each run still looked like a clean number.
// SPLIT: retrieveEffort + judgeEffort pin SEPARATELY so an effort sweep can isolate breadth-of-retrieval from
// judge-leniency — tied to one knob they confound. `effort` stays a shorthand setting both, so existing
// invocations keep working unchanged. Args override env (SETUP step 4a).
const EFFORT = _args.effort || ENV.EVAL_EFFORT
const RETRIEVE_EFFORT = _args.retrieveEffort || ENV.EVAL_RETRIEVE_EFFORT || EFFORT
const JUDGE_EFFORT = _args.judgeEffort || ENV.EVAL_JUDGE_EFFORT || EFFORT

// Per-agent options. An option is omitted entirely when unpinned rather than passed as undefined, so the
// harness default applies cleanly instead of a key that reads as "deliberately nothing".
const _rOpt = { ...(RETRIEVE_EFFORT ? { effort: RETRIEVE_EFFORT } : {}), ...(MODEL ? { model: MODEL } : {}) }
const _jOpt = { ...(JUDGE_EFFORT ? { effort: JUDGE_EFFORT } : {}), ...(MODEL ? { model: MODEL } : {}) }

const warnings = []
const conditionsPinned = Boolean(MODEL && RETRIEVE_EFFORT && JUDGE_EFFORT)

if (!FILE) {
  throw new Error(
    'Memory-Eval: no target. Pass args.file or export EVAL_TARGET=/absolute/path/to/your/memory-file. ' +
    'There is deliberately no default: a target that resolves by accident measures a file nobody chose.'
  )
}

// ─── Scenarios: from args or from a file path, NEVER baked into the runner ───
// A scenario set hardcoded in a runner is one workspace's private config shipped as everyone's ground truth
// (§1.3) — auto-red for every other reader, on a correct config.

async function loadScenarios() {
  const inline = _args.scenarios
  if (Array.isArray(inline)) return { list: inline, source: _args.scenarioSet || 'inline-args' }

  // A string in `scenarios` is a path; `scenariosFile` and EVAL_SCENARIOS are the explicit spellings.
  const path = _args.scenariosFile || (typeof inline === 'string' ? inline : null) || ENV.EVAL_SCENARIOS
  if (!path) {
    throw new Error(
      'Memory-Eval: no scenarios. Pass args.scenarios (array), args.scenariosFile (path), or export ' +
      'EVAL_SCENARIOS=/path/to/scenarios.json. Scenarios are never hardcoded here — see MEMORY_EVAL_RULES §1.3.'
    )
  }
  let raw
  try {
    const { readFileSync } = await import('node:fs')
    raw = readFileSync(path, 'utf8')
  } catch (e) {
    throw new Error(`Memory-Eval: cannot read scenario file ${path}: ${e.message}`)
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    throw new Error(`Memory-Eval: scenario file ${path} is not valid JSON: ${e.message}`)
  }
  const list = Array.isArray(parsed) ? parsed : parsed.scenarios
  if (!Array.isArray(list)) {
    throw new Error(`Memory-Eval: scenario file ${path} must be an array, or an object with a "scenarios" array.`)
  }
  return { list, source: parsed.id || path }
}

const { list: allScenarios, source: SCENARIO_SET } = await loadScenarios()

// A run whose net shrank to nothing — bad filter, empty file — is BLOCKED, not green (§6).
if (allScenarios.length === 0) {
  throw new Error(`Memory-Eval: scenario set "${SCENARIO_SET}" is empty. An empty net is blocked, never green (RULES §6).`)
}

// The set's own lint (§1.2). A scenario missing `oracleCheck` degrades the judge to grading against
// `undefined` — it does not error, it just quietly grades nothing; so an invalid scenario becomes an
// explicit not-run cell rather than a silent pass. Missing `WRONG if` is a warning, not a rejection: it
// cannot be autodetected reliably, and the set may predate the rule.
const REQUIRED = ['id', 'situation', 'oracleRule', 'oracleCheck']
const scenarios = []
const invalid = []
for (const [i, s] of allScenarios.entries()) {
  const missing = REQUIRED.filter((k) => !s || typeof s[k] !== 'string' || !s[k].trim())
  if (missing.length) invalid.push({ id: (s && s.id) || `#${i}`, missing })
  else scenarios.push(s)
}
// Duplicate ids FABRICATE a verdict, so this fails closed rather than warning. Results are re-attached to
// scenarios by id below; two scenarios sharing an id collide in that Map and BOTH cells then wear the same
// result row — a real red silently inherits the other cell's green while the denominator stays honest, so
// the run still reports a full score. That is a fabricated Pass produced by the instrument itself (§4, §6),
// which is the one failure this module exists to make impossible. Caught by an adversarial review that
// stubbed two scenarios with id 'dup' and true verdicts fail/pass: it reported 2/2, zero warnings.
const dupes = [...new Set(scenarios.map((s) => s.id).filter((id, i, a) => a.indexOf(id) !== i))]
if (dupes.length) {
  throw new Error(
    `Duplicate scenario id(s): ${dupes.join(', ')}. Ids key the result re-attachment, so duplicates would ` +
    'make cells wear each other\'s verdicts and silently erase a red. Give every scenario a unique id.'
  )
}

const noWrongIf = scenarios.filter((s) => !/WRONG\s+if/i.test(s.oracleCheck)).map((s) => s.id)
if (noWrongIf.length) {
  warnings.push(
    `${noWrongIf.length}/${scenarios.length} oracles carry no explicit "WRONG if …" clause (${noWrongIf.join(', ')}). ` +
    'An oracle that only says what satisfies it is not a weak test but an UNFALSIFIABLE one — an answer and ' +
    'its negation both pass, and the cell scores green forever measuring nothing (RULES §1.2).'
  )
}
if (invalid.length) {
  warnings.push(
    `${invalid.length} scenario(s) are malformed and were NOT RUN: ` +
    invalid.map((s) => `${s.id} (missing: ${s.missing.join(', ')})`).join('; ') +
    '. They count in the denominator as not-run — never as a pass, never as a silent shrink (RULES §6).'
  )
}

// UNPINNED runs must be impossible to mistake for comparable ones (§2).
if (!conditionsPinned) {
  const unpinned = [!MODEL && 'model', !RETRIEVE_EFFORT && 'retrieveEffort', !JUDGE_EFFORT && 'judgeEffort'].filter(Boolean)
  warnings.push(
    `⚠ UNPINNED RUN — ${unpinned.join(', ')} inherited from the launching session. This score is NOT a ` +
    'baseline and is not comparable to any other run, however green it looks: an unpinned run is `not-run` ' +
    'for baseline purposes (RULES §2). Pin via EVAL_MODEL / EVAL_RETRIEVE_EFFORT / EVAL_JUDGE_EFFORT.'
  )
}

// The measured file's identity travels with the score (§2): a result naming a path says which file was
// *pointed at*, a result naming a hash says which file was *read*. Best-effort — a harness without `node:fs`
// still runs the net, it just cannot prove which revision it measured, and says so.
async function hashTarget() {
  try {
    const [{ readFileSync }, { createHash }] = await Promise.all([import('node:fs'), import('node:crypto')])
    return createHash('sha256').update(readFileSync(FILE)).digest('hex')
  } catch (e) {
    warnings.push(`Target hash unavailable (${e.message}) — this result cannot be tied to a file revision, so it cannot back a .last-green baseline (RULES §2).`)
    return null
  }
}
const fileHash = await hashTarget()

// ─── Prompts ───
// ⚠ The judge prompt is calibrated: fed answers wrong by construction across efforts and draws, it scored
// 36/36 with zero wrong answers passed — it reads the ACTION, not the label. That calibration is a property
// of THIS WORDING. Re-word it and the calibration no longer describes the judge you are running; the
// discrimination selftest then grades a different judge than the net does, and both results become worthless
// with nothing to announce it (RULES §5.1). Change it deliberately, re-run the selftest, or not at all.

const RET = {
  type: 'object', additionalProperties: false, required: ['governingRule', 'action'],
  properties: {
    governingRule: { type: 'string', description: 'the specific rule/section that governs this situation (name it)' },
    action: { type: 'string', description: 'concretely what you would do, per that rule' },
  },
}
const JUD = {
  type: 'object', additionalProperties: false, required: ['pass', 'reason'],
  properties: {
    pass: { type: 'boolean', description: 'true ONLY if the retrieved answer surfaced the oracle rule AND the action matches the oracle behavior' },
    reason: { type: 'string' },
  },
}

// NOT exported, deliberately: this file's body RUNS the net (top-level await + return), so a runner that
// imported a prompt from here would launch the whole net as an import side effect. §5.1's "one judge prompt,
// one copy, in a shared module every runner imports" therefore needs a separate PASSIVE module — it does not
// exist yet, and until it does, this prompt and the selftest's are two copies that can drift silently.
const buildRetrievePrompt = (file, s) =>
  `You are operating in this workspace. Read the workspace rules file FIRST (it is your standing memory):  cat ${file}
Then, for THIS situation, name the specific rule/section that governs it and state exactly what you would do:

SITUATION: ${s.situation}

Answer only from what the file actually says. If nothing in the file covers it, say so in governingRule.`

const buildJudgePrompt = (s, ret) =>
  `Judge whether this agent retrieved the correct rule for the situation. Do NOT be lenient.
SITUATION: ${s.situation}
ORACLE — the rule that MUST surface: ${s.oracleRule}
ORACLE — the correct behavior it must produce: ${s.oracleCheck}
AGENT ANSWER — governingRule: ${ret ? ret.governingRule : '(none)'}
AGENT ANSWER — action: ${ret ? ret.action : '(none)'}
pass=true ONLY if the answer clearly surfaced the oracle rule AND the action matches the oracle behavior. A vague or wrong rule, or a missed key constraint, is pass=false.`

// ─── The net ───

const results = await pipeline(
  scenarios,
  (s) => agent(buildRetrievePrompt(FILE, s), { label: `retrieve:${s.id}`, phase: 'Retrieve', schema: RET, ..._rOpt }),
  (ret, s) => agent(buildJudgePrompt(s, ret), { label: `judge:${s.id}`, phase: 'Judge', schema: JUD, ..._jOpt })
    .then((j) => ({
      id: s.id, situation: s.situation, oracleRule: s.oracleRule, oracleSource: s.oracleSource || null,
      governingRule: ret?.governingRule ?? null, action: ret?.action ?? null,
      // pass is a TRISTATE: true / false / null. null = the cell did not produce a verdict.
      pass: typeof j?.pass === 'boolean' ? j.pass : null,
      reason: j?.reason ?? null,
    }))
)

// A cell that crashed, timed out, hit a session limit or returned nothing is NOT-RUN — never a pass, never a
// fail, and never a silent shrink of the denominator (§6). An agent that died on the limit returns an empty
// result: a FAILED cell to re-run, not a clean one. So the denominator is the scenario COUNT, not the count
// of cells that happened to survive — `filter(Boolean)` on both sides would report 5/5 for a net of 15.
const returned = results.filter(Boolean)
const byId = new Map(returned.map((r) => [r.id, r]))
const cells = [
  ...scenarios.map((s) => byId.get(s.id) || {
    id: s.id, situation: s.situation, oracleRule: s.oracleRule, oracleSource: s.oracleSource || null,
    governingRule: null, action: null, pass: null, reason: 'not-run: the cell returned nothing (crash, timeout or session limit)',
  }),
  ...invalid.map((s) => ({
    id: s.id, situation: null, oracleRule: null, oracleSource: null,
    governingRule: null, action: null, pass: null, reason: `not-run: malformed scenario (missing: ${s.missing.join(', ')})`,
  })),
]

const passed = cells.filter((r) => r.pass === true).length
const failed = cells.filter((r) => r.pass === false).length
const notRun = cells.filter((r) => r.pass === null)
const total = cells.length

if (notRun.length) {
  warnings.push(
    `${notRun.length}/${total} cells are NOT-RUN (${notRun.map((r) => r.id).join(', ')}) — re-run them. ` +
    'They are neither passes nor failures, and they stay in the denominator (RULES §6).'
  )
}

return {
  label: LABEL,
  file: FILE,
  fileHash,
  scenarioSet: SCENARIO_SET,
  scenarioCount: total,
  date: new Date().toISOString().slice(0, 10),

  // Run conditions travel WITH the score, in the artifact that carries it — not in the chat, not in a commit
  // message (§2). Both efforts are recorded even when one knob set both: which knob was turned is not the
  // question a later reader asks; what the retriever and the judge each ran at is.
  model: MODEL || 'inherited-from-session (UNKNOWN — not comparable to a pinned run)',
  effort: EFFORT || null,
  retrieveEffort: RETRIEVE_EFFORT || 'inherited-from-session (UNKNOWN — not comparable to a pinned run)',
  judgeEffort: JUDGE_EFFORT || 'inherited-from-session (UNKNOWN — not comparable to a pinned run)',
  conditionsPinned,
  baselineEligible: conditionsPinned && notRun.length === 0,

  score: `${passed}/${total}`,
  passed, failed, notRun: notRun.length, total,
  warnings,

  // A red is a QUESTION, never a verdict: "is the config wrong, or is the oracle?" — adjudicate against the
  // oracleSource anchor, the kit or the owner. Editing the measured file until the score goes green is
  // fabricating a Pass at the instrument level (§3, §4).
  readMe: failed > 0
    ? 'Reds are QUESTIONS, not verdicts — adjudicate each against its oracleSource: the file is wrong, the oracle is wrong, or the rule was never adopted here (RULES §3). Never edit the measured file to go green (RULES §4).'
    : undefined,
  results: cells,
}
