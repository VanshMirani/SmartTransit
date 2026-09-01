import { defaultStudentRoute, getBusRegistration, getRouteServiceLabel, withStopProgress } from "./indusRoutes.js";
import { formatShortDateTime, minutesAgo, relativeTimeLabel } from "../utils/dateLabels.js";

const selectedStopId = "iu-r4-13";
const routeStops = withStopProgress(defaultStudentRoute, selectedStopId).map((stop) => ({
    ...stop,
    ...(stop.id === selectedStopId
        ? { eta: "8 min" }
        : stop.status === "upcoming"
            ? { eta: stop.name === defaultStudentRoute.destination ? "23 min" : "14 min" }
            : {}),
}));
const selectedStop = routeStops.find((stop) => stop.id === selectedStopId);
const serviceLabel = getRouteServiceLabel(defaultStudentRoute);

export const studentTransitData = {
    bus: {
        id: `bus-${defaultStudentRoute.primaryBusNumber}`,
        number: defaultStudentRoute.primaryBusNumber,
        registration: getBusRegistration(defaultStudentRoute),
        capacity: 50,
        occupiedSeats: 33,
        status: "on-time",
        speed: 32,
        gpsUpdatedAt: relativeTimeLabel(minutesAgo(0)),
        seatsUpdatedAt: relativeTimeLabel(minutesAgo(2)),
        coordinates: [23.056, 72.476],
    },
    route: {
        id: defaultStudentRoute.id,
        code: defaultStudentRoute.code,
        name: defaultStudentRoute.name,
        startPoint: defaultStudentRoute.startPoint,
        destination: defaultStudentRoute.destination,
        distance: defaultStudentRoute.distance,
        scheduledArrival: defaultStudentRoute.campusArrival,
        selectedStopId,
        currentStopId: selectedStopId,
        mapCenter: defaultStudentRoute.mapCenter,
        notes: defaultStudentRoute.notes,
        stops: routeStops,
    },
    notifications: [
        { id: "notif-1", type: "delay", title: `Traffic near ${selectedStop.name}`, message: "Your bus may be delayed by approximately 10 minutes.", createdAt: relativeTimeLabel(minutesAgo(2)), unread: true },
        { id: "notif-2", type: "route-change", title: `Route ${defaultStudentRoute.code} pickup note`, message: `${selectedStop.name} pickup is operating from the regular marked point today.`, createdAt: formatShortDateTime(minutesAgo(24 * 60)), unread: true },
        { id: "notif-3", type: "general", title: "Transport help desk", message: "The campus transport office is available from 8 AM to 5 PM.", createdAt: formatShortDateTime(minutesAgo(3 * 24 * 60)), unread: false },
        { id: "notif-4", type: "cancellation", title: "Evening return reminder", message: "Evening buses will depart from the Indus University main gate.", createdAt: formatShortDateTime(minutesAgo(5 * 24 * 60)), unread: false },
    ],
};

export const initialComplaints = [
    { id: "CMP-2026-0412", category: "Delay", subject: "Morning bus arrived late", description: `The bus reached ${selectedStop.name} around 15 minutes after the displayed time.`, relatedService: serviceLabel, status: "resolved", createdAt: "12 Aug 2026", updatedAt: "14 Aug 2026", resolution: "Traffic congestion was confirmed. The trip schedule has been adjusted by five minutes." },
    { id: "CMP-2026-0442", category: "Bus condition", subject: "Air conditioning needs attention", description: "Cooling was inconsistent during the afternoon trip.", relatedService: serviceLabel, status: "in-progress", createdAt: "18 Aug 2026", updatedAt: "19 Aug 2026" },
];
