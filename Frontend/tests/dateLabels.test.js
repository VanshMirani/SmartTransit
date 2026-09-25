import assert from 'node:assert/strict';
import test from 'node:test';
import { currentGreeting, formatEventTime, stopTimeLabel, stopTimeSource } from '../src/utils/dateLabels.js';

test('recorded events use a real timestamp, never a permanently fresh legacy label', () => {
    for (const value of [undefined, null, '', '2 min ago', 'Just now', 'Yesterday, 7:00 PM', 'invalid'])
        assert.equal(formatEventTime(value), 'Not available');
    assert.match(formatEventTime('2026-09-25T08:00:00Z'), /25 Sept?, 1:30 pm/i);
});

test('greetings follow transport local time rather than a fixed morning label', () => {
    assert.equal(currentGreeting('2026-09-05T02:00:00Z'), 'Good morning');
    assert.equal(currentGreeting('2026-09-05T08:00:00Z'), 'Good afternoon');
    assert.equal(currentGreeting('2026-09-05T14:00:00Z'), 'Good evening');
});

test('active stop arrivals use distance estimates rather than scheduled or start-based plans', () => {
    const stop = { scheduledTime: '7:30 AM', departureEstimateAt: '2026-09-20T04:00:00Z' };
    assert.equal(stopTimeLabel(stop, false), '7:30 AM');
    assert.equal(stopTimeSource(stop, false), 'Scheduled');
    assert.equal(stopTimeLabel(stop), 'ETA unavailable');
    assert.equal(stopTimeSource(stop), 'Estimate unavailable');
    const live = { ...stop, estimatedArrivalAt: '2026-09-20T04:10:00Z' };
    assert.equal(stopTimeLabel(live), formatEventTime(live.estimatedArrivalAt));
    assert.equal(stopTimeSource(live), 'Distance-based estimate');
    assert.equal(stopTimeSource({ ...live, estimatedArrivalAt: null }), 'Estimate unavailable');
});

test('active stop times never fall back to the fixed timetable when estimates are missing or invalid', () => {
    for (const fields of [{}, { estimatedArrivalAt: 'invalid', departureEstimateAt: 'invalid' }]) {
        const stop = { scheduledTime: '7:30 AM', ...fields };
        assert.equal(stopTimeLabel(stop, true), 'ETA unavailable');
        assert.equal(stopTimeSource(stop, true), 'Estimate unavailable');
        assert.equal(stopTimeLabel(stop, false), '7:30 AM');
    }
    const planned = { estimatedArrivalAt: 'invalid', departureEstimateAt: '2026-09-20T04:00:00Z' };
    assert.equal(stopTimeLabel(planned), 'ETA unavailable');
    assert.equal(stopTimeSource(planned), 'Estimate unavailable');
});

test('assumed speed and GPS-passed stops are identified without displaying historical plans as arrivals', () => {
    const estimated = { estimatedArrivalAt: '2026-09-20T04:10:00Z', etaSource: 'driver-phone-average', etaSpeedKmh: 24 };
    assert.equal(stopTimeSource(estimated), 'Estimate (assumed 24 km/h)');
    assert.equal(stopTimeLabel({ ...estimated, status: 'completed' }), 'Passed');
    assert.equal(stopTimeSource({ ...estimated, status: 'completed' }), 'GPS progress');
});
