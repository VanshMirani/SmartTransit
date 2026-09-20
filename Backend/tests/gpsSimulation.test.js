import assert from 'node:assert/strict';
import test from 'node:test';
import { createGpsSimulator } from '../gpsSimulation.js';

const route = { code: 'IU-R999', stops: [{ id: 'a', coordinates: [23.03, 72.4] }, { id: 'b', coordinates: [23.04, 72.4] }, { id: 'c', coordinates: [23.05, 72.4] }] };
test('GPS simulation advances, pauses, completes, expires and never edits its source route', () => {
    let now = Date.now();
    let calls = 0;
    const original = structuredClone(route);
    const simulator = createGpsSimulator({ clock: () => now, project: (_route, trip, location) => { calls += 1; return { nextStopId: trip.nextStopId, coordinates: location.coordinates }; } });
    const created = simulator.create('session-one', route, { speedKmh: 30, playbackRate: 60 });
    assert.equal(created.simulation, true);
    assert.equal(simulator.get('other-session').status, 'idle');
    now += 1000;
    const moving = simulator.get('session-one');
    assert.ok(moving.travelledKm > 0.4);
    assert.ok(calls > 2, 'movement supplies intermediate points instead of skipping whole stops');
    assert.equal(moving.location.source, 'simulation');
    const paused = simulator.update('session-one', { id: created.id, action: 'pause' });
    const recordedAt = paused.location.updatedAt;
    now += 30000;
    const stillPaused = simulator.get('session-one');
    assert.equal(stillPaused.travelledKm, paused.travelledKm);
    assert.equal(stillPaused.location.updatedAt, recordedAt);
    assert.equal(simulator.update('session-one', { id: 'old-id', action: 'resume' }).error.length > 0, true);
    simulator.update('session-one', { id: created.id, action: 'resume' });
    now += 10000;
    assert.equal(simulator.get('session-one').status, 'completed');
    assert.deepEqual(route, original);
    now += 31 * 60000;
    assert.equal(simulator.get('session-one').status, 'idle');
});

test('GPS simulation rejects invalid speed, coordinates and collapsed stop locations', () => {
    const simulator = createGpsSimulator({ project: () => ({}) });
    for (const speedKmh of [-1, 0, 100, '24', null]) assert.ok(simulator.create('s', route, { speedKmh }).error);
    assert.ok(simulator.create('s', route, { playbackRate: 10000 }).error);
    assert.ok(simulator.create('s', { ...route, stops: [route.stops[0], route.stops[0]] }).error);
    assert.ok(simulator.create('s', { ...route, stops: [{ id: 'a', coordinates: [100, 0] }, route.stops[1]] }).error);
    assert.equal(simulator.remove('missing').status, 'idle');
});
