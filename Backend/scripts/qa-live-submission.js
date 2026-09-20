import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Explicitly authorized API-only verification. Never loads .env, guesses passwords or touches pre-existing records.
const base = process.env.QA_API_BASE;
const target = new URL(base || 'http://invalid');
const local = ['127.0.0.1', 'localhost'].includes(target.hostname);
if (!local && (base !== 'https://smarttransit-api-0c4n.onrender.com/api' || process.env.QA_LIVE_CONFIRM !== 'disposable-records-only'))
    throw new Error('Supply the authorized API and QA_LIVE_CONFIRM=disposable-records-only for live writes.');
if (!process.env.QA_ADMIN_EMAIL || !process.env.QA_ADMIN_PASSWORD) throw new Error('QA_ADMIN_EMAIL and QA_ADMIN_PASSWORD are required.');
const prefix = `qa-${randomUUID()}`;
const checks = [];
const created = [];
const tokens = [];
let admin;
let route;
let failed = false;
let cleanupFailed = false;
let report = {};
async function request(endpoint, token, body, method = body ? 'POST' : 'GET') {
    const start = Date.now();
    const response = await fetch(`${base}${endpoint}`, {
        method, headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), Origin: local ? 'http://127.0.0.1:5178' : 'https://smart-transit-lyart.vercel.app' },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000),
    });
    return { status: response.status, data: await response.json(), durationMs: Date.now() - start, cors: response.headers.get('access-control-allow-origin') };
}
async function pass(name, action) {
    try { await action(); checks.push({ name, result: 'passed' }); console.log(`PASS ${name}`); }
    catch (error) { checks.push({ name, result: 'failed', message: error.message }); throw error; }
}
async function create(kind, value) {
    assert.ok(value.id.startsWith(prefix));
    created.push({ kind, id: value.id });
    const response = await request(`/admin/${kind}/${value.id}`, admin, value, 'PUT');
    assert.equal(response.status, 200, response.data.message);
    return response.data;
}
async function remove(kind, id) {
    assert.ok(id.startsWith(prefix), 'Refusing to remove a pre-existing record');
    const response = await request(`/admin/${kind}/${id}`, admin, undefined, 'DELETE');
    assert.equal(response.status, 200, response.data.message);
}
try {
    await pass('API health, authentication boundary and production CORS', async () => {
        const health = await request('/health');
        assert.equal(health.status, 200);
        assert.equal(health.data.ok, true);
        if (!local) assert.equal(health.cors, 'https://smart-transit-lyart.vercel.app');
        assert.equal((await request('/admin/bootstrap')).status, 401);
        assert.equal((await request('/student/transit')).status, 401);
    });
    const auth = await request('/auth/login', null, { email: process.env.QA_ADMIN_EMAIL, password: process.env.QA_ADMIN_PASSWORD });
    assert.equal(auth.status, 200, 'Authorized admin login did not succeed');
    assert.equal(auth.data.user.role, 'admin');
    admin = auth.data.token;
    tokens.push(admin);
    const bootstrap = (await request('/admin/bootstrap', admin)).data;
    const beforeCounts = Object.fromEntries(Object.entries(bootstrap.records).map(([kind, records]) => [kind, records.length]));
    const warnings = [];
    const seen = new Set();
    for (const item of bootstrap.routes) {
        for (const field of ['busId', 'driverId', 'conductorId']) {
            const key = `${field}:${item[field]}`;
            if (item.status === 'active' && item[field]) { if (seen.has(key)) warnings.push({ routeCode: item.code, issue: `Duplicate active ${field} assignment` }); seen.add(key); }
        }
        if (item.stops.some((stop) => !Array.isArray(stop.coordinates) || stop.coordinates.length !== 2 || !stop.coordinates.every(Number.isFinite))) warnings.push({ routeCode: item.code, issue: 'Missing or invalid stop coordinates' });
        if (new Set(item.stops.map((stop) => JSON.stringify(stop.coordinates))).size !== item.stops.length) warnings.push({ routeCode: item.code, issue: 'Repeated stop coordinates require review' });
    }
    const emails = bootstrap.records.students.map((item) => String(item.contact).trim().toLowerCase());
    report = { environment: local ? 'isolated local API' : 'production API', startedAt: new Date().toISOString(), beforeCounts, routeCount: bootstrap.routes.length, duplicateStudentEmails: emails.length - new Set(emails).size, warnings };
    const number = String(Date.now());
    const password = `Qa!${randomBytes(18).toString('hex')}9a`;
    const staff = {};
    const bus = { id: `${prefix}-bus`, name: `QA-${number.slice(-6)}`, code: `QA-${number}`, detail: 'Disposable submission verification', contact: '50 seats', assignment: 'Unassigned', status: 'active' };
    await pass('Create a disposable bus, driver, conductor and pending student transport record', async () => {
        await create('buses', bus);
        for (const role of ['driver', 'conductor']) {
            staff[role] = await create(`${role}s`, { id: `${prefix}-${role}`, name: `QA verification ${role}`, code: `QA-${role}-${number}`, detail: 'Disposable submission verification', contact: '9000000000', assignment: 'Unassigned', status: 'active', accountEmail: `${prefix}-${role}@transport.indusuni.ac.in`, temporaryPassword: password });
        }
        await create('students', { id: `${prefix}-student`, name: 'QA verification student', code: `QA-STU-${number}`, detail: 'Disposable transport record; no email sent', contact: `${prefix}-student@iite.indusuni.ac.in`, assignment: 'Unassigned', routeCode: '', stopId: '', status: 'pending' });
    });
    await pass('Create and assign a disposable route; persist edits across API reads', async () => {
        const source = bootstrap.routes.find((item) => item.stops.length >= 2 && item.stops.every((stop) => Array.isArray(stop.coordinates) && stop.coordinates.every(Number.isFinite)));
        assert.ok(source);
        route = { id: `${prefix}-route`, code: `IU-R${number}`, name: 'QA verification route', startPoint: 'QA origin', destination: 'QA destination', status: 'active', busId: bus.id, driverId: staff.driver.id, conductorId: staff.conductor.id,
            stops: [source.stops[0], source.stops.at(-1)].map((stop, index) => ({ id: `${prefix}-stop-${index}`, name: `QA location ${index + 1}`, coordinates: stop.coordinates, scheduledTime: index ? '8:30 AM' : '8:00 AM' })) };
        route = await create('routes', route);
        const saved = (await request('/admin/bootstrap', admin)).data.routes.find((item) => item.id === route.id);
        assert.equal(saved.driverId, staff.driver.id);
        assert.equal(saved.conductorId, staff.conductor.id);
        assert.equal(saved.busId, bus.id);
    });
    const sessions = {};
    await pass('New driver and conductor logins see the same assigned bus and route; unauthorized admin access rejected', async () => {
        for (const role of ['driver', 'conductor']) {
            const auth = await request('/auth/login', null, { email: staff[role].accountEmail, password });
            assert.equal(auth.status, 200);
            sessions[role] = auth.data.token;
            tokens.push(auth.data.token);
            const response = await request(`/${role}/trips/current`, auth.data.token);
            assert.equal(response.status, 200);
            assert.equal(response.data.activeStaffTrip.routeCode, route.code);
            assert.equal(response.data.activeStaffTrip.busNumber, bus.name);
            assert.equal(response.data.tripStatus, 'not-started');
            assert.equal((await request('/admin/bootstrap', auth.data.token)).status, 403);
            assert.equal((await request('/admin/simulation', auth.data.token)).status, 403);
        }
    });
    await pass('Assigned record deletion is rejected without modifying the record', async () => {
        assert.equal((await request(`/admin/buses/${bus.id}`, admin, undefined, 'DELETE')).status, 400);
    });
    await pass('Hosted simulator start, movement, pause, return and exit; real trip remains untouched', async () => {
        const started = await request('/admin/simulation', admin, { routeId: route.id, direction: 'morning', speedKmh: 30, playbackRate: 60 });
        assert.equal(started.status, 200, started.data.message);
        assert.equal(started.data.simulation, true);
        assert.equal(started.data.location.source, 'simulation');
        assert.ok(started.data.stops[1].estimatedArrivalAt);
        const moving = (await request('/admin/simulation', admin)).data;
        assert.ok(moving.travelledKm > 0);
        const paused = await request('/admin/simulation', admin, { id: started.data.id, action: 'pause' }, 'PATCH');
        assert.equal(paused.data.status, 'paused');
        assert.equal(paused.data.nextStopEstimatedArrivalAt, null);
        const returning = await request('/admin/simulation', admin, { routeId: route.id, direction: 'return', speedKmh: 30, playbackRate: 60 });
        assert.equal(returning.data.route.stops[0].id, route.stops.at(-1).id);
        assert.equal((await request('/admin/simulation', admin, undefined, 'DELETE')).data.status, 'idle');
        for (const role of ['driver', 'conductor']) {
            const state = (await request(`/${role}/trips/current`, sessions[role])).data;
            assert.equal(state.tripStatus, 'not-started');
            assert.equal(state.liveLocation, null);
        }
    });
} catch (error) {
    failed = true;
    report.failure = error.message;
    console.error(error.message);
} finally {
    if (admin) {
        try { await request('/admin/simulation', admin, undefined, 'DELETE'); } catch { /* A memory-only scenario also expires automatically. */ }
        if (route?.id?.startsWith(prefix)) {
            try {
                const response = await request(`/admin/routes/${route.id}`, admin, { ...route, busId: '', driverId: '', conductorId: '' }, 'PUT');
                assert.equal(response.status, 200, response.data.message);
            } catch (error) { cleanupFailed = true; console.error(`Could not unassign owned QA route ${route.id}: ${error.message}`); }
        }
        for (const item of [...created].reverse()) {
            try { await remove(item.kind, item.id); }
            catch (error) { cleanupFailed = true; console.error(`Cleanup pending ${item.kind}/${item.id}: ${error.message}`); }
        }
        try {
            const after = (await request('/admin/bootstrap', admin)).data;
            const residual = [...after.routes, ...Object.values(after.records).flat()].filter((item) => item.id.startsWith(prefix));
            report.remainingTestRecords = residual.length;
            assert.equal(residual.length, 0, 'QA records remain');
            checks.push({ name: 'Delete only newly created records and verify no test records remain', result: 'passed' });
            console.log('PASS newly created records deleted; no QA records remain');
            for (const token of tokens.slice(1)) assert.equal((await request('/auth/session', token)).status, 401, 'Deleted account session must be revoked');
            checks.push({ name: 'Deleted staff accounts lose existing sessions', result: 'passed' });
        } catch (error) { cleanupFailed = true; console.error(error.message); }
    }
    for (const token of tokens) {
        try { await request('/auth/logout', token, {}, 'POST'); } catch { /* The token is not persisted in the QA report. */ }
    }
}
report = { ...report, completedAt: new Date().toISOString(), checks, cleanupFailed, limitations: ['API-only: browser policy blocked visual verification.', 'No real operational trip or external message was created in production.', 'Phone GPS, actual road travel, university contacts and real email delivery remain unverified.'] };
const output = path.resolve(process.env.QA_REPORT_PATH || 'docs/qa/submission-api-results.json');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2));
console.log(`Sanitized evidence: ${output}`);
if (failed || cleanupFailed) process.exitCode = 1;
