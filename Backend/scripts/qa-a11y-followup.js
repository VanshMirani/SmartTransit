/* global document, window */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.QA_BASE_URL;
if (new URL(base).hostname !== '127.0.0.1' || !process.env.QA_DATA_DIR?.includes('smarttransit-qa-'))
    throw new Error('Only the disposable local QA server is permitted.');
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const output = path.resolve('docs/qa/2026-09-25-a11y-final');
await mkdir(output, { recursive: true });
const results = [];
try {
    for (const [role, route, region, axis] of [
        ['conductor', '/conductor', 'Stop progress', 'scrollLeft'],
        ['admin', '/admin/simulator', 'Simulated stop arrivals', 'scrollTop'],
    ]) {
        const page = await browser.newPage({ viewport: { width: 320, height: 740 } });
        await page.goto(`${base}/login`);
        await page.getByLabel('University email').fill(`${role}@transport.indusuni.ac.in`);
        await page.getByLabel('Password', { exact: true }).fill(`${role[0].toUpperCase()}${role.slice(1)}@123`);
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await page.waitForURL(`**/${role}`);
        await page.goto(`${base}${route}`);
        const stops = page.getByRole('region', { name: region, exact: true });
        await stops.waitFor();
        assert.equal(await stops.getAttribute('tabindex'), '0');
        await stops.focus();
        await page.keyboard.press(axis === 'scrollLeft' ? 'ArrowRight' : 'ArrowDown');
        await page.waitForFunction(({ name, axis }) => [...document.querySelectorAll('[role="region"], section')].find((element) => element.getAttribute('aria-label') === name)?.[axis] > 0, { name: region, axis });
        for (const width of [320, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            await page.addScriptTag({ path: process.env.QA_AXE_PATH });
            const result = await page.evaluate(async () => {
                const { violations, incomplete } = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
                return { violations, incomplete: incomplete.map(({ id }) => id) };
            });
            await page.screenshot({ path: path.join(output, `${role}-${width}.png`), fullPage: true });
            results.push({ route, width, ...result });
            assert.deepEqual(result.violations, []);
        }
        await page.getByRole('button', { name: 'Log out', exact: true }).click();
        await page.close();
    }
    console.log('PASS both stop lists are keyboard-scrollable; four focused axe scans have zero violations');
} finally {
    await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    await browser.close();
}
