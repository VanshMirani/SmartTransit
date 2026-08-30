import assert from "node:assert/strict";
import test from "node:test";
import { cleanPresentationData, createSeedData } from "../seedData.js";

test("presentation cleanup keeps essential accounts and removes noisy sample data", () => {
    const data = createSeedData();
    data.users.push({
        id: "stu-extra",
        name: "Extra Student",
        email: "extra.student@iite.indusuni.ac.in",
        role: "student",
        status: "pending",
        initials: "ES",
    });
    data.sessions["old-token"] = { userId: "stu-2023" };
    data.operations.liveLocations[data.operations.activeStaffTrip.id] = {
        coordinates: [23.02, 72.5],
        updatedAt: new Date().toISOString(),
    };

    const cleaned = cleanPresentationData(data);
    const emails = cleaned.users.map((user) => user.email).sort();

    assert.deepEqual(emails, [
        "admin@transport.indusuni.ac.in",
        "conductor@transport.indusuni.ac.in",
        "driver@transport.indusuni.ac.in",
        "student@iite.indusuni.ac.in",
    ]);
    assert.equal(cleaned.admin.records.students.length, 1);
    assert.equal(cleaned.admin.records.students[0].contact, "student@iite.indusuni.ac.in");
    assert.equal(Object.keys(cleaned.sessions).length, 0);
    assert.equal(cleaned.operations.tripStatus, "not-started");
    assert.equal(cleaned.operations.seatUpdates.length, 0);
    assert.equal(Object.keys(cleaned.operations.liveLocations).length, 0);
    assert.ok(cleaned.communications.notifications.length <= 2);
    assert.ok(cleaned.communications.complaints.length <= 2);
});

test("presentation cleanup can preserve a selected student account", () => {
    const data = createSeedData();
    data.users.push({
        id: "stu-kept",
        name: "Kept Student",
        email: "kept.student@iite.indusuni.ac.in",
        role: "student",
        status: "pending",
        initials: "KS",
    });
    data.admin.records.students.push({
        id: "student-kept",
        name: "Kept Student",
        code: "IU23CSE9999",
        detail: "Computer Science - Semester 7",
        contact: "kept.student@iite.indusuni.ac.in",
        routeCode: "",
        stopId: "",
        assignment: "Unassigned",
        status: "pending",
    });

    const cleaned = cleanPresentationData(data, {
        keepEmails: ["kept.student@iite.indusuni.ac.in"],
    });

    assert.ok(cleaned.users.some((user) => user.email === "kept.student@iite.indusuni.ac.in"));
    assert.ok(cleaned.admin.records.students.some((record) => record.contact === "kept.student@iite.indusuni.ac.in"));
});
