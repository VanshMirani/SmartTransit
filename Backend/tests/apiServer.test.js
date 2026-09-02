import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createApiServer } from "../apiServer.js";
import { createDataStore } from "../dataStore.js";
import { hashPassword } from "../passwords.js";

async function startTestServer(options = {}) {
    const dir = await mkdtemp(path.join(tmpdir(), "smarttransit-api-"));
    const store = createDataStore(path.join(dir, "db.json"));
    await store.reset();
    const server = createApiServer(store, options);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    return {
        baseUrl: `http://127.0.0.1:${port}/api`,
        store,
        close: () => new Promise((resolve) => server.close(resolve)),
    };
}

async function json(response) {
    return response.json();
}

test("health endpoint responds", async () => {
    const app = await startTestServer();
    try {
        const response = await fetch(`${app.baseUrl}/health`);
        assert.equal(response.status, 200);
        assert.equal((await json(response)).ok, true);
    }
    finally {
        await app.close();
    }
});

test("student can login and load transit data", async () => {
    const app = await startTestServer();
    try {
        const login = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "student@iite.indusuni.ac.in", password: "Student@123" }),
        });
        assert.equal(login.status, 200);
        const session = await json(login);
        assert.equal(session.user.role, "student");
        assert.ok(session.token);

        const transit = await fetch(`${app.baseUrl}/student/transit`, {
            headers: { Authorization: `Bearer ${session.token}` },
        });
        assert.equal(transit.status, 200);
        const data = await json(transit);
        assert.equal(data.route.code, "IU-R4");
        assert.equal(data.route.distance, "19.8 km");
        assert.equal(data.bus.number, "9468");
    }
    finally {
        await app.close();
    }
});

test("student transit stays inactive until the assigned driver starts the route", async () => {
    const app = await startTestServer();
    try {
        await app.store.update((data) => {
            const route = data.routes.find((item) => item.code === "IU-R6");
            assert.ok(route);
            data.users.push({
                id: "stu-r6-trip-state",
                name: "Riya Patel",
                email: "riya.tripstate@iite.indusuni.ac.in",
                passwordHash: hashPassword("Student@123"),
                role: "student",
                status: "active",
                initials: "RP",
                routeCode: route.code,
                stopId: route.stops[1].id,
            }, {
                id: "drv-r6-trip-state",
                name: "Bhavesh Rana",
                email: "bhavesh.tripstate@transport.indusuni.ac.in",
                passwordHash: hashPassword("Bhavesh@123"),
                role: "driver",
                status: "active",
                initials: "BR",
                routeCode: route.code,
            });
            return data;
        });

        const loginAs = async (email, password) => {
            const login = await fetch(`${app.baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            assert.equal(login.status, 200);
            return (await json(login)).token;
        };

        const studentToken = await loginAs("riya.tripstate@iite.indusuni.ac.in", "Student@123");
        const beforeStart = await fetch(`${app.baseUrl}/student/transit`, {
            headers: { Authorization: `Bearer ${studentToken}` },
        });
        assert.equal(beforeStart.status, 200);
        const beforeStartData = await json(beforeStart);
        assert.equal(beforeStartData.route.code, "IU-R6");
        assert.equal(beforeStartData.bus.tripActive, false);
        assert.equal(beforeStartData.bus.gpsStatus, "not-sharing");
        assert.equal(beforeStartData.bus.gpsUpdatedAt, "Not sharing");
        assert.equal(beforeStartData.bus.status, "stopped");

        const driverToken = await loginAs("bhavesh.tripstate@transport.indusuni.ac.in", "Bhavesh@123");
        const currentTrip = await fetch(`${app.baseUrl}/driver/trips/current`, {
            headers: { Authorization: `Bearer ${driverToken}` },
        });
        assert.equal(currentTrip.status, 200);
        const currentTripData = await json(currentTrip);
        assert.equal(currentTripData.tripStatus, "not-started");
        assert.equal(currentTripData.activeStaffTrip.routeCode, "IU-R6");

        const startTrip = await fetch(`${app.baseUrl}/driver/trips/${currentTripData.activeStaffTrip.id}/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${driverToken}` },
        });
        assert.equal(startTrip.status, 200);
        assert.equal((await json(startTrip)).tripStatus, "active");

        const afterStart = await fetch(`${app.baseUrl}/student/transit`, {
            headers: { Authorization: `Bearer ${studentToken}` },
        });
        assert.equal(afterStart.status, 200);
        const afterStartData = await json(afterStart);
        assert.equal(afterStartData.bus.tripActive, true);
        assert.equal(afterStartData.bus.gpsStatus, "waiting");
        assert.equal(afterStartData.bus.gpsUpdatedAt, "Waiting for driver phone");
        assert.equal(afterStartData.route.currentStopId, afterStartData.route.stops[0].id);
        assert.equal(afterStartData.route.stops[0].status, "current");
    }
    finally {
        await app.close();
    }
});

test("built-in routes serve corrected official stop coordinates over stale saved coordinates", async () => {
    const app = await startTestServer();
    try {
        await app.store.update((data) => {
            const route = data.admin.routes.find((item) => item.code === "IU-R4");
            const solaRoad = route.stops.find((stop) => stop.id === "iu-r4-04");
            assert.ok(solaRoad);
            solaRoad.coordinates = [23.0697, 72.5324];
            return data;
        });

        const login = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "student@iite.indusuni.ac.in", password: "Student@123" }),
        });
        assert.equal(login.status, 200);
        const { token } = await json(login);

        const transit = await fetch(`${app.baseUrl}/student/transit`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(transit.status, 200);
        const data = await json(transit);
        const solaRoad = data.route.stops.find((stop) => stop.id === "iu-r4-04");
        assert.deepEqual(solaRoad.coordinates, [23.067932, 72.526487]);
    }
    finally {
        await app.close();
    }
});

test("route, bus, driver, and conductor assignments match across dashboards", async () => {
    const app = await startTestServer();
    try {
        const loginAs = async (email, password) => {
            const login = await fetch(`${app.baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            assert.equal(login.status, 200);
            return (await json(login)).token;
        };

        const [studentToken, driverToken, conductorToken, adminToken] = await Promise.all([
            loginAs("student@iite.indusuni.ac.in", "Student@123"),
            loginAs("driver@transport.indusuni.ac.in", "Driver@123"),
            loginAs("conductor@transport.indusuni.ac.in", "Conductor@123"),
            loginAs("admin@transport.indusuni.ac.in", "Admin@123"),
        ]);

        const studentTransit = await fetch(`${app.baseUrl}/student/transit`, {
            headers: { Authorization: `Bearer ${studentToken}` },
        });
        const driverTrip = await fetch(`${app.baseUrl}/driver/trips/current`, {
            headers: { Authorization: `Bearer ${driverToken}` },
        });
        const conductorTrip = await fetch(`${app.baseUrl}/conductor/trips/current`, {
            headers: { Authorization: `Bearer ${conductorToken}` },
        });
        const adminBootstrap = await fetch(`${app.baseUrl}/admin/bootstrap`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });

        const student = await json(studentTransit);
        const driver = await json(driverTrip);
        const conductor = await json(conductorTrip);
        const admin = await json(adminBootstrap);
        const adminRoute = admin.routes.find((route) => route.code === "IU-R4");
        const adminFleetBus = admin.fleetVehicles.find((bus) => bus.route === "IU-R4");
        const adminBus = admin.records.buses.find((bus) => bus.id === adminRoute.busId);
        const adminDriver = admin.records.drivers.find((record) => record.id === adminRoute.driverId);
        const adminConductor = admin.records.conductors.find((record) => record.id === adminRoute.conductorId);

        assert.equal(student.route.code, "IU-R4");
        assert.equal(student.bus.number, "9468");
        assert.equal(student.bus.registration, "GJ-01-FT-9468");
        assert.equal(driver.activeStaffTrip.routeCode, student.route.code);
        assert.equal(conductor.activeStaffTrip.routeCode, student.route.code);
        assert.equal(driver.activeStaffTrip.busNumber, student.bus.number);
        assert.equal(conductor.activeStaffTrip.busNumber, student.bus.number);
        assert.equal(driver.activeStaffTrip.driver.name, "Imran Hussain");
        assert.equal(conductor.activeStaffTrip.driver.name, "Imran Hussain");
        assert.equal(driver.activeStaffTrip.conductor.name, "Rahul Patel");
        assert.equal(conductor.activeStaffTrip.conductor.name, "Rahul Patel");
        assert.equal(adminBus.name, student.bus.number);
        assert.equal(adminBus.assignment, "IU-R4 - Imran Hussain");
        assert.equal(adminDriver.name, "Imran Hussain");
        assert.equal(adminDriver.assignment, "9468 - IU-R4");
        assert.equal(adminConductor.name, "Rahul Patel");
        assert.equal(adminConductor.assignment, "9468 - IU-R4");
        assert.equal(adminFleetBus.number, student.bus.number);
        assert.equal(adminFleetBus.driver, "Imran Hussain");
    }
    finally {
        await app.close();
    }
});

test("driver dashboard uses the signed-in driver's assigned route and bus", async () => {
    const app = await startTestServer();
    try {
        const adminLogin = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@transport.indusuni.ac.in", password: "Admin@123" }),
        });
        assert.equal(adminLogin.status, 200);
        const { token: adminToken } = await json(adminLogin);

        const bootstrap = await fetch(`${app.baseUrl}/admin/bootstrap`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const data = await json(bootstrap);
        const bhavesh = data.records.drivers.find((record) => record.name === "Bhavesh Rana");
        assert.ok(bhavesh);

        const enabled = await fetch(`${app.baseUrl}/admin/drivers/${bhavesh.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({
                ...bhavesh,
                accountEmail: "bhavesh@transport.indusuni.ac.in",
                temporaryPassword: "Bhavesh@123",
            }),
        });
        assert.equal(enabled.status, 200);

        const login = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "bhavesh@transport.indusuni.ac.in", password: "Bhavesh@123" }),
        });
        assert.equal(login.status, 200);
        const session = await json(login);
        assert.equal(session.user.role, "driver");
        assert.equal(session.user.routeCode, "IU-R6");

        const driverTrip = await fetch(`${app.baseUrl}/driver/trips/current`, {
            headers: { Authorization: `Bearer ${session.token}` },
        });
        assert.equal(driverTrip.status, 200);
        const driverData = await json(driverTrip);
        assert.equal(driverData.activeStaffTrip.routeCode, "IU-R6");
        assert.equal(driverData.activeStaffTrip.busNumber, "6999");
        assert.equal(driverData.activeStaffTrip.registration, "GJ-01-FT-6999");
        assert.equal(driverData.activeStaffTrip.driver.name, "Bhavesh Rana");
        assert.notEqual(driverData.activeStaffTrip.busNumber, "9468");

        const returnTrip = await fetch(`${app.baseUrl}/driver/trips/current/direction`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
            body: JSON.stringify({ direction: "return" }),
        });
        assert.equal(returnTrip.status, 200);
        const returnData = await json(returnTrip);
        assert.equal(returnData.activeStaffTrip.routeCode, "IU-R6");
        assert.equal(returnData.activeStaffTrip.busNumber, "6999");
        assert.equal(returnData.activeStaffTrip.direction, "return");

        const started = await fetch(`${app.baseUrl}/driver/trips/${returnData.activeStaffTrip.id}/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${session.token}` },
        });
        assert.equal(started.status, 200);
        const startedData = await json(started);
        assert.equal(startedData.activeStaffTrip.routeCode, "IU-R6");
        assert.equal(startedData.activeStaffTrip.busNumber, "6999");
        assert.equal(startedData.tripStatus, "active");
    }
    finally {
        await app.close();
    }
});

test("custom admin route assignments appear correctly for new driver and conductor accounts", async () => {
    const app = await startTestServer();
    try {
        const adminLogin = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@transport.indusuni.ac.in", password: "Admin@123" }),
        });
        assert.equal(adminLogin.status, 200);
        const { token: adminToken } = await json(adminLogin);

        const bus = {
            id: "bus-7711",
            name: "7711",
            code: "GJ-01-FT-7711",
            detail: "Tata Starbus",
            contact: "46 seats",
            assignment: "Unassigned",
            status: "active",
        };
        const driver = {
            id: "driver-mahipal",
            name: "Mahipal Solanki",
            code: "DRV-909",
            detail: "Licence GJ01-2026-9090",
            contact: "+91 90000 09090",
            assignment: "Unassigned",
            accountEmail: "mahipal@transport.indusuni.ac.in",
            temporaryPassword: "Mahipal@123",
            status: "active",
        };
        const conductor = {
            id: "conductor-vraj",
            name: "Vraj Patel",
            code: "CON-909",
            detail: "Morning and evening shift",
            contact: "+91 90000 08080",
            assignment: "Unassigned",
            accountEmail: "vraj@transport.indusuni.ac.in",
            temporaryPassword: "Vraj@123",
            status: "active",
        };
        const route = {
            id: "route-iu-r9",
            code: "IU-R9",
            name: "Ghuma Gaam - Indus University",
            startPoint: "Ghuma Gaam",
            destination: "Indus University",
            campusArrival: "8:45 AM",
            distance: "21.4 km",
            mapCenter: [23.095, 72.525],
            notes: "Faculty demo route.",
            status: "active",
            busId: bus.id,
            driverId: driver.id,
            conductorId: conductor.id,
            stops: [
                { id: "iu-r9-01", name: "Ghuma Gaam", scheduledTime: "7:40 AM", coordinates: [23.0286, 72.4208] },
                { id: "iu-r9-02", name: "Electrotherm", scheduledTime: "7:55 AM", coordinates: [23.0662, 72.4159] },
                { id: "iu-r9-03", name: "Indus University", scheduledTime: "8:45 AM", coordinates: [23.06805, 72.4402] },
            ],
        };

        for (const [kind, record] of [
            ["buses", bus],
            ["drivers", driver],
            ["conductors", conductor],
        ]) {
            const response = await fetch(`${app.baseUrl}/admin/${kind}/${record.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
                body: JSON.stringify(record),
            });
            assert.equal(response.status, 200);
        }

        const routeResponse = await fetch(`${app.baseUrl}/admin/routes/${route.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify(route),
        });
        assert.equal(routeResponse.status, 200);

        const studentAssignment = await fetch(`${app.baseUrl}/admin/students/student-001`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({
                id: "student-001",
                name: "Aarav Shah",
                code: "IU23CSE2023",
                detail: "Computer Science - Semester 7",
                contact: "student@iite.indusuni.ac.in",
                routeCode: route.code,
                stopId: route.stops[0].id,
                assignment: `${route.code} - ${route.stops[0].name}`,
                status: "active",
            }),
        });
        assert.equal(studentAssignment.status, 200);

        const loginAs = async (email, password) => {
            const login = await fetch(`${app.baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            assert.equal(login.status, 200);
            return (await json(login)).token;
        };
        const [driverToken, conductorToken, studentToken] = await Promise.all([
            loginAs(driver.accountEmail, driver.temporaryPassword),
            loginAs(conductor.accountEmail, conductor.temporaryPassword),
            loginAs("student@iite.indusuni.ac.in", "Student@123"),
        ]);

        const [driverTrip, conductorTrip, studentTransit, adminBootstrap] = await Promise.all([
            fetch(`${app.baseUrl}/driver/trips/current`, {
                headers: { Authorization: `Bearer ${driverToken}` },
            }),
            fetch(`${app.baseUrl}/conductor/trips/current`, {
                headers: { Authorization: `Bearer ${conductorToken}` },
            }),
            fetch(`${app.baseUrl}/student/transit`, {
                headers: { Authorization: `Bearer ${studentToken}` },
            }),
            fetch(`${app.baseUrl}/admin/bootstrap`, {
                headers: { Authorization: `Bearer ${adminToken}` },
            }),
        ]);
        assert.equal(driverTrip.status, 200);
        assert.equal(conductorTrip.status, 200);
        assert.equal(studentTransit.status, 200);
        assert.equal(adminBootstrap.status, 200);
        const driverData = await json(driverTrip);
        const conductorData = await json(conductorTrip);
        const studentData = await json(studentTransit);
        const admin = await json(adminBootstrap);

        for (const dashboard of [driverData, conductorData]) {
            assert.equal(dashboard.activeStaffTrip.routeCode, "IU-R9");
            assert.equal(dashboard.activeStaffTrip.routeName, "Ghuma Gaam - Indus University");
            assert.equal(dashboard.activeStaffTrip.busNumber, "7711");
            assert.equal(dashboard.activeStaffTrip.registration, "GJ-01-FT-7711");
            assert.equal(dashboard.activeStaffTrip.capacity, 46);
            assert.equal(dashboard.activeStaffTrip.occupiedSeats, 0);
            assert.equal(dashboard.activeStaffTrip.availableSeats, 46);
            assert.equal(dashboard.seatUpdates.length, 0);
            assert.equal(dashboard.activeStaffTrip.driver.name, "Mahipal Solanki");
            assert.equal(dashboard.activeStaffTrip.driver.phone, "+91 90000 09090");
            assert.equal(dashboard.activeStaffTrip.conductor.name, "Vraj Patel");
            assert.equal(dashboard.activeStaffTrip.conductor.phone, "+91 90000 08080");
        }

        assert.equal(studentData.route.code, "IU-R9");
        assert.equal(studentData.route.selectedStopId, "iu-r9-01");
        assert.equal(studentData.route.currentStopId, "iu-r9-01");
        assert.equal(studentData.bus.number, "7711");
        assert.equal(studentData.bus.registration, "GJ-01-FT-7711");
        assert.equal(studentData.bus.capacity, 46);
        assert.equal(studentData.bus.tripActive, false);

        const adminRoute = admin.routes.find((item) => item.code === "IU-R9");
        const adminBus = admin.records.buses.find((item) => item.id === bus.id);
        const adminDriver = admin.records.drivers.find((item) => item.id === driver.id);
        const adminConductor = admin.records.conductors.find((item) => item.id === conductor.id);
        const adminFleetBus = admin.fleetVehicles.find((item) => item.route === "IU-R9");

        assert.equal(adminRoute.primaryBusNumber, "7711");
        assert.equal(adminBus.assignment, "IU-R9 - Mahipal Solanki");
        assert.equal(adminDriver.assignment, "7711 - IU-R9");
        assert.equal(adminConductor.assignment, "7711 - IU-R9");
        assert.equal(adminFleetBus.number, "7711");
        assert.equal(adminFleetBus.driver, "Mahipal Solanki");
        assert.equal(adminFleetBus.capacity, 46);

        const tripId = driverData.activeStaffTrip.id;
        const startTrip = await fetch(`${app.baseUrl}/driver/trips/${tripId}/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${driverToken}` },
        });
        assert.equal(startTrip.status, 200);
        const startedTrip = await json(startTrip);
        assert.equal(startedTrip.operationalCurrentStopId, "iu-r9-01");
        assert.equal(startedTrip.activeStaffTrip.nextStopName, "Ghuma Gaam");

        const [driverAfterStart, conductorAfterStart, studentAfterStart, adminAfterStart] = await Promise.all([
            fetch(`${app.baseUrl}/driver/trips/current`, {
                headers: { Authorization: `Bearer ${driverToken}` },
            }),
            fetch(`${app.baseUrl}/conductor/trips/current`, {
                headers: { Authorization: `Bearer ${conductorToken}` },
            }),
            fetch(`${app.baseUrl}/student/transit`, {
                headers: { Authorization: `Bearer ${studentToken}` },
            }),
            fetch(`${app.baseUrl}/admin/bootstrap`, {
                headers: { Authorization: `Bearer ${adminToken}` },
            }),
        ]);
        assert.equal(driverAfterStart.status, 200);
        assert.equal(conductorAfterStart.status, 200);
        assert.equal(studentAfterStart.status, 200);
        assert.equal(adminAfterStart.status, 200);
        const syncedDriver = await json(driverAfterStart);
        const syncedConductor = await json(conductorAfterStart);
        const syncedStudent = await json(studentAfterStart);
        const syncedAdmin = await json(adminAfterStart);
        const syncedAdminBus = syncedAdmin.fleetVehicles.find((item) => item.route === "IU-R9");
        assert.equal(syncedDriver.tripStatus, "active");
        assert.equal(syncedConductor.tripStatus, "active");
        assert.equal(syncedDriver.operationalCurrentStopId, "iu-r9-01");
        assert.equal(syncedConductor.operationalCurrentStopId, "iu-r9-01");
        assert.equal(syncedStudent.route.currentStopId, "iu-r9-01");
        assert.equal(syncedStudent.bus.tripActive, true);
        assert.equal(syncedAdminBus.tripActive, true);
        assert.equal(syncedAdminBus.nextStopName, "Ghuma Gaam");

        await app.store.update((data) => {
            const staleState = data.operations.routeTrips?.[route.code] ?? data.operations;
            staleState.operationalCurrentStopId = route.stops[1].id;
            staleState.activeStaffTrip = {
                ...staleState.activeStaffTrip,
                nextStopId: route.stops[1].id,
                nextStopName: route.stops[1].name,
                lastReachedStopId: "",
            };
            data.operations.liveLocations = {
                ...(data.operations.liveLocations ?? {}),
                [tripId]: {
                    tripId,
                    routeCode: route.code,
                    busNumber: bus.name,
                    source: "driver-phone",
                    updatedAt: new Date().toISOString(),
                    coordinates: route.stops[1].coordinates,
                    speedKmh: 28,
                },
            };
            return data;
        });

        const recoveredTrip = await fetch(`${app.baseUrl}/driver/trips/current`, {
            headers: { Authorization: `Bearer ${driverToken}` },
        });
        assert.equal(recoveredTrip.status, 200);
        const recoveredTripData = await json(recoveredTrip);
        assert.equal(recoveredTripData.operationalCurrentStopId, "iu-r9-01");
        assert.equal(recoveredTripData.activeStaffTrip.nextStopName, "Ghuma Gaam");

        const prematureGps = await fetch(`${app.baseUrl}/driver/trips/${tripId}/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
            body: JSON.stringify({
                latitude: route.stops[1].coordinates[0],
                longitude: route.stops[1].coordinates[1],
                accuracy: 12,
                speedMetersPerSecond: 8,
                timestamp: new Date().toISOString(),
            }),
        });
        assert.equal(prematureGps.status, 201);
        const prematureGpsData = await json(prematureGps);
        assert.equal(prematureGpsData.activeStaffTrip.nextStopName, "Ghuma Gaam");
        assert.equal(prematureGpsData.activeStaffTrip.lastReachedStopId, "");

        const firstStopGps = await fetch(`${app.baseUrl}/driver/trips/${tripId}/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
            body: JSON.stringify({
                latitude: route.stops[0].coordinates[0],
                longitude: route.stops[0].coordinates[1],
                accuracy: 12,
                speedMetersPerSecond: 8,
                timestamp: new Date().toISOString(),
            }),
        });
        assert.equal(firstStopGps.status, 201);
        const firstStopGpsData = await json(firstStopGps);
        assert.equal(firstStopGpsData.activeStaffTrip.nextStopName, "Ghuma Gaam");
        assert.equal(firstStopGpsData.activeStaffTrip.lastReachedStopId, "iu-r9-01");

        const secondStopGps = await fetch(`${app.baseUrl}/driver/trips/${tripId}/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
            body: JSON.stringify({
                latitude: route.stops[1].coordinates[0],
                longitude: route.stops[1].coordinates[1],
                accuracy: 12,
                speedMetersPerSecond: 8,
                timestamp: new Date().toISOString(),
            }),
        });
        assert.equal(secondStopGps.status, 201);
        const secondStopGpsData = await json(secondStopGps);
        assert.equal(secondStopGpsData.activeStaffTrip.nextStopName, "Electrotherm");
        assert.equal(secondStopGpsData.activeStaffTrip.lastReachedStopId, "iu-r9-02");
    }
    finally {
        await app.close();
    }
});

test("newly assigned bus starts trips with zero occupied seats even when route had older occupancy", async () => {
    const app = await startTestServer();
    try {
        const loginAs = async (email, password) => {
            const login = await fetch(`${app.baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            assert.equal(login.status, 200);
            return (await json(login)).token;
        };

        const adminToken = await loginAs("admin@transport.indusuni.ac.in", "Admin@123");
        const bootstrapResponse = await fetch(`${app.baseUrl}/admin/bootstrap`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.equal(bootstrapResponse.status, 200);
        const bootstrap = await json(bootstrapResponse);
        const route = bootstrap.routes.find((item) => item.code === "IU-R1");
        const oldFleetBus = bootstrap.fleetVehicles.find((item) => item.route === "IU-R1");
        assert.equal(oldFleetBus.occupancy, 37);

        const bus = {
            id: "bus-0522",
            name: "0522",
            code: "GJ-01-FT-0522",
            detail: "Faculty demo mini bus",
            contact: "3 seats",
            assignment: "Unassigned",
            status: "active",
        };
        const createBus = await fetch(`${app.baseUrl}/admin/buses/${bus.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify(bus),
        });
        assert.equal(createBus.status, 200);

        const issueDriverLogin = await fetch(`${app.baseUrl}/admin/drivers/driver-104`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({
                accountEmail: "nadeem.r1@transport.indusuni.ac.in",
                temporaryPassword: "Nadeem@123",
                status: "active",
            }),
        });
        assert.equal(issueDriverLogin.status, 200);

        const issueConductorLogin = await fetch(`${app.baseUrl}/admin/conductors/conductor-104`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({
                accountEmail: "dev.r1@transport.indusuni.ac.in",
                temporaryPassword: "Devshah@123",
                status: "active",
            }),
        });
        assert.equal(issueConductorLogin.status, 200);

        const assignRoute = await fetch(`${app.baseUrl}/admin/routes/${route.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({
                ...route,
                busId: bus.id,
                primaryBusNumber: bus.name,
                busNumbers: [bus.name],
                driverId: "driver-104",
                conductorId: "conductor-104",
            }),
        });
        assert.equal(assignRoute.status, 200);

        const [driverToken, conductorToken] = await Promise.all([
            loginAs("nadeem.r1@transport.indusuni.ac.in", "Nadeem@123"),
            loginAs("dev.r1@transport.indusuni.ac.in", "Devshah@123"),
        ]);

        const preparedTripResponse = await fetch(`${app.baseUrl}/driver/trips/current`, {
            headers: { Authorization: `Bearer ${driverToken}` },
        });
        assert.equal(preparedTripResponse.status, 200);
        const preparedTrip = await json(preparedTripResponse);
        assert.equal(preparedTrip.activeStaffTrip.routeCode, "IU-R1");
        assert.equal(preparedTrip.activeStaffTrip.busNumber, "0522");
        assert.equal(preparedTrip.activeStaffTrip.capacity, 3);
        assert.equal(preparedTrip.activeStaffTrip.occupiedSeats, 0);
        assert.equal(preparedTrip.activeStaffTrip.availableSeats, 3);

        const startTripResponse = await fetch(`${app.baseUrl}/driver/trips/${preparedTrip.activeStaffTrip.id}/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${driverToken}` },
        });
        assert.equal(startTripResponse.status, 200);
        const startedTrip = await json(startTripResponse);
        assert.equal(startedTrip.tripStatus, "active");
        assert.equal(startedTrip.activeStaffTrip.busNumber, "0522");
        assert.equal(startedTrip.activeStaffTrip.capacity, 3);
        assert.equal(startedTrip.activeStaffTrip.occupiedSeats, 0);
        assert.equal(startedTrip.activeStaffTrip.availableSeats, 3);
        assert.equal(startedTrip.seatUpdates.length, 0);

        const conductorTripResponse = await fetch(`${app.baseUrl}/conductor/trips/current`, {
            headers: { Authorization: `Bearer ${conductorToken}` },
        });
        assert.equal(conductorTripResponse.status, 200);
        const conductorTrip = await json(conductorTripResponse);
        assert.equal(conductorTrip.activeStaffTrip.busNumber, "0522");
        assert.equal(conductorTrip.activeStaffTrip.occupiedSeats, 0);
        assert.equal(conductorTrip.activeStaffTrip.availableSeats, 3);

        const firstStop = conductorTrip.operationalStops.find((stop) => stop.id === conductorTrip.operationalCurrentStopId);
        const seatUpdateResponse = await fetch(`${app.baseUrl}/conductor/trips/${conductorTrip.activeStaffTrip.id}/seat-updates`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${conductorToken}` },
            body: JSON.stringify({
                stopId: firstStop.id,
                stopName: firstStop.name,
                boarded: 2,
                deboarded: 0,
            }),
        });
        assert.equal(seatUpdateResponse.status, 201);
        const seatUpdate = await json(seatUpdateResponse);
        assert.equal(seatUpdate.update.occupiedSeats, 2);
        assert.equal(seatUpdate.update.availableSeats, 1);

        const overCapacityResponse = await fetch(`${app.baseUrl}/conductor/trips/${conductorTrip.activeStaffTrip.id}/seat-updates`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${conductorToken}` },
            body: JSON.stringify({
                stopId: seatUpdate.operationalCurrentStopId,
                boarded: 2,
                deboarded: 0,
            }),
        });
        assert.equal(overCapacityResponse.status, 400);
        assert.match((await json(overCapacityResponse)).message, /between 0 and 3/);

        const finalAdminResponse = await fetch(`${app.baseUrl}/admin/bootstrap`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.equal(finalAdminResponse.status, 200);
        const finalAdmin = await json(finalAdminResponse);
        const currentFleetBus = finalAdmin.fleetVehicles.find((item) => item.route === "IU-R1");
        assert.equal(currentFleetBus.number, "0522");
        assert.equal(currentFleetBus.capacity, 3);
        assert.equal(currentFleetBus.occupancy, 2);
    }
    finally {
        await app.close();
    }
});

test("driver dashboard recovers existing named driver accounts with stale route data", async () => {
    const app = await startTestServer();
    try {
        await app.store.update((data) => {
            data.users.push({
                id: "drv-live-bhavesh",
                name: "Bhavesh Rana",
                email: "bhavesh.live@transport.indusuni.ac.in",
                passwordHash: hashPassword("Bhavesh@123"),
                role: "driver",
                status: "active",
                initials: "BR",
                routeCode: "IU-R4",
            });
            return data;
        });

        const login = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "bhavesh.live@transport.indusuni.ac.in", password: "Bhavesh@123" }),
        });
        assert.equal(login.status, 200);
        const session = await json(login);
        assert.equal(session.user.routeCode, "IU-R4");

        const driverTrip = await fetch(`${app.baseUrl}/driver/trips/current`, {
            headers: { Authorization: `Bearer ${session.token}` },
        });
        assert.equal(driverTrip.status, 200);
        const driverData = await json(driverTrip);
        assert.equal(driverData.activeStaffTrip.routeCode, "IU-R6");
        assert.equal(driverData.activeStaffTrip.busNumber, "6999");
        assert.equal(driverData.activeStaffTrip.driver.name, "Bhavesh Rana");

        const returnTrip = await fetch(`${app.baseUrl}/driver/trips/current/direction`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
            body: JSON.stringify({ direction: "return" }),
        });
        assert.equal(returnTrip.status, 200);
        const returnData = await json(returnTrip);
        assert.equal(returnData.activeStaffTrip.routeCode, "IU-R6");
        assert.equal(returnData.activeStaffTrip.busNumber, "6999");
        assert.equal(returnData.activeStaffTrip.direction, "return");
    }
    finally {
        await app.close();
    }
});

test("assigned driver route ignores stale active trips and incomplete managed route records", async () => {
    const app = await startTestServer();
    try {
        await app.store.update((data) => {
            data.users.push({
                id: "drv-live-bhavesh-partial",
                name: "Bhavesh Rana",
                email: "bhavesh.partial@transport.indusuni.ac.in",
                passwordHash: hashPassword("Bhavesh@123"),
                role: "driver",
                status: "active",
                initials: "BR",
                routeCode: "IU-R4",
            });
            data.operations.tripStatus = "active";
            data.operations.gpsUpdatedAt = "Just now";
            data.admin.routes = data.admin.routes.map((route) => route.code === "IU-R6"
                ? {
                    id: route.id,
                    code: route.code,
                    name: route.name,
                    status: route.status,
                    stops: [],
                }
                : route);
            return data;
        });

        const login = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "bhavesh.partial@transport.indusuni.ac.in", password: "Bhavesh@123" }),
        });
        assert.equal(login.status, 200);
        const session = await json(login);

        const driverTrip = await fetch(`${app.baseUrl}/driver/trips/current`, {
            headers: { Authorization: `Bearer ${session.token}` },
        });
        assert.equal(driverTrip.status, 200);
        const driverData = await json(driverTrip);
        assert.equal(driverData.tripStatus, "not-started");
        assert.equal(driverData.activeStaffTrip.routeCode, "IU-R6");
        assert.equal(driverData.activeStaffTrip.busNumber, "6999");
        assert.equal(driverData.activeStaffTrip.distance, "30.6 km");
        assert.equal(driverData.activeStaffTrip.driver.name, "Bhavesh Rana");
        assert.notEqual(driverData.activeStaffTrip.busNumber, "9468");

        const returnTrip = await fetch(`${app.baseUrl}/driver/trips/current/direction`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
            body: JSON.stringify({ direction: "return" }),
        });
        assert.equal(returnTrip.status, 200);
        const returnData = await json(returnTrip);
        assert.equal(returnData.activeStaffTrip.routeCode, "IU-R6");
        assert.equal(returnData.activeStaffTrip.busNumber, "6999");
        assert.equal(returnData.activeStaffTrip.direction, "return");
        assert.equal(returnData.operationalStops[0].name, "Indus University");
    }
    finally {
        await app.close();
    }
});

test("assigned drivers can start their route when another route is active", async () => {
    const app = await startTestServer();
    try {
        const loginAs = async (email, password) => {
            const login = await fetch(`${app.baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            assert.equal(login.status, 200);
            return await json(login);
        };

        const adminSession = await loginAs("admin@transport.indusuni.ac.in", "Admin@123");
        const driverSession = await loginAs("driver@transport.indusuni.ac.in", "Driver@123");

        const defaultTrip = await fetch(`${app.baseUrl}/driver/trips/current`, {
            headers: { Authorization: `Bearer ${driverSession.token}` },
        });
        const defaultTripData = await json(defaultTrip);
        assert.equal(defaultTripData.activeStaffTrip.routeCode, "IU-R4");

        const defaultStarted = await fetch(`${app.baseUrl}/driver/trips/${defaultTripData.activeStaffTrip.id}/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${driverSession.token}` },
        });
        assert.equal(defaultStarted.status, 200);
        assert.equal((await json(defaultStarted)).tripStatus, "active");

        const bootstrap = await fetch(`${app.baseUrl}/admin/bootstrap`, {
            headers: { Authorization: `Bearer ${adminSession.token}` },
        });
        const data = await json(bootstrap);
        const bhavesh = data.records.drivers.find((record) => record.name === "Bhavesh Rana");
        assert.ok(bhavesh);

        const enabled = await fetch(`${app.baseUrl}/admin/drivers/${bhavesh.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminSession.token}` },
            body: JSON.stringify({
                ...bhavesh,
                accountEmail: "bhavesh.active@transport.indusuni.ac.in",
                temporaryPassword: "Bhavesh@123",
            }),
        });
        assert.equal(enabled.status, 200);

        const bhaveshSession = await loginAs("bhavesh.active@transport.indusuni.ac.in", "Bhavesh@123");
        const bhaveshCurrent = await fetch(`${app.baseUrl}/driver/trips/current`, {
            headers: { Authorization: `Bearer ${bhaveshSession.token}` },
        });
        const bhaveshCurrentData = await json(bhaveshCurrent);
        assert.equal(bhaveshCurrentData.tripStatus, "not-started");
        assert.equal(bhaveshCurrentData.activeStaffTrip.routeCode, "IU-R6");
        assert.equal(bhaveshCurrentData.activeStaffTrip.busNumber, "6999");

        const returnTrip = await fetch(`${app.baseUrl}/driver/trips/current/direction`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${bhaveshSession.token}` },
            body: JSON.stringify({ direction: "return" }),
        });
        assert.equal(returnTrip.status, 200);
        const returnData = await json(returnTrip);
        assert.equal(returnData.activeStaffTrip.routeCode, "IU-R6");
        assert.equal(returnData.activeStaffTrip.direction, "return");

        const bhaveshStarted = await fetch(`${app.baseUrl}/driver/trips/${returnData.activeStaffTrip.id}/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${bhaveshSession.token}` },
        });
        assert.equal(bhaveshStarted.status, 200);
        const bhaveshStartedData = await json(bhaveshStarted);
        assert.equal(bhaveshStartedData.tripStatus, "active");
        assert.equal(bhaveshStartedData.activeStaffTrip.routeCode, "IU-R6");
        assert.equal(bhaveshStartedData.activeStaffTrip.busNumber, "6999");

        const defaultStillActive = await fetch(`${app.baseUrl}/driver/trips/current`, {
            headers: { Authorization: `Bearer ${driverSession.token}` },
        });
        const defaultStillActiveData = await json(defaultStillActive);
        assert.equal(defaultStillActiveData.tripStatus, "active");
        assert.equal(defaultStillActiveData.activeStaffTrip.routeCode, "IU-R4");
        assert.equal(defaultStillActiveData.activeStaffTrip.busNumber, "9468");
    }
    finally {
        await app.close();
    }
});

test("route stop changes stay aligned across student, staff, and admin dashboards", async () => {
    const app = await startTestServer();
    try {
        const loginAs = async (email, password) => {
            const login = await fetch(`${app.baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            assert.equal(login.status, 200);
            return (await json(login)).token;
        };

        const [studentToken, driverToken, conductorToken, adminToken] = await Promise.all([
            loginAs("student@iite.indusuni.ac.in", "Student@123"),
            loginAs("driver@transport.indusuni.ac.in", "Driver@123"),
            loginAs("conductor@transport.indusuni.ac.in", "Conductor@123"),
            loginAs("admin@transport.indusuni.ac.in", "Admin@123"),
        ]);

        const bootstrap = await fetch(`${app.baseUrl}/admin/bootstrap`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const adminBefore = await json(bootstrap);
        const route = adminBefore.routes.find((item) => item.code === "IU-R4");
        const updatedRoute = {
            ...route,
            stops: route.stops.map((stop) => stop.id === "iu-r4-13"
                ? { ...stop, name: "Shilaj Circle Gate", scheduledTime: "8:26 AM" }
                : stop),
        };

        const routeUpdate = await fetch(`${app.baseUrl}/admin/routes/${route.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify(updatedRoute),
        });
        assert.equal(routeUpdate.status, 200);

        const [studentTransit, driverTrip, conductorTrip, adminBootstrap] = await Promise.all([
            fetch(`${app.baseUrl}/student/transit`, {
                headers: { Authorization: `Bearer ${studentToken}` },
            }),
            fetch(`${app.baseUrl}/driver/trips/current`, {
                headers: { Authorization: `Bearer ${driverToken}` },
            }),
            fetch(`${app.baseUrl}/conductor/trips/current`, {
                headers: { Authorization: `Bearer ${conductorToken}` },
            }),
            fetch(`${app.baseUrl}/admin/bootstrap`, {
                headers: { Authorization: `Bearer ${adminToken}` },
            }),
        ]);

        const student = await json(studentTransit);
        const driver = await json(driverTrip);
        const conductor = await json(conductorTrip);
        const admin = await json(adminBootstrap);
        const studentStop = student.route.stops.find((stop) => stop.id === "iu-r4-13");
        const driverStop = driver.operationalStops.find((stop) => stop.id === "iu-r4-13");
        const conductorStop = conductor.operationalStops.find((stop) => stop.id === "iu-r4-13");
        const adminRouteStop = admin.routes.find((item) => item.code === "IU-R4").stops.find((stop) => stop.id === "iu-r4-13");
        const adminStopRecord = admin.records.stops.find((stop) => stop.name === "Shilaj Circle Gate");

        assert.equal(studentStop.name, "Shilaj Circle Gate");
        assert.equal(studentStop.scheduledTime, "8:26 AM");
        assert.equal(driverStop.name, "Shilaj Circle Gate");
        assert.equal(conductorStop.name, "Shilaj Circle Gate");
        assert.equal(adminRouteStop.name, "Shilaj Circle Gate");
        assert.equal(adminStopRecord.name, "Shilaj Circle Gate");
        assert.equal(adminStopRecord.contact, "8:26 AM");
        assert.match(adminStopRecord.assignment, /IU-R4 stop 13/);
    }
    finally {
        await app.close();
    }
});

test("student pickup stop does not override the GPS-based bus next stop", async () => {
    const app = await startTestServer();
    try {
        const loginAs = async (email, password) => {
            const login = await fetch(`${app.baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            assert.equal(login.status, 200);
            return (await json(login)).token;
        };

        const [studentToken, driverToken, adminToken] = await Promise.all([
            loginAs("student@iite.indusuni.ac.in", "Student@123"),
            loginAs("driver@transport.indusuni.ac.in", "Driver@123"),
            loginAs("admin@transport.indusuni.ac.in", "Admin@123"),
        ]);

        const bootstrap = await fetch(`${app.baseUrl}/admin/bootstrap`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const admin = await json(bootstrap);
        const student = admin.records.students.find((item) => item.contact === "student@iite.indusuni.ac.in");
        const route = admin.routes.find((item) => item.code === "IU-R4");
        const pickupStop = route.stops.find((item) => item.name === "Sola Road");
        const busNextStop = route.stops.find((item) => item.name === "Shilaj Circle");

        const updatedResponse = await fetch(`${app.baseUrl}/admin/students/${student.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ ...student, routeCode: route.code, stopId: pickupStop.id }),
        });
        assert.equal(updatedResponse.status, 200);

        const currentTrip = await fetch(`${app.baseUrl}/driver/trips/current`, {
            headers: { Authorization: `Bearer ${driverToken}` },
        });
        const currentTripData = await json(currentTrip);
        const started = await fetch(`${app.baseUrl}/driver/trips/${currentTripData.activeStaffTrip.id}/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${driverToken}` },
        });
        assert.equal(started.status, 200);
        const startedData = await json(started);
        const firstRouteStop = startedData.operationalStops[0];

        const firstStopLocation = await fetch(`${app.baseUrl}/driver/trips/${currentTripData.activeStaffTrip.id}/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
            body: JSON.stringify({
                latitude: firstRouteStop.coordinates[0],
                longitude: firstRouteStop.coordinates[1],
                accuracy: 12,
                speedMetersPerSecond: 8,
                timestamp: new Date().toISOString(),
            }),
        });
        assert.equal(firstStopLocation.status, 201);

        const locationUpdate = await fetch(`${app.baseUrl}/driver/trips/${currentTripData.activeStaffTrip.id}/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
            body: JSON.stringify({
                latitude: busNextStop.coordinates[0],
                longitude: busNextStop.coordinates[1],
                accuracy: 12,
                speedMetersPerSecond: 8,
                timestamp: new Date().toISOString(),
            }),
        });
        assert.equal(locationUpdate.status, 201);

        const transit = await fetch(`${app.baseUrl}/student/transit`, {
            headers: { Authorization: `Bearer ${studentToken}` },
        });
        const transitData = await json(transit);
        const pickup = transitData.route.stops.find((item) => item.id === pickupStop.id);
        const current = transitData.route.stops.find((item) => item.status === "current");

        assert.equal(transitData.route.selectedStopId, pickupStop.id);
        assert.equal(transitData.route.currentStopId, busNextStop.id);
        assert.equal(pickup.name, "Sola Road");
        assert.equal(pickup.status, "completed");
        assert.equal(current.name, "Shilaj Circle");
    }
    finally {
        await app.close();
    }
});

test("driver phone GPS updates student and admin live tracking", async () => {
    const app = await startTestServer();
    try {
        const driverLogin = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "driver@transport.indusuni.ac.in", password: "Driver@123" }),
        });
        assert.equal(driverLogin.status, 200);
        const { token: driverToken } = await json(driverLogin);

        const blockedBeforeStart = await fetch(`${app.baseUrl}/driver/trips/TRIP-2026-0821-IU-R4/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
            body: JSON.stringify({ latitude: 23.021111, longitude: 72.511111 }),
        });
        assert.equal(blockedBeforeStart.status, 400);

        const startTrip = await fetch(`${app.baseUrl}/driver/trips/TRIP-2026-0821-IU-R4/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${driverToken}` },
        });
        assert.equal(startTrip.status, 200);
        const startedTrip = await json(startTrip);
        const firstRouteStop = startedTrip.operationalStops[0];

        const invalidLocation = await fetch(`${app.baseUrl}/driver/trips/TRIP-2026-0821-IU-R4/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
            body: JSON.stringify({ latitude: 230, longitude: 72.511111 }),
        });
        assert.equal(invalidLocation.status, 400);

        const firstStopLocation = await fetch(`${app.baseUrl}/driver/trips/TRIP-2026-0821-IU-R4/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
            body: JSON.stringify({
                latitude: firstRouteStop.coordinates[0],
                longitude: firstRouteStop.coordinates[1],
                accuracy: 14.4,
                speedMetersPerSecond: 9.8,
                heading: 82,
                timestamp: new Date().toISOString(),
            }),
        });
        assert.equal(firstStopLocation.status, 201);

        const locationUpdate = await fetch(`${app.baseUrl}/driver/trips/TRIP-2026-0821-IU-R4/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
            body: JSON.stringify({
                latitude: 23.0526,
                longitude: 72.4717,
                accuracy: 14.4,
                speedMetersPerSecond: 9.8,
                heading: 82,
                timestamp: new Date().toISOString(),
            }),
        });
        assert.equal(locationUpdate.status, 201);
        const locationPayload = await json(locationUpdate);
        assert.equal(locationPayload.location.source, "driver-phone");
        assert.deepEqual(locationPayload.location.coordinates, [23.0526, 72.4717]);
        assert.equal(locationPayload.activeStaffTrip.etaSource, "driver-phone-speed");
        assert.equal(locationPayload.activeStaffTrip.nextStopName, "Shilaj Circle");
        assert.match(locationPayload.activeStaffTrip.nextStopEta, /^\d+ min$/);
        assert.notEqual(locationPayload.activeStaffTrip.remainingDistance, "Waiting for GPS");

        const studentLogin = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "student@iite.indusuni.ac.in", password: "Student@123" }),
        });
        const { token: studentToken } = await json(studentLogin);
        const transit = await fetch(`${app.baseUrl}/student/transit`, {
            headers: { Authorization: `Bearer ${studentToken}` },
        });
        assert.equal(transit.status, 200);
        const transitData = await json(transit);
        assert.equal(transitData.bus.gpsStatus, "live");
        assert.equal(transitData.bus.locationSource, "driver-phone");
        assert.deepEqual(transitData.bus.coordinates, [23.0526, 72.4717]);
        assert.equal(transitData.bus.speed, 35);
        assert.equal(transitData.bus.etaSource, "driver-phone-speed");
        assert.equal(transitData.bus.nextStopName, "Shilaj Circle");
        assert.equal(transitData.bus.nextStopEta, locationPayload.activeStaffTrip.nextStopEta);
        assert.equal(transitData.bus.remainingDistance, locationPayload.activeStaffTrip.remainingDistance);
        const activeStop = transitData.route.stops.find((stop) => stop.id === transitData.route.currentStopId);
        const campusStop = transitData.route.stops.at(-1);
        assert.equal(activeStop.name, "Shilaj Circle");
        assert.equal(activeStop.eta, transitData.bus.nextStopEta);
        assert.equal(activeStop.distanceFromBus, transitData.bus.remainingDistance);
        assert.match(campusStop.eta, /^\d+ min$/);

        const liveLocation = await fetch(`${app.baseUrl}/student/live-location`, {
            headers: { Authorization: `Bearer ${studentToken}` },
        });
        assert.equal(liveLocation.status, 200);
        assert.equal((await json(liveLocation)).gpsStatus, "live");

        const adminLogin = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@transport.indusuni.ac.in", password: "Admin@123" }),
        });
        const { token: adminToken } = await json(adminLogin);
        const bootstrap = await fetch(`${app.baseUrl}/admin/bootstrap`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const adminData = await json(bootstrap);
        const liveBus = adminData.fleetVehicles.find((bus) => bus.route === "IU-R4");
        assert.equal(liveBus.gpsStatus, "live");
        assert.deepEqual(liveBus.coordinates, [23.0526, 72.4717]);
        assert.equal(liveBus.etaSource, "driver-phone-speed");
        assert.equal(liveBus.nextStopName, "Shilaj Circle");
        assert.equal(liveBus.nextStopEta, transitData.bus.nextStopEta);
        assert.equal(liveBus.remainingDistance, transitData.bus.remainingDistance);

        const conductorLogin = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "conductor@transport.indusuni.ac.in", password: "Conductor@123" }),
        });
        const { token: conductorToken } = await json(conductorLogin);
        const conductorTrip = await fetch(`${app.baseUrl}/conductor/trips/current`, {
            headers: { Authorization: `Bearer ${conductorToken}` },
        });
        assert.equal(conductorTrip.status, 200);
        const conductorData = await json(conductorTrip);
        assert.equal(conductorData.tripStatus, "active");
        assert.equal(conductorData.activeStaffTrip.routeCode, "IU-R4");
        assert.equal(conductorData.activeStaffTrip.busNumber, "9468");
        assert.equal(conductorData.activeStaffTrip.nextStopName, "Shilaj Circle");
        assert.equal(conductorData.operationalCurrentStopId, transitData.route.currentStopId);

        const endTrip = await fetch(`${app.baseUrl}/driver/trips/TRIP-2026-0821-IU-R4/end`, {
            method: "POST",
            headers: { Authorization: `Bearer ${driverToken}` },
        });
        assert.equal(endTrip.status, 200);

        const hiddenAfterTrip = await fetch(`${app.baseUrl}/student/live-location`, {
            headers: { Authorization: `Bearer ${studentToken}` },
        });
        assert.equal(hiddenAfterTrip.status, 200);
        assert.equal((await json(hiddenAfterTrip)).gpsStatus, "not-sharing");
    }
    finally {
        await app.close();
    }
});

test("conductor seat update changes occupancy without advancing GPS-based route progress", async () => {
    const app = await startTestServer();
    try {
        const loginAs = async (email, password) => {
            const login = await fetch(`${app.baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            assert.equal(login.status, 200);
            return (await json(login)).token;
        };

        const [driverToken, conductorToken, studentToken, adminToken] = await Promise.all([
            loginAs("driver@transport.indusuni.ac.in", "Driver@123"),
            loginAs("conductor@transport.indusuni.ac.in", "Conductor@123"),
            loginAs("student@iite.indusuni.ac.in", "Student@123"),
            loginAs("admin@transport.indusuni.ac.in", "Admin@123"),
        ]);

        const currentTripBeforeStart = await fetch(`${app.baseUrl}/conductor/trips/current`, {
            headers: { Authorization: `Bearer ${conductorToken}` },
        });
        assert.equal(currentTripBeforeStart.status, 200);
        const inactiveTrip = await json(currentTripBeforeStart);
        const inactiveSubmittedStop = inactiveTrip.operationalStops.find((stop) => stop.id === inactiveTrip.operationalCurrentStopId);

        const blockedUpdate = await fetch(`${app.baseUrl}/conductor/trips/${inactiveTrip.activeStaffTrip.id}/seat-updates`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${conductorToken}` },
            body: JSON.stringify({
                stopId: inactiveSubmittedStop.id,
                stopName: inactiveSubmittedStop.name,
                boarded: 4,
                deboarded: 1,
            }),
        });
        assert.equal(blockedUpdate.status, 400);
        assert.match((await json(blockedUpdate)).message, /Start the trip/);

        const startTrip = await fetch(`${app.baseUrl}/driver/trips/${inactiveTrip.activeStaffTrip.id}/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${driverToken}` },
        });
        assert.equal(startTrip.status, 200);

        const currentTripResponse = await fetch(`${app.baseUrl}/conductor/trips/current`, {
            headers: { Authorization: `Bearer ${conductorToken}` },
        });
        assert.equal(currentTripResponse.status, 200);
        const currentTrip = await json(currentTripResponse);
        const submittedStop = currentTrip.operationalStops.find((stop) => stop.id === currentTrip.operationalCurrentStopId);

        const seatUpdateResponse = await fetch(`${app.baseUrl}/conductor/trips/${currentTrip.activeStaffTrip.id}/seat-updates`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${conductorToken}` },
            body: JSON.stringify({
                stopId: submittedStop.id,
                stopName: submittedStop.name,
                boarded: 4,
                deboarded: 1,
            }),
        });
        assert.equal(seatUpdateResponse.status, 201);
        const seatUpdate = await json(seatUpdateResponse);
        assert.equal(seatUpdate.update.stopName, submittedStop.name);
        assert.equal(seatUpdate.update.occupiedSeats, 3);
        assert.equal(seatUpdate.operationalCurrentStopId, submittedStop.id);
        assert.equal(seatUpdate.activeStaffTrip.nextStopName, submittedStop.name);

        const studentTransitResponse = await fetch(`${app.baseUrl}/student/transit`, {
            headers: { Authorization: `Bearer ${studentToken}` },
        });
        assert.equal(studentTransitResponse.status, 200);
        const studentTransit = await json(studentTransitResponse);
        assert.equal(studentTransit.route.currentStopId, submittedStop.id);
        assert.equal(studentTransit.route.stops.find((stop) => stop.status === "current").id, submittedStop.id);
        assert.equal(studentTransit.bus.occupiedSeats, 3);

        const adminBootstrapResponse = await fetch(`${app.baseUrl}/admin/bootstrap`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.equal(adminBootstrapResponse.status, 200);
        const admin = await json(adminBootstrapResponse);
        const liveBus = admin.fleetVehicles.find((bus) => bus.route === "IU-R4");
        assert.equal(liveBus.occupancy, 3);
        assert.equal(liveBus.nextStopName, submittedStop.name);
    }
    finally {
        await app.close();
    }
});

test("return trip reverses stops and supports deboarding seat updates", async () => {
    const app = await startTestServer();
    try {
        const loginAs = async (email, password) => {
            const login = await fetch(`${app.baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            assert.equal(login.status, 200);
            return (await json(login)).token;
        };

        const [driverToken, conductorToken, studentToken, adminToken] = await Promise.all([
            loginAs("driver@transport.indusuni.ac.in", "Driver@123"),
            loginAs("conductor@transport.indusuni.ac.in", "Conductor@123"),
            loginAs("student@iite.indusuni.ac.in", "Student@123"),
            loginAs("admin@transport.indusuni.ac.in", "Admin@123"),
        ]);

        const directionResponse = await fetch(`${app.baseUrl}/driver/trips/current/direction`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
            body: JSON.stringify({ direction: "return" }),
        });
        assert.equal(directionResponse.status, 200);
        const returnTrip = await json(directionResponse);
        const tripId = returnTrip.activeStaffTrip.id;
        const campusStop = returnTrip.operationalStops[0];
        const firstDropStop = returnTrip.operationalStops[1];
        assert.equal(returnTrip.activeStaffTrip.direction, "return");
        assert.equal(returnTrip.activeStaffTrip.directionLabel, "Return");
        assert.equal(campusStop.name, "Indus University");
        assert.equal(firstDropStop.name, "Shilaj Circle");
        assert.equal(returnTrip.operationalCurrentStopId, campusStop.id);

        const startReturnTrip = await fetch(`${app.baseUrl}/driver/trips/${tripId}/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${driverToken}` },
        });
        assert.equal(startReturnTrip.status, 200);

        const campusLocation = await fetch(`${app.baseUrl}/driver/trips/${tripId}/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
            body: JSON.stringify({
                latitude: campusStop.coordinates[0],
                longitude: campusStop.coordinates[1],
                accuracy: 12,
                speedMetersPerSecond: 8.4,
                timestamp: new Date().toISOString(),
            }),
        });
        assert.equal(campusLocation.status, 201);

        const firstUpdate = await fetch(`${app.baseUrl}/conductor/trips/${tripId}/seat-updates`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${conductorToken}` },
            body: JSON.stringify({
                stopId: campusStop.id,
                stopName: campusStop.name,
                boarded: 35,
                deboarded: 0,
            }),
        });
        assert.equal(firstUpdate.status, 201);
        const firstSeatData = await json(firstUpdate);
        assert.equal(firstSeatData.update.occupiedSeats, 35);
        assert.equal(firstSeatData.update.availableSeats, 15);
        assert.equal(firstSeatData.operationalCurrentStopId, campusStop.id);

        const locationUpdate = await fetch(`${app.baseUrl}/driver/trips/${tripId}/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
            body: JSON.stringify({
                latitude: firstDropStop.coordinates[0],
                longitude: firstDropStop.coordinates[1],
                accuracy: 12,
                speedMetersPerSecond: 8.4,
                timestamp: new Date().toISOString(),
            }),
        });
        assert.equal(locationUpdate.status, 201);
        const gpsProgress = await json(locationUpdate);
        assert.equal(gpsProgress.activeStaffTrip.nextStopName, firstDropStop.name);

        const secondUpdate = await fetch(`${app.baseUrl}/conductor/trips/${tripId}/seat-updates`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${conductorToken}` },
            body: JSON.stringify({
                stopId: firstDropStop.id,
                stopName: firstDropStop.name,
                boarded: 0,
                deboarded: 5,
            }),
        });
        assert.equal(secondUpdate.status, 201);
        const secondSeatData = await json(secondUpdate);
        assert.equal(secondSeatData.update.occupiedSeats, 30);
        assert.equal(secondSeatData.update.availableSeats, 20);
        assert.equal(secondSeatData.operationalCurrentStopId, firstDropStop.id);
        assert.equal(secondSeatData.activeStaffTrip.nextStopName, firstDropStop.name);

        const invalidUpdate = await fetch(`${app.baseUrl}/conductor/trips/${tripId}/seat-updates`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${conductorToken}` },
            body: JSON.stringify({
                stopId: secondSeatData.operationalCurrentStopId,
                boarded: 0,
                deboarded: 99,
            }),
        });
        assert.equal(invalidUpdate.status, 400);
        assert.match((await json(invalidUpdate)).message, /between 0 and 50/);

        const studentTransit = await fetch(`${app.baseUrl}/student/transit`, {
            headers: { Authorization: `Bearer ${studentToken}` },
        });
        assert.equal(studentTransit.status, 200);
        const studentData = await json(studentTransit);
        assert.equal(studentData.route.direction, "return");
        assert.equal(studentData.route.startPoint, "Indus University");
        assert.equal(studentData.route.destination, "Vyaswadi");
        assert.equal(studentData.route.stops[0].name, "Indus University");
        assert.equal(studentData.route.currentStopId, secondSeatData.operationalCurrentStopId);
        assert.equal(studentData.bus.occupiedSeats, 30);

        const adminBootstrap = await fetch(`${app.baseUrl}/admin/bootstrap`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.equal(adminBootstrap.status, 200);
        const adminData = await json(adminBootstrap);
        const liveBus = adminData.fleetVehicles.find((bus) => bus.route === "IU-R4");
        assert.equal(liveBus.occupancy, 30);
        assert.equal(liveBus.direction, "return");
        assert.equal(liveBus.nextStopName, firstDropStop.name);
    }
    finally {
        await app.close();
    }
});

test("completed driver trips can be prepared again for morning or return", async () => {
    const app = await startTestServer();
    try {
        const login = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "driver@transport.indusuni.ac.in", password: "Driver@123" }),
        });
        assert.equal(login.status, 200);
        const { token } = await json(login);

        const returnDirection = await fetch(`${app.baseUrl}/driver/trips/current/direction`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ direction: "return" }),
        });
        assert.equal(returnDirection.status, 200);
        const returnTrip = await json(returnDirection);

        const started = await fetch(`${app.baseUrl}/driver/trips/${returnTrip.activeStaffTrip.id}/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(started.status, 200);

        const ended = await fetch(`${app.baseUrl}/driver/trips/${returnTrip.activeStaffTrip.id}/end`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(ended.status, 200);
        assert.equal((await json(ended)).tripStatus, "completed");

        const repeatReturn = await fetch(`${app.baseUrl}/driver/trips/current/direction`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ direction: "return" }),
        });
        assert.equal(repeatReturn.status, 200);
        const repeatReturnData = await json(repeatReturn);
        assert.equal(repeatReturnData.tripStatus, "not-started");
        assert.equal(repeatReturnData.activeStaffTrip.direction, "return");
        assert.equal(repeatReturnData.operationalStops[0].name, "Indus University");

        const nextMorning = await fetch(`${app.baseUrl}/driver/trips/current/direction`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ direction: "morning" }),
        });
        assert.equal(nextMorning.status, 200);
        const nextMorningData = await json(nextMorning);
        assert.equal(nextMorningData.tripStatus, "not-started");
        assert.equal(nextMorningData.activeStaffTrip.direction, "morning");
        assert.notEqual(nextMorningData.operationalStops[0].name, "Indus University");
    }
    finally {
        await app.close();
    }
});

test("session endpoint validates saved backend tokens", async () => {
    const app = await startTestServer();
    try {
        const missing = await fetch(`${app.baseUrl}/auth/session`);
        assert.equal(missing.status, 401);

        const login = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@transport.indusuni.ac.in", password: "Admin@123" }),
        });
        const session = await json(login);

        const valid = await fetch(`${app.baseUrl}/auth/session`, {
            headers: { Authorization: `Bearer ${session.token}` },
        });
        assert.equal(valid.status, 200);
        assert.equal((await json(valid)).user.role, "admin");

        const invalid = await fetch(`${app.baseUrl}/auth/session`, {
            headers: { Authorization: "Bearer not-a-real-token" },
        });
        assert.equal(invalid.status, 401);
    }
    finally {
        await app.close();
    }
});

test("student complaint is stored and returned", async () => {
    const app = await startTestServer();
    try {
        const login = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "student@iite.indusuni.ac.in", password: "Student@123", role: "student" }),
        });
        const { token } = await json(login);
        const created = await fetch(`${app.baseUrl}/student/complaints`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                category: "Delay",
                subject: "Late pickup",
                relatedService: "9468 / Route IU-R4",
                description: "The bus reached the pickup stop later than expected.",
            }),
        });
        assert.equal(created.status, 201);
        const complaint = await json(created);
        assert.equal(complaint.routeCode, "IU-R4");

        const list = await fetch(`${app.baseUrl}/student/complaints`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const complaints = await json(list);
        assert.ok(complaints.some((item) => item.id === complaint.id));
    }
    finally {
        await app.close();
    }
});

test("admin can load management bootstrap data", async () => {
    const app = await startTestServer();
    try {
        const login = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@transport.indusuni.ac.in", password: "Admin@123", role: "admin" }),
        });
        const { token } = await json(login);
        const response = await fetch(`${app.baseUrl}/admin/bootstrap`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(response.status, 200);
        const data = await json(response);
        assert.equal(data.routes.length, 8);
        assert.equal(data.fleetVehicles.length, 8);
        assert.ok(data.records.buses.length >= 8);
        const stopNames = data.records.stops.map((stop) => stop.name.toLowerCase());
        assert.equal(new Set(stopNames).size, stopNames.length);
        const zydusStop = data.records.stops.find((stop) => stop.name === "Zydus Hospital");
        assert.match(zydusStop.assignment, /IU-R4/);
        assert.match(zydusStop.assignment, /IU-R8/);
    }
    finally {
        await app.close();
    }
});

test("admin bootstrap marks approved students without pickup stops as pending", async () => {
    const app = await startTestServer();
    try {
        await app.store.update((data) => {
            data.admin.records.students.push({
                id: "student-legacy-stop",
                name: "Legacy Stop",
                code: "LEGACY.STOP.23.CSE",
                detail: "Verified institute email",
                contact: "legacy.stop@iite.indusuni.ac.in",
                assignment: "IU-R4 - Shilaj Circle",
                status: "active",
            }, {
                id: "student-needs-stop",
                name: "Needs Stop",
                code: "NEEDS.STOP.23.CSE",
                detail: "Verified institute email",
                contact: "needs.stop@iite.indusuni.ac.in",
                assignment: "IU-R4 - Pending stop assignment",
                status: "active",
            }, {
                id: "student-unassigned",
                name: "Needs Assignment",
                code: "NEEDS.ASSIGN.23.CSE",
                detail: "Verified institute email",
                contact: "needs.assign@iite.indusuni.ac.in",
                assignment: "Unassigned",
                status: "active",
            });
            return data;
        });
        const login = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@transport.indusuni.ac.in", password: "Admin@123" }),
        });
        const { token } = await json(login);
        const response = await fetch(`${app.baseUrl}/admin/bootstrap`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(response.status, 200);
        const data = await json(response);
        const legacyStop = data.records.students.find((student) => student.id === "student-legacy-stop");
        const needsStop = data.records.students.find((student) => student.id === "student-needs-stop");
        const unassigned = data.records.students.find((student) => student.id === "student-unassigned");

        assert.equal(legacyStop.status, "active");
        assert.equal(legacyStop.routeCode, "IU-R4");
        assert.ok(legacyStop.stopId);
        assert.equal(legacyStop.assignment, "IU-R4 - Shilaj Circle");

        assert.equal(needsStop.status, "pending");
        assert.equal(needsStop.routeCode, "IU-R4");
        assert.equal(needsStop.stopId, "");
        assert.equal(needsStop.assignment, "IU-R4 - Pending stop assignment");

        assert.equal(unassigned.status, "pending");
        assert.equal(unassigned.routeCode, "");
        assert.equal(unassigned.stopId, "");
        assert.equal(unassigned.assignment, "Unassigned");
    }
    finally {
        await app.close();
    }
});

test("admin notifications count actual active student accounts", async () => {
    const app = await startTestServer();
    try {
        const login = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@transport.indusuni.ac.in", password: "Admin@123" }),
        });
        const { token } = await json(login);

        const allStudents = await fetch(`${app.baseUrl}/admin/notifications`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                type: "general",
                title: "Morning update",
                message: "Transport services are running on schedule today.",
                audience: "all",
                deliveryMode: "now",
            }),
        });
        assert.equal(allStudents.status, 201);
        assert.equal((await json(allStudents)).recipientCount, 1);

        const assignedRoute = await fetch(`${app.baseUrl}/admin/notifications`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                type: "delay",
                title: "Route IU-R4 update",
                message: "Route IU-R4 is delayed by five minutes.",
                audience: "route",
                routeCode: "IU-R4",
                deliveryMode: "now",
            }),
        });
        assert.equal(assignedRoute.status, 201);
        assert.equal((await json(assignedRoute)).recipientCount, 1);

        const emptyRoute = await fetch(`${app.baseUrl}/admin/notifications`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                type: "delay",
                title: "Route IU-R2 update",
                message: "Route IU-R2 is delayed by five minutes.",
                audience: "route",
                routeCode: "IU-R2",
                deliveryMode: "now",
            }),
        });
        assert.equal(emptyRoute.status, 201);
        assert.equal((await json(emptyRoute)).recipientCount, 0);
    }
    finally {
        await app.close();
    }
});

test("admin can change a student's route assignment", async () => {
    const app = await startTestServer();
    try {
        const adminLogin = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@transport.indusuni.ac.in", password: "Admin@123" }),
        });
        const { token: adminToken } = await json(adminLogin);
        const bootstrap = await fetch(`${app.baseUrl}/admin/bootstrap`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const data = await json(bootstrap);
        const student = data.records.students.find((item) => item.contact === "student@iite.indusuni.ac.in");
        const route = data.routes.find((item) => item.code === "IU-R2");
        const stop = route.stops.find((item) => item.name === "Bopal");

        const invalid = await fetch(`${app.baseUrl}/admin/students/${student.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ ...student, routeCode: "IU-R99", stopId: "" }),
        });
        assert.equal(invalid.status, 400);

        const updatedResponse = await fetch(`${app.baseUrl}/admin/students/${student.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ ...student, routeCode: route.code, stopId: stop.id }),
        });
        assert.equal(updatedResponse.status, 200);
        const updated = await json(updatedResponse);
        assert.equal(updated.routeCode, "IU-R2");
        assert.equal(updated.stopId, stop.id);
        assert.equal(updated.assignment, "IU-R2 - Bopal");

        const studentLogin = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "student@iite.indusuni.ac.in", password: "Student@123" }),
        });
        const { token: studentToken } = await json(studentLogin);
        const transit = await fetch(`${app.baseUrl}/student/transit`, {
            headers: { Authorization: `Bearer ${studentToken}` },
        });
        const transitData = await json(transit);
        assert.equal(transitData.route.code, "IU-R2");
        assert.equal(transitData.route.selectedStopId, stop.id);
        assert.equal(transitData.route.stops.find((item) => item.id === stop.id).status, "current");
    }
    finally {
        await app.close();
    }
});

test("student signup uses institute email OTP verification", async () => {
    let sentOtp = "";
    let sentTo = "";
    const app = await startTestServer({
        otpEmailSender: async ({ to, otp }) => {
            sentTo = to;
            sentOtp = otp;
        },
    });
    try {
        const otpResponse = await fetch(`${app.baseUrl}/auth/signup-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "new.student@iite.indusuni.ac.in" }),
        });
        assert.equal(otpResponse.status, 200);
        const otpPayload = await json(otpResponse);
        assert.deepEqual(Object.keys(otpPayload).sort(), ["expiresInMinutes", "ok"]);
        assert.equal(otpPayload.expiresInMinutes, 10);
        assert.equal(sentTo, "new.student@iite.indusuni.ac.in");
        assert.match(sentOtp, /^\d{6}$/);

        const blocked = await fetch(`${app.baseUrl}/auth/register/student`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fullName: "New Student",
                email: "new.student@iite.indusuni.ac.in",
                phone: "9876543212",
                password: "Student@789",
                otp: "000000",
            }),
        });
        assert.equal(blocked.status, 400);

        const created = await fetch(`${app.baseUrl}/auth/register/student`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fullName: "New Student",
                email: "new.student@iite.indusuni.ac.in",
                phone: "9876543212",
                password: "Student@789",
                otp: sentOtp,
            }),
        });
        assert.equal(created.status, 201);
        const session = await json(created);
        assert.equal(session.user.email, "new.student@iite.indusuni.ac.in");
        assert.equal(session.user.routeCode, "");
        assert.equal(session.user.stopId, "");
        assert.equal(session.user.status, "pending");
        assert.ok(session.token);

        const pendingTransit = await fetch(`${app.baseUrl}/student/transit`, {
            headers: { Authorization: `Bearer ${session.token}` },
        });
        assert.equal(pendingTransit.status, 200);
        const pendingTransitData = await json(pendingTransit);
        assert.equal(pendingTransitData.assignmentStatus, "unassigned");
        assert.equal(pendingTransitData.approvalStatus, "pending");
        assert.equal(pendingTransitData.route.code, "");
        assert.equal(pendingTransitData.route.stops.length, 0);

        const adminLogin = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@transport.indusuni.ac.in", password: "Admin@123" }),
        });
        const { token: adminToken } = await json(adminLogin);
        const bootstrap = await fetch(`${app.baseUrl}/admin/bootstrap`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const data = await json(bootstrap);
        const student = data.records.students.find((item) => item.contact === "new.student@iite.indusuni.ac.in");
        const route = data.routes.find((item) => item.code === "IU-R2");
        const stop = route.stops.find((item) => item.name === "Bopal");
        assert.equal(student.assignment, "Unassigned");
        assert.equal(student.status, "pending");

        const blockedApproval = await fetch(`${app.baseUrl}/admin/students/${student.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ ...student, status: "active" }),
        });
        assert.equal(blockedApproval.status, 400);

        const assigned = await fetch(`${app.baseUrl}/admin/students/${student.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ ...student, routeCode: route.code, stopId: stop.id, status: "active" }),
        });
        assert.equal(assigned.status, 200);

        const assignedTransit = await fetch(`${app.baseUrl}/student/transit`, {
            headers: { Authorization: `Bearer ${session.token}` },
        });
        assert.equal(assignedTransit.status, 200);
        const assignedTransitData = await json(assignedTransit);
        assert.equal(assignedTransitData.assignmentStatus, "assigned");
        assert.equal(assignedTransitData.approvalStatus, "approved");
        assert.equal(assignedTransitData.route.code, "IU-R2");
        assert.equal(assignedTransitData.route.selectedStopId, stop.id);
    }
    finally {
        await app.close();
    }
});

test("admin can issue staff accounts and staff can sign in", async () => {
    const app = await startTestServer();
    try {
        const adminLogin = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@transport.indusuni.ac.in", password: "Admin@123" }),
        });
        const { token: adminToken } = await json(adminLogin);

        const weakPassword = await fetch(`${app.baseUrl}/admin/drivers/driver-new`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({
                id: "driver-new",
                name: "New Driver",
                code: "DRV-999",
                detail: "Licence GJ01-2026-9999",
                contact: "+91 98765 44999",
                assignment: "9468 - IU-R4",
                accountEmail: "new.driver@transport.indusuni.ac.in",
                temporaryPassword: "weakpass",
                status: "active",
            }),
        });
        assert.equal(weakPassword.status, 400);

        const created = await fetch(`${app.baseUrl}/admin/drivers/driver-new`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({
                id: "driver-new",
                name: "New Driver",
                code: "DRV-999",
                detail: "Licence GJ01-2026-9999",
                contact: "+91 98765 44999",
                assignment: "9468 - IU-R4",
                accountEmail: "new.driver@transport.indusuni.ac.in",
                temporaryPassword: "Driver@999",
                status: "active",
            }),
        });
        assert.equal(created.status, 200);
        const driverRecord = await json(created);
        assert.equal(driverRecord.accountEmail, "new.driver@transport.indusuni.ac.in");
        assert.equal(driverRecord.temporaryPassword, undefined);

        const staffLogin = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "new.driver@transport.indusuni.ac.in", password: "Driver@999" }),
        });
        assert.equal(staffLogin.status, 200);
        const staffSession = await json(staffLogin);
        assert.equal(staffSession.user.role, "driver");
        assert.equal(staffSession.user.status, "active");
    }
    finally {
        await app.close();
    }
});

test("rejected students are blocked with a clear approval message", async () => {
    const app = await startTestServer();
    try {
        const adminLogin = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@transport.indusuni.ac.in", password: "Admin@123" }),
        });
        assert.equal(adminLogin.status, 200);
        const { token: adminToken } = await json(adminLogin);

        const bootstrap = await fetch(`${app.baseUrl}/admin/bootstrap`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        const data = await json(bootstrap);
        const student = data.records.students.find((item) => item.contact === "student@iite.indusuni.ac.in");

        const rejected = await fetch(`${app.baseUrl}/admin/students/${student.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
            body: JSON.stringify({ ...student, status: "rejected" }),
        });
        assert.equal(rejected.status, 200);
        assert.equal((await json(rejected)).status, "rejected");

        const login = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "student@iite.indusuni.ac.in", password: "Student@123" }),
        });
        assert.equal(login.status, 403);
        assert.equal((await json(login)).message, "Your account has been rejected. Please contact transport admin.");
    }
    finally {
        await app.close();
    }
});

test("auth endpoints rate limit repeated OTP and failed login attempts", async () => {
    const app = await startTestServer({
        otpEmailSender: async () => {},
        passwordResetEmailSender: async () => {},
    });
    try {
        for (let index = 0; index < 3; index += 1) {
            const response = await fetch(`${app.baseUrl}/auth/signup-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: "limited.student@iite.indusuni.ac.in" }),
            });
            assert.equal(response.status, 200);
        }
        const limitedOtp = await fetch(`${app.baseUrl}/auth/signup-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "limited.student@iite.indusuni.ac.in" }),
        });
        assert.equal(limitedOtp.status, 429);

        for (let index = 0; index < 4; index += 1) {
            const response = await fetch(`${app.baseUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: "student@iite.indusuni.ac.in", password: "Wrong@123" }),
            });
            assert.equal(response.status, 401);
        }
        const lockedLogin = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "student@iite.indusuni.ac.in", password: "Wrong@123" }),
        });
        assert.equal(lockedLogin.status, 429);
    }
    finally {
        await app.close();
    }
});

test("signup accepts only Indus University email domains", async () => {
    let sentTo = "";
    const app = await startTestServer({
        otpEmailSender: async ({ to }) => {
            sentTo = to;
        },
    });
    try {
        const rootDomain = await fetch(`${app.baseUrl}/auth/signup-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "zoom1@indusuni.ac.in" }),
        });
        assert.equal(rootDomain.status, 200);
        assert.equal(sentTo, "zoom1@indusuni.ac.in");

        const external = await fetch(`${app.baseUrl}/auth/signup-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "student@gmail.com" }),
        });
        assert.equal(external.status, 400);
        const payload = await json(external);
        assert.match(payload.message, /indusuni\.ac\.in/);
    }
    finally {
        await app.close();
    }
});

test("password reset accepts only institute emails and hides unknown accounts", async () => {
    let sentCount = 0;
    const app = await startTestServer({
        passwordResetEmailSender: async () => {
            sentCount += 1;
        },
    });
    try {
        const external = await fetch(`${app.baseUrl}/auth/password-reset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "student@gmail.com" }),
        });
        assert.equal(external.status, 400);
        assert.match((await json(external)).message, /indusuni\.ac\.in/);

        const unknownInstitute = await fetch(`${app.baseUrl}/auth/password-reset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "unknown.student@iite.indusuni.ac.in" }),
        });
        assert.equal(unknownInstitute.status, 200);
        const payload = await json(unknownInstitute);
        assert.equal(payload.ok, true);
        assert.equal(payload.expiresInMinutes, 10);
        assert.equal(sentCount, 0);
    }
    finally {
        await app.close();
    }
});

test("password reset verifies emailed OTP and updates login password", async () => {
    let sentOtp = "";
    let sentTo = "";
    const app = await startTestServer({
        passwordResetEmailSender: async ({ to, otp }) => {
            sentTo = to;
            sentOtp = otp;
        },
    });
    try {
        const oldLogin = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "student@iite.indusuni.ac.in", password: "Student@123" }),
        });
        assert.equal(oldLogin.status, 200);
        const oldSession = await json(oldLogin);

        const resetRequest = await fetch(`${app.baseUrl}/auth/password-reset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "student@iite.indusuni.ac.in" }),
        });
        assert.equal(resetRequest.status, 200);
        const resetPayload = await json(resetRequest);
        assert.deepEqual(Object.keys(resetPayload).sort(), ["expiresInMinutes", "ok"]);
        assert.equal(sentTo, "student@iite.indusuni.ac.in");
        assert.match(sentOtp, /^\d{6}$/);

        const blocked = await fetch(`${app.baseUrl}/auth/password-reset/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "student@iite.indusuni.ac.in",
                otp: "000000",
                password: "Student@789",
            }),
        });
        assert.equal(blocked.status, 400);

        const confirmed = await fetch(`${app.baseUrl}/auth/password-reset/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "student@iite.indusuni.ac.in",
                otp: sentOtp,
                password: "Student@789",
            }),
        });
        assert.equal(confirmed.status, 200);
        assert.equal((await json(confirmed)).ok, true);

        const oldSessionRequest = await fetch(`${app.baseUrl}/student/transit`, {
            headers: { Authorization: `Bearer ${oldSession.token}` },
        });
        assert.equal(oldSessionRequest.status, 401);

        const oldPassword = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "student@iite.indusuni.ac.in", password: "Student@123" }),
        });
        assert.equal(oldPassword.status, 401);

        const newPassword = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "student@iite.indusuni.ac.in", password: "Student@789" }),
        });
        assert.equal(newPassword.status, 200);
        assert.equal((await json(newPassword)).user.role, "student");
    }
    finally {
        await app.close();
    }
});

test("backend rejects role mismatches for protected operations", async () => {
    const app = await startTestServer();
    try {
        const studentLogin = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "student@iite.indusuni.ac.in", password: "Student@123" }),
        });
        const studentSession = await json(studentLogin);

        const driverTrip = await fetch(`${app.baseUrl}/driver/trips/current`, {
            headers: { Authorization: `Bearer ${studentSession.token}` },
        });
        assert.equal(driverTrip.status, 403);

        const seatUpdate = await fetch(`${app.baseUrl}/conductor/trips/TRIP-1/seat-updates`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentSession.token}`,
            },
            body: JSON.stringify({ boarded: 1, deboarded: 0 }),
        });
        assert.equal(seatUpdate.status, 403);

        const emergency = await fetch(`${app.baseUrl}/staff/emergencies`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${studentSession.token}`,
            },
            body: JSON.stringify({ type: "Medical", note: "Test" }),
        });
        assert.equal(emergency.status, 403);

        const driverLogin = await fetch(`${app.baseUrl}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "driver@transport.indusuni.ac.in", password: "Driver@123" }),
        });
        const driverSession = await json(driverLogin);
        const studentTransit = await fetch(`${app.baseUrl}/student/transit`, {
            headers: { Authorization: `Bearer ${driverSession.token}` },
        });
        assert.equal(studentTransit.status, 403);
    }
    finally {
        await app.close();
    }
});
