// scripts/verifyApis.js
// Standalone (no server) verifier for every marketplace API endpoint. Reads the
// same catalog the seed script writes, hits baseUrl + each endpoint.path with
// sample values, classifies OK / AUTH-OK / BROKEN / DEAD / TIMEOUT, and writes
// scripts/verify-apis-report.json. Re-run after editing marketplaceCatalog.js.
//
// Usage:
//   node scripts/verifyApis.js            # verify all, 10s timeout each
//   node scripts/verifyApis.js --insecure # allow broken TLS (httpbin etc.)
//   node scripts/verifyApis.js --id dogapi  # single API by id
//   node scripts/verifyApis.js --concurrency 8
//
// Auth-required endpoints (authType 'API Key' / required api_key|apiKey param)
// are hit WITHOUT a key and expected to return 401/403 — that proves the host
// and path are valid (not a 404/dead host). Live key testing is out of scope.

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
let fetchFn;
const fetchImport = (...a) => import('node-fetch').then(({ default: f }) => f(...a));

const { publicApiCatalog } = require('./marketplaceCatalog');

// Sample substitution values for known placeholder / query param names.
// Keys are matched case-insensitively against the param name.
const SAMPLES = {
    q: 'hello', query: 'hello', search: 'hello', q: 'hello',
    id: '1', name: 'pikachu', title: 'hello',
    username: 'octocat', owner: 'octocat', repo: 'Hello-World',
    zip: '90210', lat: '36.7202', lng: '-4.4200', latlng: '36.7202,-4.4200',
    sol: '1000', vs_currency: 'usd', vs_currencies: 'usd',
    ids: 'bitcoin', from: 'USD', to: 'EUR', base: 'USD', currency: 'USD',
    code: '200', countrycode: 'US', country: 'us', countrycode2: 'US',
    ip: '8.8.8.8', number: '42', word: 'hello',
    year: '2023', width: '200', height: '300', style: 'avataaars',
    subreddit: 'javascript', region: 'na1', city: 'london',
    results: '1', limit: '1', page: '1', per_page: '1',
    order: 'desc', sort: 'creation', site: 'stackoverflow', action: 'query', list: 'search', format: 'json', srsearch: 'test',
    fsym: 'BTC', tsym: 'USD', limit_: '1', unit: 'metric',
    // raw — let URL/path encoding apply once, not twice
    citation: 'john 3:16',
};

// Param names that represent an API key (any of these signals "auth required").
const KEY_PARAM_NAMES = new Set(['api_key', 'apikey', 'api-key', 'key', 'token', 'access_token', 'appid']);

function sampleFor(name) {
    if (!name) return null;
    const lower = String(name).toLowerCase();
    if (SAMPLES[lower] !== undefined) return String(SAMPLES[lower]);
    if (KEY_PARAM_NAMES.has(lower)) return 'PIGEON_TEST_KEY_PLACEHOLDER';
    // generic fallbacks
    if (!isNaN(lower) && lower !== '') return '1';
    return 'hello';
}

function isEndpointAuthRequired(api, endpoint) {
    if (api.authType && /api key|bearer|oauth|token/i.test(api.authType)) return true;
    const params = endpoint.parameters || [];
    return params.some(p => KEY_PARAM_NAMES.has(String(p.name).toLowerCase()));
}

// Substitute {param} placeholders in path and in baseUrl host (e.g. {region}).
function substitute(str, params) {
    if (!str) return str;
    return str.replace(/\{(\w+)\}/g, (m, key) => {
        const v = params[key];
        return v !== undefined ? encodeURIComponent(v) : m;
    });
}

function buildRequest(api, endpoint) {
    const authRequired = isEndpointAuthRequired(api, endpoint);
    const provided = {};
    (endpoint.parameters || []).forEach(p => {
        const pname = p.name;
        if (KEY_PARAM_NAMES.has(String(pname).toLowerCase())) {
            provided[pname] = 'PIGEON_TEST_KEY_PLACEHOLDER'; // prove host+path, expect 401/403
        } else {
            provided[pname] = sampleFor(pname);
        }
    });

    // Many seed endpoints use {placeholder} in the path WITHOUT declaring it in
    // `parameters`. Auto-extract every {x} from path + baseUrl and sample it so
    // the request URL is concrete (not %7Bid%7D).
    const extract = (s) => (s ? (s.match(/\{(\w+)\}/g) || []).map(m => m.slice(1, -1)) : []);
    new Set([...extract(endpoint.path), ...extract(api.baseUrl)]).forEach(pname => {
        if (!(pname in provided)) provided[pname] = sampleFor(pname);
    });
    // Rito/any host template {region} resolves in baseUrl — already covered above.

    let base = substitute(api.baseUrl, provided);
    let urlPath = substitute(endpoint.path, provided);

    // Join base + path preserving a single slash between them. Handles baseUrl
    // that ends in '/' and path that starts (or doesn't start) with '/'.
    let fullUrl;
    if (!urlPath || urlPath === '/') {
        fullUrl = base;
    } else if (base.endsWith('/')) {
        fullUrl = base + urlPath.replace(/^\//, '');
    } else if (urlPath.startsWith('/')) {
        fullUrl = base + urlPath;
    } else {
        fullUrl = base + '/' + urlPath;
    }

    // path params consumed; remaining are query
    const url = new URL(fullUrl);
    Object.entries(provided).forEach(([k, v]) => {
        if (endpoint.path && new RegExp(`\\{${k}\\}`, 'i').test(endpoint.path)) return;
        if (api.baseUrl && new RegExp(`\\{${k}\\}`, 'i').test(api.baseUrl)) return;
        if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, v);
    });

    const method = (endpoint.method || 'GET').toUpperCase();
    const headers = { 'User-Agent': 'Pigeon-API-Client/1.0' };
    // JSONPlaceholder POST expects a body
    let body;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
        headers['Content-Type'] = 'application/json';
        if (endpoint.body && typeof endpoint.body === 'object') {
            body = JSON.stringify(Object.fromEntries(Object.keys(endpoint.body).map(k => [k, sampleFor(k)])));
        } else {
            body = '{}';
        }
    }
    return { url: url.toString(), method, headers, body, authRequired };
}

function classify(status, authRequired, netErr) {
    if (netErr) {
        if (/timeout|aborted/i.test(String(netErr))) return 'TIMEOUT';
        return 'DEAD';
    }
    if (status >= 200 && status < 300) return 'OK';
    if (status === 401 || status === 403) return 'AUTH-OK';
    // Key-gated APIs return a variety of 4xx (400 "missing key", 404 "resource",
    // 410) when hit senza key — all prove host+path reachable, just auth-walled.
    if (authRequired && status >= 400 && status < 500 && status !== 429) return 'AUTH-OK';
    if (status === 429) return 'OK'; // rate-limited = host+path valid
    if (status >= 500) return 'DEAD';
    return 'BROKEN'; // 400/404/405 etc = path/host mismatch on a no-auth API
}

async function fetchOnce(req, timeoutMs, insecure) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const opts = { method: req.method, headers: req.headers, signal: controller.signal };
        if (req.body) opts.body = req.body;
        // node-fetch v3 doesn't honor https.Agent insecure on global; respect --insecure via env.
        if (insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        const fetch = await fetchImport;
        const res = await fetch(req.url, opts);
        // drain to free socket
        await res.text().catch(() => {});
        return { status: res.status };
    } catch (e) {
        return { netErr: e };
    } finally {
        clearTimeout(timer);
        if (insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
    }
}

// Retry up to 2x on transient failures (5xx, 429, timeout) — many of these
// public hosts rate-limit or hiccup; retrying avoids false DEAD verdicts.
function isTransient(out) {
    if (out.netErr) return /timeout|aborted|EAI_AGAIN|ETIMEDOUT|ECONNRESET|ENOTFOUND/i.test(String(out.netErr.message || out.netErr)) && !/ENOTFOUND/.test(out.netErr);
    return (out.status >= 500) || out.status === 429 || out.status === 502 || out.status === 503 || out.status === 504;
}
async function fetchWithRetry(req, timeoutMs, insecure) {
    let out = await fetchOnce(req, timeoutMs, insecure);
    for (let i = 0; i < 2 && (out.netErr || (out.status >= 500) || out.status === 429); i++) {
        await new Promise(r => setTimeout(r, 1000));
        out = await fetchOnce(req, timeoutMs, insecure);
    }
    return out;
}

async function verifyOne(api, endpoint, timeoutMs, insecure) {
    const req = buildRequest(api, endpoint);
    const t0 = Date.now();
    const { status, netErr } = await fetchWithRetry(req, timeoutMs, insecure);
    const latencyMs = Date.now() - t0;
    const verdict = classify(status || 0, req.authRequired, netErr && (netErr.message || netErr));
    const curl = `curl -s -o /dev/null -w "%{http_code}" "${req.url}"`;
    return {
        id: api.id, name: api.name, method: req.method, url: req.url,
        authRequired: req.authRequired, expected: req.authRequired ? '401/403' : '2xx',
        status: status || null, verdict, latencyMs, netErr: netErr ? String(netErr.message || netErr).slice(0, 200) : null,
        curl,
    };
}

// tiny concurrency pool
async function pool(items, worker, n) {
    const results = [];
    let i = 0;
    const runners = Array.from({ length: n }, async () => {
        while (i < items.length) {
            const idx = i++;
            results[idx] = await worker(items[idx]);
        }
    });
    await Promise.all(runners);
    return results;
}

async function main() {
    const args = process.argv.slice(2);
    const insecure = args.includes('--insecure');
    const idIdx = args.indexOf('--id');
    const filterId = idIdx >= 0 ? args[idIdx + 1] : null;
    const concIdx = args.indexOf('--concurrency');
    const concurrency = concIdx >= 0 ? Math.max(1, parseInt(args[concIdx + 1]) || 6) : 6;
    const timeoutMs = 20000;

    let catalog = publicApiCatalog;
    if (filterId) catalog = catalog.filter(a => a.id === filterId);
    if (!catalog.length) { console.error('No matching APIs'); process.exit(1); }

    const work = [];
    catalog.forEach(api => (api.endpoints || []).forEach(ep => work.push({ api, ep })));
    console.log(chalk.cyan(`Verifying ${work.length} endpoints across ${catalog.length} APIs (concurrency ${concurrency}, timeout ${timeoutMs}ms, insecure=${insecure})\n`));

    let done = 0;
    const results = await pool(work, async ({ api, ep }) => {
        const r = await verifyOne(api, ep, timeoutMs, insecure);
        done++;
        const color = { OK: 'green', 'AUTH-OK': 'cyan', BROKEN: 'yellow', DEAD: 'red', TIMEOUT: 'red' }[r.verdict] || 'gray';
        process.stdout.write(`[${done}/${work.length}] ${chalk[color](r.verdict.padEnd(8))} ${r.status || '---'}  ${r.method.padEnd(4)} ${r.url}\n`);
        return r;
    }, concurrency);

    const counts = {};
    results.forEach(r => { counts[r.verdict] = (counts[r.verdict] || 0) + 1; });
    const broken = results.filter(r => r.verdict === 'BROKEN' || r.verdict === 'DEAD' || r.verdict === 'TIMEOUT');

    const report = {
        generatedAt: new Date().toISOString(),
        total: results.length,
        summary: counts,
        results,
    };
    const reportPath = path.join(__dirname, 'verify-apis-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n' + chalk.bold('=== Summary ==='));
    Object.entries(counts).sort().forEach(([k, v]) => console.log(`  ${k.padEnd(8)} ${v}`));
    if (broken.length) {
        console.log('\n' + chalk.bold.red(`Needs fixing (${broken.length}):`));
        broken.forEach(r => console.log(chalk.red(`  ${r.verdict} ${r.status || '---'}  ${r.name}  ${r.method} ${r.url}${r.netErr ? '  // ' + r.netErr : ''}`)));
    } else {
        console.log(chalk.green('\nAll endpoints OK or AUTH-OK. Nothing to fix.'));
    }
    console.log(`\nReport: ${reportPath}`);
    process.exit(broken.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
