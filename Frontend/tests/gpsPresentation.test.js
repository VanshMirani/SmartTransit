import assert from 'node:assert/strict';
import test from 'node:test';
import { driverGpsDisplay, driverGuidanceStops, gpsSharingLabel } from '../src/operations/gpsPresentation.js';
import { formatEventTime, formatTime } from '../src/utils/dateLabels.js';

const startedAt = '2026-09-20T07:30:00Z';
const input = {
    trip: { startedAt, etaSource: 'waiting-for-gps', nextStopEta: 'ETA unavailable', remainingDistance: 'Location unavailable' },
    nextStop: { departureEstimateAt: startedAt }, status: 'waiting', updatedAt: 'Not sharing',
};

test('sub-1 km/h GPS speed is not rounded into the minimum ETA threshold', () => {
    for (const speed of [0.01, 0.5, 0.99]) {
        const display = driverGpsDisplay({ ...input, status: 'sharing', updatedAt: startedAt,
            trip: { ...input.trip, currentSpeed: speed, etaSource: 'stationary' },
        });
        assert.equal(display.speed, '<1 km/h');
        assert.equal(display.value, 'ETA unavailable');
    }
    for (const speed of [-1, NaN, Infinity, null, undefined]) {
        assert.equal(driverGpsDisplay({ ...input, status: 'sharing', updatedAt: startedAt,
            trip: { ...input.trip, currentSpeed: speed },
        }).speed, 'Waiting for GPS');
    }
});

test('guidance starts at the actual next stop throughout outbound and return journeys', () => {
    const stops = Array.from({ length: 9 }, (_, index) => ({ id: `stop-${index}`, status: index < 6 ? 'completed' : index === 6 ? 'current' : 'upcoming' }));
    assert.deepEqual(driverGuidanceStops(stops, 'stop-0'), stops.slice(0, 4));
    assert.deepEqual(driverGuidanceStops(stops, 'stop-6'), stops.slice(6));
    assert.deepEqual(driverGuidanceStops(stops, 'missing'), stops.slice(6));
    const returning = [...stops].reverse().map((stop) => ({ ...stop, status: 'upcoming' }));
    assert.deepEqual(driverGuidanceStops(returning, 'stop-7'), returning.slice(1, 5));
    assert.deepEqual(driverGuidanceStops(returning), returning.slice(0, 4));
    assert.deepEqual(driverGuidanceStops(stops.map((stop) => ({ ...stop, status: 'completed' }))), []);
    assert.deepEqual(driverGuidanceStops([]), []);
});

test('a trip without GPS does not present its departure plan as an arrival prediction', () => {
    const display = driverGpsDisplay(input);
    assert.equal(display.sharing, false);
    assert.equal(display.label, 'Estimated arrival');
    assert.equal(display.value, 'ETA unavailable');
    assert.equal(display.note, 'Waiting for a reliable GPS location');
    assert.equal(display.lastAccepted, 'No location received yet');
    assert.equal(display.speed, 'Waiting for GPS');
    assert.equal(display.distance, 'Waiting for GPS');
    assert.match(display.message, /Allow location access/);
});

test('only accepted sharing GPS exposes live metrics; stale and failed states retain recorded times', () => {
    const liveInput = { ...input, status: 'sharing', updatedAt: startedAt,
        trip: { ...input.trip, etaSource: 'driver-phone-speed', nextStopEta: '8 min', remainingDistance: '~2 km', currentSpeed: 24,
            nextStopEstimatedArrivalAt: '2026-09-20T07:38:00Z', etaNote: 'Approximate distance and GPS speed. No road or traffic data.' },
    };
    const live = driverGpsDisplay(liveInput);
    assert.equal(live.label, 'Estimated arrival');
    assert.equal(live.value, formatTime(liveInput.trip.nextStopEstimatedArrivalAt));
    assert.match(live.note, /8 min away/);
    assert.equal(live.distance, '~2 km');
    assert.equal(live.speed, '24 km/h');
    for (const status of ['waiting', 'requesting', 'sending', 'error', 'permission', 'weak', 'unsupported']) {
        const display = driverGpsDisplay({ ...liveInput, status, error: 'Specific failure' });
        assert.equal(display.sharing, false);
        assert.equal(display.value, 'ETA unavailable');
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
        trip: { ...input.trip, etaSource: 'stationary', currentSpeed: 0, remainingDistance: '~2 km', etaNote: 'Bus stopped.' },
    });
    assert.equal(stopped.value, 'ETA unavailable');
    assert.equal(stopped.speed, '0 km/h');
    assert.equal(stopped.distance, '~2 km');
    assert.equal(stopped.note, 'Bus stopped.');
});

test('a distance-derived clock takes precedence over an old departure plan and names assumed speed', () => {
    const display = driverGpsDisplay({ ...input, status: 'sharing', updatedAt: startedAt,
        nextStop: { departureEstimateAt: '2026-09-20T01:00:00Z', estimatedArrivalAt: '2026-09-20T08:00:00Z' },
        trip: { ...input.trip, etaSource: 'driver-phone-average', nextStopEta: '30 min', remainingDistance: '~12 km',
            etaNote: 'Approximate distance; assumed 24 km/h. No road or traffic data.' },
    });
    assert.equal(display.value, formatTime('2026-09-20T08:00:00Z'));
    assert.match(display.note, /assumed 24 km\/h/);
    assert.equal(display.distance, '~12 km');
    assert.equal(display.speed, 'Waiting for GPS');
});
