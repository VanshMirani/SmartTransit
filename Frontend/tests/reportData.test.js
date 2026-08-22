import assert from "node:assert/strict";
import test from "node:test";
import { routeReportRecords, summarizeRoutes, } from "../src/services/reportData.js";
test("report records cover eight routes and fourteen days", () => {
    assert.equal(new Set(routeReportRecords.map((item) => item.routeCode)).size, 8);
    assert.equal(new Set(routeReportRecords.map((item) => item.date)).size, 14);
    assert.equal(routeReportRecords.length, 112);
});
test("route summary preserves trip and journey totals", () => {
    const records = routeReportRecords.filter((item) => item.routeCode === "IU-R5");
    const [summary] = summarizeRoutes(records);
    assert.equal(summary.trips, records.reduce((sum, item) => sum + item.trips, 0));
    assert.equal(summary.studentJourneys, records.reduce((sum, item) => sum + item.studentJourneys, 0));
    assert.ok(summary.onTimeRate >= 0 && summary.onTimeRate <= 100);
});
test("a route without report records produces an empty summary", () => {
    assert.deepEqual(summarizeRoutes(routeReportRecords.filter((item) => item.routeCode === "IU-R99")), []);
});
