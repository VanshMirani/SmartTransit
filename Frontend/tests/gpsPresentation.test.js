import assert from 'node:assert/strict';
import test from 'node:test';
import { driverGpsDisplay, gpsSharingLabel } from '../src/operations/gpsPresentation.js';
import { formatEventTime, formatTime } from '../src/utils/dateLabels.js';

const startedAt = '2026-09-20T07:30:00Z';
const input = {
    trip: { startedAt, etaSource: 'waiting-for-gps', nextStopEta: 'ETA unavailable', remainingDistance: 'Location unavailable' },
    nextStop: { departureEstimateAt: startedAt }, status: 'waiting', updatedAt: 'Not sharing',
};

test('a trip without GPS keeps its departure plan and clearly identifies missing live data', () => {
    const display = driverGpsDisplay(input);
    assert.equal(display.sharing, false);
    assert.equal(display.label, 'Start-based arrival');
    assert.equal(display.value, formatTime(startedAt));
    assert.equal(display.note, 'Departure plan, not a live GPS estimate');
    assert.equal(display.lastAccepted, 'No location received yet');
    assert.equal(display.speed, 'Waiting for GPS');
    assert.equal(display.distance, 'Waiting for GPS');
    assert.match(display.message, /Allow location access/);
});

test('only accepted sharing GPS exposes live metrics; stale and failed states retain recorded times', () => {
    const liveInput = { ...input, status: 'sharing', updatedAt: startedAt,
        trip: { ...input.trip, etaSource: 'driver-phone-speed', nextStopEta: '8 min', remainingDistance: '2 km', currentSpeed: 24 },
    };
    const live = driverGpsDisplay(liveInput);
    assert.equal(live.label, 'Live ETA');
    assert.equal(live.value, '8 min');
    assert.equal(live.distance, '2 km');
    assert.equal(live.speed, '24 km/h');
    for (const status of ['waiting', 'requesting', 'sending', 'error', 'permission', 'weak', 'unsupported']) {
        const display = driverGpsDisplay({ ...liveInput, status, error: 'Specific failure' });
        assert.equal(display.sharing, false);
        assert.equal(display.label, 'Start-based arrival');
        assert.equal(display.speed, 'Waiting for GPS');
        assert.equal(display.distance, 'Waiting for GPS');
        assert.equal(display.lastAccepted, formatEventTime(startedAt));
        assert.equal(display.message, 'Specific failure');
        assert.notEqual(gpsSharingLabel(status), 'GPS Active');
    }
    assert.equal(driverGpsDisplay({ ...liveInput, updatedAt: null }).sharing, false);
    assert.equal(gpsSharingLabel('sharing', false), 'GPS Inactive');
});

test('missing departure plans and unusable GPS estimates never become fabricated live arrivals', () => {
    assert.equal(driverGpsDisplay({ ...input, nextStop: {} }).value, 'ETA unavailable');
    const stopped = driverGpsDisplay({ ...input, status: 'sharing', updatedAt: startedAt,
        trip: { ...input.trip, etaSource: 'unavailable', currentSpeed: 0 },
    });
    assert.equal(stopped.label, 'Start-based arrival');
    assert.equal(stopped.speed, '0 km/h');
    assert.equal(stopped.distance, 'Distance unavailable');
});
