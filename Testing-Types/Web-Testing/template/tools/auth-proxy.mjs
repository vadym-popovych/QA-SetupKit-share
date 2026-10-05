#!/usr/bin/env node
/**
 * auth-proxy.mjs — browse a Basic-auth-protected staging site from a device
 * that cannot be driven through the browser's sign-in dialog.
 *
 * Why this exists: an iOS Simulator's Safari sign-in sheet is a WebView-level
 * dialog. Typing into its SECURE field through UI automation is unreliable —
 * measured 31/08/2026: a 24-character password with `*` in it arrived as 10
 * characters and the round burned twenty minutes on 401s before anyone looked
 * at the field's accessibility value. The proxy removes the dialog entirely:
 * it holds the credentials and injects `Authorization` on every request, so
 * the device just browses an unauthenticated origin.
 *
 * It also rewrites the target's absolute URLs to point back at itself, so
 * same-host assets — stylesheets, bundles, hero mp4s — travel through the
 * proxy too. Third-party origins (Vimeo, fonts, analytics) are untouched and
 * load directly, which is what you want: the point is to reach the site, not
 * to sandbox it.
 *
 * Usage:
 *   BASIC_USER=<user> BASIC_PASS=<pass> TARGET=https://<host> \
 *   HOST_IP=$(ipconfig getifaddr en0) node auth-proxy.mjs [port]
 *
 *   Then point the device at http://<HOST_IP>:<port>/ — a Simulator on the
 *   same machine can also use http://127.0.0.1:<port>/.
 *
 * Credentials come from the environment ONLY; never hard-code them here and
 * never commit a wrapper that does.
 *
 * Two things to record in the round's REPORT.md when you use it, because they
 * are real deviations from what a user's browser does:
 *   - the page is served over http, not https, so anything gated on a secure
 *     context (getUserMedia, service workers, some autoplay policies) behaves
 *     differently — re-verify such a finding without the proxy before filing;
 *   - `Content-Security-Policy` and `Strict-Transport-Security` are stripped,
 *     since both would block the rewritten origin. A CSP finding cannot be
 *     made through this proxy.
 */
import http from 'node:http';
import { Readable } from 'node:stream';

const TARGET = (process.env.TARGET || '').replace(/\/$/, '');
const USER = process.env.BASIC_USER;
const PASS = process.env.BASIC_PASS;
const PORT = Number(process.argv[2] || process.env.PORT || 8099);
const HOST_IP = process.env.HOST_IP || '127.0.0.1';

if (!TARGET || !USER || !PASS) {
  console.error('auth-proxy: TARGET, BASIC_USER and BASIC_PASS are required (env only).');
  console.error('  BASIC_USER=… BASIC_PASS=… TARGET=https://host node auth-proxy.mjs [port]');
  process.exit(1);
}

const AUTH = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');
const SELF = `http://${HOST_IP}:${PORT}`;
const TARGET_HOST = new URL(TARGET).host;
// Rewrite the protocol-relative form too — WordPress emits both.
const TARGET_FORMS = [TARGET, TARGET.replace(/^https?:/, '')];
const TEXTUAL = /(text\/|application\/(javascript|json|xml|xhtml))/i;
const DROP_HEADERS = new Set([
  'content-encoding',        // we ask upstream for identity and re-length ourselves
  'content-length',
  'transfer-encoding',
  'strict-transport-security', // would force the device back to https
  'content-security-policy',   // would block the rewritten origin
  'content-security-policy-report-only',
]);

const server = http.createServer(async (req, res) => {
  let upstream;
  try {
    upstream = new URL(req.url, TARGET);
  } catch {
    res.writeHead(400).end('bad request url');
    return;
  }

  const headers = {
    ...req.headers,
    host: TARGET_HOST,
    authorization: AUTH,
    'accept-encoding': 'identity',
  };
  // Conditional requests would hand back a 304 with no body to rewrite.
  delete headers['if-none-match'];
  delete headers['if-modified-since'];

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks);
  }

  let up;
  try {
    up = await fetch(upstream, { method: req.method, headers, body, redirect: 'manual' });
  } catch (err) {
    res.writeHead(502).end(`auth-proxy upstream error: ${err.message}`);
    return;
  }

  const out = {};
  up.headers.forEach((value, key) => {
    if (DROP_HEADERS.has(key)) return;
    out[key] = key === 'location' ? rewrite(value) : value;
  });

  const type = up.headers.get('content-type') || '';
  if (TEXTUAL.test(type)) {
    const text = rewrite(await up.text());
    out['content-length'] = Buffer.byteLength(text);
    res.writeHead(up.status, out);
    res.end(text);
  } else {
    res.writeHead(up.status, out);
    if (up.body) Readable.fromWeb(up.body).pipe(res);
    else res.end();
  }
});

function rewrite(text) {
  return TARGET_FORMS.reduce((acc, form) => acc.split(form).join(SELF), text);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`auth-proxy: ${SELF}  ->  ${TARGET}  (user ${USER})`);
});
