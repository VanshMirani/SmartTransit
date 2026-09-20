import assert from 'node:assert/strict';
import test from 'node:test';
import { captureStopOffsets, stopsWithDepartureEstimates } from '../tripTiming.js';

const stops = [{ id: 'a', scheduledTime: '7:30 AM' }, { id: 'b', scheduledTime: '7:45 AM' }, { id: 'c', scheduledTime: '8:00 AM' }];

test('early and late departures shift stop estimates without changing the timetable', () => {
    const offsets = captureStopOffsets(stops);
    assert.deepEqual(offsets.map((item) => item.offsetMinutes), [0, 15, 30]);
    for (const start of ['2026-09-20T07:00:00+05:30', '2026-09-20T11:00:00+05:30']) {
        const timed = stopsWithDepartureEstimates(stops, { startedAt: start, plannedStopOffsets: offsets });
        assert.deepEqual(timed.map((stop) => stop.scheduledTime), ['7:30 AM', '7:45 AM', '8:00 AM']);
        assert.equal(Date.parse(timed[2].departureEstimateAt) - Date.parse(start), 30 * 60000);
        assert.equal(timed[0].departureEstimateAt, new Date(start).toISOString());
    }
});

test('journey estimates preserve midnight rollover and reject malformed or backwards schedules', () => {
    const overnight = [{ id: 'a', scheduledTime: '23:50' }, { id: 'b', scheduledTime: '12:10 AM' }];
    const timed = stopsWithDepartureEstimates(overnight, { startedAt: '2026-09-20T23:55:00+05:30' });
    assert.equal(timed[1].departureEstimateAt, new Date('2026-09-21T00:15:00+05:30').toISOString());
    for (const value of ['', 'garbage', '25:10', '13:10 PM', '7:99 AM', '7:00 AM'])
        assert.deepEqual(captureStopOffsets([stops[0], { id: 'b', scheduledTime: value }]), []);
    assert.equal(stopsWithDepartureEstimates(stops, {})[0].departureEstimateAt, null);
    assert.equal(stopsWithDepartureEstimates(stops, { startedAt: 'invalid' })[0].departureEstimateAt, null);
});

test('a saved trip plan is stable after refresh and subsequent route timetable edits', () => {
    const trip = { startedAt: '2026-09-20T09:00:00+05:30', plannedStopOffsets: captureStopOffsets(stops) };
    const before = stopsWithDepartureEstimates(stops, trip);
    const changed = stopsWithDepartureEstimates(stops.map((stop) => ({ ...stop, scheduledTime: '10:30 AM' })), trip);
    assert.deepEqual(changed.map((stop) => stop.departureEstimateAt), before.map((stop) => stop.departureEstimateAt));
});
