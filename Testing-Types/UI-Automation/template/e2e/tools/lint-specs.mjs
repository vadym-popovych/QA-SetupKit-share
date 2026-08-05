// lint-specs.mjs — mechanical guard for an E2E suite that must stay trustworthy.
// Zero dependencies. Copy to <Project>/UI-Automation/e2e/tools/ and run:
//
//   node tools/lint-specs.mjs tests          # exit 1 on any violation
//
// The kit's rules are only real if something checks them. Every rule below has the same
// shape of failure: the suite still goes GREEN while testing less than you think — which is
// the "never fake a Pass" principle applied to the tests themselves.
//
// Wire it as a CI gate (CI-Integration kit) or a pre-commit hook. It is fast and offline.

import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ?? 'tests';
if (!fs.existsSync(root)) { console.error(`lint-specs: ${root} does not exist`); process.exit(2); }

const RULES = [
  {
    id: 'locator-in-spec',
    // Selectors belong to page objects, which are generated from the CAPTURED DOM. A selector
    // typed into a spec was, by definition, guessed — and it breaks silently on redeploy.
    // Catches: .locator()/.$/$$; the WHOLE getBy* family (getByRole/Text/Label/Placeholder/
    // AltText/Title/TestId — a role-based locator is still a locator, and it still belongs in the
    // page object per this kit's separation); css=/xpath= engine prefixes; and a raw string
    // selector passed straight to a page action (page.fill('#password', …), page.click('.btn')).
    re: /\b(page|frame|dialog)\s*\.\s*(locator|\$\$?)\s*\(|\bgetBy[A-Z]\w*\s*\(|css=|xpath=|\bpage\.\$\(|\b(page|frame)\s*\.\s*(click|fill|type|press|check|uncheck|hover|dblclick|tap|focus|selectOption|setInputFiles|dragAndDrop)\s*\(\s*['"`]/,
    msg: 'locator in a spec — move it into a page object (specs describe behaviour, POs own selectors)',
  },
  {
    id: 'hard-sleep',
    // A sleep is a bet on someone else's machine being as fast as yours. It is the single
    // biggest source of "flaky" suites, and it silently passes when the app is broken-but-slow.
    // Catches waitForTimeout, sleep(), AND any setTimeout — including the Promise-wrapped form
    // `new Promise(r => setTimeout(r, 5000))` where the resolver isn't named `resolve`.
    re: /waitForTimeout\s*\(|\bsleep\s*\(|\bsetTimeout\s*\(/,
    msg: 'hard sleep — wait for a concrete element/state instead (waits belong in page objects)',
  },
  {
    id: 'conditional-assertion',
    // `if (await x.isVisible()) { expect(...) }` is an assertion that can decide not to run.
    // The test then reports PASS having verified nothing — a faked Pass with extra steps.
    re: /if\s*\(\s*await[^)]*\.(isVisible|isEnabled|count|isChecked)\s*\(/,
    msg: 'conditional assertion — an assertion that can silently skip is a faked Pass; assert unconditionally',
  },
  {
    id: 'unexplained-skip',
    // A skip is allowed, but it must name the bug or the reason. An anonymous skip is how
    // coverage quietly evaporates.
    re: /(test|describe)\.(skip|fixme)\s*\(/,
    ok: (line) => /BUG-\d{3}|@quarantine|reason:/i.test(line),
    msg: 'test.skip/fixme without a BUG-NNN, @quarantine tag, or reason: — coverage cannot vanish anonymously',
  },
  {
    id: 'stray-only',
    // `.only` in a committed spec shrinks the whole suite to one test — and it still reports green.
    re: /(test|describe)\.only\s*\(/,
    msg: 'test.only — it shrinks the suite to one test and still reports green (forbidOnly catches it in CI; catch it here first)',
  },
  {
    id: 'hardcoded-credentials',
    // Catches: `password = '...'` / `token: '...'` / `apiKey='...'` assignments AND a secret
    // literal passed to a field fill (`page.fill('#password', 'Sup3rSecret!')`,
    // `pwd.fill('hunter2')`). Env refs / placeholders are exempt.
    re: /(password|passwd|pwd|secret|token|api[-_]?key|bearer)\s*[:=]\s*['"][^'"]{3,}['"]|\.fill\s*\(\s*[^)]*,\s*['"][^'"]{4,}['"]\s*\)/i,
    ok: (line) => /process\.env|TODO|example|\$\{|REPLACE|<[a-z]/i.test(line),
    msg: 'hardcoded credential — accounts come from the Test-Data pool via env, never a literal in a spec',
  },
  {
    id: 'missing-traceability',
    file: true,
    // Every spec traces to something: a case, a bug, or an invariant. Without it the RTM
    // cannot answer "what covers this requirement?" and the suite stops being memory.
    check: (text) => /TC-\d{3}|BUG-\d{3}|INV-\d+/.test(text),
    msg: 'no TC-NNN / BUG-NNN / INV-N in the file — every spec traces to a case, bug, or invariant (TRACEABILITY_RULES)',
  },
  {
    id: 'missing-priority-tag',
    file: true,
    check: (text) => /@high\b|@medium\b|@low\b|@regression\b|@quarantine\b/.test(text),
    msg: 'no @high/@medium/@low / @regression / @quarantine tag — the CI gate selects by tag, so an untagged spec runs nowhere (tags mirror the case priority: test-case.schema High/Medium/Low)',
  },
];

const specs = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.spec\.ts$/.test(e.name)) specs.push(p);
  }
})(root);

let violations = 0;
for (const file of specs) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');

  for (const rule of RULES.filter((r) => r.file)) {
    if (!rule.check(text)) { console.log(`${file}: ${rule.msg} [${rule.id}]`); violations++; }
  }
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;                       // comments are documentation, not code
    for (const rule of RULES.filter((r) => r.re)) {
      if (rule.re.test(line) && !(rule.ok?.(line))) {
        console.log(`${file}:${i + 1}: ${rule.msg} [${rule.id}]`);
        violations++;
      }
    }
  });
}

console.log(`\nlint-specs: ${specs.length} spec(s), ${violations} violation(s)`);
if (!specs.length) {
  // An empty suite passing its lint is exactly the kind of green that means nothing.
  console.error('lint-specs: no specs found — an empty suite is not a healthy suite');
  process.exit(1);
}
process.exit(violations ? 1 : 0);
