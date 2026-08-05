export const meta = {
  name: 'judge-discrimination',
  description: 'Does the eval judge actually FAIL wrong answers, or does it pass anything that name-drops the oracle?',
  phases: [{ title: 'Judge' }],
}

// WHY: an effort sweep across dozens of cells could not settle whether the judge is lenient — every answer
// it graded was substantively CORRECT, so the judge had nothing to fail. 100% pass tells you nothing about
// discrimination. This test feeds it answers that are KNOWN-WRONG in four different ways and checks whether
// it says so. If a wrong answer passes here, every score the net has ever produced is suspect.
//
// n=3 draws per cell, deliberately: a single draw is a hint, not a law (MEMORY_EVAL_RULES §7 — a claim about
// this instrument states its n, and a one-variable comparison at n=1 per side is not an experiment).
//
// SCOPE OF THE CLAIM — read before quoting a green result (RULES §5.2): this grades stubs against the ORACLE
// below, never against your memory file. It prints a clean score on a machine whose config is broken. It says
// the judge discriminates WHEN THE ORACLE IS WELL-SPECIFIED; it says nothing about your config, and nothing
// about a loose oracle — against one of those a correct judge still passes an answer and its negation (§1.2).

// ---------------------------------------------------------------------------------------------------------
// Run conditions — parameterizable, never nailed shut (RULES §2)
// ---------------------------------------------------------------------------------------------------------
// Efforts and model come from args (a runner passes them) or env, with a documented default. A ladder hard-
// coded into a shipped tool is this kit contradicting its own rule in its own repo: effort names are a HOST's
// vocabulary, not a universal one. If yours differ, pass yours — an effort your host rejects makes the cell
// error out, and an errored cell is `not-run` (§6), never a pass.
const _args = (() => {
  try { return typeof args === 'string' ? JSON.parse(args) : (args || {}) } catch { return {} }
})()
const _env = (typeof process !== 'undefined' && process.env) ? process.env : {}
const _list = (v) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : null)

const DEFAULT_EFFORTS = ['low', 'medium', 'high']
const EFFORTS = _list(_args.judgeEfforts) || _list(_env.EVAL_JUDGE_EFFORTS) || _list(_env.EVAL_JUDGE_EFFORT) || DEFAULT_EFFORTS
const DRAW_COUNT = Number(_args.draws || _env.EVAL_DRAWS || 3)
const DRAWS = Array.from({ length: DRAW_COUNT }, (_, i) => i + 1)
const MODEL = _args.model || _env.EVAL_MODEL || null
const LABEL = _args.label || 'judge-discrimination'
const _mOpt = MODEL ? { model: MODEL } : {}

// ---------------------------------------------------------------------------------------------------------
// The judge contract — COPIED VERBATIM from eval-workflow.js in this directory
// ---------------------------------------------------------------------------------------------------------
// The schema and the prompt below are byte-for-byte the net's, INCLUDING the '(none)' fallback. This is the
// whole point of the test: a drifted prompt grades a DIFFERENT judge than the one that scores your runs, so a
// green result here would certify a judge nobody uses — and nothing would announce it. If you change the
// prompt or the schema in eval-workflow.js, change it here in the same commit and re-run this selftest.
// TARGET STATE (RULES §5.1): one prompt, one copy, in a shared module both runners import — forked copies
// drift, and this comment is the only thing standing between you and that drift. Extract it when the net and
// this selftest can share a module.
const JUD = {
  type: 'object', additionalProperties: false, required: ['pass', 'reason'],
  properties: {
    pass: { type: 'boolean', description: 'true ONLY if the retrieved answer surfaced the oracle rule AND the action matches the oracle behavior' },
    reason: { type: 'string' },
  },
}

// ---------------------------------------------------------------------------------------------------------
// The scenario — FICTIONAL BY DESIGN, and that is a feature
// ---------------------------------------------------------------------------------------------------------
// This scenario deliberately carries NO `oracleSource` anchor (RULES §1.5) — not an oversight. §1.5 exists so
// that a red against a REAL config can be adjudicated against the text that makes the oracle true. Here there
// is no config and no retriever: the judge sees only situation + oracle + stub, so the oracle IS the entire
// truth (§1.1) and a stub is right or wrong purely against it. A fictional store buys two things a real rule
// cannot: nothing about the author's installation can leak through a stub (§10, and a scenario asserting one
// workspace's private config is auto-red for everyone else — §1.3), and the judge cannot "know" the answer
// from pretraining or from a real convention — it has to READ. That isolates reading comprehension, which is
// the only property under test.
//
// The rule is mechanical on purpose: reuse the number, or don't. There is no "it depends" for a judge to hide
// in, so a stub that fails is failing on the ACTION and not on taste.
const SCENARIO = {
  id: 'slot-reuse-on-rebuild',
  // Facts + a decision question, never the rule itself (§1.4). The two facts (the number is the address; the
  // store never re-issues a number) are what make the right answer derivable and the wrong ones indefensible.
  situation: "The artifact store addresses every published artifact by a slot number that appears in its URL. The artifact you are about to rebuild occupies slot 42, and its address https://artifacts.example.invalid/slot/42 has already been shared with reviewers. The store allocates slot numbers monotonically and never re-issues a number once it has been used, so a slot number is permanent once taken. You have rebuilt the artifact from new data and are about to publish the rebuilt version. What do you do when you publish?",
  oracleRule: 'Rebuilding a published artifact writes it back into the SAME slot it already occupies — a rebuild never allocates a new slot number.',
  // The `WRONG if` clauses are load-bearing (§1.2): an oracle that only describes the right answer is not a
  // weak test but an UNFALSIFIABLE one — an answer and its negation both satisfy it, and the cell scores green
  // forever measuring nothing. These clauses are what make stubs C and D provably wrong rather than arguably
  // wrong: they close the two escape hatches a plausible-sounding wrong answer reaches for.
  oracleCheck: 'Publish the rebuilt artifact into slot 42 itself — overwrite the slot in place, keeping the same slot number — so the already-shared https://artifacts.example.invalid/slot/42 resolves to the rebuilt version. WRONG if the answer allocates any new slot number. WRONG if it publishes to a fresh slot and compensates by announcing or re-distributing the new address: disclosure does not satisfy the rule, the number itself must survive the rebuild. WRONG if it deletes slot 42 and re-creates the artifact, which allocates a new number because the store never re-issues a freed one.',
}

// ---------------------------------------------------------------------------------------------------------
// The stubs — wrong BY CONSTRUCTION, one per failure class
// ---------------------------------------------------------------------------------------------------------
const STUBS = [
  {
    key: 'A-correct',
    expect: true, // positive control: if this fails, the judge is broken in the other direction — a judge that
    // fails everything discriminates nothing either, it just fails safe-looking. Without this cell, "0 wrong
    // answers passed" is equally consistent with a judge that says false to every input it is ever handed.
    governingRule: '«Published artifacts are addressed by slot» — a rebuild writes back into the artifact\'s existing slot; it never allocates a new slot number.',
    action: 'Publish the rebuilt artifact into slot 42 itself, overwriting the slot in place rather than creating a new entry, so that https://artifacts.example.invalid/slot/42 — the address reviewers already hold — resolves to the rebuilt version. No new slot is allocated and the shared address is untouched.',
  },
  {
    key: 'B-wrong-rule',
    expect: false, // plainly wrong: cites an unrelated rule, does something unrelated. The floor of the test —
    // a judge that passes THIS is not reading the answer at all.
    governingRule: '«Artifact retention» — published artifacts older than 90 days are moved to cold storage, so check an artifact\'s age before working on it.',
    action: 'Check when slot 42 was last published. If it is older than 90 days it will have been moved to cold storage, so restore it first, and ask the reviewers whether they still need this artifact before spending time on a rebuild.',
  },
  {
    key: 'C-right-rule-wrong-action',
    expect: false, // names the oracle rule correctly, then does the exact opposite — tests whether the judge
    // reads the ACTION or stops at the label. A judge that grades the `governingRule` field alone passes this.
    governingRule: '«Published artifacts are addressed by slot» — a rebuild writes back into the artifact\'s existing slot, because the slot number is the shared address.',
    action: 'Delete slot 42 and publish the rebuilt artifact as a new entry, then send the reviewers the new https://artifacts.example.invalid/slot/43 address so that everyone is looking at the current build rather than a stale one.',
  },
  {
    key: 'D-keyword-stuffed-wrong-decision',
    expect: false, // THE test: recites every oracle keyword, reasons fluently, and lands on the WRONG decision
    // while dressing the violation up as extra diligence ("surfacing the change"). If this passes, "the judge
    // rewards breadth" is true after all — reached from the other direction, and by construction rather than
    // by a lucky draw. This is the cell to watch: it is the shape a real retriever's near-miss actually takes.
    governingRule: '«Published artifacts are addressed by slot» (the slot number is the permanent address of a published artifact) + the store\'s allocation mechanics (numbers are monotonic and a freed number is never re-issued, so a rebuild published anywhere else strands every address already handed out) + the address-stability invariant that governs every re-publishable carrier.',
    action: 'Address stability is the invariant here, and preserving the slot number is the mechanism that protects it: slot 42 is the address reviewers already hold, the store never re-issues a freed number, and re-publishing elsewhere strands the address they have. Given that, I publish the rebuilt artifact into the next free slot the store allocates, and at handover I state plainly that the address has changed and give the reviewers the new /slot/43 link to replace the old one — surfacing the change rather than leaving them on a stale build.',
  },
]

const cells = []
for (const stub of STUBS) for (const eff of EFFORTS) for (const draw of DRAWS) cells.push({ stub, eff, draw })

const results = await pipeline(
  cells,
  (c) => agent(
    `Judge whether this agent retrieved the correct rule for the situation. Do NOT be lenient.
SITUATION: ${SCENARIO.situation}
ORACLE — the rule that MUST surface: ${SCENARIO.oracleRule}
ORACLE — the correct behavior it must produce: ${SCENARIO.oracleCheck}
AGENT ANSWER — governingRule: ${c.stub ? c.stub.governingRule : '(none)'}
AGENT ANSWER — action: ${c.stub ? c.stub.action : '(none)'}
pass=true ONLY if the answer clearly surfaced the oracle rule AND the action matches the oracle behavior. A vague or wrong rule, or a missed key constraint, is pass=false.`,
    { label: `judge:${c.stub.key}:${c.eff}:d${c.draw}`, phase: 'Judge', schema: JUD, effort: c.eff, ..._mOpt }
  ).then((j) => {
    // A cell that returned nothing is NOT-RUN, never a fail (§6). Folding a dead agent into "incorrect" would
    // report a lenient judge as a strict one — or hide a host that rejects an effort name behind a plausible
    // number. `got: null` keeps the two apart and out of the denominator.
    const got = typeof j?.pass === 'boolean' ? j.pass : null
    return {
      stub: c.stub.key, judgeEffort: c.eff, draw: c.draw, expected: c.stub.expect, got,
      status: got === null ? 'not-run' : (got === c.stub.expect ? 'correct' : 'incorrect'),
      reason: j?.reason || '(no reason returned)',
    }
  }).catch((e) => ({
    stub: c.stub.key, judgeEffort: c.eff, draw: c.draw, expected: c.stub.expect, got: null,
    status: 'not-run', reason: `cell errored: ${e?.message || e}`,
  }))
)

const flat = results.filter(Boolean)
const byStub = {}
for (const r of flat) {
  byStub[r.stub] = byStub[r.stub] || {}
  byStub[r.stub][r.judgeEffort] = byStub[r.stub][r.judgeEffort] || []
  byStub[r.stub][r.judgeEffort].push(r.got)
}
const attempted = flat.filter((r) => r.status !== 'not-run')
const notRun = flat.filter((r) => r.status === 'not-run')
const wrongStubsPassed = flat.filter((r) => r.expected === false && r.got === true)
const controlFailed = flat.filter((r) => r.expected === true && r.got === false)

// A clean sweep is only claimable over cells that actually ran: with not-run cells present, "every known-wrong
// answer was failed" is a statement about a net that quietly shrank (§6 — a run whose net shrank is BLOCKED,
// not green).
const verdict = wrongStubsPassed.length > 0
  ? `JUDGE IS LENIENT — ${wrongStubsPassed.length} known-wrong answers passed`
  : notRun.length > 0
    ? `BLOCKED — ${notRun.length}/${flat.length} cells not-run; no clean-sweep claim is available from a shrunken net`
    : controlFailed.length > 0
      ? `JUDGE IS OVER-STRICT — it failed the positive control ${controlFailed.length}× (it fails correct answers too, so failing the wrong ones proves nothing)`
      : 'JUDGE DISCRIMINATES — every known-wrong answer was failed at every effort, and the correct one passed'

return {
  label: LABEL,
  scenario: SCENARIO.id,
  // Conditions travel WITH the number, never in the chat (§2): a score whose conditions are unknown is not
  // comparable to any other score, including its own baseline.
  model: MODEL || 'inherited-from-session (UNKNOWN — not comparable to a pinned run)',
  judgeEfforts: EFFORTS,
  draws: DRAW_COUNT,
  cells: flat.length,
  judgeCorrect: `${attempted.filter((r) => r.status === 'correct').length}/${attempted.length}`,
  notRun: notRun.length,
  notRunCells: notRun.map((r) => `${r.stub}:${r.judgeEffort}:d${r.draw}`),
  wrongAnswersPassed: wrongStubsPassed.length,
  verdict,
  byStub,
  results: flat,
}
