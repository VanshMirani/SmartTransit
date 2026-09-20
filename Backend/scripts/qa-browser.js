/* global window, document, innerWidth, sessionStorage */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { formatEventTime, stopTimeLabel, stopTimeSource } from '../../Frontend/src/utils/dateLabels.js';

const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5175';
const dataDirectory = process.env.QA_DATA_DIR;
if (new URL(base).hostname !== '127.0.0.1' || !dataDirectory?.includes('smarttransit-qa-'))
    throw new Error('Browser writes require the isolated qa-server and its QA_DATA_DIR.');
const apiBase = process.env.QA_API_URL;
if (apiBase && new URL(apiBase).hostname !== '127.0.0.1')
    throw new Error('Direct browser API checks require a loopback test API.');
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const runName = process.env.QA_RUN_NAME || '';
if (runName && !/^[a-zA-Z0-9-]+$/.test(runName)) throw new Error('QA_RUN_NAME must be a simple folder name.');
const output = path.resolve('docs/qa', runName);
await mkdir(output, { recursive: true });
const results = [], errors = [], limitations = [], consoleIssues = [], networkIssues = [];
let scenario = 'setup';
const contexts = [];
const check = async (name, action) => {
    scenario = name;
    try { await action(); results.push({ name, status: 'passed' }); console.log(`PASS ${name}`); }
    catch (error) { results.push({ name, status: 'failed', error: error.message }); console.log(`FAIL ${name}: ${error.message}`); throw error; }
};
async function pageFor(role, width = 1440) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, ignoreHTTPSErrors: base.startsWith('https:') });
    contexts.push(context);
    await context.addInitScript(() => {
        const watchers = new Map(); let id = 0;
        Object.defineProperty(navigator, 'geolocation', { value: {
            watchPosition: (success, error) => { watchers.set(++id, { success, error }); return id; },
            clearWatch: (key) => watchers.delete(key),
        } });
        window.__qaEmitGps = (point) => watchers.forEach(({ success }) => success({ timestamp: Date.now(), coords: { latitude: point[0], longitude: point[1], accuracy: 12, speed: 8, heading: 90 } }));
        window.__qaGpsError = (code) => watchers.forEach(({ error }) => error({ code }));
        window.__qaWatcherCount = () => watchers.size;
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push({ role, scenario, message: error.message, stack: error.stack }));
    page.on('console', (message) => {
        if (['error', 'warning'].includes(message.type()))
            consoleIssues.push({ role, scenario, type: message.type(), message: message.text().slice(0, 400) });
    });
    page.on('response', (response) => {
        if (response.status() >= 400) {
            const url = new URL(response.url());
            networkIssues.push({ role, scenario, status: response.status(), path: url.pathname });
        }
    });
    page.on('requestfailed', (request) => {
        const url = new URL(request.url());
        networkIssues.push({ role, scenario, path: url.pathname, failure: request.failure()?.errorText });
    });
    page.setDefaultTimeout(12000);
    if (role) await login(page, role);
    return page;
}
async function login(page, role, email, password) {
    await page.goto(`${base}/login`);
    await page.getByLabel('University email').fill(email || (role === 'student' ? 'student@iite.indusuni.ac.in' : `${role}@transport.indusuni.ac.in`));
    await page.getByLabel('Password', { exact: true }).fill(password || `${role[0].toUpperCase()}${role.slice(1)}@123`);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(`**/${role}`);
    await page.locator('h1:visible, h2:visible').first().waitFor();
}
async function api(page, route, body, method = body ? 'POST' : 'GET') {
    return page.evaluate(async ({ route, body, method, apiBase }) => {
        if (apiBase) {
            const response = await fetch(`${apiBase}${route}`, {
                method,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('smarttransit.authToken')}` },
                body: body ? JSON.stringify(body) : undefined,
            });
            const data = await response.json();
            return response.ok ? { ok: true, data } : { ok: false, status: response.status, message: data.message };
        }
        const { apiRequest } = await import('/src/services/apiClient.js');
        try { return { data: await apiRequest(route, { body, method }), ok: true }; }
        catch (error) { return { ok: false, status: error.status, message: error.message }; }
    }, { route, body, method, apiBase });
}
async function snapshot(page, filename) {
    await page.evaluate(() => document.fonts.ready);
    if (await page.locator('.leaflet-container').count()) {
        await page.waitForFunction(() => {
            const tiles = [...document.querySelectorAll('.leaflet-tile')];
            return tiles.some((tile) => tile.naturalWidth >= 256 && tile.src.startsWith('https:')) &&
                tiles.filter((tile) => tile.src.startsWith('https:')).every((tile) => tile.complete && tile.naturalWidth >= 256 && Number(window.getComputedStyle(tile).opacity) === 1);
        }, undefined, { timeout: 15000 }).catch(() => {
            const message = `Not all map tiles loaded at ${new URL(page.url()).pathname}`;
            limitations.push(message);
            console.log(`LIMITATION ${message}`);
        });
    }
    for (const drawing of await page.locator('.leaflet-overlay-pane > svg').all()) {
        const box = await drawing.boundingBox();
        assert.ok(box?.width > 200 && box?.height > 200, 'Map route drawing must not be shrunk by icon CSS');
    }
    await page.screenshot({ path: path.join(output, filename), fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
    assert.equal(overflow, false, `Page overflow at ${page.url()}`);
}
async function startTrip(page) {
    await page.goto(`${base}/driver/checklist`);
    await page.locator('.checklist-item').first().waitFor();
    for (const input of await page.getByRole('checkbox').all()) await input.check();
    await page.getByRole('button', { name: 'Start trip', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm & start' }).click();
    await page.waitForURL('**/driver/trip');
}

try {
    const publicPage = await pageFor(null);
    await check('Public desktop and mobile pages render without horizontal overflow', async () => {
        for (const width of [1440, 768, 390, 320]) {
            await publicPage.setViewportSize({ width, height: 900 });
            for (const route of ['/', '/login', '/signup', '/forgot-password', '/privacy', '/help']) {
                await publicPage.goto(`${base}${route}`);
                await publicPage.locator('h1:visible, h2:visible').first().waitFor();
                await snapshot(publicPage, `public-${route.replaceAll('/', '') || 'home'}-${width}.png`);
                if (route === '/') {
                    const nextStop = await publicPage.locator('.phone .next-stop').boundingBox();
                    const navigation = await publicPage.locator('.phone__nav').boundingBox();
                    assert.ok(nextStop.y + nextStop.height <= navigation.y + 1, 'Phone navigation must not cover the next stop');
                }
            }
        }
    });
    await check('Public support is accessible without login, and homepage makes no fake live claim', async () => {
        await publicPage.goto(base);
        await publicPage.getByText('Campus transport, connected.', { exact: true }).waitFor();
        const preview = publicPage.getByLabel('SmartTransit mobile application preview');
        assert.match(await preview.innerText(), /App preview/);
        assert.equal(await preview.locator('.live-pill').count(), 0, 'A floating badge must not overlap the preview heading');
        assert.doesNotMatch(await preview.innerText(), /Live now|9468|Aarav|17 \/ 50|8 min/);
        assert.doesNotMatch(await publicPage.locator('main').innerText(), /Ready to present|Backend-ready APIs|Accurate ETA/);
        if (base.startsWith('https:')) {
            const resources = await publicPage.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
            assert.equal(resources.some((url) => /\/assets\/(maps|charts)-.*\.js/.test(url)), false, 'Public homepage must not download dashboard maps/charts');
        }
        await publicPage.getByRole('link', { name: 'Open help center', exact: true }).click();
        await publicPage.waitForURL('**/help');
        await publicPage.reload();
        await publicPage.getByRole('heading', { name: 'Account and transport help' }).waitFor();
        await publicPage.getByText('Why is my student account pending?', { exact: true }).click();
        await publicPage.getByText(/Email verification confirms ownership/).waitFor({ state: 'visible' });
        assert.equal(await publicPage.getByRole('link', { name: 'Official contact details' }).getAttribute('href'), 'https://indusuni.ac.in/contact-us.php');
        await publicPage.getByRole('link', { name: 'Reset password', exact: true }).click();
        await publicPage.waitForURL('**/forgot-password');
        await publicPage.goBack();
        await publicPage.waitForURL('**/help');
        await publicPage.goto(`${base}/login`);
        await publicPage.getByRole('link', { name: 'Need help signing in?' }).click();
        await publicPage.waitForURL('**/help');
    });
    await check('Failed sign-in has readable recovery guidance and preserves input', async () => {
        await publicPage.goto(`${base}/login`);
        await publicPage.getByLabel('University email').fill('review@example.invalid');
        await publicPage.getByLabel('Password', { exact: true }).fill('Fictional-Review!9');
        await publicPage.route('**/auth/login', (route) => route.abort());
        await publicPage.getByRole('button', { name: 'Sign in', exact: true }).click();
        await publicPage.getByText(/Check your internet connection and try again/).waitFor();
        assert.equal(await publicPage.getByLabel('University email').inputValue(), 'review@example.invalid');
        assert.equal(await publicPage.getByRole('button', { name: 'Sign in', exact: true }).isEnabled(), true);
        await publicPage.unroute('**/auth/login');
    });
    const driver = await pageFor('driver'), conductor = await pageFor('conductor'), admin = await pageFor('admin'), student = await pageFor('student');
    if (base.startsWith('https:')) {
        await check('A failed dashboard download offers recovery and reload restores the page', async () => {
            const page = await pageFor('student');
            const chunk = '**/assets/LiveTrackingPage-*.js';
            await page.route(chunk, (route) => route.abort());
            await page.goto(`${base}/student/track`);
            await page.getByRole('heading', { name: 'This page could not be loaded' }).waitFor();
            assert.equal(await page.getByRole('link', { name: 'Get help', exact: true }).getAttribute('href'), '/help');
            await page.unroute(chunk);
            await page.getByRole('button', { name: 'Reload page', exact: true }).click();
            await page.getByRole('heading', { name: 'No active trip right now' }).waitFor();
            await page.context().close();
        });
    }
    if (!process.env.QA_PAGES_ONLY) {
    let trip, route;
    await check('Both emergency forms reject failed submissions without inventing a location', async () => {
        for (const [role, page] of [['driver', driver], ['conductor', conductor]]) {
            await page.goto(`${base}/${role}/emergency`);
            await page.getByText('No active trip', { exact: true }).waitFor();
            assert.doesNotMatch(await page.locator('.attached-location').innerText(), /Near |Current location attached/);
            await page.getByRole('button', { name: 'Breakdown', exact: false }).click();
            await page.getByLabel('Additional details', { exact: false }).fill('Isolated outage review');
            const attempts = [];
            await page.route('**/staff/emergencies', (route) => {
                attempts.push(route.request().postDataJSON());
                return attempts.length === 1
                    ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Unavailable"}' })
                    : route.abort();
            });
            for (let attempt = 0; attempt < 2; attempt += 1) {
                await page.getByRole('button', { name: 'Confirm & send alert' }).click();
                await page.getByText(/Alert submission was not confirmed/).waitFor();
                assert.equal(await page.getByLabel('Additional details', { exact: false }).inputValue(), 'Isolated outage review');
                assert.equal(await page.getByRole('heading', { name: 'Alert saved by server' }).count(), 0);
            }
            assert.equal(attempts.length, 2);
            assert.equal(attempts[0].id, attempts[1].id);
            assert.equal(attempts[0].coordinates, undefined);
            await snapshot(page, `${role}-emergency-outage.png`);
            await page.unroute('**/staff/emergencies');
        }
    });
    await check('Separate role sessions and direct API role rejection', async () => {
        assert.equal((await api(student, '/admin/bootstrap')).status, 403);
        assert.equal((await api(conductor, '/driver/trips/current')).status, 403);
        const current = (await api(driver, '/driver/trips/current')).data;
        trip = current.activeStaffTrip;
        route = current.operationalStops;
        assert.equal((await api(conductor, '/conductor/trips/current')).data.activeStaffTrip.id, trip.id);
        await student.goto(`${base}/admin`);
        await student.waitForURL('**/unauthorized');
        await student.goto(`${base}/student`);
    });
    await check('Outbound start, simulated phone GPS upload and cross-user passenger updates', async () => {
        await startTrip(driver);
        const starting = (await api(driver, '/driver/trips/current')).data;
        const actualStart = starting.activeStaffTrip.startedAt;
        assert.equal(starting.operationalStops[0].departureEstimateAt, actualStart);
        await driver.goto(`${base}/driver`);
        await driver.getByText(`Started ${formatEventTime(actualStart)}`, { exact: false }).waitFor();
        await conductor.goto(`${base}/conductor`);
        await conductor.getByText(`Started ${formatEventTime(actualStart)}`, { exact: false }).waitFor();
        await student.goto(`${base}/student/routes`);
        await student.getByRole('heading', { name: 'Actual departure', exact: true }).waitFor();
        assert.equal(await student.locator('.route-side > section').nth(1).locator('strong').innerText(), formatEventTime(actualStart));
        const refreshTimes = await student.locator('.timeline-stop time').allTextContents();
        await student.reload();
        await student.getByRole('heading', { name: 'Actual departure', exact: true }).waitFor();
        assert.deepEqual(await student.locator('.timeline-stop time').allTextContents(), refreshTimes);
        await snapshot(student, 'actual-departure-plan.png');
        await admin.goto(`${base}/admin/live`);
        await admin.getByRole('textbox', { name: 'Search live fleet' }).fill(starting.activeStaffTrip.routeCode);
        await admin.getByText(`Started ${formatEventTime(actualStart)}`, { exact: false }).waitFor();
        await driver.goto(`${base}/driver/trip`);
        await driver.waitForFunction(() => window.__qaWatcherCount() > 0);
        await driver.locator('.driver-stop small').first().waitFor();
        assert.deepEqual(await driver.locator('.driver-stop small').allTextContents(),
            starting.operationalStops.slice(1, 5).map((stop) => `Start-based estimate · ${formatEventTime(stop.departureEstimateAt)}`));
        const locationSaved = driver.waitForResponse((response) => response.url().endsWith('/location') && response.request().method() === 'POST');
        await driver.evaluate((point) => window.__qaEmitGps(point), route[0].coordinates);
        const afterGps = await (await locationSaved).json();
        await driver.getByText('GPS Active', { exact: true }).waitFor();
        assert.deepEqual(afterGps.operationalStops.map((stop) => stop.departureEstimateAt),
            starting.operationalStops.map((stop) => stop.departureEstimateAt));
        assert.deepEqual(await driver.locator('.driver-stop small').allTextContents(),
            afterGps.operationalStops.slice(1, 5).map((stop) => `${stopTimeSource(stop)} · ${stopTimeLabel(stop)}`));
        await conductor.goto(`${base}/conductor/trip`);
        const increase = conductor.getByRole('button', { name: 'Increase Boarded students' });
        await increase.waitFor();
        for (let i = 0; i < 3; i += 1) await increase.click();
        const seatsSaved = conductor.waitForResponse((response) => response.url().endsWith('/seat-updates') && response.request().method() === 'POST');
        await conductor.getByRole('button', { name: 'Submit seat update' }).click();
        const afterSeats = await (await seatsSaved).json();
        await conductor.getByText('Seat update confirmed', { exact: true }).waitFor();
        assert.deepEqual(afterSeats.operationalStops.map((stop) => stop.departureEstimateAt),
            starting.operationalStops.map((stop) => stop.departureEstimateAt));
        const seatStopTimes = await conductor.locator('.conductor-stop small').allTextContents();
        for (const [index, stop] of afterSeats.operationalStops.entries()) {
            assert.ok(seatStopTimes[index].startsWith(`${stopTimeSource(stop)} · ${stopTimeLabel(stop)}`));
        }
        const data = (await api(student, '/student/transit')).data;
        assert.equal(data.bus.occupiedSeats, 3);
        assert.equal(data.bus.tripActive, true);
        assert.equal(data.bus.gpsStatus, 'live');
        await student.goto(`${base}/student/track`);
        await student.locator('.leaflet-container').waitFor();
        await snapshot(student, 'student-live-tracking.png');
        await snapshot(conductor, 'conductor-confirmed-seats.png');
    });
    await check('Passenger changes reach open student and admin dashboards through polling', async () => {
        await student.goto(`${base}/student`);
        await student.locator('.assigned-bus-card').waitFor();
        const before = (await api(student, '/student/transit')).data.bus;
        await conductor.getByRole('button', { name: 'Increase Boarded students' }).click();
        await conductor.getByRole('button', { name: 'Submit seat update' }).click();
        await conductor.getByText('Seat update confirmed', { exact: true }).waitFor();
        const available = before.capacity - before.occupiedSeats - 1;
        await student.locator('.assigned-bus-card__stats > div').nth(1).getByText(`${available} / ${before.capacity}`, { exact: true }).waitFor({ timeout: 40000 });
        await admin.locator('.live-detail-grid').getByText(`${before.occupiedSeats + 1} / ${before.capacity}`, { exact: true }).waitFor({ timeout: 20000 });
        await conductor.getByRole('button', { name: 'Increase Deboarded students' }).click();
        await conductor.getByRole('button', { name: 'Submit seat update' }).click();
        await conductor.getByText('Seat update confirmed', { exact: true }).waitFor();
        assert.equal((await api(student, '/student/transit')).data.bus.occupiedSeats, before.occupiedSeats);
    });
    await check('Student internet loss immediately removes live GPS and live ETA labels', async () => {
        await student.goto(`${base}/student/track`);
        await student.locator('.gps-chip--live').waitFor();
        const timestamp = await student.locator('.map-updated').innerText();
        await student.context().setOffline(true);
        try {
            await student.locator('.gps-chip--live').waitFor({ state: 'detached', timeout: 3000 });
            assert.equal(await student.getByText('GPS estimate', { exact: true }).count(), 0);
            assert.equal(await student.locator('.map-updated').innerText(), timestamp);
            assert.equal(await student.evaluate(() => Boolean(sessionStorage.getItem('smarttransit.authToken'))), true);
            await snapshot(student, 'tracking-offline.png');
        } finally {
            await student.context().setOffline(false);
        }
        await student.locator('.gps-chip--live').waitFor();
        assert.equal(await student.locator('.map-updated').innerText(), timestamp);
    });
    await check('Emergency server failure preserves details; accepted-but-lost response retries once', async () => {
        await driver.goto(`${base}/driver/emergency`);
        await driver.getByRole('button', { name: 'Breakdown', exact: false }).click();
        await driver.getByLabel('Additional details', { exact: false }).fill('Isolated QA breakdown');
        await driver.route('**/staff/emergencies', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"QA service unavailable"}' }));
        await driver.getByRole('button', { name: 'Confirm & send alert' }).click();
        await driver.getByText(/Alert submission was not confirmed/).waitFor();
        assert.equal(await driver.getByLabel('Additional details', { exact: false }).inputValue(), 'Isolated QA breakdown');
        assert.equal(await driver.getByText('Alert saved by server', { exact: true }).count(), 0);
        await snapshot(driver, 'emergency-failed.png');
        await driver.unroute('**/staff/emergencies');
        await driver.route('**/staff/emergencies', async (route) => { await route.fetch(); await route.abort('failed'); });
        await driver.getByRole('button', { name: 'Confirm & send alert' }).click();
        await driver.getByText(/Alert submission was not confirmed/).waitFor();
        await driver.unroute('**/staff/emergencies');
        await driver.getByRole('button', { name: 'Confirm & send alert' }).click();
        await driver.getByText('Alert saved by server', { exact: true }).waitFor();
        assert.equal((await api(driver, '/driver/trips/current')).data.emergencies.length, 1);
        await snapshot(driver, 'emergency-confirmed.png');
    });
    await check('Seat update accepted with lost response retries without counting twice', async () => {
        await conductor.getByRole('button', { name: 'Increase Boarded students' }).click();
        await conductor.route('**/seat-updates', async (route) => { await route.fetch(); await route.abort('failed'); });
        await conductor.getByRole('button', { name: 'Submit seat update' }).click();
        await conductor.locator('[role="alert"]').first().waitFor();
        await conductor.unroute('**/seat-updates');
        await conductor.getByRole('button', { name: 'Submit seat update' }).click();
        await conductor.getByText('Seat update confirmed', { exact: true }).waitFor();
        assert.equal((await api(student, '/student/transit')).data.bus.occupiedSeats, 4);
    });
    await check('GPS permission and upload errors do not show active synchronization', async () => {
        await driver.goto(`${base}/driver/trip`);
        await driver.waitForFunction(() => window.__qaWatcherCount() > 0);
        await driver.evaluate(() => window.__qaGpsError(1));
        await driver.locator('.driver-gps-notice').getByText(/Location access is blocked/).waitFor();
        assert.equal(await driver.locator('.staff-page-heading .staff-status--active').count(), 0);
        await driver.getByRole('button', { name: 'Retry GPS', exact: true }).click();
        await driver.waitForFunction(() => window.__qaWatcherCount() === 1);
        await driver.route('**/location', (route) => route.abort());
        await driver.evaluate((point) => window.__qaEmitGps(point), route[0].coordinates);
        await driver.locator('.driver-gps-notice').getByText(/upload was not confirmed/).waitFor();
        await driver.unroute('**/location');
        await snapshot(driver, 'gps-upload-failed.png');
    });
    await check('Temporary session verification failure preserves token and blocks unverified access', async () => {
        await student.route('**/auth/session', (route) => route.abort());
        await student.reload();
        await student.getByRole('heading', { name: 'Unable to verify your session' }).waitFor();
        assert.equal(await student.evaluate(() => Boolean(sessionStorage.getItem('smarttransit.authToken'))), true);
        assert.equal(await student.locator('.student-app').count(), 0);
        await snapshot(student, 'session-reconnecting.png');
        await student.unroute('**/auth/session');
        await student.getByRole('button', { name: 'Retry connection' }).click();
        await student.locator('.student-app').waitFor();
        await student.route('**/auth/session', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Temporarily unavailable"}' }));
        await student.reload();
        await student.getByRole('heading', { name: 'Unable to verify your session' }).waitFor();
        assert.equal(await student.evaluate(() => Boolean(sessionStorage.getItem('smarttransit.authToken'))), true);
        assert.equal(await student.locator('.student-app').count(), 0);
        await student.unroute('**/auth/session');
        await student.getByRole('button', { name: 'Retry connection' }).click();
        await student.locator('.student-app').waitFor();
        await student.route('**/auth/session', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"Revoked"}' }));
        await student.reload();
        await student.waitForURL('**/login');
        await student.unroute('**/auth/session');
        await login(student, 'student');
    });
    await check('Trip completion then distinct return journey clears GPS and occupancy', async () => {
        await driver.getByRole('button', { name: 'End trip', exact: true }).click();
        await driver.getByRole('button', { name: 'Confirm end trip' }).click();
        await driver.waitForURL('**/driver');
        assert.equal(await driver.evaluate(() => window.__qaWatcherCount()), 0);
        await driver.getByRole('button', { name: 'Return trip', exact: true }).click();
        await startTrip(driver);
        const current = (await api(driver, '/driver/trips/current')).data;
        assert.notEqual(current.activeStaffTrip.id, trip.id);
        assert.equal(current.activeStaffTrip.occupiedSeats, 0);
        assert.equal(current.liveLocation, null);
        assert.match(current.operationalStops[0].name, /Indus/);
        await admin.goto(`${base}/admin/live`);
        await admin.locator('.admin-last-updated').getByText('Waiting for driver GPS', { exact: true }).waitFor();
        await conductor.goto(`${base}/conductor/trip`);
        await conductor.getByRole('button', { name: 'Increase Boarded students' }).click();
        await conductor.getByRole('button', { name: 'Submit seat update' }).click();
        await conductor.getByText('Seat update confirmed', { exact: true }).waitFor();
        assert.equal((await api(student, '/student/transit')).data.bus.occupiedSeats, 1);
        const returnStopTimes = await conductor.locator('.conductor-stop small').allTextContents();
        for (const [index, stop] of current.operationalStops.entries()) {
            assert.ok(returnStopTimes[index].startsWith(`Start-based estimate · ${formatEventTime(stop.departureEstimateAt)}`));
        }
        await snapshot(conductor, 'return-departure-plan-after-seats.png');
        await snapshot(driver, 'return-trip.png');
    });
    await check('Browser registration, captured test mail, pending state and administrator approval', async () => {
        const applicant = await pageFor(null);
        await applicant.goto(`${base}/signup`);
        await applicant.getByLabel('Full name', { exact: true }).fill('QA Applicant');
        await applicant.getByLabel('Institute email', { exact: true }).fill('qa.audit@iite.indusuni.ac.in');
        await applicant.getByLabel('Mobile number', { exact: true }).fill('9000000001');
        await applicant.getByLabel('Create password', { exact: true }).fill('AuditStudent@123');
        await applicant.getByLabel('Confirm password', { exact: true }).fill('AuditStudent@123');
        await applicant.getByRole('checkbox').check();
        await applicant.getByRole('button', { name: 'Send OTP', exact: true }).click();
        await applicant.getByLabel('Email OTP', { exact: true }).waitFor();
        const mailbox = JSON.parse(await readFile(path.join(dataDirectory, 'mailbox.json'), 'utf8'));
        await applicant.getByLabel('Email OTP', { exact: true }).fill(mailbox['qa.audit@iite.indusuni.ac.in']);
        await applicant.locator('button[type="submit"]').click();
        await applicant.getByText(/Account created/i).first().waitFor();
        await login(applicant, 'student', 'qa.audit@iite.indusuni.ac.in', 'AuditStudent@123');
        await applicant.getByText('Your account is pending admin approval.', { exact: true }).waitFor();
        assert.equal((await api(applicant, '/student/transit')).data.route.stops.length, 0);
        assert.equal((await api(applicant, '/admin/bootstrap')).status, 403);
        const records = (await api(admin, '/admin/bootstrap')).data.records.students;
        const record = records.find((item) => item.contact === 'qa.audit@iite.indusuni.ac.in');
        assert.ok(record);
        await admin.goto(`${base}/admin/students`);
        await admin.getByLabel('Search students', { exact: true }).fill('QA Applicant');
        await admin.getByRole('button', { name: 'Edit QA Applicant' }).click();
        await admin.getByRole('combobox', { name: 'Assigned route', exact: true }).selectOption(trip.routeCode);
        await admin.getByRole('combobox', { name: 'Pickup stop', exact: true }).selectOption(route[0].id);
        await admin.getByRole('combobox', { name: 'Status', exact: true }).selectOption('active');
        await admin.getByRole('button', { name: 'Save student', exact: true }).click();
        await admin.getByText('QA Applicant was saved successfully.').waitFor();
        await applicant.reload();
        await applicant.getByText('Your assigned bus', { exact: true }).waitFor();
        await snapshot(applicant, 'approved-student.png');
        await check('Password reset accepts captured test OTP and revokes the existing session', async () => {
            const reset = await pageFor(null);
            await reset.goto(`${base}/forgot-password`);
            await reset.getByLabel('Institute email', { exact: true }).fill('qa.audit@iite.indusuni.ac.in');
            await reset.getByRole('button', { name: 'Send reset OTP', exact: true }).click();
            await reset.getByLabel('Email OTP', { exact: true }).waitFor();
            const mail = JSON.parse(await readFile(path.join(dataDirectory, 'mailbox.json'), 'utf8'));
            await reset.getByLabel('Email OTP', { exact: true }).fill(mail['qa.audit@iite.indusuni.ac.in']);
            await reset.getByLabel('New password', { exact: true }).fill('AuditChanged@456');
            await reset.getByLabel('Confirm new password', { exact: true }).fill('AuditChanged@456');
            await reset.getByRole('button', { name: 'Reset password', exact: true }).click();
            await reset.getByRole('heading', { name: 'Password updated', exact: true }).waitFor();
            await snapshot(reset, 'password-reset-complete.png');
            await applicant.reload();
            await applicant.waitForURL('**/login');
            await login(reset, 'student', 'qa.audit@iite.indusuni.ac.in', 'AuditChanged@456');
            await reset.getByText('Your assigned bus', { exact: true }).waitFor();
        });
    });
    await check('Complaint submission, admin resolution, and independent student refresh', async () => {
        await student.goto(`${base}/student/complaints`);
        await student.getByRole('button', { name: /Raise.*complaint|New complaint/i }).click();
        await student.getByRole('combobox', { name: 'Category *', exact: true }).selectOption('General feedback');
        await student.getByLabel('Subject *', { exact: true }).fill('QA transport request');
        await student.getByLabel('Description *', { exact: true }).fill('Isolated browser audit complaint.');
        await student.getByRole('button', { name: 'Submit complaint', exact: true }).click();
        await student.getByText('QA transport request', { exact: true }).waitFor();
        const saved = { ok: true, data: (await api(student, '/student/complaints')).data.find((item) => item.subject === 'QA transport request') };
        assert.equal(saved.ok, true);
        await admin.goto(`${base}/admin/complaints`);
        await admin.getByLabel('Search complaints', { exact: true }).fill('QA transport request');
        await admin.getByText('QA transport request', { exact: true }).first().click();
        await admin.getByLabel('Resolution reply', { exact: true }).fill('Resolved in isolated QA.');
        await admin.getByRole('button', { name: 'Mark as resolved' }).click();
        await admin.getByText('Complaint resolved', { exact: true }).waitFor();
        const list = (await api(student, '/communications/bootstrap')).data.complaints;
        assert.equal(list.find((item) => item.id === saved.data.id).status, 'resolved');
        assert.equal(list.find((item) => item.id === saved.data.id).internalNotes, undefined);
        await student.goto(`${base}/student/complaints`);
        await student.getByText('QA transport request', { exact: true }).waitFor();
    });
    await check('Map imagery failure is distinct from GPS failure and offers a working retry', async () => {
        await student.route('https://tile.openstreetmap.org/**', (route) => route.abort());
        await student.goto(`${base}/student/track`);
        await student.getByText('Some map imagery could not load. Location updates are separate.').waitFor();
        await student.unroute('https://tile.openstreetmap.org/**');
        await student.getByRole('button', { name: 'Retry map', exact: true }).click();
        await snapshot(student, 'map-recovered.png');
        assert.equal(await student.getByRole('button', { name: 'Retry map', exact: true }).count(), 0);
    });
    await check('Student preferences persist and failed saves never show success', async () => {
        await student.goto(`${base}/student/profile`);
        await student.getByRole('checkbox', { name: 'Delay alerts' }).uncheck();
        await student.route('**/student/preferences', (route) => route.request().method() === 'PATCH' ? route.abort() : route.continue());
        await student.getByRole('button', { name: 'Save preferences' }).click();
        await student.getByText('Preferences were not saved. Please retry.').waitFor();
        assert.equal(await student.getByText('Preferences saved', { exact: true }).count(), 0);
        await student.unroute('**/student/preferences');
        await student.getByRole('button', { name: 'Save preferences' }).click();
        await student.getByText('Preferences saved', { exact: true }).waitFor();
        await student.reload();
        await student.getByRole('checkbox', { name: 'Delay alerts' }).waitFor();
        assert.equal((await api(student, '/student/preferences')).data.delay, false);
    });
    }
    await check('All role routes at desktop and mobile widths', async () => {
        const pages = {
            student: [student, ['', 'track', 'routes', 'alerts', 'complaints', 'profile', 'help']],
            driver: [driver, ['', 'checklist', 'trip', 'emergency', 'history', 'profile']],
            conductor: [conductor, ['', 'trip', 'emergency', 'history', 'profile']],
            admin: [admin, ['', 'live', 'buses', 'routes', 'stops', 'drivers', 'conductors', 'students', 'assignments', 'notifications', 'complaints', 'reports', 'settings', 'settings/states', 'search']],
        };
        for (const [role, [page, paths]] of Object.entries(pages)) {
            for (const width of [1440, 390]) {
                await page.setViewportSize({ width, height: 900 });
                for (const route of paths) {
                    await page.goto(`${base}/${role}${route ? `/${route}` : ''}`);
                    await page.locator('h1').first().waitFor();
                    await snapshot(page, `${role}-${route.replaceAll('/', '-') || 'home'}-${width}.png`);
                    if (role === 'student' && ['', 'routes', 'profile'].includes(route)) {
                        const transit = (await api(page, '/student/transit')).data;
                        const returning = transit.route.direction === 'return';
                        const active = transit.bus.tripActive;
                        if (!route) {
                            const stop = transit.route.stops.find((item) => item.id === transit.route.selectedStopId);
                            await page.getByText(active ? stopTimeSource(stop) : returning ? 'Scheduled drop-off' : 'Scheduled pickup', { exact: true }).first().waitFor();
                            assert.equal(await page.getByText('Traffic update', { exact: true }).count(), 0);
                            assert.equal(await page.getByText(/ETA already includes the delay/).count(), 0);
                            const gpsLive = transit.bus.tripActive && transit.bus.gpsStatus === 'live' && Boolean(transit.bus.lastLocationAt);
                            assert.equal(await page.locator('[data-gps-live]').getAttribute('data-gps-live'), String(Boolean(gpsLive)));
                        } else if (route === 'routes') {
                            await page.getByRole('heading', { name: active ? 'Actual departure' : returning ? 'Return departure' : 'Morning departure', exact: true }).waitFor();
                            const departure = page.locator('.route-side > section').nth(1).locator('strong');
                            assert.equal(await departure.innerText(), active ? formatEventTime(transit.route.startedAt) : transit.route.stops[0].scheduledTime);
                            await page.getByText(active ? stopTimeSource(transit.route.stops.at(-1)) : returning ? 'Final stop arrival' : 'Campus arrival', { exact: true }).first().waitFor();
                            assert.equal(await page.getByText('ETA ETA unavailable', { exact: true }).count(), 0);
                        } else {
                            await page.getByText(returning ? 'Drop-off stop' : 'Pickup stop', { exact: true }).waitFor();
                        }
                    }
                }
            }
        }
        assert.deepEqual(errors, []);
    });
    await check('Mobile role navigation, browser back, and GPS cleanup on logout', async () => {
        for (const [role, page] of [['student', student], ['driver', driver], ['conductor', conductor], ['admin', admin]]) {
            await page.goto(`${base}/${role}`);
            await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
            const nav = page.getByRole('navigation', { name: `${role === 'admin' ? 'Admin' : role[0].toUpperCase() + role.slice(1)} navigation`, exact: true });
            const link = nav.getByRole('link').nth(1);
            const href = await link.getAttribute('href');
            await link.click();
            await page.waitForURL(`**${href}`);
            await page.goBack();
            await page.waitForURL(`**/${role}`);
        }
        await driver.getByRole('button', { name: 'Open navigation', exact: true }).click();
        await driver.getByRole('button', { name: 'Log out', exact: true }).click();
        await driver.waitForURL('**/login');
        assert.equal(await driver.evaluate(() => window.__qaWatcherCount()), 0);
    });
    await check('Rapid map navigation leaves no delayed browser exceptions', async () => {
        await student.setViewportSize({ width: 390, height: 900 });
        for (let attempt = 0; attempt < 3; attempt += 1) {
            await student.goto(`${base}/student`);
            await student.getByRole('link', { name: 'Track', exact: true }).last().click();
            await student.locator('.leaflet-container').waitFor();
            await student.getByRole('link', { name: 'Home', exact: true }).last().click();
            await student.waitForURL('**/student');
        }
        // Leaflet transition fallbacks finish asynchronously after a map unmounts.
        await student.waitForTimeout(500);
        assert.deepEqual(errors, []);
    });
}
finally {
    for (const context of contexts) await context.close();
    await writeFile(path.join(output, process.env.QA_PAGES_ONLY ? 'browser-pages-results.json' : 'browser-results.json'), JSON.stringify({ results, pageErrors: errors, limitations, consoleIssues, networkIssues }, null, 2));
    await browser.close();
}
assert.deepEqual(errors, [], 'Browser errors occurred during navigation or teardown');
