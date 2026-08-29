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
        assert.ok(session.token);
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
