import assert from 'node:assert/strict';
import test from 'node:test';
import { currentGreeting, formatEventTime, stopTimeLabel, stopTimeSource } from '../src/utils/dateLabels.js';

test('greetings follow transport local time rather than a fixed morning label', () => {
    assert.equal(currentGreeting('2026-09-05T02:00:00Z'), 'Good morning');
    assert.equal(currentGreeting('2026-09-05T08:00:00Z'), 'Good afternoon');
    assert.equal(currentGreeting('2026-09-05T14:00:00Z'), 'Good evening');
});

test('stop labels distinguish timetable, departure plan and live GPS estimate', () => {
    const stop = { scheduledTime: '7:30 AM', departureEstimateAt: '2026-09-20T04:00:00Z' };
    assert.equal(stopTimeLabel(stop, false), '7:30 AM');
    assert.equal(stopTimeSource(stop, false), 'Scheduled');
    assert.equal(stopTimeLabel(stop), formatEventTime(stop.departureEstimateAt));
    assert.equal(stopTimeSource(stop), 'Start-based estimate');
    const live = { ...stop, estimatedArrivalAt: '2026-09-20T04:10:00Z' };
    assert.equal(stopTimeLabel(live), formatEventTime(live.estimatedArrivalAt));
    assert.equal(stopTimeSource(live), 'GPS estimate');
    assert.equal(stopTimeSource({ ...live, estimatedArrivalAt: null }), 'Start-based estimate');
});

test('active stop times never fall back to the fixed timetable when estimates are missing or invalid', () => {
    for (const fields of [{}, { estimatedArrivalAt: 'invalid', departureEstimateAt: 'invalid' }]) {
        const stop = { scheduledTime: '7:30 AM', ...fields };
        assert.equal(stopTimeLabel(stop, true), 'ETA unavailable');
        assert.equal(stopTimeSource(stop, true), 'Estimate unavailable');
        assert.equal(stopTimeLabel(stop, false), '7:30 AM');
    }
    const planned = { estimatedArrivalAt: 'invalid', departureEstimateAt: '2026-09-20T04:00:00Z' };
    assert.equal(stopTimeLabel(planned), formatEventTime(planned.departureEstimateAt));
    assert.equal(stopTimeSource(planned), 'Start-based estimate');
});
