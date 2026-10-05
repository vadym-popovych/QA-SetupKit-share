# Design-Conformance — setup and a round

Read [`DESIGN_CONFORMANCE_RULES.md`](DESIGN_CONFORMANCE_RULES.md) first; it is what the tools below
are enforcing.

## Trigger phrases

> «звір дизайн зі сторі» · «чи відповідає макет вимогам» · «пройдись по прототипу проти AC» ·
> "does the prototype match the stories" · "design conformance round" · "review this design export
> against the PRD"

## 0. Prerequisites

**Playwright with a browser.** The tools drive a real browser; they never parse the bundle as text.

```bash
# in any project dir that will hold the harness
npm i -D playwright
npx playwright install chromium
```

If the installed Playwright pins a browser revision you do not have, use the browser already on the
machine instead of downloading a second one:

```bash
export UI_FLOW_CHANNEL=chrome
```

**Tell the tools where Playwright lives** (they are deliberately not `npm`-linked into the kit):

```bash
export PLAYWRIGHT_DIR=/path/to/dir/containing/node_modules
```

**ffmpeg**, for turning the recorded `.webm` into `.mp4` plus a poster frame. `brew install ffmpeg`.

**Copied the template out of the kit?** Then point the flow engine at the kit copy, or
`lib-ui-flow.mjs` will tell you to:

```bash
export UI_FLOW_LIB=<kit>/Testing-Types/Web-Testing/template/tools/record-ui-flow.mjs
```

## 1. Land the artefacts

```bash
mkdir -p <Project>/QA-Documentation/design-review/evidence
cp <kit>/QA-Documentation/Custom-Reports/Design-Conformance/template/findings.example.json \
   <Project>/QA-Documentation/design-review/findings.json
```

The **design bundle itself stays where it is** — it is somebody else's deliverable. Record its
filename and hash in the report's meta block instead:

```bash
shasum -a 256 "<the design export>" | cut -c1-16
```

## 2. Read the design's own annotations

```bash
node <kit>/…/Design-Conformance/template/tools/dc-map.mjs \
  --src="<the design export>" --out=story-map.json
```

That alone reads the landing screen plus the bundle's hidden screen manifest. To annotate every
screen, write a walk module — the flows are project-specific, the engine is not:

```js
// walk.mjs
export default async (f, mark) => {
  await mark('SIGN-IN');
  await f.tap('Continue with Google');
  await mark('ONBOARDING');
  await f.tap('Skip');
  await mark('APP SELECTION');
};
```

```bash
node …/dc-map.mjs --src="<export>" --out=story-map.json --walk=./walk.mjs
```

**No annotations in the bundle?** Then you cannot claim coverage from this file — walk the flows and
report what you actually saw. `dc-map.mjs` prints that warning itself.

## 3. Record the findings

One clip per claim, in a project-owned recording script that is a thin wrapper over the shared engine — the flows are the only project-specific part:

```js
import { createRecorder } from '<kit>/Testing-Types/Web-Testing/template/tools/record-ui-flow.mjs';

const rec = await createRecorder({
  src: process.argv[2], out: 'evidence',
  // The default tap dot is white and vanishes on a light UI — override it.
  tapStyle: { fill: 'rgba(17,19,26,.36)', ring: 'rgba(255,255,255,.96)' },
});

await rec.clip('F1-gate-is-skippable', async (f) => {
  await f.tap('Continue with Google');
  await f.tap('Skip', { hold: 2600 });
  await f.expect('Pick apps to track', { hold: 1500 });   // throws if it never renders
});

await rec.close();
```

Then encode and take a poster frame from the moment that carries the evidence:

```bash
cd evidence
for f in *.webm; do
  ffmpeg -y -loglevel error -i "$f" -c:v libx264 -pix_fmt yuv420p -crf 26 \
         -movflags +faststart "${f%.webm}.mp4"
  ffmpeg -y -loglevel error -ss <seconds> -i "${f%.webm}.mp4" -frames:v 1 -q:v 6 "poster-${f%.webm}.jpg"
done
```

Pick the poster second deliberately: it should show **the state that proves the finding**, not
wherever the clip happens to end.

## 4. Write the findings, build the page

Fill `findings.json` (structure: [`template/findings.example.json`](template/findings.example.json)).
Every finding needs `requires` (quoted from the spec), `observed`, and — if it carries an `impact` —
a `severitySource`.

```bash
node …/Design-Conformance/template/tools/dc-report.mjs \
  --findings=findings.json --out=report.html --evidence=evidence
```

It **refuses to build** on a missing clip, a one-sided finding, or an unattributed impact rating, and
warns on every build which findings carry an agent-proposed rating.

## 5. Hand it over

Run your workspace's handover gate — the four questions asked before any artefact is handed
over — and in particular:

1. **The link is stable** because rebuilding writes the same path; publish through
   [HTML-Reports](../HTML-Reports/SETUP.md) for a shareable URL that survives the next round.
2. **Verified by render** — open the built page and look at it, in both light and dark. An attribute
   check is not verification.
3. **Repeat the proposed-impact warning** in the same message as the link (RULES §6).
4. A first round on a project is also a **new document type** for the owner's Doc-type validation
   sheet.
