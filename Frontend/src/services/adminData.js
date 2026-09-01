import { getBusRegistration, indusRoutes } from "./indusRoutes.js";
import { minutesAgo, relativeTimeLabel } from "../utils/dateLabels.js";

const drivers = [
    ["driver-101", "Imran Hussain", "GJ05-2021-4567", "+91 98765 44330"],
    ["driver-102", "Faisal Ansari", "GJ01-2019-6721", "+91 98765 44331"],
    ["driver-103", "Ketan More", "GJ18-2020-8834", "+91 98765 44332"],
    ["driver-104", "Nadeem Shaikh", "GJ06-2018-3421", "+91 98765 44333"],
    ["driver-105", "Zubair Ali", "GJ01-2022-1902", "+91 98765 44334"],
    ["driver-106", "Bhavesh Rana", "GJ01-2020-7712", "+91 98765 44335"],
    ["driver-107", "Jignesh Parmar", "GJ27-2017-6401", "+91 98765 44336"],
    ["driver-108", "Sohail Shaikh", "GJ01-2023-1188", "+91 98765 44337"],
];

const conductors = [
    ["conductor-101", "Rahul Patel", "+91 98765 44210"],
    ["conductor-102", "Arjun Mehta", "+91 98765 44211"],
    ["conductor-103", "Sameer Khan", "+91 98765 44212"],
    ["conductor-104", "Dev Shah", "+91 98765 44213"],
    ["conductor-105", "Mahesh Prajapati", "+91 98765 44214"],
    ["conductor-106", "Kunal Trivedi", "+91 98765 44215"],
    ["conductor-107", "Ritesh Solanki", "+91 98765 44216"],
    ["conductor-108", "Harsh Vyas", "+91 98765 44217"],
];

const routeStaffAssignments = {
    "IU-R1": { driverId: "driver-104", conductorId: "conductor-104" },
    "IU-R2": { driverId: "driver-102", conductorId: "conductor-102" },
    "IU-R3": { driverId: "driver-103", conductorId: "conductor-103" },
    "IU-R4": { driverId: "driver-101", conductorId: "conductor-101" },
    "IU-R5": { driverId: "driver-105", conductorId: "conductor-105" },
    "IU-R6": { driverId: "driver-106", conductorId: "conductor-106" },
    "IU-R7": { driverId: "driver-107", conductorId: "conductor-107" },
    "IU-R8": { driverId: "driver-108", conductorId: "conductor-108" },
};

const driverById = new Map(drivers.map((driver) => [driver[0], driver]));
const conductorById = new Map(conductors.map((conductor) => [conductor[0], conductor]));

function routeForDriver(driverId) {
    return indusRoutes.find((route) => routeStaffAssignments[route.code]?.driverId === driverId);
}

function routeForConductor(conductorId) {
    return indusRoutes.find((route) => routeStaffAssignments[route.code]?.conductorId === conductorId);
}

export function getRouteStaffAssignment(routeCode) {
    const assignment = routeStaffAssignments[routeCode] ?? routeStaffAssignments["IU-R4"];
    const driver = driverById.get(assignment.driverId) ?? drivers[0];
    const conductor = conductorById.get(assignment.conductorId) ?? conductors[0];
    return {
        driver: {
            id: driver[0],
            name: driver[1],
            licence: driver[2],
            phone: driver[3],
            accountEmail: driver[0] === "driver-101" ? "driver@transport.indusuni.ac.in" : "",
            accountUserId: driver[0] === "driver-101" ? "drv-101" : "",
        },
        conductor: {
            id: conductor[0],
            name: conductor[1],
            phone: conductor[2],
            accountEmail: conductor[0] === "conductor-101" ? "conductor@transport.indusuni.ac.in" : "",
            accountUserId: conductor[0] === "conductor-101" ? "con-101" : "",
        },
    };
}

const vehicleModels = [
    "Tata Starbus",
    "Eicher Skyline",
    "Ashok Leyland",
    "Volvo 9400",
    "Yutong ZK6128",
    "Daewoo BH120F",
    "BharatBenz Staff Bus",
    "SML Isuzu Executive",
];

const routeStatuses = ["active", "active", "active", "active", "active", "active", "maintenance", "active"];
const fleetStatuses = ["on-trip", "delayed", "on-trip", "on-trip", "stale-gps", "on-trip", "stopped", "on-trip"];
const capacities = [52, 50, 48, 50, 52, 48, 50, 52];
const occupancies = [37, 42, 31, 33, 28, 39, 0, 35];

export const buildRouteStopRecord = (route, index, stop) => ({
    id: `${route.code.toLowerCase()}-stop-${String(index + 1).padStart(2, "0")}`,
    name: stop.name,
    code: `STP-${route.code.replace("IU-R", "").padStart(2, "0")}${String(index + 1).padStart(2, "0")}`,
    detail: stop.coordinates.join(", "),
    contact: stop.scheduledTime,
    assignment: `${route.code} - Stop ${index + 1}`,
    routeCode: route.code,
    routeId: route.id,
    stopId: stop.id,
    stopOrder: index + 1,
    status: "active",
});

const studentRouteAssignment = (routeCode, stopName) => {
    const route = indusRoutes.find((item) => item.code === routeCode);
    const stop = route?.stops.find((item) => item.name === stopName);
    return {
        routeCode,
        stopId: stop?.id ?? "",
        assignment: `${routeCode} - ${stopName}`,
    };
};

const initialBuses = indusRoutes.map((route, index) => ({
    id: `bus-${route.primaryBusNumber}`,
    name: route.primaryBusNumber,
    code: getBusRegistration(route),
    detail: vehicleModels[index],
    contact: `${capacities[index]} seats`,
    assignment: `${route.code} - ${getRouteStaffAssignment(route.code).driver.name}`,
    status: index === 6 ? "inactive" : "active",
}));

const initialDrivers = drivers.map(([id, name, licence, contact], index) => {
    const route = routeForDriver(id);
    return {
        id,
        name,
        code: `DRV-${String(index + 1).padStart(3, "0")}`,
        detail: `Licence ${licence}`,
        contact,
        assignment: route ? `${route.primaryBusNumber} - ${route.code}` : "Unassigned",
        accountEmail: id === "driver-101" ? "driver@transport.indusuni.ac.in" : "",
        accountUserId: id === "driver-101" ? "drv-101" : "",
        status: index === 6 ? "inactive" : "active",
    };
});

const initialConductors = conductors.map(([id, name, contact], index) => {
    const route = routeForConductor(id);
    return {
        id,
        name,
        code: `CON-${String(index + 1).padStart(3, "0")}`,
        detail: index % 2 === 0 ? "Morning and evening shift" : "Morning shift",
        contact,
        assignment: route ? `${route.primaryBusNumber} - ${route.code}` : "Unassigned",
        accountEmail: id === "conductor-101" ? "conductor@transport.indusuni.ac.in" : "",
        accountUserId: id === "conductor-101" ? "con-101" : "",
        status: index === 6 ? "inactive" : "active",
    };
});

export const initialAdminRecords = {
    buses: initialBuses,
    drivers: initialDrivers,
    conductors: initialConductors,
    students: [
        {
            id: "student-001",
            name: "Aarav Shah",
            code: "IU23CSE2023",
            detail: "Computer Science - Semester 7",
            contact: "student@iite.indusuni.ac.in",
            ...studentRouteAssignment("IU-R4", "Shilaj Circle"),
            status: "active",
        },
    ],
    stops: indusRoutes.flatMap((route) => route.stops.map((stop, index) => buildRouteStopRecord(route, index, stop))),
};

export const initialRoutes = indusRoutes.map((route, index) => ({
    id: route.id,
    code: route.code,
    name: route.name,
    startPoint: route.startPoint,
    destination: route.destination,
    campusArrival: route.campusArrival,
    distance: route.distance,
    primaryBusNumber: route.primaryBusNumber,
    mapCenter: route.mapCenter,
    notes: route.notes,
    status: routeStatuses[index],
    busId: `bus-${route.primaryBusNumber}`,
    driverId: getRouteStaffAssignment(route.code).driver.id,
    conductorId: getRouteStaffAssignment(route.code).conductor.id,
    stops: route.stops.map((stop) => ({
        id: stop.id,
        name: stop.name,
        scheduledTime: stop.scheduledTime,
        coordinates: stop.coordinates,
    })),
}));

export const fleetVehicles = indusRoutes.map((route, index) => {
    const currentStop = route.stops[Math.min(2 + (index % 4), route.stops.length - 2)];
    const status = fleetStatuses[index];
    const staff = getRouteStaffAssignment(route.code);
    return {
        id: `bus-${route.primaryBusNumber}`,
        number: route.primaryBusNumber,
        route: route.code,
        driver: staff.driver.name,
        speed: status === "stopped" || status === "stale-gps" ? 0 : 24 + index * 3,
        eta: status === "stopped" ? "--" : `${8 + index} min`,
        occupancy: occupancies[index],
        capacity: capacities[index],
        gpsUpdated: status === "stale-gps" ? relativeTimeLabel(minutesAgo(12)) : status === "stopped" ? "Not sharing" : relativeTimeLabel(minutesAgo(0)),
        status,
        tripActive: status !== "stopped",
        coordinates: currentStop.coordinates,
    };
});

export const adminActivity = [
    `Bus ${indusRoutes[1].primaryBusNumber} started trip on Route ${indusRoutes[1].code}`,
    "Complaint CMP-2026-0445 assigned to Operations Team",
    `Route ${indusRoutes[3].code} stop schedule updated`,
    `${getRouteStaffAssignment("IU-R4").driver.name} completed pre-trip checklist`,
    `Seat count updated for ${indusRoutes[3].primaryBusNumber} at Shilaj Circle`,
];
