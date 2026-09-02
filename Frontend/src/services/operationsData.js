import { getRouteStaffAssignment } from "./adminData.js";
import { defaultStaffRoute, getBusRegistration, normalizeTripDirection, routeForTripDirection, tripDirectionLabel, withStopProgress } from "./indusRoutes.js";

export const operationalCurrentStopId = routeForTripDirection(defaultStaffRoute).stops[0]?.id ?? "";
export const operationalStops = withStopProgress(routeForTripDirection(defaultStaffRoute), operationalCurrentStopId);
const staffAssignment = getRouteStaffAssignment(defaultStaffRoute.code);

export function buildStaffTripForDirection(sourceRoute = defaultStaffRoute, direction = "morning") {
    const normalizedDirection = normalizeTripDirection(direction);
    const route = routeForTripDirection(sourceRoute, normalizedDirection);
    const nextStop = route.stops[0];
    return {
        id: normalizedDirection === "return" ? `TRIP-2026-0821-${sourceRoute.code}-PM` : `TRIP-2026-0821-${sourceRoute.code}`,
        direction: normalizedDirection,
        directionLabel: tripDirectionLabel(normalizedDirection),
        routeCode: sourceRoute.code,
        routeName: route.name,
        busNumber: sourceRoute.primaryBusNumber,
        registration: getBusRegistration(sourceRoute),
        capacity: 50,
        scheduledStart: route.stops[0]?.scheduledTime ?? sourceRoute.stops[0]?.scheduledTime,
        scheduledEnd: route.stops.at(-1)?.scheduledTime ?? sourceRoute.campusArrival,
        distance: sourceRoute.distance,
        nextStopId: nextStop.id,
        nextStopName: nextStop.name,
        nextStopEta: normalizedDirection === "return" ? "Ready to depart" : "--",
        remainingDistance: normalizedDirection === "return" ? "At campus" : "--",
        conductor: {
            id: staffAssignment.conductor.accountUserId,
            name: staffAssignment.conductor.name,
            phone: staffAssignment.conductor.phone,
            initials: staffAssignment.conductor.name.split(/\s+/).map((part) => part[0]).join(""),
        },
        driver: {
            id: staffAssignment.driver.accountUserId,
            name: staffAssignment.driver.name,
            phone: staffAssignment.driver.phone,
            initials: staffAssignment.driver.name.split(/\s+/).map((part) => part[0]).join(""),
        },
    };
}

export const activeStaffTrip = buildStaffTripForDirection(defaultStaffRoute);

export const driverTripHistory = [
    { id: "TRIP-0820-AM", date: "20 Aug 2026", routeCode: defaultStaffRoute.code, routeName: defaultStaffRoute.name, busNumber: defaultStaffRoute.primaryBusNumber, startTime: "7:49 AM", endTime: "8:38 AM", duration: "49m", status: "completed" },
    { id: "TRIP-0819-PM", date: "19 Aug 2026", routeCode: defaultStaffRoute.code, routeName: `${defaultStaffRoute.destination} - ${defaultStaffRoute.startPoint}`, busNumber: defaultStaffRoute.primaryBusNumber, startTime: "4:35 PM", endTime: "5:26 PM", duration: "51m", status: "completed" },
    { id: "TRIP-0819-AM", date: "19 Aug 2026", routeCode: defaultStaffRoute.code, routeName: defaultStaffRoute.name, busNumber: defaultStaffRoute.primaryBusNumber, startTime: "7:50 AM", endTime: "8:41 AM", duration: "51m", status: "completed" },
    { id: "TRIP-0818-PM", date: "18 Aug 2026", routeCode: defaultStaffRoute.code, routeName: `${defaultStaffRoute.destination} - ${defaultStaffRoute.startPoint}`, busNumber: defaultStaffRoute.primaryBusNumber, startTime: "--", endTime: "--", duration: "--", status: "cancelled" },
];

export const preTripItems = [
    { id: "exterior", label: "Exterior inspection", hint: "Tyres, mirrors and visible damage" },
    { id: "lights", label: "Lights and indicators", hint: "Headlights, brake lights and signals" },
    { id: "brakes", label: "Brakes and steering", hint: "Controls respond normally" },
    { id: "horn", label: "Horn", hint: "Audible and working" },
    { id: "first-aid", label: "First-aid kit", hint: "Present, sealed and accessible" },
    { id: "extinguisher", label: "Fire extinguisher", hint: "Present and within expiry" },
];
