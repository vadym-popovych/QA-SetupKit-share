// Central config for <PROJECT> load tests. Copy this folder into your project as
// `<Project>-LoadTest/` and fill in the TODOs from your API's Postman collection.
// Everything is overridable via `-e KEY=value` on the k6 CLI, so no secrets or
// environment-specific values are hard-baked.
//
//   k6 run -e BASE_URL=https://staging.example.com scenarios/smoke.js

// TODO: your staging/dev base URL. NEVER test production.
export const BASE_URL = __ENV.BASE_URL || 'https://staging.example.com';

// --- Auth mode --------------------------------------------------------------
// 'none'     - no auth
// 'static'   - a bearer token you pass with -e TOKEN=...
// 'login'    - POST credentials to an auth endpoint that returns a token (see lib/auth.js)
// 'firebase' - Firebase Identity Toolkit signInWithPassword (see lib/auth.js)
export const AUTH_MODE = __ENV.AUTH_MODE || 'static';

// static mode: bearer token passed at runtime (never commit it)
export const TOKEN = __ENV.TOKEN || '';

// login/firebase mode config (fill what applies):
export const AUTH_URL = __ENV.AUTH_URL || ''; // e.g. https://api.example.com/login
export const FIREBASE_API_KEY = __ENV.FIREBASE_API_KEY || ''; // public web API key
// Field in the auth response that holds the bearer token:
export const TOKEN_FIELD = __ENV.TOKEN_FIELD || 'idToken'; // e.g. idToken | access_token | token

// Poll cadence for async flows (POST returns a job/id, then you poll a status endpoint).
export const POLL_INTERVAL = Number(__ENV.POLL_INTERVAL || 3);  // s between status polls
export const POLL_TIMEOUT = Number(__ENV.POLL_TIMEOUT || 120);  // s before giving up

// --- Thresholds -------------------------------------------------------------
// TODO: tune to the SLA you agree on. Tag heavy vs light calls in the scenarios
// (tags:{name:'create'|'poll'|...}) so these per-tag budgets apply.
export const thresholds = {
  http_req_failed: ['rate<0.02'],
  'http_req_duration{name:health}': ['p(95)<500'],
  'http_req_duration{name:create}': ['p(95)<5000', 'p(99)<10000'],
  'http_req_duration{name:poll}':   ['p(95)<1000', 'p(99)<1500'],
  'http_req_duration{name:list}':   ['p(95)<1000'],
};

// TODO: the real request body for your "do the work" endpoint, from the Postman
// collection. Keep it a function so scenarios can vary fields per iteration.
export function createPayload() {
  return JSON.stringify({
    // e.g. theme, characters, language, ...
    example: 'replace with real fields from your Postman collection',
  });
}
