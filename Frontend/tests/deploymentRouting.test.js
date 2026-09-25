import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('SPA fallback preserves page deep links but excludes API and missing asset paths', () => {
    const configuration = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
    const fallback = configuration.rewrites.find((rule) => rule.destination === '/index.html');
    const matches = new RegExp(`^${fallback.source}$`);
    for (const path of ['/', '/login', '/student/track', '/driver/trip', '/admin/routes', '/unknown-page'])
        assert.ok(matches.test(path), `Page ${path} needs client routing`);
    for (const path of ['/api', '/api/', '/api/unknown', '/assets/missing.js', '/assets/missing.css'])
        assert.equal(matches.test(path), false, `${path} must not become a successful HTML page`);
});
