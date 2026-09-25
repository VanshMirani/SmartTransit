import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApiServer } from '../apiServer.js';
import { createDataStore } from '../dataStore.js';
import { hashPassword } from '../passwords.js';
import { createMongoDataStore } from '../mongoDataStore.js';
import { cleanRouteForSave, prepareRouteForEdit, updateStopCoordinates } from '../../Frontend/src/admin/routeDrafts.js';

async function fixture(t, options = {}) {
    const directory = await mkdtemp(path.join(tmpdir(), 'smarttransit-regression-'));
    const filename = path.join(directory, 'db.json');
    const useMongo = process.env.QA_MONGO_URI?.startsWith('mongodb://127.0.0.1:');
    if (useMongo) {
        process.env.SMARTTRANSIT_MONGODB_URI = process.env.QA_MONGO_URI;
        process.env.SMARTTRANSIT_MONGODB_DB = 'smarttransit_qa';
        process.env.SMARTTRANSIT_MONGODB_STATE_ID = path.basename(directory);
    }
    let store = useMongo ? createMongoDataStore() : createDataStore(filename);
    await store.ready?.();
    let server = createApiServer(store, options);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { await new Promise((resolve) => server.close(resolve)); await store.close?.(); });
    const request = async (route, token, body, method = body ? 'POST' : 'GET') => {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api${route}`, {
            method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: body ? JSON.stringify(body) : undefined,
        });
        return { status: response.status, data: await response.json() };
    };
    const login = async (role) => (await request('/auth/login', null, {
        email: role === 'student' ? 'student@iite.indusuni.ac.in' : `${role}@transport.indusuni.ac.in`,
        password: `${role[0].toUpperCase()}${role.slice(1)}@123`,
    })).data.token;
    const restart = async () => {
        await new Promise((resolve) => server.close(resolve));
        await store.close?.();
        store = useMongo ? createMongoDataStore() : createDataStore(filename);
        await store.ready?.();
        server = createApiServer(store, options);
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        return store;
    };
    const rawRequest = async (route, body) => fetch(`http://127.0.0.1:${server.address().port}/api${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    return { request, rawRequest, login, store, filename, restart };
}

test('stale admin route and record forms cannot overwrite a newer saved edit', async (t) => {
    const { request, login, store } = await fixture(t);
    const first = await login('admin'), second = await login('admin');
    const snapshot = (await request('/admin/bootstrap', first)).data;
    const original = snapshot.routes[0];
    const saved = await request(`/admin/routes/${original.id}`, first, { ...original, name: 'QA first administrator' }, 'PUT');
    assert.equal(saved.status, 200, saved.data.message);
    const stale = await request(`/admin/routes/${original.id}`, second, { ...original, destination: 'QA stale destination' }, 'PUT');
    assert.equal(stale.status, 409, 'Stale route must not erase the first administrator edit');
    assert.match(stale.data.message, /changed.*reopen/i);
    assert.equal((await store.get()).admin.routes.find((route) => route.id === original.id).name, 'QA first administrator');
    const bus = snapshot.records.buses[0];
    assert.equal((await request(`/admin/buses/${bus.id}`, first, { ...bus, detail: 'QA first model' }, 'PUT')).status, 200);
    assert.equal((await request(`/admin/buses/${bus.id}`, second, { ...bus, detail: 'QA stale model' }, 'PUT')).status, 409);
    assert.equal((await store.get()).admin.records.buses.find((item) => item.id === bus.id).detail, 'QA first model');
});

test('complaints validate content and concurrent lost-response retries create one timestamped record', async (t) => {
    const { request, login, store, restart } = await fixture(t);
    const student = await login('student');
    const input = { requestId: 'qa-complaint-retry', category: 'Delay', subject: 'Late pickup today', description: 'The bus arrived later than the displayed estimate.', relatedService: 'Route IU-R4 only' };
    for (const body of [{}, { ...input, category: 'invented' }, { ...input, subject: '' }, { ...input, description: 'x'.repeat(501) }, { ...input, relatedService: {} }, { ...input, requestId: {} }]) {
        assert.equal((await request('/student/complaints', student, body)).status, 400);
    }
    const first = await request('/student/complaints', student, input);
    assert.equal(first.status, 201, first.data.message);
    const retries = await Promise.all([request('/student/complaints', student, input), request('/student/complaints', student, input)]);
    assert.ok(retries.every((item) => item.data.id === first.data.id));
    assert.match(first.data.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(first.data.updatedAt, first.data.createdAt);
    assert.equal(first.data.tripId, 'Not linked', 'No invented active trip reference');
    assert.equal((await request('/student/complaints', student, { ...input, subject: 'Changed content' })).status, 400);
    assert.equal((await store.get()).communications.complaints.filter((item) => item.requestId === input.requestId).length, 1);
    await restart();
    assert.equal((await request('/student/complaints', student, input)).data.id, first.data.id);
    const admin = await login('admin');
    const update = { requestId: 'qa-complaint-update', status: 'resolved', resolution: 'Reviewed locally', internalNote: 'Staff-only test note' };
    for (let attempt = 0; attempt < 2; attempt += 1)
        assert.equal((await request(`/admin/complaints/${first.data.id}`, admin, update, 'PATCH')).status, 200);
    const publicRetry = (await request('/student/complaints', student, input)).data;
    assert.equal(publicRetry.timeline.filter((item) => item.title === 'Complaint updated').length, 1);
    assert.doesNotMatch(JSON.stringify(publicRetry), /Staff-only test note/);
    assert.equal((await request(`/admin/complaints/${first.data.id}`, admin, { ...update, resolution: 'Changed' }, 'PATCH')).status, 400);
});

test('implausible GPS jumps do not overwrite accepted location or stop progress', async (t) => {
    const { request, login } = await fixture(t);
    const driver = await login('driver');
    const trip = (await request('/driver/trips/current', driver)).data.activeStaffTrip;
    await request(`/driver/trips/${trip.id}/start`, driver, {});
    const location = { latitude: 23.05, longitude: 72.53, accuracy: 12, timestamp: new Date(Date.now() - 2000).toISOString() };
    const endpoint = `/driver/trips/${trip.id}/location`;
    assert.equal((await request(endpoint, driver, location)).status, 201);
    const before = (await request('/driver/trips/current', driver)).data;
    const jump = await request(endpoint, driver, { ...location, latitude: 24.05, timestamp: new Date().toISOString() });
    assert.equal(jump.status, 400);
    assert.match(jump.data.message, /jump|movement|reliable/i);
    const after = (await request('/driver/trips/current', driver)).data;
    assert.deepEqual(after.activeStaffTrip.currentCoordinates, before.activeStaffTrip.currentCoordinates);
    assert.equal(after.operationalCurrentStopId, before.operationalCurrentStopId);
    const jitter = await request(endpoint, driver, { ...location, latitude: 23.05001, timestamp: new Date().toISOString() });
    assert.equal(jitter.status, 201, jitter.data.message);
});

test('notification retries publish once and reject reused IDs with different content', async (t) => {
    const { request, login, store } = await fixture(t);
    const admin = await login('admin');
    const input = { requestId: 'qa-notice-retry', type: 'general', title: 'QA notice', message: 'Local verification only.', audience: 'all', routeCode: 'ignored', deliveryMode: 'now' };
    const first = await request('/admin/notifications', admin, input);
    assert.equal(first.status, 201, first.data.message);
    const retry = await request('/admin/notifications', admin, input);
    assert.equal(retry.data.id, first.data.id);
    assert.equal((await store.get()).communications.campaigns.filter((item) => item.requestId === input.requestId).length, 1);
    assert.equal((await request('/admin/notifications', admin, { ...input, message: 'Changed' })).status, 400);
    assert.equal((await request('/admin/notifications', admin, { ...input, requestId: 'qa-other', type: 'invalid' })).status, 400);
    assert.equal((await request('/admin/notifications', admin, { ...input, requestId: 'qa-route', audience: 'route', routeCode: 'IU-R404' })).status, 400);
    const scheduled = { ...input, requestId: 'qa-scheduled', deliveryMode: 'scheduled', scheduledFor: new Date(Date.now() + 60000).toISOString() };
    const scheduledFirst = await request('/admin/notifications', admin, scheduled);
    assert.equal(scheduledFirst.status, 201);
    assert.equal((await request('/admin/notifications', admin, scheduled)).data.id, scheduledFirst.data.id);
});

test('inactive or missing route resources cannot start a trip', async (t) => {
    const { request, login, store } = await fixture(t);
    const driver = await login('driver');
    const state = (await request('/driver/trips/current', driver)).data;
    const trip = state.activeStaffTrip;
    const initial = await store.get();
    const route = initial.admin.routes.find((item) => item.code === trip.routeCode);
    for (const [kind, field] of [['buses', 'busId'], ['drivers', 'driverId'], ['conductors', 'conductorId']]) {
        await store.update((data) => { data.admin.records[kind].find((item) => item.id === route[field]).status = 'inactive'; return true; });
        assert.notEqual((await request(`/driver/trips/${trip.id}/start`, driver, {})).status, 200);
        await store.update((data) => { data.admin.records[kind].find((item) => item.id === route[field]).status = 'active'; return true; });
    }
    await store.update((data) => { data.admin.routes.find((item) => item.id === route.id).busId = ''; return true; });
    const unassigned = (await request('/driver/trips/current', driver)).data;
    assert.equal(unassigned.activeStaffTrip, null, 'A removed bus must not fall back to the seeded vehicle');
    const student = await login('student');
    const transit = (await request('/student/transit', student)).data;
    assert.equal(transit.assignmentStatus, 'unassigned');
    assert.equal(transit.approvalStatus, 'approved');
    assert.equal(transit.bus.capacity, 0);
    assert.equal((await request(`/driver/trips/${trip.id}/start`, driver, {})).status, 400);
    await store.update((data) => { data.admin.routes.find((item) => item.id === route.id).busId = route.busId; return true; });
    assert.equal((await request(`/driver/trips/${trip.id}/start`, driver, {})).status, 200);
});

test('malformed and oversized JSON are rejected without exposing server errors', async (t) => {
    const { rawRequest } = await fixture(t);
    for (const value of ['{invalid', 'null', '[]']) {
        const response = await rawRequest('/auth/login', value);
        assert.equal(response.status, 400);
        assert.equal((await response.json()).message, 'Submit a valid JSON object.');
    }
    assert.equal((await rawRequest('/auth/login', JSON.stringify({ value: 'x'.repeat(513 * 1024) }))).status, 413);
});

test('admin CRUD rejects invalid identity, capacity and duplicate codes; deletion revokes only the new login', async (t) => {
    const { request, login, store } = await fixture(t);
    const admin = await login('admin');
    const driver = await login('driver');
    const before = await store.get();
    const bus = { id: 'qa-bus', name: '9990', code: 'GJ-QA-9990', detail: 'QA bus', contact: '50 seats', assignment: 'Unassigned', status: 'active' };
    assert.equal((await request('/admin/buses/qa-bus', admin, { ...bus, id: 'other' }, 'PUT')).status, 400);
    for (const contact of ['-1', '12.5', 'zero', '0', '201']) assert.equal((await request('/admin/buses/qa-bus', admin, { ...bus, contact }, 'PUT')).status, 400);
    assert.equal((await request('/admin/buses/qa-bus', admin, bus, 'PUT')).status, 200);
    assert.equal((await request('/admin/buses/duplicate', admin, { ...bus, id: 'duplicate' }, 'PUT')).status, 400);
    assert.equal((await request('/admin/buses/qa-bus', driver, undefined, 'DELETE')).status, 403);
    const staff = { id: 'qa-driver', name: 'QA Driver', code: 'QA-DRV', detail: 'QA licence', contact: '9000000000', assignment: 'Unassigned', status: 'active', accountEmail: 'qa-driver@transport.indusuni.ac.in', temporaryPassword: 'QaDriver@2026!' };
    const created = await request('/admin/drivers/qa-driver', admin, staff, 'PUT');
    assert.equal(created.status, 200, created.data.message);
    const auth = (await request('/auth/login', null, { email: staff.accountEmail, password: staff.temporaryPassword })).data;
    assert.ok(auth.token);
    assert.equal((await request('/admin/drivers/claimed', admin, { ...staff, id: 'claimed', code: 'QA-OTHER', accountUserId: created.data.accountUserId }, 'PUT')).status, 400);
    assert.equal((await request('/admin/drivers/qa-driver', admin, undefined, 'DELETE')).status, 200);
    assert.equal((await request('/auth/session', auth.token)).status, 401);
    assert.equal((await request('/admin/drivers/qa-driver', admin, undefined, 'DELETE')).status, 200);
    assert.equal((await request('/admin/buses/qa-bus', admin, undefined, 'DELETE')).status, 200);
    const after = await store.get();
    assert.deepEqual(after.admin.records, before.admin.records);
    assert.deepEqual(after.users, before.users);
    assert.equal((await request('/auth/session', admin)).status, 200);
});

test('route edits and deletion protect assignments, active trips, student stops and completed history', async (t) => {
    const { request, login, store } = await fixture(t);
    const admin = await login('admin'), driver = await login('driver');
    const bootstrap = (await request('/admin/bootstrap', admin)).data;
    const trip = (await request('/driver/trips/current', driver)).data.activeStaffTrip;
    const route = bootstrap.routes.find((item) => item.code === trip.routeCode);
    const duplicate = { ...route, id: 'qa-route', code: 'IU-R999', stops: route.stops };
    assert.equal((await request('/admin/routes/qa-route', admin, duplicate, 'PUT')).status, 400);
    const disposable = { ...duplicate, busId: '', driverId: '', conductorId: '' };
    const created = await request('/admin/routes/qa-route', admin, disposable, 'PUT');
    assert.equal(created.status, 200);
    assert.equal((await request('/admin/routes/qa-route', admin, { ...created.data, stops: [route.stops[0], route.stops[0]] }, 'PUT')).status, 400);
    assert.equal((await request('/admin/routes/qa-route', admin, undefined, 'DELETE')).status, 200);
    assert.equal((await request(`/admin/buses/${route.busId}`, admin, undefined, 'DELETE')).status, 400);
    assert.equal((await request(`/driver/trips/${trip.id}/start`, driver, {})).status, 200);
    assert.equal((await request(`/admin/routes/${route.id}`, admin, { ...route, name: 'Changed while running' }, 'PUT')).status, 400);
    assert.equal((await request(`/admin/routes/${route.id}/status`, admin, { status: 'inactive' }, 'PATCH')).status, 400);
    assert.equal((await request(`/admin/buses/${route.busId}`, admin, { contact: '10 seats' }, 'PATCH')).status, 400);
    await request(`/driver/trips/${trip.id}/end`, driver, {});
    assert.equal((await request(`/admin/routes/${route.id}`, admin, undefined, 'DELETE')).status, 400);
    assert.equal((await store.get()).admin.routes.find((item) => item.id === route.id).name, route.name);
});

test('simulation is admin and session scoped, uses distance ETA, and makes no database writes', async (t) => {
    const { request, login, store } = await fixture(t);
    const admin = await login('admin'), secondAdmin = await login('admin');
    const driver = await login('driver'), student = await login('student');
    const before = await store.get();
    const route = before.admin.routes[0];
    for (const token of [driver, student]) assert.equal((await request('/admin/simulation', token)).status, 403);
    const start = await request('/admin/simulation', admin, { routeId: route.id, direction: 'morning', speedKmh: 30, playbackRate: 60 });
    assert.equal(start.status, 200, start.data.message);
    assert.equal(start.data.simulation, true);
    assert.equal(start.data.location.source, 'simulation');
    assert.ok(start.data.stops[1].estimatedArrivalAt);
    assert.equal(start.data.stops[1].distanceSource, 'coordinate-estimate');
    assert.equal((await request('/admin/simulation', secondAdmin)).data.status, 'idle');
    assert.equal((await request('/admin/simulation', admin, { id: start.data.id, action: 'pause' }, 'PATCH')).data.status, 'paused');
    const paused = (await request('/admin/simulation', admin)).data;
    assert.equal(paused.nextStopEstimatedArrivalAt, null);
    assert.deepEqual(await store.get(), before, 'simulation must not touch sessions, users, operations, alerts or database revisions');
    assert.equal((await request('/admin/simulation', admin, undefined, 'DELETE')).data.status, 'idle');
    const returning = (await request('/admin/simulation', admin, { routeId: route.id, direction: 'return' })).data;
    assert.equal(returning.route.stops[0].id, start.data.route.stops.at(-1).id);
    await request('/auth/logout', admin, {});
    assert.equal((await request('/admin/simulation', admin)).status, 401);
});

test('actual departure and stop estimates persist and agree across roles without clock-based stop progress', async (t) => {
    const { request, login, restart } = await fixture(t);
    const driver = await login('driver'), conductor = await login('conductor'), student = await login('student'), admin = await login('admin');
    const before = (await request('/driver/trips/current', driver)).data;
    const id = before.activeStaffTrip.id;
    assert.equal(before.operationalStops[0].departureEstimateAt, null);
    const startBound = Date.now();
    const started = (await request(`/driver/trips/${id}/start`, driver, { startedAt: '2000-01-01T00:00:00Z' })).data;
    const startedAt = started.activeStaffTrip.startedAt;
    assert.ok(Date.parse(startedAt) >= startBound && Date.parse(startedAt) <= Date.now());
    assert.equal(started.operationalStops[0].departureEstimateAt, startedAt);
    const plan = started.operationalStops.map((stop) => stop.departureEstimateAt);
    assert.ok(Date.parse(plan.at(-1)) > Date.parse(startedAt));
    assert.deepEqual(started.operationalStops.map((stop) => stop.scheduledTime), before.operationalStops.map((stop) => stop.scheduledTime));
    const reopenedStore = await restart();
    const staff = (await request('/conductor/trips/current', conductor)).data;
    const transit = (await request('/student/transit', student)).data;
    const fleet = (await request('/admin/bootstrap', admin)).data.fleetVehicles.find((bus) => bus.route === started.activeStaffTrip.routeCode);
    assert.equal(transit.route.startedAt, startedAt);
    assert.equal(fleet.startedAt, startedAt);
    assert.equal(fleet.departureEstimateAt, plan.at(-1));
    assert.deepEqual(staff.operationalStops.map((stop) => stop.departureEstimateAt), plan);
    assert.deepEqual(transit.route.stops.map((stop) => stop.departureEstimateAt), plan);
    const first = before.operationalStops[0];
    const location = await request(`/driver/trips/${id}/location`, driver, { latitude: first.coordinates[0], longitude: first.coordinates[1], accuracy: 10, speedKmh: 24, timestamp: new Date().toISOString() });
    assert.equal(location.status, 201);
    const live = (await request('/student/transit', student)).data;
    assert.ok(live.route.stops[1].estimatedArrivalAt);
    assert.equal(live.route.stops[1].departureEstimateAt, plan[1]);
    await reopenedStore.update((data) => {
        data.operations.routeTrips[started.activeStaffTrip.routeCode].activeStaffTrip.startedAt = new Date(Date.now() - 3 * 3600000).toISOString();
        data.operations.liveLocations[id].updatedAt = new Date(Date.now() - 5 * 60000).toISOString();
        return true;
    });
    const stale = (await request('/student/transit', student)).data;
    assert.equal(stale.route.currentStopId, first.id);
    assert.equal(stale.route.stops.filter((stop) => stop.status === 'completed').length, 0);
    assert.equal(stale.route.stops[1].estimatedArrivalAt, undefined);
    assert.equal(stale.route.stops[1].eta, 'ETA unavailable');
    await request(`/driver/trips/${id}/end`, driver, {});
    const prepared = (await request('/driver/trips/current/direction', driver, { direction: 'return' })).data;
    assert.notEqual(prepared.activeStaffTrip.id, id);
    assert.equal(prepared.operationalStops[0].departureEstimateAt, null);
    const returned = (await request(`/driver/trips/${prepared.activeStaffTrip.id}/start`, driver, {})).data;
    assert.equal(returned.operationalStops[0].departureEstimateAt, returned.activeStaffTrip.startedAt);
    assert.equal(Date.parse(returned.operationalStops[1].departureEstimateAt) - Date.parse(returned.activeStaffTrip.startedAt), 5 * 60000);
});

for (const action of ['GPS upload', 'seat update']) {
    test(`${action} responses retain actual-departure estimates for morning and return trips`, async (t) => {
        const { request, login } = await fixture(t);
        const driver = await login('driver'), conductor = await login('conductor');
        for (const direction of ['morning', 'return']) {
            const prepared = (await request('/driver/trips/current/direction', driver, { direction })).data;
            const id = prepared.activeStaffTrip.id;
            const started = (await request(`/driver/trips/${id}/start`, driver, {})).data;
            const plan = started.operationalStops.map((stop) => stop.departureEstimateAt);
            const first = started.operationalStops[0];
            let lastFix = 0;
            const sendLocation = (speedKmh) => {
                lastFix = Math.max(Date.now(), lastFix + 1);
                return request(`/driver/trips/${id}/location`, driver, {
                    latitude: first.coordinates[0], longitude: first.coordinates[1], accuracy: 10,
                    speedKmh, timestamp: new Date(lastFix).toISOString(),
                });
            };
            for (const speed of [0, 24]) {
                const gps = await sendLocation(speed);
                assert.equal(gps.status, 201);
                const input = { id: `seats-${direction}-${speed}`, stopId: first.id, boarded: 1, deboarded: 0 };
                const response = action === 'GPS upload' ? gps
                    : await request(`/conductor/trips/${id}/seat-updates`, conductor, input);
                assert.equal(response.status, 201);
                assert.deepEqual(response.data.operationalStops.map((stop) => stop.departureEstimateAt), plan);
                assert.equal(response.data.activeStaffTrip.departureEstimateAt, plan.at(-1));
                assert.equal(response.data.activeStaffTrip.startedAt, started.activeStaffTrip.startedAt);
                assert.equal(Boolean(response.data.operationalStops[1].estimatedArrivalAt), speed > 0);
                const refreshed = (await request('/driver/trips/current', driver)).data;
                assert.deepEqual(refreshed.operationalStops.map((stop) => stop.departureEstimateAt), plan);
                if (speed > 0) {
                    assert.ok(Math.abs(Date.parse(response.data.operationalStops[1].estimatedArrivalAt)
                        - Date.parse(refreshed.operationalStops[1].estimatedArrivalAt)) < 1000);
                }
                if (action === 'seat update') {
                    const retry = (await request(`/conductor/trips/${id}/seat-updates`, conductor, input)).data;
                    assert.deepEqual(retry.operationalStops.map((stop) => stop.departureEstimateAt), plan);
                    assert.equal(retry.update.occupiedSeats, response.data.update.occupiedSeats);
                }
            }
            assert.equal((await request(`/driver/trips/${id}/end`, driver, {})).status, 200);
        }
    });
}

test('distance and stop arrivals use accepted GPS even away from the schematic route, in both directions', async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
    const { request, login } = await fixture(t);
    const driver = await login('driver'), conductor = await login('conductor');
    const student = await login('student'), admin = await login('admin');
    let fixAt = Date.now();
    for (const direction of ['morning', 'return']) {
        const prepared = (await request('/driver/trips/current/direction', driver, { direction })).data;
        const id = prepared.activeStaffTrip.id;
        const started = (await request(`/driver/trips/${id}/start`, driver, {})).data;
        const first = started.operationalStops[0];
        const latitude = Math.max(...started.operationalStops.map((stop) => stop.coordinates[0])) + 0.05;
        const upload = async (speedKmh, lat = latitude) => {
            fixAt = Math.max(Date.now(), fixAt + 1);
            const response = await request(`/driver/trips/${id}/location`, driver, {
                latitude: lat, longitude: first.coordinates[1], accuracy: 10, speedKmh,
                timestamp: new Date(fixAt).toISOString(),
            });
            assert.equal(response.status, 201);
            return response.data;
        };
        const fast = await upload(30);
        const fastTrip = fast.activeStaffTrip;
        assert.ok(fastTrip.distanceToNextStopKm > 1);
        assert.equal(fastTrip.distanceSource, 'coordinate-estimate');
        assert.equal(fast.operationalStops.filter((stop) => stop.status === 'completed').length, 0);
        for (const stop of fast.operationalStops) {
            assert.ok(Number.isFinite(stop.distanceFromBusKm));
            const expectedMinutes = Math.max(1, Math.round(stop.distanceFromBusKm / 30 * 60));
            assert.equal(Date.parse(stop.estimatedArrivalAt) - fixAt, expectedMinutes * 60000);
            assert.equal(stop.etaCalculatedAt, new Date(fixAt).toISOString());
            assert.equal(stop.etaSource, 'driver-phone-speed');
        }
        const slow = await upload(6);
        assert.equal(slow.activeStaffTrip.etaSpeedKmh, 6, 'slow buses must not be treated as travelling at 12 km/h');
        assert.ok(Date.parse(slow.operationalStops[0].estimatedArrivalAt) > Date.parse(fast.operationalStops[0].estimatedArrivalAt));
        const slowArrival = slow.operationalStops.map((stop) => stop.estimatedArrivalAt);
        const staff = (await request('/conductor/trips/current', conductor)).data;
        const refreshed = (await request('/driver/trips/current', driver)).data;
        const transit = (await request('/student/transit', student)).data;
        const fleet = (await request('/admin/bootstrap', admin)).data.fleetVehicles.find((bus) => bus.route === fastTrip.routeCode);
        assert.deepEqual(staff.operationalStops.map((stop) => stop.estimatedArrivalAt), slowArrival);
        assert.deepEqual(refreshed.operationalStops.map((stop) => stop.estimatedArrivalAt), slowArrival);
        assert.deepEqual(transit.route.stops.map((stop) => stop.estimatedArrivalAt), slowArrival);
        assert.equal(fleet.nextStopEta, slow.activeStaffTrip.nextStopEta);
        assert.equal(fleet.distanceToNextStopKm, slow.activeStaffTrip.distanceToNextStopKm);
        assert.equal(fleet.estimatedArrivalAt, slow.operationalStops.at(-1).estimatedArrivalAt);
        // Movement takes time: the quality filter must not accept kilometre jumps in milliseconds.
        t.mock.timers.tick(10 * 60 * 1000);
        const closer = await upload(6, (latitude + first.coordinates[0]) / 2);
        assert.ok(closer.activeStaffTrip.distanceToNextStopKm < slow.activeStaffTrip.distanceToNextStopKm);
        assert.ok(Date.parse(closer.operationalStops[0].estimatedArrivalAt) < Date.parse(slow.operationalStops[0].estimatedArrivalAt));
        await request(`/driver/trips/${id}/end`, driver, {});
    }
});

test('stationary GPS retains distance without inventing an arrival, and stale GPS never becomes fresh', async (t) => {
    const { request, login, store } = await fixture(t);
    const driver = await login('driver');
    const before = (await request('/driver/trips/current', driver)).data;
    const id = before.activeStaffTrip.id;
    await request(`/driver/trips/${id}/start`, driver, {});
    const first = before.operationalStops[0];
    const stopped = (await request(`/driver/trips/${id}/location`, driver, {
        latitude: first.coordinates[0] + 0.05, longitude: first.coordinates[1],
        accuracy: 10, speedKmh: 0, timestamp: new Date().toISOString(),
    })).data;
    assert.ok(stopped.activeStaffTrip.distanceToNextStopKm > 0);
    assert.equal(stopped.activeStaffTrip.nextStopEta, 'ETA unavailable');
    assert.match(stopped.activeStaffTrip.etaNote, /stopped/i);
    assert.ok(stopped.operationalStops[1].distanceFromBusKm > 0);
    assert.equal(stopped.operationalStops[1].estimatedArrivalAt, undefined);
    await store.update((data) => {
        data.operations.liveLocations[id].updatedAt = new Date(Date.now() - 300000).toISOString();
        return true;
    });
    const stale = (await request('/driver/trips/current', driver)).data;
    assert.equal(stale.activeStaffTrip.distanceToNextStopKm, null);
    assert.equal(stale.operationalStops[1].estimatedArrivalAt, undefined);
    assert.equal(stale.activeStaffTrip.nextStopEta, 'ETA unavailable');
});

test('unknown speed is explicitly assumed, while GPS jitter does not imply a moving bus', async (t) => {
    const { request, login } = await fixture(t);
    const driver = await login('driver');
    const before = (await request('/driver/trips/current', driver)).data;
    const id = before.activeStaffTrip.id;
    await request(`/driver/trips/${id}/start`, driver, {});
    const first = before.operationalStops[0];
    const now = Date.now();
    const upload = (latitude, timestamp) => request(`/driver/trips/${id}/location`, driver, {
        latitude, longitude: first.coordinates[1], accuracy: 20, timestamp: new Date(timestamp).toISOString(),
    });
    const assumed = (await upload(first.coordinates[0], now - 10000)).data;
    assert.equal(assumed.activeStaffTrip.etaSource, 'driver-phone-average');
    assert.match(assumed.activeStaffTrip.etaNote, /assumed 24 km\/h/);
    assert.equal(assumed.operationalStops[1].etaSource, 'driver-phone-average');
    const jitter = (await upload(first.coordinates[0] + 0.00001, now)).data;
    assert.equal(jitter.activeStaffTrip.currentSpeed, 0);
    assert.equal(jitter.operationalStops[1].estimatedArrivalAt, undefined);
    assert.ok(jitter.operationalStops[1].distanceFromBusKm > 0);
});

test('seat updates are atomic, idempotent and authoritative, including a lost-response retry', async (t) => {
    const { request, login, store } = await fixture(t);
    const driver = await login('driver'), conductor = await login('conductor');
    const initial = (await request('/driver/trips/current', driver)).data;
    const trip = initial.activeStaffTrip.id;
    await request(`/driver/trips/${trip}/start`, driver, {});
    const stopId = initial.operationalStops[0].id;
    const seat = (body) => request(`/conductor/trips/${trip}/seat-updates`, conductor, body);
    assert.equal((await seat({ id: 'initial', stopId, boarded: 30, deboarded: 0 })).data.update.occupiedSeats, 30);
    const input = { id: 'retry-safe', stopId, boarded: 5, deboarded: 2, occupiedSeats: 1, availableSeats: 49, timestamp: '08:15 AM' };
    const results = await Promise.all([seat(input), seat(input), seat(input)]);
    for (const result of results) {
        assert.equal(result.status, 201);
        assert.equal(result.data.update.occupiedSeats, 33);
        assert.equal(result.data.update.availableSeats, 17);
        assert.ok(Number.isFinite(Date.parse(result.data.update.timestamp)));
    }
    assert.equal((await store.get()).operations.seatUpdates.filter((item) => item.id === input.id).length, 1);
    assert.equal((await seat({ ...input, boarded: 6 })).status, 400);
    for (const boarded of [-1, 1.5, '3', null, true, 'no'])
        assert.equal((await seat({ stopId, boarded, deboarded: 0 })).status, 400);
    assert.equal((await seat({ stopId: 'wrong', boarded: 0, deboarded: 0 })).status, 400);
    assert.equal((await seat({ stopId, boarded: 0, deboarded: 34 })).status, 400);
    assert.equal((await seat({ id: 'zero', stopId, boarded: 0, deboarded: 0 })).data.update.occupiedSeats, 33);
    assert.equal((await seat({ id: 'full', stopId, boarded: 17, deboarded: 0 })).data.update.availableSeats, 0);
    assert.equal((await seat({ stopId, boarded: 1, deboarded: 0 })).status, 400);
    assert.equal((await seat({ id: 'empty', stopId, boarded: 0, deboarded: 50 })).data.update.availableSeats, 50);
    await Promise.all(Array.from({ length: 5 }, (_, index) => seat({ id: `concurrent-${index}`, stopId, boarded: 1, deboarded: 0 })));
    const beforeRead = (await store.get()).operations.seatUpdates[0];
    const refreshed = (await request('/conductor/trips/current', conductor)).data;
    assert.equal(refreshed.activeStaffTrip.occupiedSeats, 5);
    assert.equal(refreshed.seatUpdates[0].timestamp, beforeRead.timestamp);
});

test('student seat freshness comes from the assigned bus recorded update, not a legacy relative label', async (t) => {
    const { request, login } = await fixture(t);
    const driver = await login('driver'), conductor = await login('conductor'), student = await login('student');
    const trip = (await request('/driver/trips/current', driver)).data.activeStaffTrip;
    await request(`/driver/trips/${trip.id}/start`, driver, {});
    assert.equal((await request('/student/transit', student)).data.bus.seatsUpdatedAt, null);
    const stops = (await request('/conductor/trips/current', conductor)).data.operationalStops;
    const input = { id: 'seat-time', stopId: stops[0].id, boarded: 3, deboarded: 0 };
    const saved = await request(`/conductor/trips/${trip.id}/seat-updates`, conductor, input);
    assert.equal(saved.status, 201);
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const bus = (await request('/student/transit', student)).data.bus;
        assert.equal(bus.occupiedSeats, 3);
        assert.equal(bus.seatsUpdatedAt, saved.data.update.timestamp);
    }
});

test('signup rejects expired, reused and brute-forced OTPs and cannot self-approve or provision staff', async (t) => {
    const mailbox = {};
    const { request, login, store } = await fixture(t, { otpEmailSender: async ({ to, otp }) => { mailbox[to] = otp; } });
    const body = (email) => ({ email, fullName: 'Isolated Applicant', phone: '9000000001', password: 'Applicant@123', otp: mailbox[email], role: 'admin', status: 'active' });
    assert.equal((await request('/auth/signup-otp', null, { email: 'not-an-email' })).status, 400);
    assert.equal((await request('/auth/signup-otp', null, { email: 'student@iite.indusuni.ac.in' })).status, 409);
    const expired = 'expired.qa@iite.indusuni.ac.in';
    assert.equal((await request('/auth/signup-otp', null, { email: expired })).status, 200);
    await store.update((data) => { data.signupOtps[expired].expiresAt = new Date(0).toISOString(); return true; });
    assert.equal((await request('/auth/register/student', null, body(expired))).status, 400);
    const wrong = 'wrong.qa@iite.indusuni.ac.in';
    await request('/auth/signup-otp', null, { email: wrong });
    for (let index = 0; index < 5; index += 1)
        assert.equal((await request('/auth/register/student', null, { ...body(wrong), otp: mailbox[wrong] === '000000' ? '111111' : '000000' })).status, 400);
    assert.equal((await request('/auth/register/student', null, body(wrong))).status, 400);
    const valid = 'pending.qa@iite.indusuni.ac.in';
    const sent = await request('/auth/signup-otp', null, { email: valid });
    assert.equal(sent.data.otp, undefined);
    const created = await request('/auth/register/student', null, body(valid));
    assert.equal(created.status, 201);
    assert.equal(created.data.user.role, 'student');
    assert.equal(created.data.user.status, 'pending');
    assert.equal((await request('/auth/register/student', null, body(valid))).status, 400);
    assert.deepEqual((await request('/student/transit', created.data.token)).data.route.stops, []);
    assert.equal((await request('/admin/bootstrap', created.data.token)).status, 403);
    assert.equal((await request(`/admin/students/${created.data.user.id}`, created.data.token, { status: 'active' }, 'PUT')).status, 403);
    for (const role of ['student', 'driver', 'conductor'])
        assert.equal((await request('/admin/drivers/forged', await login(role), { name: 'Forbidden staff' }, 'PUT')).status, 403);
});

test('trip transitions preserve separate journeys and reject cross-assignment writes', async (t) => {
    const { request, login, store } = await fixture(t);
    const driver = await login('driver'), conductor = await login('conductor');
    const trip = (await request('/driver/trips/current', driver)).data.activeStaffTrip.id;
    assert.equal((await request(`/driver/trips/${trip}/start`, driver, {})).status, 200);
    assert.equal((await request(`/driver/trips/${trip}/start`, driver, {})).status, 400);
    assert.equal((await request('/driver/trips/current/direction', driver, { direction: 'return' })).status, 400);
    await store.update((data) => { data.users.push({ id: 'unassigned', name: 'Unassigned Staff', role: 'driver', status: 'active', email: 'unassigned@transport.indusuni.ac.in', passwordHash: hashPassword('Private@123') }); return true; });
    const stranger = (await request('/auth/login', null, { email: 'unassigned@transport.indusuni.ac.in', password: 'Private@123' })).data.token;
    const location = { latitude: 23.04, longitude: 72.5, accuracy: 10, timestamp: new Date().toISOString() };
    assert.equal((await request(`/driver/trips/${trip}/location`, stranger, location)).status, 400);
    assert.equal((await request(`/driver/trips/${trip}/end`, stranger, {})).status, 400);
    assert.equal((await request(`/driver/trips/${trip}/start`, stranger, {})).status, 400);
    assert.equal((await request('/driver/trips/current/direction', stranger, { direction: 'return' })).status, 400);
    assert.equal((await request(`/driver/trips/${trip}/end`, driver, {})).status, 200);
    assert.equal((await request(`/driver/trips/${trip}/end`, driver, {})).status, 400);
    const next = (await request('/driver/trips/current/direction', driver, { direction: 'return' })).data;
    assert.notEqual(next.activeStaffTrip.id, trip);
    const started = (await request(`/driver/trips/${next.activeStaffTrip.id}/start`, driver, {})).data;
    assert.equal(started.activeStaffTrip.occupiedSeats, 0);
    assert.equal(started.liveLocation, null);
    assert.match(started.operationalStops[0].name, /Indus/);
    assert.equal((await request(`/conductor/trips/${trip}/seat-updates`, conductor, { boarded: 1, deboarded: 0 })).status, 400);
    assert.equal((await store.get()).operations.tripHistory[0].id, trip);
});

test('emergency retries save once and never attach the next stop as phone GPS', async (t) => {
    const { request, login, store } = await fixture(t);
    const driver = await login('driver');
    const tripId = (await request('/driver/trips/current', driver)).data.activeStaffTrip.id;
    await request(`/driver/trips/${tripId}/start`, driver, {});
    const report = { id: 'emergency-retry', type: 'Breakdown', note: 'QA only', tripId, coordinates: [23, 72], location: 'Fake current location' };
    for (let i = 0; i < 2; i += 1) {
        const result = await request('/staff/emergencies', driver, report);
        assert.equal(result.status, 201);
        assert.equal(result.data.status, 'saved');
        assert.equal(result.data.coordinates, null);
        assert.equal(result.data.acknowledgedAt, null);
    }
    assert.equal((await store.get()).operations.emergencies.length, 1);
    assert.equal((await request('/staff/emergencies', driver, { ...report, note: 'changed' })).status, 400);
    assert.equal((await request('/staff/emergencies', driver, { ...report, id: 'wrong', tripId: 'other' })).status, 400);
    assert.equal((await request('/staff/emergencies', driver, { ...report, id: {}, note: 'QA' })).status, 400);
    assert.equal((await request('/staff/emergencies', driver, { ...report, id: 'long-note', note: 'x'.repeat(241) })).status, 400);
});

test('removing managed staff assignments cannot restore access through old template or user route fields', async (t) => {
    const { request, login } = await fixture(t);
    const admin = await login('admin'), driver = await login('driver'), conductor = await login('conductor');
    const current = (await request('/driver/trips/current', driver)).data;
    const tripId = current.activeStaffTrip.id;
    const route = (await request('/admin/bootstrap', admin)).data.routes.find((item) => item.code === current.activeStaffTrip.routeCode);
    assert.equal((await request(`/admin/routes/${route.id}`, admin, { ...route, driverId: '', conductorId: '' }, 'PUT')).status, 200);
    assert.equal((await request('/driver/trips/current', driver)).data.activeStaffTrip, null);
    assert.equal((await request('/conductor/trips/current', conductor)).data.activeStaffTrip, null);
    assert.equal((await request(`/driver/trips/${tripId}/start`, driver, {})).status, 400);
    assert.equal((await request('/staff/emergencies', conductor, { id: 'not-assigned', tripId, type: 'Other', note: 'QA' })).status, 400);
    const student = await login('student');
    const transit = (await request('/student/transit', student)).data;
    assert.equal(JSON.stringify(transit).includes('Imran Hussain'), false);
    assert.equal(JSON.stringify(transit).includes('Rahul Patel'), false);
});

test('GPS rejects weak, missing, old, future and out-of-order fixes', async (t) => {
    const { request, login, store } = await fixture(t);
    const driver = await login('driver');
    const tripId = (await request('/driver/trips/current', driver)).data.activeStaffTrip.id;
    await request(`/driver/trips/${tripId}/start`, driver, {});
    const base = { latitude: 23.04, longitude: 72.5, accuracy: 10, timestamp: new Date(Date.now() - 1000).toISOString() };
    const send = (body) => request(`/driver/trips/${tripId}/location`, driver, body);
    for (const override of [{ accuracy: 900 }, { timestamp: '' }, { timestamp: new Date(Date.now() - 60000).toISOString() }, { timestamp: new Date(Date.now() + 60000).toISOString() }, { latitude: null }])
        assert.equal((await send({ ...base, ...override })).status, 400);
    const accepted = await send(base);
    assert.equal(accepted.status, 201);
    assert.equal(accepted.data.location.updatedAt, base.timestamp);
    assert.ok(accepted.data.location.acceptedAt);
    assert.equal((await send({ ...base, timestamp: new Date(Date.now() - 2000).toISOString() })).status, 400);
    assert.equal((await store.get()).operations.liveLocations[tripId].updatedAt, base.timestamp);
});

test('assigned staff on a second route cannot operate another route or call admin endpoints', async (t) => {
    const { request, login, store } = await fixture(t);
    const driver = await login('driver');
    const first = (await request('/driver/trips/current', driver)).data.activeStaffTrip;
    const tokens = {};
    for (const role of ['driver', 'conductor']) {
        const email = `qa-second-${role}@transport.indusuni.ac.in`;
        await store.update((data) => {
            const route = data.admin.routes.find((item) => item.code === 'IU-R2');
            const record = data.admin.records[`${role}s`].find((item) => item.id === route[`${role}Id`]);
            const user = { id: `qa-second-${role}`, name: record.name, role, status: 'active', email, passwordHash: hashPassword('LocalOnly@2026!') };
            record.accountUserId = user.id;
            record.accountEmail = email;
            data.users.push(user);
            return true;
        });
        tokens[role] = (await request('/auth/login', null, { email, password: 'LocalOnly@2026!' })).data.token;
    }
    const second = (await request('/driver/trips/current', tokens.driver)).data.activeStaffTrip;
    assert.equal(second.routeCode, 'IU-R2');
    assert.equal((await request('/conductor/trips/current', tokens.conductor)).data.activeStaffTrip.id, second.id);
    assert.notEqual(second.id, first.id);
    assert.equal((await request(`/driver/trips/${first.id}/start`, driver, {})).status, 200);
    assert.equal((await request(`/driver/trips/${second.id}/start`, tokens.driver, {})).status, 200);
    const original = structuredClone((await store.get()).operations);
    for (const action of ['start', 'end', 'location']) {
        const response = await request(`/driver/trips/${first.id}/${action}`, tokens.driver, { latitude: 23.05, longitude: 72.53, accuracy: 10, timestamp: new Date().toISOString() });
        assert.equal(response.status, 400, action);
    }
    assert.equal((await request(`/conductor/trips/${first.id}/seat-updates`, tokens.conductor, { id: 'qa-wrong-route', stopId: first.nextStopId, boarded: 1, deboarded: 0 })).status, 400);
    for (const token of Object.values(tokens))
        assert.equal((await request('/staff/emergencies', token, { id: 'qa-wrong-emergency', tripId: first.id, type: 'Other', note: 'Local fixture only' })).status, 400);
    assert.deepEqual((await store.get()).operations, original, 'Rejected cross-route requests must not alter either journey');
    tokens.student = await login('student');
    const forbidden = [
        ['/admin/bootstrap', 'GET'], ['/admin/live-locations', 'GET'], ['/admin/simulation', 'POST'],
        ['/admin/buses/qa-forbidden', 'PUT'], ['/admin/drivers/qa-forbidden', 'PUT'], ['/admin/conductors/qa-forbidden', 'PUT'],
        ['/admin/students/qa-forbidden/status', 'PATCH'], ['/admin/routes/qa-forbidden', 'PUT'],
        ['/admin/buses/qa-forbidden', 'DELETE'], ['/admin/notifications', 'POST'], ['/admin/complaints/qa-forbidden', 'PATCH'],
    ];
    for (const token of Object.values(tokens)) {
        for (const [endpoint, method] of forbidden)
            assert.equal((await request(endpoint, token, method === 'GET' ? undefined : {}, method)).status, 403, `${method} ${endpoint}`);
    }
    assert.equal((await request(`/conductor/trips/${second.id}/seat-updates`, tokens.driver, {})).status, 403);
    assert.equal((await request(`/driver/trips/${second.id}/end`, tokens.conductor, {})).status, 403);
});

test('email provider failure never reports successful OTP delivery or stores a usable challenge', async (t) => {
    const unavailable = async () => { throw new Error('Controlled QA mail outage'); };
    const { request, store } = await fixture(t, { otpEmailSender: unavailable, passwordResetEmailSender: unavailable });
    const before = await store.get();
    assert.equal((await request('/auth/signup-otp', null, { email: 'qa-mail@iite.indusuni.ac.in', name: 'QA Mail' })).status, 503);
    assert.equal((await request('/auth/password-reset', null, { email: 'student@iite.indusuni.ac.in' })).status, 503);
    const after = await store.get();
    assert.deepEqual(after.signupOtps, before.signupOtps);
    assert.deepEqual(after.passwordResetOtps, before.passwordResetOtps);
});

test('database write failure is unconfirmed, retains stored data, and permits a safe retry', async (t) => {
    const { request, login, store } = await fixture(t);
    const driver = await login('driver');
    const trip = (await request('/driver/trips/current', driver)).data.activeStaffTrip;
    await request(`/driver/trips/${trip.id}/start`, driver, {});
    const before = await store.get();
    const write = t.mock.method(store, 'update', async () => { throw new Error('Controlled QA persistence outage'); });
    const input = { id: 'qa-database-retry', tripId: trip.id, type: 'Other', note: 'Local fixture only' };
    const failed = await request('/staff/emergencies', driver, input);
    assert.equal(failed.status, 500);
    assert.doesNotMatch(JSON.stringify(failed.data), /Controlled QA|stack|apiServer/);
    assert.deepEqual(await store.get(), before);
    write.mock.restore();
    const accepted = await request('/staff/emergencies', driver, input);
    assert.equal(accepted.status, 201, accepted.data.message);
    assert.equal((await request('/staff/emergencies', driver, input)).data.id, accepted.data.id);
});

test('sessions with missing or malformed lifetime metadata fail closed', async (t) => {
    const { request, login, store } = await fixture(t);
    for (const lifetime of [{}, { expiresAt: 'invalid', createdAt: 'invalid' }, { createdAt: new Date(0).toISOString() }]) {
        const token = await login('student');
        await store.update((data) => {
            data.sessions[token] = { userId: data.sessions[token].userId, ...lifetime };
            return true;
        });
        assert.equal((await request('/auth/session', token)).status, 401, 'Unverifiable session lifetime must not grant access indefinitely');
    }
    const token = await login('student');
    await store.update((data) => { delete data.sessions[token].expiresAt; return true; });
    assert.equal((await request('/auth/session', token)).status, 200, 'Valid creation time retains bounded legacy compatibility');
});

test('logout, expiry, rejection, password reset and OTP limits are enforced by the server', async (t) => {
    let otp;
    const { request, login, store } = await fixture(t, { passwordResetEmailSender: async (mail) => { otp = mail.otp; } });
    let student = await login('student');
    await request('/auth/logout', student, {});
    assert.equal((await request('/auth/session', student)).status, 401);
    student = await login('student');
    await store.update((data) => { data.sessions[student].expiresAt = new Date(0).toISOString(); return true; });
    assert.equal((await request('/auth/session', student)).status, 401);
    student = await login('student');
    await request('/auth/password-reset', null, { email: 'student@iite.indusuni.ac.in' });
    assert.equal((await request('/auth/password-reset/confirm', null, { email: 'student@iite.indusuni.ac.in', otp, password: 'Changed@123' })).status, 200);
    assert.equal((await request('/auth/session', student)).status, 401);
    assert.equal((await request('/auth/password-reset/confirm', null, { email: 'student@iite.indusuni.ac.in', otp, password: 'Changed@123' })).status, 400);
    await request('/auth/password-reset', null, { email: 'student@iite.indusuni.ac.in' });
    for (let i = 0; i < 5; i += 1) await request('/auth/password-reset/confirm', null, { email: 'student@iite.indusuni.ac.in', otp: 'not-valid', password: 'Changed@123' });
    assert.equal((await request('/auth/password-reset/confirm', null, { email: 'student@iite.indusuni.ac.in', otp, password: 'Changed@123' })).status, 400);
});

test('approval, complaints, assignment, sessions and trip counts survive a backend restart', async (t) => {
    const { request, login, store, restart } = await fixture(t);
    const admin = await login('admin'), student = await login('student'), driver = await login('driver'), conductor = await login('conductor');
    let record = (await request('/admin/bootstrap', admin)).data.records.students.find((item) => item.contact === 'student@iite.indusuni.ac.in');
    assert.ok(record);
    assert.equal((await request(`/admin/students/${record.id}`, admin, { ...record, status: 'pending' }, 'PUT')).status, 200);
    assert.equal((await request('/student/transit', student)).data.route.stops.length, 0);
    record = (await request('/admin/bootstrap', admin)).data.records.students.find((item) => item.id === record.id);
    assert.equal((await request(`/admin/students/${record.id}`, admin, { ...record, status: 'active' }, 'PUT')).status, 200);
    const complaint = (await request('/student/complaints', student, { category: 'General feedback', subject: 'QA persisted request', description: 'Isolated QA persistence verification.', relatedService: record.routeCode })).data;
    assert.equal((await request(`/admin/complaints/${complaint.id}`, admin, { status: 'resolved', resolution: 'QA resolution', internalNote: 'Private staff note' }, 'PATCH')).status, 200);
    const current = (await request('/driver/trips/current', driver)).data;
    const tripId = current.activeStaffTrip.id;
    const start = await request(`/driver/trips/${tripId}/start`, driver, {});
    assert.equal(start.data.routeTrips, undefined);
    assert.equal(start.data.liveLocations, undefined);
    await request(`/conductor/trips/${tripId}/seat-updates`, conductor, { id: 'persist-seats', stopId: current.operationalStops[0].id, boarded: 3, deboarded: 0 });
    await restart();
    assert.equal((await request('/auth/session', student)).status, 200);
    const transit = (await request('/student/transit', student)).data;
    assert.equal(transit.approvalStatus, 'approved');
    assert.equal(transit.bus.occupiedSeats, 3);
    assert.equal(transit.route.code, current.activeStaffTrip.routeCode);
    const saved = (await request('/student/complaints', student)).data.find((item) => item.id === complaint.id);
    assert.equal(saved.status, 'resolved');
    assert.equal(saved.internalNotes, undefined);
    record = (await request('/admin/bootstrap', admin)).data.records.students.find((item) => item.id === record.id);
    assert.equal((await request(`/admin/students/${record.id}`, admin, { ...record, status: 'rejected' }, 'PUT')).status, 200);
    assert.equal((await request('/auth/session', student)).status, 403);
    void store;
});

test('scheduled in-app notifications publish once when due, and read status is private and persistent', async (t) => {
    const { request, login, store } = await fixture(t);
    const admin = await login('admin'), student = await login('student');
    const body = { title: 'QA schedule', message: 'Isolated notice', audience: 'all', type: 'delay', deliveryMode: 'scheduled', scheduledFor: new Date(Date.now() + 60000).toISOString() };
    const saved = (await request('/admin/notifications', admin, body)).data;
    assert.equal(saved.status, 'scheduled');
    assert.equal((await request('/communications/bootstrap', student)).data.notifications.some((item) => item.id === saved.id), false);
    await store.update((data) => { data.communications.campaigns.find((item) => item.id === saved.id).scheduledFor = new Date(0).toISOString(); return true; });
    for (let index = 0; index < 2; index += 1)
        assert.equal((await request('/communications/bootstrap', student)).data.notifications.filter((item) => item.id === saved.id).length, 1);
    await request('/student/notifications/read', student, {});
    assert.equal((await request('/communications/bootstrap', student)).data.notifications.find((item) => item.id === saved.id).unread, false);
    assert.equal((await request('/admin/notifications', admin, { ...body, scheduledFor: 'invalid' })).status, 400);
});

test('administrator-confirmed coordinates persist across roles and invalid coordinates are rejected', async (t) => {
    const { request, login } = await fixture(t);
    const admin = await login('admin'), driver = await login('driver');
    const route = (await request('/admin/bootstrap', admin)).data.routes.find((item) => item.code === 'IU-R4');
    route.stops[0].coordinates = [23.051, 72.551];
    const saved = await request(`/admin/routes/${route.id}`, admin, route, 'PUT');
    assert.equal(saved.status, 200);
    const actual = (await request('/driver/trips/current', driver)).data.operationalStops[0];
    assert.deepEqual(actual.coordinates, [23.051, 72.551]);
    saved.data.stops[0].coordinates = [null, 72];
    assert.equal((await request(`/admin/routes/${route.id}`, admin, saved.data, 'PUT')).status, 400);
    assert.equal((await request('/admin/stops/not-a-route-stop', admin, { name: 'Ignored stop' }, 'PUT')).status, 400);
});

test('map-edited existing stops save after trip completion and survive refresh and restart for every role', async (t) => {
    const { request, login, restart } = await fixture(t);
    const admin = await login('admin'), driver = await login('driver'), conductor = await login('conductor'), student = await login('student');
    const route = (await request('/admin/bootstrap', admin)).data.routes.find((item) => item.code === 'IU-R4');
    const trip = (await request('/driver/trips/current', driver)).data.activeStaffTrip;
    const point = [23.061234, 72.512345];
    const draft = updateStopCoordinates(prepareRouteForEdit(route), route.stops[1].id, { lat: point[0], lng: point[1] });
    const payload = cleanRouteForSave(draft);
    assert.equal((await request(`/driver/trips/${trip.id}/start`, driver, {})).status, 200);
    const blocked = await request(`/admin/routes/${route.id}`, admin, payload, 'PUT');
    assert.equal(blocked.status, 400);
    assert.match(blocked.data.message, /End the active trip/);
    assert.deepEqual((await request('/admin/bootstrap', admin)).data.routes.find((item) => item.id === route.id).stops[1].coordinates, route.stops[1].coordinates);
    assert.equal((await request(`/driver/trips/${trip.id}/end`, driver, {})).status, 200);
    assert.equal((await request(`/admin/routes/${route.id}`, admin, payload, 'PUT')).status, 200);
    await restart();
    const saved = (await request('/admin/bootstrap', admin)).data.routes.find((item) => item.id === route.id);
    assert.deepEqual(saved.stops[1].coordinates, point);
    assert.equal(saved.stops[1].coordinateSource, 'admin');
    for (const [role, token] of [['driver', driver], ['conductor', conductor]])
        assert.deepEqual((await request(`/${role}/trips/current`, token)).data.operationalStops.find((stop) => stop.id === route.stops[1].id).coordinates, point);
    assert.deepEqual((await request('/student/transit', student)).data.route.stops.find((stop) => stop.id === route.stops[1].id).coordinates, point);
});

test('student notification preferences save on the server, filter notices, and survive restart', async (t) => {
    const { request, login, restart } = await fixture(t);
    const student = await login('student'), driver = await login('driver');
    const prefs = { delay: false, route: true, general: true };
    assert.equal((await request('/student/preferences', driver, prefs, 'PATCH')).status, 403);
    assert.equal((await request('/student/preferences', student, { ...prefs, delay: 'no' }, 'PATCH')).status, 400);
    assert.equal((await request('/student/preferences', student, prefs, 'PATCH')).status, 200);
    await restart();
    assert.deepEqual((await request('/student/preferences', student)).data, prefs);
    assert.equal((await request('/communications/bootstrap', student)).data.notifications.some((item) => item.type === 'delay'), false);
});

test('JSON storage serializes concurrent writes, rolls back failed mutations and survives reopening', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'smarttransit-storage-'));
    const filename = path.join(directory, 'db.json');
    const store = createDataStore(filename);
    await Promise.all(Array.from({ length: 12 }, () => store.update(async (data) => {
        const count = data.qaCount ?? 0;
        await new Promise((resolve) => setTimeout(resolve, 1));
        data.qaCount = count + 1;
        return data.qaCount;
    })));
    await assert.rejects(store.update((data) => { data.qaCount = 99; throw new Error('failed'); }));
    assert.equal((await createDataStore(filename).get()).qaCount, 12);
    assert.equal(JSON.parse(await readFile(filename, 'utf8')).qaCount, 12);
    const bad = path.join(directory, 'corrupt.json');
    await writeFile(bad, 'invalid json');
    await assert.rejects(createDataStore(bad).get());
    assert.equal(await readFile(bad, 'utf8'), 'invalid json');
});
