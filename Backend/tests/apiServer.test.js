import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createApiServer } from "../apiServer.js";
import { createDataStore } from "../dataStore.js";

async function startTestServer(options = {}) {
    const dir = await mkdtemp(path.join(tmpdir(), "smarttransit-api-"));
    const store = createDataStore(path.join(dir, "db.json"));
    await store.reset();
    const server = createApiServer(store, options);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    return {
        baseUrl: `http://127.0.0.1:${port}/api`,
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

        const invalidLocation = await fetch(`${app.baseUrl}/driver/trips/TRIP-2026-0821-IU-R4/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
            body: JSON.stringify({ latitude: 230, longitude: 72.511111 }),
        });
        assert.equal(invalidLocation.status, 400);

        const locationUpdate = await fetch(`${app.baseUrl}/driver/trips/TRIP-2026-0821-IU-R4/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${driverToken}` },
            body: JSON.stringify({
                latitude: 23.021111,
                longitude: 72.511111,
                accuracy: 14.4,
                speedMetersPerSecond: 9.8,
                heading: 82,
                timestamp: new Date().toISOString(),
            }),
        });
        assert.equal(locationUpdate.status, 201);
        const locationPayload = await json(locationUpdate);
        assert.equal(locationPayload.location.source, "driver-phone");
        assert.deepEqual(locationPayload.location.coordinates, [23.021111, 72.511111]);

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
        assert.deepEqual(transitData.bus.coordinates, [23.021111, 72.511111]);
        assert.equal(transitData.bus.speed, 35);

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
        assert.deepEqual(liveBus.coordinates, [23.021111, 72.511111]);

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
