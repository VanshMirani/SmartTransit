import assert from 'node:assert/strict';
import test from 'node:test';
import { dailyPerformance, recordedReports, transportDate } from '../src/services/recordedReports.js';
import { summarizeRoutes } from '../src/services/reportData.js';
test('reports use actual completed records without inventing dated schedules or attendance', () => {
    const rows = recordedReports([
        { routeCode: 'IU-R9', startedAt: '2026-09-04T22:00:00Z', completedAt: '2026-09-04T23:00:00Z', seatUpdates: [{ boarded: 30 }, { boarded: 5, deboarded: 2 }] },
        { routeCode: 'IU-R9', startedAt: '2026-09-05T00:00:00Z' },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].date, '2026-09-05');
    assert.equal(rows[0].studentJourneys, 35);
    assert.equal(summarizeRoutes(rows)[0].measuredTrips, 0);
    assert.equal(transportDate('not a timestamp'), '');
});

test('daily on-time charts use measured trips, preserve unknown days and sort chronologically', () => {
    const rows = recordedReports([
        { routeCode: 'IU-R9', startedAt: '2026-09-06T04:00:00Z', completedAt: '2026-09-06T05:00:00Z' },
        { routeCode: 'IU-R9', startedAt: '2026-09-05T04:00:00Z', completedAt: '2026-09-05T05:00:00Z', scheduledArrivalAt: '2026-09-05T05:00:00Z' },
        { routeCode: 'IU-R9', startedAt: '2026-09-05T05:00:00Z', completedAt: '2026-09-05T06:00:00Z' },
    ]);
    const days = dailyPerformance(rows);
    assert.equal(days[0].date, '2026-09-05');
    assert.equal(days[0].trips, 2);
    assert.equal(days[0].onTimeRate, 100);
    assert.equal(days[1].onTimeRate, null);
    assert.equal(summarizeRoutes(rows)[0].onTimeRate, 100);
});
