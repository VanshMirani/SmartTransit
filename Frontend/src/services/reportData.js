import { indusRoutes } from "./indusRoutes.js";

const routes = indusRoutes.map((route) => [route.code, route.name, route.studentCount]);
const usagePattern = [
    92, 105, 111, 108, 116, 72, 68, 98, 109, 114, 118, 121, 76, 70,
];
const delayPattern = [1, 0, 2, 1, 1, 0, 0, 1, 2, 1, 0, 2, 0, 1];

export const routeReportRecords = Array.from({ length: 14 }, (_, dayIndex) => {
    const date = new Date(Date.UTC(2026, 7, 8 + dayIndex))
        .toISOString()
        .slice(0, 10);
    return routes.map(([routeCode, routeName, studentCount], routeIndex) => {
        const weekend = [0, 6].includes(new Date(`${date}T12:00:00`).getDay());
        const trips = weekend ? 2 + (routeIndex % 2) : 4 + (routeIndex % 3);
        const delayedTrips = Math.min(trips, delayPattern[(dayIndex + routeIndex * 2) % delayPattern.length] +
            (routeCode === "IU-R5" && dayIndex % 4 === 0 ? 1 : 0));
        return {
            date,
            routeCode,
            routeName,
            trips,
            onTimeTrips: trips - delayedTrips,
            delayedTrips,
            averageDelayMinutes: delayedTrips === 0 ? 0 : 6 + ((dayIndex + routeIndex * 3) % 9),
            studentJourneys: studentCount + usagePattern[dayIndex] - 60 + routeIndex * 4 + (weekend ? -18 : 0),
        };
    });
}).flat();

export const reportRouteOptions = [
    { value: "all", label: "All routes" },
    ...indusRoutes.map((route) => ({ value: route.code, label: `${route.code} - ${route.name}` })),
];

export function summarizeRoutes(records) {
    const byRoute = new Map();
    records.forEach((record) => {
        const current = byRoute.get(record.routeCode) ?? {
            routeCode: record.routeCode,
            routeName: record.routeName,
            trips: 0,
            onTimeTrips: 0,
            delayedTrips: 0,
            averageDelayMinutes: 0,
            studentJourneys: 0,
            onTimeRate: 0,
        };
        const delayedMinutes = current.averageDelayMinutes * current.delayedTrips +
            record.averageDelayMinutes * record.delayedTrips;
        current.trips += record.trips;
        current.onTimeTrips += record.onTimeTrips;
        current.delayedTrips += record.delayedTrips;
        current.studentJourneys += record.studentJourneys;
        current.averageDelayMinutes = current.delayedTrips
            ? delayedMinutes / current.delayedTrips
            : 0;
        current.onTimeRate = current.trips
            ? (current.onTimeTrips / current.trips) * 100
            : 0;
        byRoute.set(record.routeCode, current);
    });
    return [...byRoute.values()];
}
