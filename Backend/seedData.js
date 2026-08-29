import { initialAdminRecords, initialRoutes, fleetVehicles, adminActivity } from "../Frontend/src/services/adminData.js";
import { initialComplaintCases, initialNotificationCampaigns, initialStudentNotifications } from "../Frontend/src/services/communicationsData.js";
import { defaultStudentRoute, indusRoutes } from "../Frontend/src/services/indusRoutes.js";
import { studentTransitData } from "../Frontend/src/services/mockData.js";
import { activeStaffTrip, driverTripHistory, operationalCurrentStopId, operationalStops } from "../Frontend/src/services/operationsData.js";
import { hashPassword } from "./passwords.js";

export const demoUsers = [
    { id: "stu-2023", name: "Aarav Shah", email: "student@iite.indusuni.ac.in", passwordHash: hashPassword("Student@123"), role: "student", initials: "AS", enrollment: "IU23CSE2023", routeCode: defaultStudentRoute.code },
    { id: "drv-101", name: "Imran Hussain", email: "driver@transport.indusuni.ac.in", passwordHash: hashPassword("Driver@123"), role: "driver", initials: "IH", routeCode: defaultStudentRoute.code },
    { id: "con-101", name: "Rahul Patel", email: "conductor@transport.indusuni.ac.in", passwordHash: hashPassword("Conductor@123"), role: "conductor", initials: "RP", routeCode: defaultStudentRoute.code },
    { id: "adm-001", name: "Admin Operator", email: "admin@transport.indusuni.ac.in", passwordHash: hashPassword("Admin@123"), role: "admin", initials: "AO" },
];

const clone = (value) => JSON.parse(JSON.stringify(value));

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
