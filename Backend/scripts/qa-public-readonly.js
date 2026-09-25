import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Public GETs only. No credentials, account access, or production mutations.
const site = 'https://smart-transit-lyart.vercel.app';
const api = 'https://smarttransit-api-0c4n.onrender.com/api';
const output = path.resolve('docs/qa/2026-09-25-readonly');
const headers = ['content-type', 'cache-control', 'strict-transport-security', 'x-content-type-options',
    'referrer-policy', 'permissions-policy', 'content-security-policy', 'content-security-policy-report-only',
    'x-robots-tag', 'access-control-allow-origin'];
const results = [];
for (const [url, expected] of [
    [site, 200], [`${site}/login`, 200], [`${site}/student/track`, 200],
    [`${site}/qa-not-a-real-page`, 200], [`${site}/favicon.svg`, 200], [`${site}/site.webmanifest`, 200],
    [`${site}/brand/smarttransit-indus-logo.jpeg`, 200], [`${api}/health`, 200],
    [`${api}/auth/session`, 401], [`${api}/student/transit`, 401], [`${api}/admin/bootstrap`, 401],
]) {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000), headers: { Origin: site } });
    const result = { url, status: response.status, expected, headers: Object.fromEntries(headers.map((name) => [name, response.headers.get(name)])) };
    if (url.endsWith('/site.webmanifest')) {
        const manifest = await response.json();
        result.manifest = { name: manifest.name, start_url: manifest.start_url, icons: manifest.icons };
    } else if (url === site) {
        const html = await response.text();
        result.socialImage = html.match(/property="og:image"\s+content="([^"]+)"/)?.[1];
    } else await response.arrayBuffer();
    results.push(result);
    console.log(`${response.status === expected ? 'PASS' : 'FAIL'} ${url}: ${response.status}`);
}
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'public-http.json'), JSON.stringify({ checkedAt: new Date().toISOString(), note: 'SPA unknown paths return HTTP 200; this is distinct from the rendered 404 screen.', results }, null, 2));
assert.ok(results.every((item) => item.status === item.expected));
