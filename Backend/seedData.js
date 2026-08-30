import { initialAdminRecords, initialRoutes, fleetVehicles, adminActivity } from "../Frontend/src/services/adminData.js";
import { initialComplaintCases, initialNotificationCampaigns, initialStudentNotifications } from "../Frontend/src/services/communicationsData.js";
import { defaultStudentRoute, indusRoutes } from "../Frontend/src/services/indusRoutes.js";
import { studentTransitData } from "../Frontend/src/services/mockData.js";
import { activeStaffTrip, driverTripHistory, operationalCurrentStopId, operationalStops } from "../Frontend/src/services/operationsData.js";
import { hashPassword } from "./passwords.js";

const presentationAccountEmails = [
    "admin@transport.indusuni.ac.in",
    "driver@transport.indusuni.ac.in",
    "conductor@transport.indusuni.ac.in",
    "student@iite.indusuni.ac.in",
];

export const demoUsers = [
    { id: "stu-2023", name: "Aarav Shah", email: "student@iite.indusuni.ac.in", passwordHash: hashPassword("Student@123"), role: "student", status: "active", initials: "AS", enrollment: "IU23CSE2023", routeCode: defaultStudentRoute.code },
    { id: "drv-101", name: "Imran Hussain", email: "driver@transport.indusuni.ac.in", passwordHash: hashPassword("Driver@123"), role: "driver", status: "active", initials: "IH", routeCode: defaultStudentRoute.code },
    { id: "con-101", name: "Rahul Patel", email: "conductor@transport.indusuni.ac.in", passwordHash: hashPassword("Conductor@123"), role: "conductor", status: "active", initials: "RP", routeCode: defaultStudentRoute.code },
    { id: "adm-001", name: "Admin Operator", email: "admin@transport.indusuni.ac.in", passwordHash: hashPassword("Admin@123"), role: "admin", status: "active", initials: "AO" },
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();

function routeByCode(routeCode) {
    return indusRoutes.find((route) => route.code === routeCode) ?? null;
}

function studentRecordCode(user, existing) {
    if (existing?.code)
        return existing.code;
    if (user.enrollment)
        return user.enrollment;
    return normalizeEmail(user.email)
        .split("@")[0]
        .replace(/[^a-z0-9]/gi, "")
        .toUpperCase()
        .slice(0, 14) || "INDUS-STUDENT";
}

function studentRouteAssignmentFor(user, existing) {
    const routeCode = String(user.routeCode ?? existing?.routeCode ?? "").trim().toUpperCase();
    const stopId = String(user.stopId ?? existing?.stopId ?? "").trim();
    const route = routeByCode(routeCode);
    if (!routeCode || !route) {
        return {
            routeCode: "",
            stopId: "",
            assignment: "Unassigned",
        };
    }
    const stop = route.stops.find((item) => item.id === stopId) ??
        route.stops.find((item) => existing?.assignment?.toLowerCase().includes(item.name.toLowerCase())) ??
        route.stops[Math.max(0, route.stops.length - 2)];
    return {
        routeCode: route.code,
        stopId: stop?.id ?? "",
        assignment: stop ? `${route.code} - ${stop.name}` : `${route.code} - Pending stop assignment`,
    };
}

function studentRecordForUser(user, recordsByEmail, seedRecordsByEmail) {
    const email = normalizeEmail(user.email);
    const existing = recordsByEmail.get(email) ?? seedRecordsByEmail.get(email);
    const assignment = studentRouteAssignmentFor(user, existing);
    return {
        id: existing?.id ?? user.id,
        name: user.name,
        code: studentRecordCode(user, existing),
        detail: existing?.detail ?? "Indus University student",
        contact: email,
        ...assignment,
        status: user.status ?? existing?.status ?? "pending",
    };
}

export function createSeedData() {
    return clone({
        users: demoUsers,
        sessions: {},
        signupOtps: {},
        passwordResetOtps: {},
        routes: indusRoutes,
        studentTransitData,
        admin: {
            records: initialAdminRecords,
            routes: initialRoutes,
            fleetVehicles,
            adminActivity,
        },
        communications: {
            notifications: initialStudentNotifications,
            campaigns: initialNotificationCampaigns,
            complaints: initialComplaintCases,
        },
        operations: {
            activeStaffTrip,
            operationalStops,
            operationalCurrentStopId,
            driverTripHistory,
            tripStatus: "not-started",
            gpsUpdatedAt: "Not sharing",
            liveLocations: {},
            seatUpdates: [
                {
                    id: "SEAT-001",
                    stopId: operationalStops[1].id,
                    stopName: operationalStops[1].name,
                    boarded: 12,
                    deboarded: 2,
                    occupiedSeats: 30,
                    availableSeats: 20,
                    timestamp: "8:05 AM",
                },
                {
                    id: "SEAT-000",
                    stopId: operationalStops[0].id,
                    stopName: operationalStops[0].name,
                    boarded: 20,
                    deboarded: 0,
                    occupiedSeats: 20,
                    availableSeats: 30,
                    timestamp: "7:51 AM",
                },
            ],
            emergencies: [],
        },
    });
}

export function cleanPresentationData(data = createSeedData(), options = {}) {
    const source = clone(data);
    const seed = createSeedData();
    const keepEmails = new Set([
        ...presentationAccountEmails,
        ...(options.keepEmails ?? []),
    ].map(normalizeEmail).filter(Boolean));
    const sourceUsersByEmail = new Map((source.users ?? []).map((user) => [normalizeEmail(user.email), user]));
    const seedUsersByEmail = new Map(seed.users.map((user) => [normalizeEmail(user.email), user]));
    const selectedUsers = [...keepEmails]
        .map((email) => sourceUsersByEmail.get(email) ?? seedUsersByEmail.get(email))
        .filter(Boolean);
    const usersByEmail = new Map(selectedUsers.map((user) => [normalizeEmail(user.email), user]));
    const users = [...usersByEmail.values()];
    const studentUsers = users.filter((user) => user.role === "student");
    const keptStudentEmails = new Set(studentUsers.map((user) => normalizeEmail(user.email)));
    const keptStudentIds = new Set(studentUsers.map((user) => user.id));
    const recordsByEmail = new Map((source.admin?.records?.students ?? []).map((record) => [normalizeEmail(record.contact), record]));
    const seedRecordsByEmail = new Map(seed.admin.records.students.map((record) => [normalizeEmail(record.contact), record]));
    const students = studentUsers.map((user) => studentRecordForUser(user, recordsByEmail, seedRecordsByEmail));
    const notifications = (source.communications?.notifications ?? seed.communications.notifications)
        .filter((item) => !item.routeCode || users.some((user) => user.routeCode === item.routeCode))
        .slice(0, 2);
    const campaigns = (source.communications?.campaigns ?? seed.communications.campaigns).slice(0, 2);
    const complaints = (source.communications?.complaints ?? seed.communications.complaints)
        .filter((complaint) => keptStudentEmails.has(normalizeEmail(complaint.studentEmail)) || keptStudentIds.has(complaint.studentId))
        .slice(0, 2);
    return {
        ...source,
        users,
        sessions: {},
        signupOtps: {},
        passwordResetOtps: {},
        studentTransitData: seed.studentTransitData,
        admin: {
            ...source.admin,
            records: {
                ...source.admin?.records,
                buses: source.admin?.records?.buses ?? seed.admin.records.buses,
                drivers: source.admin?.records?.drivers ?? seed.admin.records.drivers,
                conductors: source.admin?.records?.conductors ?? seed.admin.records.conductors,
                stops: source.admin?.records?.stops ?? seed.admin.records.stops,
                students,
            },
            routes: source.admin?.routes ?? seed.admin.routes,
            fleetVehicles: source.admin?.fleetVehicles ?? seed.admin.fleetVehicles,
            adminActivity: (source.admin?.adminActivity ?? seed.admin.adminActivity).slice(0, 3),
        },
        communications: {
            notifications,
            campaigns,
            complaints,
        },
        operations: {
            ...seed.operations,
            seatUpdates: [],
            emergencies: [],
        },
    };
}
