import { defaultStaffRoute, withStopProgress } from "./indusRoutes.js";

export const operationalCurrentStopId = "iu-r4-13";
export const operationalStops = withStopProgress(defaultStaffRoute, operationalCurrentStopId);
const currentStop = operationalStops.find((stop) => stop.id === operationalCurrentStopId);

export const activeStaffTrip = {
    id: "TRIP-2026-0821-IU-R4",
    routeCode: defaultStaffRoute.code,
    routeName: defaultStaffRoute.name,
    busNumber: defaultStaffRoute.primaryBusNumber,
    registration: "GJ-01-FT-9468",
    capacity: 50,
    scheduledStart: defaultStaffRoute.stops[0].scheduledTime,
    scheduledEnd: defaultStaffRoute.campusArrival,
    distance: defaultStaffRoute.distance,
    nextStopId: currentStop.id,
    nextStopName: currentStop.name,
    nextStopEta: "8 min",
    remainingDistance: "5.8 km",
    conductor: { id: "con-101", name: "Rahul Patel", phone: "+91 98765 44210", initials: "RP" },
    driver: { id: "drv-101", name: "Imran Hussain", phone: "+91 98765 44330", initials: "IH" },
};

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
