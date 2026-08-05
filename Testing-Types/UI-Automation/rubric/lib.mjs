// lib.mjs — shared helpers for the self-healing locators rubric (R0–R4).
//
// Zero-dependency Node >= 18 ESM. Playwright is loaded lazily by verify-locators.mjs only.
// NO hardcoded machine paths: everything is resolved from the config file
// (--config <path>, or $RUBRIC_CONFIG, or ./rubric.config.json).
// Path convention: `projectDir` is relative to the CONFIG FILE; every other
// configured path (locatorsDir, pageObjectsDir, locatorsDoc, baselineDir,
// verdictsDir) is relative to `projectDir`.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ---------------------------------------------------------------- CLI / config

export function parseArgs(argv = process.argv.slice(2)) {
  const valueFlags = new Set(['config', 'only', 'baseline', 'skip']);
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const name = a.slice(2);
      if (valueFlags.has(name)) args[name] = argv[++i];
      else args[name] = true;
    } else {
      args._.push(a);
    }
  }
  return args;
}

export function loadConfig(args = {}) {
  const candidate =
    args.config || process.env.RUBRIC_CONFIG || path.resolve(process.cwd(), 'rubric.config.json');
  const configPath = path.resolve(candidate);
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Rubric config not found: ${configPath}\n` +
        `Pass --config <path> (start from config.example.json in the rubric/ kit folder).`,
    );
  }
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const configDir = path.dirname(configPath);
  const projectDir = path.resolve(configDir, cfg.projectDir || '.');
  const inProject = (p, dflt) => path.resolve(projectDir, p ?? dflt);
  return {
    ...cfg,
    _configPath: configPath,
    _configDir: configDir,
    _projectDir: projectDir,
    _locatorsDir: inProject(cfg.locatorsDir, 'locators'),
    _pageObjectsDir: inProject(cfg.pageObjectsDir, 'page-objects'),
    _locatorsDoc: inProject(cfg.locatorsDoc, 'LOCATORS.md'),
    _baselineDir: inProject(cfg.baselineDir, 'rubric-baseline'),
    _verdictsDir: inProject(cfg.verdictsDir, 'rubric-verdicts'),
  };
}

// Human-readable progress goes to STDERR so that --json stdout stays machine-clean.
export const log = (...a) => console.error(...a);

export function emit(result, { json = false } = {}) {
  if (json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return result;
}

export const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Wildcard match for group/entry ids like "products.json#formPage.fields.price"
// (pattern may contain `*` which matches any run of characters).
export function idMatches(pattern, id) {
  const rx = new RegExp('^' + pattern.split('*').map(escapeRx).join('.*') + '$');
  return rx.test(id);
}

// ------------------------------------------------- locators/*.json extraction

// Keys whose values are documentation / routing metadata, NOT locators.
const SKIP_KEYS = new Set([
  '$comment', 'meta', 'section', 'note', 'notes', 'warning', 'trigger', 'marker',
  'tab', 'tabs', 'columns', 'navItems', 'kind', 'required', 'readonly', 'label',
  'method', 'body', 'statusColumn', 'url', 'urlPattern', 'urlPatternAdd',
  'urlPatternEdit', 'urlMarker', 'app', 'baseUrl', 'capturedAt', 'locale', 'strategy',
]);

// Heuristic: does this string look like a runnable selector (vs. prose)?
export function looksLikeSelector(s) {
  const t = String(s).trim();
  if (!t) return false;
  if (/^(\/\/|\.\w|#\w|\[)/.test(t)) return true; // xpath, .class, #id, [attr]
  if (t.includes('[') || t.includes('>>') || t.includes(':has')) return true;
  if (/^text=/.test(t)) return true;
  if (/^(input|textarea|button|form|h1|a\s|crt-|mat-)/.test(t)) return true;
  // structural selectors: tag-prefixed chains, combinators, nth-child
  if (/^(html|body|div|span|table|thead|tbody|tr|td|ul|ol|li|nav|section|header|footer|main|p|svg)\b/i.test(t)
      && (/[\s>+~.#:]/.test(t))) return true;
  if (t.includes(':nth-child(') || / > /.test(t)) return true;
  return false;
}

// Classify a locator value:
//   'selector'  — plain runnable selector
//   'template'  — contains <placeholder> parts (substitutable via config.samples)
//   'annotated' — carries a human note (Cyrillic prose outside quoted strings) —
//                 documentation value, not directly runnable
//   'empty'     — empty string
export function classifyLocator(raw) {
  const s = String(raw ?? '');
  if (!s.trim()) return 'empty';
  const template = /<[^<>]+>/.test(s);
  const stripped = s
    .replace(/<[^<>]+>/g, '<>') // placeholders first: Cyrillic inside <...> is template syntax, not prose
    .replace(/"[^"]*"/g, '""')
    .replace(/'[^']*'/g, "''")
    .replace(/text=[^\s,>"']+/g, 'text=');
  if (/[Ѐ-ӿ]/.test(stripped)) return 'annotated';
  return template ? 'template' : 'selector';
}

// Flatten one parsed locators/*.json into Map(keyPath -> {locator, classification, required}).
// An object with a string `locator` property is one entry; otherwise EVERY plain string
// value (outside SKIP_KEYS) is recorded — selector-looking ones with a real
// classification, the rest as 'unclassified'. Recording everything is what lets R2
// ban-check values the selector heuristic would miss (e.g. bare nth-child chains);
// R1 live-checks only 'selector'/'template' entries. Arrays and SKIP_KEYS are metadata.
export function flattenLocatorMap(data) {
  const map = new Map();
  (function walk(node, keyPath) {
    if (node === null || node === undefined || Array.isArray(node)) return;
    if (typeof node === 'object') {
      if (typeof node.locator === 'string') {
        map.set(keyPath.join('.'), {
          locator: node.locator,
          classification: classifyLocator(node.locator),
          required: !!node.required,
        });
        return;
      }
      for (const [k, v] of Object.entries(node)) {
        if (SKIP_KEYS.has(k)) continue;
        walk(v, [...keyPath, k]);
      }
      return;
    }
    if (typeof node === 'string') {
      map.set(keyPath.join('.'), {
        locator: node,
        classification: !node.trim()
          ? 'empty'
          : looksLikeSelector(node) ? classifyLocator(node) : 'unclassified',
      });
    }
  })(data, []);
  return map;
}

// List locator JSON files in a directory (skips files starting with "_", e.g.
// _inventory_raw.json, plus anything in skipFiles).
export function listLocatorFiles(dir, skipFiles = []) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_') && !skipFiles.includes(f))
    .sort();
}

// [{file, data}] for every locator JSON in cfg._locatorsDir (or an explicit dir).
export function readLocatorFiles(cfg, dir = cfg._locatorsDir) {
  return listLocatorFiles(dir, cfg.skipFiles || []).map((file) => ({
    file,
    data: JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')),
  }));
}

// Flat entry list across all files: {file, group, keyPath, key, locator, classification, required}.
export function extractLocatorEntries(cfg, dir = cfg._locatorsDir) {
  const entries = [];
  for (const { file, data } of readLocatorFiles(cfg, dir)) {
    for (const [keyPath, info] of flattenLocatorMap(data)) {
      const parts = keyPath.split('.');
      entries.push({ file, group: parts[0], keyPath, key: parts[parts.length - 1], ...info });
    }
  }
  return entries;
}

// --------------------------------------------- page-objects/*.ts extraction

// Pull quoted selector strings out of .locator(...) / waitForSelector(...) calls.
export function extractTsSelectors(cfg) {
  const dir = cfg._pageObjectsDir;
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const files = fs.readdirSync(dir).filter((f) => /\.(ts|tsx|js|mjs)$/.test(f)).sort();
  const rx = /(?:\.locator|\.\$\$?|waitForSelector|querySelector(?:All)?)\(\s*(['"`])((?:\\.|(?!\1).)*?)\1/g;
  for (const file of files) {
    const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      let m;
      while ((m = rx.exec(line)) !== null) {
        out.push({ file, line: i + 1, selector: m[2] });
      }
      rx.lastIndex = 0;
    });
  }
  return out;
}

// ------------------------------------------------------- files, hashes, globs

export function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

export function walkFiles(root, { exclude = [] } = {}) {
  const out = [];
  const skipNames = new Set(['.git', 'node_modules', '.DS_Store']);
  (function rec(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (skipNames.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (exclude.some((x) => full === x || full.startsWith(x + path.sep))) continue;
      if (e.isDirectory()) rec(full);
      else if (e.isFile()) out.push(full);
    }
  })(root);
  return out;
}

// Minimal glob: `**` crosses directories, `*` within a segment, `?` one char.
// A pattern without `/` (e.g. "*.spec.ts", "README.md") matches at any depth.
export function globToRegExp(glob) {
  let rx = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        rx += '.*';
        i++;
        if (glob[i + 1] === '/') i++;
      } else {
        rx += '[^/]*';
      }
    } else if (c === '?') {
      rx += '[^/]';
    } else if ('\\^$.|+()[]{}'.includes(c)) {
      rx += '\\' + c;
    } else {
      rx += c;
    }
  }
  return new RegExp('^' + rx + '$');
}

export function matchesGlobs(relPath, globs = []) {
  const posix = relPath.split(path.sep).join('/');
  const base = path.basename(posix);
  return globs.some((g) => {
    const rx = globToRegExp(g);
    return rx.test(posix) || (!g.includes('/') && rx.test(base));
  });
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
