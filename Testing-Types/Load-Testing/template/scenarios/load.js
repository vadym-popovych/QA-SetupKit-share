// Load test — realistic traffic at target concurrency. Default shape is the
// common async flow: POST create -> poll status -> (optional) fetch result.
// Adapt to sync/SSE if your API differs.
//
//   k6 run -e USERS_FILE=$PWD/users.json -e VUS=20 scenarios/load.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import {
  BASE_URL, createPayload, POLL_INTERVAL, POLL_TIMEOUT, thresholds,
} from '../config.js';
import { authHeaders } from '../lib/auth.js';

// Per-run self-contained HTML report (results/<RUN_ID>.html) — see lib/report.js
export { handleSummary } from '../lib/report.js';

const e2e = new Trend('work_ready_duration', true); // create -> result-ready
const errors = new Rate('work_errors');

const TARGET_VUS = Number(__ENV.VUS || 20);

export const options = {
  // Names this run in the Grafana Cloud k6 dashboard (only used with -o cloud).
  cloud: { name: __ENV.K6_CLOUD_NAME || '<PROJECT> — load' },
  scenarios: {
    steady_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: TARGET_VUS },
        { duration: '5m', target: TARGET_VUS },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: { ...thresholds, work_errors: ['rate<0.05'] },
};

export default function () {
  const start = Date.now();

  const create = http.post(`${BASE_URL}/items`, createPayload(), {
    headers: authHeaders(), tags: { name: 'create' },
  });
  const accepted = check(create, { 'create accepted (200/202)': (r) => r.status === 200 || r.status === 202 });
  if (!accepted) {
    errors.add(1);
    if (create.status === 429 || create.status === 409) sleep(5); // back off, don't hammer
    return;
  }

  const id = create.json('id');
  if (!id) { errors.add(1); return; }

  // Poll until ready (delete if your API is synchronous).
  const deadline = Date.now() + POLL_TIMEOUT * 1000;
  let ready = false;
  while (Date.now() < deadline) {
    const s = http.get(`${BASE_URL}/items/${id}/status`, { headers: authHeaders(), tags: { name: 'poll' } });
    const st = s.status === 200 ? (s.json('status') || '') : '';
    if (st === 'completed' || st === 'ready') { ready = true; break; }
    if (st === 'failed') break;
    sleep(POLL_INTERVAL);
  }
  errors.add(!ready);
  if (!ready) return;
  e2e.add(Date.now() - start);

  // Optional: fetch the finished result.
  // http.get(`${BASE_URL}/items/${id}`, { headers: authHeaders(), tags: { name: 'result' } });

  sleep(1); // think time
}
