import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build, preview } from 'vite';

// An intentionally unconfigured production build. Never loads local secrets or a database.
const directory = await mkdtemp(path.join(tmpdir(), 'smarttransit-qa-public-'));
const config = {
    root: path.resolve('Frontend'), envDir: directory,
    define: { 'import.meta.env.VITE_USE_BACKEND': '"true"', 'import.meta.env.VITE_API_BASE_URL': '""' },
    build: { outDir: path.join(directory, 'dist'), emptyOutDir: true },
};
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE || 'playwright');
const runName = process.env.QA_RUN_NAME || '2026-09-20-public-config';
if (!/^[a-zA-Z0-9-]+$/.test(runName)) throw new Error('QA_RUN_NAME must be a simple folder name.');
const output = path.resolve('docs/qa', runName);
await mkdir(output, { recursive: true });
let server, browser;
const errors = [];
try {
    await build(config);
    server = await preview({ ...config, preview: { host: '127.0.0.1', port: 0, strictPort: true } });
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 320, height: 844 } });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/student`);
    await page.getByRole('heading', { name: 'Transport service unavailable' }).waitFor();
    assert.equal(await page.locator('.student-app').count(), 0);
    await page.screenshot({ path: path.join(output, 'missing-configuration.png') });
    await page.getByRole('link', { name: 'Get account help' }).click();
    await page.waitForURL('**/help');
    await page.getByRole('heading', { name: 'Account and transport help' }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: 'Account and transport help' }).waitFor();
    await page.getByRole('link', { name: 'Privacy information' }).click();
    await page.getByRole('heading', { name: 'Your commute data stays trip-bound and role-protected.' }).waitFor();
    assert.deepEqual(errors, []);
    const result = { status: 'passed', configuration: 'Missing API URL, production bundle', checks: ['Protected service fails closed', 'Public help accessible and refreshable', 'Privacy accessible'], pageErrors: errors };
    await writeFile(path.join(output, 'public-config-results.json'), JSON.stringify(result, null, 2));
    console.log('PASS missing production configuration blocks transport access but preserves public help and privacy');
} finally {
    await browser?.close();
    if (server) await new Promise((resolve) => server.httpServer.close(resolve));
}
