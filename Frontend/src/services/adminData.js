import { indusRoutes } from "./indusRoutes.js";

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

const routeStop = (route, index, stop) => ({
    id: `${route.code.toLowerCase()}-stop-${String(index + 1).padStart(2, "0")}`,
    name: stop.name,
    code: `STP-${route.code.replace("IU-R", "").padStart(2, "0")}${String(index + 1).padStart(2, "0")}`,
    detail: stop.coordinates.join(", "),
    contact: stop.scheduledTime,
    assignment: `${route.code} - Stop ${index + 1}`,
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
    code: `GJ-01-FT-${route.primaryBusNumber}`,
    detail: vehicleModels[index],
    contact: `${capacities[index]} seats`,
    assignment: `${route.code} - ${drivers[index][1]}`,
    status: index === 6 ? "inactive" : "active",
}));

const initialDrivers = drivers.map(([id, name, licence, contact], index) => ({
    id,
    name,
    code: `DRV-${String(index + 1).padStart(3, "0")}`,
    detail: `Licence ${licence}`,
    contact,
    assignment: `${indusRoutes[index].primaryBusNumber} - ${indusRoutes[index].code}`,
    accountEmail: index === 0 ? "driver@transport.indusuni.ac.in" : "",
    accountUserId: index === 0 ? "drv-101" : "",
    status: index === 6 ? "inactive" : "active",
}));

const initialConductors = conductors.map(([id, name, contact], index) => ({
    id,
    name,
    code: `CON-${String(index + 1).padStart(3, "0")}`,
    detail: index % 2 === 0 ? "Morning and evening shift" : "Morning shift",
    contact,
    assignment: `${indusRoutes[index].primaryBusNumber} - ${indusRoutes[index].code}`,
    accountEmail: index === 0 ? "conductor@transport.indusuni.ac.in" : "",
    accountUserId: index === 0 ? "con-101" : "",
    status: index === 6 ? "inactive" : "active",
}));

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
        {
            id: "student-002",
            name: "Diya Patel",
            code: "IU24IT1042",
            detail: "Information Technology - Semester 5",
            contact: "diya.patel@iite.indusuni.ac.in",
            ...studentRouteAssignment("IU-R2", "Bopal"),
            status: "active",
        },
        {
            id: "student-003",
            name: "Vivaan Joshi",
            code: "IU23CE1088",
            detail: "Civil Engineering - Semester 7",
            contact: "vivaan.joshi@iite.indusuni.ac.in",
            ...studentRouteAssignment("IU-R6", "Gurukul"),
            status: "active",
        },
        {
            id: "student-004",
            name: "Ananya Desai",
            code: "IU25MBA0341",
            detail: "Management - Semester 3",
            contact: "ananya.desai@iite.indusuni.ac.in",
            ...studentRouteAssignment("IU-R7", "University Road"),
            status: "inactive",
        },
        {
            id: "student-005",
            name: "Kabir Mehta",
            code: "IU24ME1077",
            detail: "Mechanical Engineering - Semester 5",
            contact: "kabir.mehta@iite.indusuni.ac.in",
            ...studentRouteAssignment("IU-R3", "Science City"),
            status: "active",
        },
        {
            id: "student-006",
            name: "Myra Trivedi",
            code: "IU25BCA0290",
            detail: "Computer Applications - Semester 3",
            contact: "myra.trivedi@iite.indusuni.ac.in",
            routeCode: "",
            stopId: "",
            assignment: "Unassigned",
            status: "pending",
        },
    ],
    stops: indusRoutes.flatMap((route) => route.stops.map((stop, index) => routeStop(route, index, stop))),
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
    driverId: drivers[index][0],
    conductorId: conductors[index][0],
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
    return {
        id: `bus-${route.primaryBusNumber}`,
        number: route.primaryBusNumber,
        route: route.code,
        driver: drivers[index][1],
        speed: status === "stopped" || status === "stale-gps" ? 0 : 24 + index * 3,
        eta: status === "stopped" ? "--" : `${8 + index} min`,
        occupancy: occupancies[index],
        capacity: capacities[index],
        gpsUpdated: status === "stale-gps" ? "12 min ago" : status === "stopped" ? "Not sharing" : "Just now",
        status,
        tripActive: status !== "stopped",
        coordinates: currentStop.coordinates,
    };
});

export const adminActivity = [
    `Bus ${indusRoutes[1].primaryBusNumber} started trip on Route ${indusRoutes[1].code}`,
    "Complaint CMP-2026-0445 assigned to Operations Team",
    `Route ${indusRoutes[3].code} stop schedule updated`,
    `${drivers[0][1]} completed pre-trip checklist`,
    `Seat count updated for ${indusRoutes[3].primaryBusNumber} at Shilaj Circle`,
];
