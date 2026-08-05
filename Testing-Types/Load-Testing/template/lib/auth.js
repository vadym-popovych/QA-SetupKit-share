// Auth + optional test-user pool for <PROJECT> load tests.
//
// Supports four AUTH_MODEs (set in config.js or -e AUTH_MODE=...):
//   none     -> no Authorization header
//   static   -> a single bearer token from -e TOKEN=...
//   login    -> POST {email,password} to AUTH_URL, read token from TOKEN_FIELD
//   firebase -> Firebase Identity Toolkit signInWithPassword with FIREBASE_API_KEY
//
// For login/firebase you can supply a POOL of accounts (1 VU = 1 account) to
// spread per-user rate/resource limits. Provide a gitignored JSON file:
//   [{ "email": "load1@example.com", "password": "..." }, ...]
// and pass:  -e USERS_FILE=$PWD/users.json
// Without a pool, a single account from -e EMAIL=... -e PASSWORD=... is used.
import http from 'k6/http';
import { SharedArray } from 'k6/data';
import {
  AUTH_MODE, TOKEN, AUTH_URL, FIREBASE_API_KEY, TOKEN_FIELD,
} from '../config.js';

export const users = new SharedArray('users', () => {
  if (__ENV.USERS_FILE) return JSON.parse(open(__ENV.USERS_FILE));
  return [{ email: __ENV.EMAIL || '', password: __ENV.PASSWORD || '' }];
});

let _token = null;
let _expiresAt = 0;

export function currentUser() {
  return users[(__VU - 1) % users.length];
}

// Returns a valid bearer token for this VU (or '' for AUTH_MODE=none),
// signing in / refreshing as needed. Sign-in is tagged name:signin so it stays
// out of the API latency thresholds.
export function token() {
  if (AUTH_MODE === 'none') return '';
  if (AUTH_MODE === 'static') return TOKEN;

  const now = Date.now();
  if (_token && now < _expiresAt) return _token;

  const u = currentUser();
  let res;
  if (AUTH_MODE === 'firebase') {
    res = http.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      JSON.stringify({ email: u.email, password: u.password, returnSecureToken: true }),
      { headers: { 'Content-Type': 'application/json' }, tags: { name: 'signin' } }
    );
  } else { // 'login'
    res = http.post(AUTH_URL, JSON.stringify({ email: u.email, password: u.password }), {
      headers: { 'Content-Type': 'application/json' }, tags: { name: 'signin' },
    });
  }

  const body = res.json();
  const tok = body && body[TOKEN_FIELD];
  if (res.status !== 200 || !tok) {
    throw new Error(`sign-in failed (${AUTH_MODE}) for ${u.email}: HTTP ${res.status} ${res.body}`);
  }
  _token = tok;
  // Firebase returns expiresIn (s); others often don't — default to 55 min.
  const ttl = Number(body.expiresIn || 3300);
  _expiresAt = now + (ttl - 120) * 1000;
  return _token;
}

// JSON + bearer headers for authenticated calls.
export function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  const t = token();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}
