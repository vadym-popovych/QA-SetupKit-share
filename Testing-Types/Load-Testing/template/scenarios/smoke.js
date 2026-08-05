// Smoke test — 1 VU, exercises the contract once. Run FIRST to confirm
// endpoints, auth and payloads before any real load.
//
//   k6 run -e USERS_FILE=$PWD/users.json scenarios/smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, createPayload, POLL_INTERVAL, thresholds } from '../config.js';
import { token, authHeaders } from '../lib/auth.js';

// Per-run self-contained HTML report (results/<RUN_ID>.html) — see lib/report.js
export { handleSummary } from '../lib/report.js';

export const options = { vus: 1, iterations: 1, thresholds };

export default function () {
  // 1. Health (adjust path/expectation to your API; remove if none).
  const health = http.get(`${BASE_URL}/health`, { tags: { name: 'health' } });
  check(health, { 'health 2xx': (r) => r.status >= 200 && r.status < 300 });

  // 2. Auth (no-op for AUTH_MODE=none/static).
  token();

  // 3. A representative read (TODO: your list/GET endpoint).
  const list = http.get(`${BASE_URL}/items`, { headers: authHeaders(), tags: { name: 'list' } });
  check(list, { 'list 200': (r) => r.status === 200 });

  // 4. The "do the work" call (TODO: your create/generate endpoint + method).
  const create = http.post(`${BASE_URL}/items`, createPayload(), {
    headers: authHeaders(), tags: { name: 'create' },
  });
  const ok = check(create, { 'create accepted (200/202)': (r) => r.status === 200 || r.status === 202 });
  if (!ok) { console.warn(`create -> HTTP ${create.status}: ${create.body}`); return; }

  // 5. If async: poll a status endpoint until done (delete this block if sync).
  //    TODO: real id field + status endpoint + "done" condition.
  const id = create.json('id');
  if (!id) return;
  for (let i = 0; i < 10; i++) {
    const s = http.get(`${BASE_URL}/items/${id}/status`, { headers: authHeaders(), tags: { name: 'poll' } });
    const st = s.status === 200 ? (s.json('status') || '') : '';
    console.log(`status: ${st}`);
    if (st === 'completed' || st === 'ready' || st === 'failed') break;
    sleep(POLL_INTERVAL);
  }
}
