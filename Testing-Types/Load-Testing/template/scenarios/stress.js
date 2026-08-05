// Stress test — ramp past the expected ceiling to find the breaking point and
// whether the API recovers on ramp-down. Tracks 429/409/5xx.
//
//   k6 run -e USERS_FILE=$PWD/users.json -e PEAK=200 scenarios/stress.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { BASE_URL, createPayload } from '../config.js';
import { authHeaders } from '../lib/auth.js';

// Per-run self-contained HTML report (results/<RUN_ID>.html) — see lib/report.js
export { handleSummary } from '../lib/report.js';

const rateLimited = new Rate('rate_limited_429');
const serverErrors = new Rate('server_errors_5xx');
const PEAK = Number(__ENV.PEAK || 200);

export const options = {
  cloud: { name: __ENV.K6_CLOUD_NAME || '<PROJECT> — stress' },
  scenarios: {
    ramp_to_break: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: Math.round(PEAK * 0.25) },
        { duration: '2m', target: Math.round(PEAK * 0.5) },
        { duration: '2m', target: Math.round(PEAK * 0.75) },
        { duration: '2m', target: PEAK },
        { duration: '3m', target: PEAK }, // sustain
        { duration: '2m', target: 0 },    // recovery
      ],
      gracefulRampDown: '1m',
    },
  },
  thresholds: { server_errors_5xx: ['rate<0.10'] }, // informational tripwire
};

export default function () {
  const res = http.post(`${BASE_URL}/items`, createPayload(), {
    headers: authHeaders(), tags: { name: 'create' },
  });
  rateLimited.add(res.status === 429);
  serverErrors.add(res.status >= 500);
  check(res, { 'not a server error (5xx)': (r) => r.status < 500 });
  sleep(1);
}
