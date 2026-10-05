// Design-Conformance — resolve the shared flow engine.
//
// The walk/tap/record engine is ONE implementation, owned by Web-Testing
// (`Testing-Types/Web-Testing/template/tools/record-ui-flow.mjs`); this report type drives it for a
// different purpose (reading a design's own annotations, recording a finding) but must never fork
// it — two copies of a browser harness drift, and the copy the report used stops being the copy
// anyone maintains.
//
// Templates get copied into `<Project>/…`, where the relative path back into the kit no longer
// holds, so resolution is: `UI_FLOW_LIB` (explicit path to record-ui-flow.mjs) → the in-kit
// relative path. It fails with the fix rather than a bare module-not-found.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const IN_KIT = new URL('../../../../../Testing-Types/Web-Testing/template/tools/record-ui-flow.mjs', import.meta.url);

const candidates = [
  process.env.UI_FLOW_LIB ? pathToFileURL(process.env.UI_FLOW_LIB) : null,
  IN_KIT,
].filter(Boolean);

const found = candidates.find((u) => existsSync(fileURLToPath(u)));
if (!found) {
  throw new Error(
    'Design-Conformance: cannot find the shared flow engine (record-ui-flow.mjs).\n'
    + '  Looked at: ' + candidates.map((u) => fileURLToPath(u)).join('\n             ') + '\n'
    + '  This template was probably copied out of the kit. Point UI_FLOW_LIB at the kit copy:\n'
    + '    export UI_FLOW_LIB=<kit>/Testing-Types/Web-Testing/template/tools/record-ui-flow.mjs');
}

export const { createRecorder } = await import(found.href);
