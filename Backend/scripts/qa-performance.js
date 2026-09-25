/* global document, window */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.QA_BASE_URL;
const runName = process.env.QA_RUN_NAME;
if (!base || new URL(base).hostname !== '127.0.0.1' || !/^[a-zA-Z0-9-]+$/.test(runName ?? ''))
    throw new Error('Performance samples require a named, isolated loopback preview.');
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
    for (const width of [390, 1366]) {
        for (const route of ['/', '/login']) {
            for (let sample = 1; sample <= 3; sample += 1) {
                const context = await browser.newContext({ viewport: { width, height: 900 }, ignoreHTTPSErrors: base.startsWith('https:') });
                await context.addInitScript(() => {
                    window.__qaPerformance = { lcp: null, cls: 0 };
                    new PerformanceObserver((list) => {
                        window.__qaPerformance.lcp = list.getEntries().at(-1)?.startTime ?? null;
                    }).observe({ type: 'largest-contentful-paint', buffered: true });
                    new PerformanceObserver((list) => {
                        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__qaPerformance.cls += entry.value;
                    }).observe({ type: 'layout-shift', buffered: true });
                });
                const page = await context.newPage();
                await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
                await page.locator('h1:visible, h2:visible').first().waitFor();
                await page.evaluate(() => document.fonts.ready);
                const metrics = await page.evaluate(() => {
                    const navigation = performance.getEntriesByType('navigation')[0];
                    const resources = performance.getEntriesByType('resource');
                    return {
                        domContentLoadedMs: navigation.domContentLoadedEventEnd,
                        firstContentfulPaintMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
                        largestContentfulPaintMs: window.__qaPerformance.lcp,
                        observedLayoutShift: window.__qaPerformance.cls,
                        resourceCount: resources.length,
                        observedTransferBytes: resources.reduce((sum, entry) => sum + entry.transferSize, 0),
                        loadedProtectedMapsOrCharts: resources.some((entry) => /\/assets\/(maps|charts)-.*\.js/.test(entry.name)),
                    };
                });
                results.push({ route, width, sample, ...metrics });
                await context.close();
            }
        }
    }
} finally { await browser.close(); }
const output = path.resolve('docs/qa', runName);
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'performance-samples.json'), JSON.stringify({
    checkedAt: new Date().toISOString(),
    conditions: 'Local production build, installed headless Chrome, fresh context per sample, no CPU/network throttling; other QA may run concurrently. Resource timing can omit cross-origin transfer sizes. Not Lighthouse, field Web Vitals, mobile hardware, or load capacity.',
    results,
}, null, 2));
console.log(`Recorded ${results.length} local public-page performance samples.`);
