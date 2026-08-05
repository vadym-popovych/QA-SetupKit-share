// Zero-dependency JSON-Schema SUBSET validator for the QA-SetupKit schemas.
// Supports: type, required, properties, items, enum, pattern, minItems, minLength,
// minimum, maximum, additionalProperties (false OR a value schema). Annotations
// ignored: $schema, $id, $comment, title, description. For full draft-2020-12
// (allOf/oneOf/$ref/formats) use ajv — the schemas here deliberately stay in this subset.
//
//   node validate.mjs <schema.json> <instance.json>
//
// Exit 0 = valid; 1 = violations (printed one per line); 2 = usage/IO/schema error.
//
// TWO PROTECTIONS ADDED 13/07/2026 (a self-test found the kit's own contract wasn't
// protecting field NAMES — a bug with `invariantViolatd` typo + a garbage field passed
// as VALID):
//   1. `additionalProperties: false` is ENFORCED — an unknown property is a violation.
//      Field names are load-bearing exactly like the ID patterns, and now they're checked.
//   2. A validator that SILENTLY IGNORES a schema keyword it doesn't implement gives a
//      false sense of protection (someone writes `additionalProperties: false` expecting
//      enforcement that never happens). So an unimplemented keyword in a schema is now a
//      hard error (exit 2), not a silent no-op. This is the never-fake-a-Pass rule applied
//      to the checker itself.
import fs from 'fs';

// Every keyword the validator actually enforces or deliberately ignores. Anything else in a
// schema position must NOT be silently accepted.
const KNOWN_KEYWORDS = new Set([
  'type', 'required', 'properties', 'items', 'enum', 'pattern',
  'minItems', 'minLength', 'minimum', 'maximum', 'additionalProperties',
  '$schema', '$id', '$comment', 'title', 'description',
]);
// Walk the schema tree; any keyword outside KNOWN_KEYWORDS is a schema-authoring error.
function assertKnownKeywords(sch, where, bad) {
  if (!sch || typeof sch !== 'object' || Array.isArray(sch)) return;
  for (const k of Object.keys(sch)) {
    if (!KNOWN_KEYWORDS.has(k)) bad.push(`${where}.${k}`);
    if (k === 'properties') for (const [p, ps] of Object.entries(sch.properties)) assertKnownKeywords(ps, `${where}.properties.${p}`, bad);
    else if (k === 'items') assertKnownKeywords(sch.items, `${where}.items`, bad);
    else if (k === 'additionalProperties' && typeof sch.additionalProperties === 'object') assertKnownKeywords(sch.additionalProperties, `${where}.additionalProperties`, bad);
  }
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v === 'number' && Number.isInteger(v) ? 'integer' : typeof v;
}
function typeMatches(v, t) {
  const actual = typeOf(v);
  return t === actual || (t === 'number' && actual === 'integer');
}

function validate(schema, value, path, errs) {
  if (schema === true || schema == null) return;
  if (schema.enum !== undefined) {
    if (!schema.enum.some(e => JSON.stringify(e) === JSON.stringify(value)))
      errs.push(`${path}: value ${JSON.stringify(value)} not in enum [${schema.enum.map(e => JSON.stringify(e)).join(', ')}]`);
    return; // enum fully constrains the value
  }
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some(t => typeMatches(value, t))) {
      errs.push(`${path}: expected ${types.join('|')}, got ${typeOf(value)}`);
      return; // don't cascade type-mismatched checks
    }
  }
  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(value))
      errs.push(`${path}: "${value}" does not match /${schema.pattern}/`);
    if (schema.minLength !== undefined && value.length < schema.minLength)
      errs.push(`${path}: length ${value.length} < minLength ${schema.minLength}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum)
      errs.push(`${path}: ${value} < minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum)
      errs.push(`${path}: ${value} > maximum ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      errs.push(`${path}: ${value.length} items < minItems ${schema.minItems}`);
    if (schema.items) value.forEach((v, i) => validate(schema.items, v, `${path}[${i}]`, errs));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const req of schema.required || [])
      if (!(req in value)) errs.push(`${path}: missing required property "${req}"`);
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties && k in schema.properties)
        validate(schema.properties[k], v, `${path}.${k}`, errs);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object')
        validate(schema.additionalProperties, v, `${path}.${k}`, errs);
      else if (schema.additionalProperties === false && k !== '$comment')
        // Field names are load-bearing: an unknown property is a violation, not a shrug.
        // `$comment` is the ONE exception — the reserved JSON-Schema annotation key, used to
        // self-document example instances ("what this example demonstrates"). It is never data,
        // so it is allowed everywhere; a garbage field or a typo'd real field still fails.
        errs.push(`${path}: unknown property "${k}" (additionalProperties: false)`);
    }
  }
}

// ── importable API ────────────────────────────────────────────────────────────────────────
// The kit's rule is "validate in the SAME turn as the write". A CLI can only be obeyed by a
// human or an agent remembering to run it; a tool that writes an artefact should be able to
// check it *before* writing, with no chance to forget. So the checker is exported too
// (28/07/2026). The CLI below still behaves exactly as before — it is guarded so that
// importing this file runs no argv parsing and exits nothing.
export function schemaFor(nameOrPath) {
  let p = nameOrPath;
  if (!fs.existsSync(p) && /^[\w-]+$/.test(p)) {
    const here = new URL('.', import.meta.url).pathname;
    const candidate = `${here}${p}.schema.json`;
    if (fs.existsSync(candidate)) p = candidate;
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** Validate `value` against a schema (name or path). Returns [] when valid, else error strings. */
export function validateValue(nameOrPath, value, path = '$') {
  const errs = [];
  validate(schemaFor(nameOrPath), value, path, errs);
  return errs;
}

const RUN_AS_CLI = process.argv[1] && new URL(`file://${fs.realpathSync(process.argv[1])}`).href === import.meta.url;
if (!RUN_AS_CLI) { /* imported as a module — the CLI below is skipped */ } else {

let [schemaPath, instancePath] = process.argv.slice(2);
if (!schemaPath || !instancePath) {
  console.error('usage: node validate.mjs <schema.json | shorthand: bug|bug-spec|bug-summary|test-case|test-report|run-result|checklist-row|coverage|strategy|pagespeed-round|link-ledger> <instance.json>');
  process.exit(2);
}
// shorthand: "coverage" -> "<this script's dir>/coverage.schema.json"
if (!fs.existsSync(schemaPath) && /^[\w-]+$/.test(schemaPath)) {
  const here = new URL('.', import.meta.url).pathname;
  const candidate = `${here}${schemaPath}.schema.json`;
  if (fs.existsSync(candidate)) schemaPath = candidate;
}
let schema, instance;
try {
  schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  instance = JSON.parse(fs.readFileSync(instancePath, 'utf8'));
} catch (e) {
  console.error(`read/parse error: ${e.message}`);
  process.exit(2);
}
// Guard: refuse to run against a schema that uses a keyword we don't implement — a
// silently-ignored keyword is a promise the validator can't keep.
const unknownKw = [];
assertKnownKeywords(schema, '$', unknownKw);
if (unknownKw.length) {
  console.error(`schema error: ${schemaPath} uses keyword(s) this validator does not implement:`);
  unknownKw.forEach((k) => console.error(`  ✗ ${k}`));
  console.error('Add support in validate.mjs (and KNOWN_KEYWORDS) or remove the keyword — do NOT rely on it being enforced.');
  process.exit(2);
}
const errs = [];
validate(schema, instance, '$', errs);
if (errs.length) {
  errs.forEach(e => console.error('✗ ' + e));
  console.error(`INVALID — ${errs.length} violation(s)`);
  process.exit(1);
}
console.log('VALID');

}   // end CLI guard
