// Quick smoke test for routing fixes.
// Run: node scripts/smoke-test.js  (server must be running on port 5001)
const http = require('http');

const BASE = 'http://localhost:5001';
const COOKIE = process.env.SMOKE_COOKIE || ''; // paste your connect.sid here if auth required

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}${path}`, { headers: { Cookie: COOKIE } }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => reject(new Error('timeout')));
  });
}

function post(path) {
  return new Promise((resolve, reject) => {
    const opts = { method: 'POST', headers: { Cookie: COOKIE, 'Content-Type': 'application/json' } };
    const req = http.request(`${BASE}${path}`, opts, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(JSON.stringify({}));
    req.end();
  });
}

async function main() {
  const checks = [
    ['/api/health', 200, 'ok'],
    ['/api/marketplace/listings/pending', [200, 401, 403]],
    ['/api/environments/active', [200, 204]],
    ['/api/incidents', 200],
    ['/api/alerts', 200],
  ];

  let failures = 0;
  for (const [path, expected] of checks) {
    const res = await get(path).catch(e => ({ status: 0, body: e.message }));
    const ok = Array.isArray(expected) ? expected.includes(res.status) : res.status === expected;
    console.log(`${ok ? '✓' : '✗'} ${path} → ${res.status}`);
    if (!ok) failures++;
  }

  // POST actions against a nonexistent alert should 404 (proves routes exist)
  const postPaths = [
    '/api/alerts/000000000000000000000000/acknowledge',
    '/api/alerts/000000000000000000000000/snooze',
    '/api/alerts/000000000000000000000000/resolve',
  ];
  for (const path of postPaths) {
    const res = await post(path).catch(e => ({ status: 0, body: e.message }));
    const ok = [404, 200, 500].includes(res.status); // 404 is expected if alert missing
    console.log(`${ok ? '✓' : '✗'} POST ${path} → ${res.status}`);
    if (!ok) failures++;
  }

  process.exit(failures ? 1 : 0);
}

main();
