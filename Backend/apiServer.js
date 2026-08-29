import { createServer } from "node:http";
import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { indusRoutes, withStopProgress } from "../Frontend/src/services/indusRoutes.js";
import { isInstituteEmail, normalizeEmail, signupEmailHelpText, validatePassword } from "../Frontend/src/utils/registrationValidation.js";
import { sendPasswordResetOtpEmail, sendSignupOtpEmail } from "./emailService.js";
import { hashPassword, verifyPassword } from "./passwords.js";

const signupOtpExpiryMinutes = 10;
const passwordResetOtpExpiryMinutes = 10;
const defaultSessionHours = 8;

const jsonHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": process.env.SMARTTRANSIT_ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status ?? "active",
        initials: user.initials,
        enrollment: user.enrollment,
        phone: user.phone,
        routeCode: user.routeCode,
        stopId: user.stopId,
    };
}

function send(response, status, payload) {
    response.writeHead(status, jsonHeaders);
    response.end(JSON.stringify(payload));
}

function notFound(response) {
    send(response, 404, { message: "Endpoint not found." });
}

function badRequest(response, message) {
    send(response, 400, { message });
}

function serviceUnavailable(response, message) {
    send(response, 503, { message });
}

function tooManyRequests(response, message) {
    send(response, 429, { message });
}

function otpEmailErrorMessage(error) {
    if (error instanceof Error && error.message.startsWith("Email service is not configured")) {
        return "OTP email service is not configured yet. Ask the transport office administrator to set email provider credentials.";
    }
    return "Unable to send OTP email right now. Try again later.";
}

function passwordResetEmailErrorMessage(error) {
    if (error instanceof Error && error.message.startsWith("Email service is not configured")) {
        return "Password reset email service is not configured yet. Ask the transport office administrator to set email provider credentials.";
    }
    return "Unable to send password reset OTP right now. Try again later.";
}

function logOtpEmailError(error) {
    console.error("[otp-email]", error instanceof Error ? error.message : error);
}

function logPasswordResetEmailError(error) {
    console.error("[password-reset-email]", error instanceof Error ? error.message : error);
}


async function readBody(request) {
    const chunks = [];
    for await (const chunk of request)
        chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString("utf8");
    if (!raw)
        return {};
    try {
        return JSON.parse(raw);
    }
    catch {
        throw new Error("Invalid JSON request body.");
    }
}

async function requireUser(request, store) {
    const header = request.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token)
        return null;
    return store.update((data) => {
        const session = data.sessions[token];
        if (!session)
            return null;
        if (sessionExpired(session)) {
            delete data.sessions[token];
            return null;
        }
        const user = data.users.find((item) => item.id === session.userId) ?? null;
        if (!user) {
            delete data.sessions[token];
        }
        return user;
    });
}

function requireRole(user, roles) {
    return user && roles.includes(user.role);
}

function findRouteFromService(service) {
    return indusRoutes.find((route) => String(service ?? "").includes(route.code));
}

function routeStudentCount(routeCode) {
    return indusRoutes.find((route) => route.code === routeCode)?.studentCount ?? 0;
}

function routeCodeFromAssignment(assignment) {
    return String(assignment ?? "").match(/\bIU-R\d+\b/i)?.[0]?.toUpperCase() ?? "";
}

function findRouteByCode(data, routeCode) {
    return data.admin?.routes?.find((route) => route.code === routeCode) ??
        indusRoutes.find((route) => route.code === routeCode);
}

function stopNameFromAssignment(routeCode, assignment) {
    return String(assignment ?? "").replace(new RegExp(`^${routeCode}\\s*-\\s*`, "i"), "").trim();
}

function normalizeStudentRecordAssignment(data, record) {
    const routeCode = String(record?.routeCode ?? routeCodeFromAssignment(record?.assignment)).trim().toUpperCase();
    if (!routeCode) {
        return {
            record: {
                ...record,
                routeCode: "",
                stopId: "",
                assignment: "Unassigned",
            },
        };
    }
    const route = findRouteByCode(data, routeCode);
    if (!route) {
        return { error: `Route ${routeCode} does not exist.` };
    }
    const requestedStopId = String(record?.stopId ?? "").trim();
    let stop = requestedStopId
        ? route.stops?.find((item) => item.id === requestedStopId)
        : null;
    if (requestedStopId && !stop) {
        return { error: "Selected pickup stop does not belong to this route." };
    }
    if (!stop) {
        const stopName = stopNameFromAssignment(routeCode, record?.assignment);
        stop = route.stops?.find((item) => item.name.toLowerCase() === stopName.toLowerCase()) ?? null;
    }
    return {
        record: {
            ...record,
            routeCode: route.code,
            stopId: stop?.id ?? "",
            assignment: `${route.code} - ${stop?.name ?? "Pending stop assignment"}`,
        },
    };
}

function syncStudentUserAssignment(data, record) {
    const student = data.users.find((item) => item.role === "student" &&
        (item.id === record.id || normalizeEmail(item.email) === normalizeEmail(record.contact)));
    if (!student)
        return;
    student.status = record.status ?? student.status ?? "pending";
    student.routeCode = record.routeCode ?? "";
    if (!record.routeCode) {
        student.stopId = "";
        return;
    }
    student.routeCode = record.routeCode;
    if (record.stopId)
        student.stopId = record.stopId;
    else
        student.stopId = "";
}

function totalStudentCount() {
    return indusRoutes.reduce((sum, route) => sum + route.studentCount, 0);
}

function ensureSignupOtps(data) {
    if (!data.signupOtps)
        data.signupOtps = {};
    return data.signupOtps;
}

function ensurePasswordResetOtps(data) {
    if (!data.passwordResetOtps)
        data.passwordResetOtps = {};
    return data.passwordResetOtps;
}

function sessionDurationMs() {
    const hours = Number(process.env.SMARTTRANSIT_SESSION_HOURS ?? defaultSessionHours);
    return Number.isFinite(hours) && hours > 0
        ? hours * 60 * 60 * 1000
        : defaultSessionHours * 60 * 60 * 1000;
}

function createSession(userId) {
    const createdAt = new Date();
    return {
        userId,
        createdAt: createdAt.toISOString(),
        expiresAt: new Date(createdAt.getTime() + sessionDurationMs()).toISOString(),
    };
}

function sessionExpired(session) {
    const expiresAt = Date.parse(session.expiresAt ?? "");
    if (Number.isFinite(expiresAt))
        return expiresAt <= Date.now();
    const createdAt = Date.parse(session.createdAt ?? "");
    return Number.isFinite(createdAt) && createdAt + sessionDurationMs() <= Date.now();
}

function createOtp() {
    return String(randomInt(100000, 1000000));
}

function signupOtpSecret() {
    return process.env.SMARTTRANSIT_OTP_SECRET ?? "smarttransit-development-otp-secret";
}

function hashSignupOtp(email, otp) {
    return createHash("sha256")
        .update(`${signupOtpSecret()}:${email}:${String(otp ?? "").trim()}`)
        .digest("hex");
}

function hashPasswordResetOtp(email, otp) {
    return createHash("sha256")
        .update(`${signupOtpSecret()}:password-reset:${email}:${String(otp ?? "").trim()}`)
        .digest("hex");
}

function safeHashEquals(left, right) {
    if (!left || !right)
        return false;
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyStoredSignupOtp(email, inputOtp, record) {
    if (!record)
        return false;
    if (record.codeHash) {
        return safeHashEquals(record.codeHash, hashSignupOtp(email, inputOtp));
    }
    return record.code === String(inputOtp ?? "").trim();
}

function verifyStoredPasswordResetOtp(email, inputOtp, record) {
    if (!record)
        return false;
    if (record.codeHash) {
        return safeHashEquals(record.codeHash, hashPasswordResetOtp(email, inputOtp));
    }
    return record.code === String(inputOtp ?? "").trim();
}

function userByEmail(data, email) {
    return data.users.find((user) => user.email.toLowerCase() === email);
}

function studentCodeFromEmail(email) {
    return email.split("@")[0].toUpperCase();
}

function buildComplaint(input, user) {
    const route = findRouteFromService(input.relatedService);
    const label = new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date());
    return {
        id: `CMP-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        studentId: user.id,
        studentName: user.name,
        studentEmail: user.email,
        category: input.category,
        subject: input.subject,
        description: input.description,
        relatedService: input.relatedService,
        routeCode: route?.code ?? "Not linked",
        busNumber: route?.primaryBusNumber ?? "Not linked",
        tripId: route ? `TRIP-CURRENT-${route.code}` : "Not linked",
        status: "new",
        assignedTo: "Unassigned",
        createdAt: label,
        updatedAt: label,
        timeline: [
            {
                id: `evt-${Date.now()}`,
                title: "Complaint submitted",
                detail: "Submitted through the student application.",
                timestamp: label,
            },
        ],
        internalNotes: [],
    };
}

function createRateLimiter({ limit, windowMs, lockMs = windowMs }) {
    const attempts = new Map();
    return {
        check(key) {
            const now = Date.now();
            const entry = attempts.get(key);
            if (!entry)
                return { allowed: true };
            if (entry.blockedUntil && entry.blockedUntil > now) {
                return {
                    allowed: false,
                    retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000),
                };
            }
            if (entry.resetAt <= now) {
                attempts.delete(key);
                return { allowed: true };
            }
            return { allowed: true };
        },
        record(key) {
            const now = Date.now();
            const current = attempts.get(key);
            const entry = current && current.resetAt > now
                ? current
                : { count: 0, resetAt: now + windowMs, blockedUntil: 0 };
            entry.count += 1;
            if (entry.count >= limit)
                entry.blockedUntil = now + lockMs;
            attempts.set(key, entry);
            return this.check(key);
        },
        reset(key) {
            attempts.delete(key);
        },
    };
}

function clientKey(request, scope, identifier) {
    const forwardedFor = request.headers["x-forwarded-for"];
    const ip = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : String(forwardedFor ?? request.socket.remoteAddress ?? "unknown").split(",")[0].trim();
    return `${scope}:${normalizeEmail(String(identifier ?? "")) || ip}`;
}

function retryMessage(action, retryAfterSeconds) {
    const minutes = Math.max(1, Math.ceil((retryAfterSeconds ?? 60) / 60));
    return `Too many ${action}. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

function validateStudentSignupBody(body) {
    const name = String(body.fullName ?? "").trim();
    const phone = String(body.phone ?? "").replace(/\D/g, "");
    const password = String(body.password ?? "");
    if (name.length < 3)
        return "Enter your full name before creating the account.";
    if (!/^\d{10}$/.test(phone))
        return "Enter a valid 10-digit mobile number.";
    return validatePassword(password);
}

function isInactive(user) {
    return (user.status ?? "active") === "inactive";
}

function isPendingStudent(user) {
    return user.role === "student" && (user.status ?? "active") === "pending";
}

function validateActiveStudentAssignment(record) {
    if (record.status !== "active")
        return "";
    if (!record.routeCode)
        return "Assign a route before approving this student.";
    if (!record.stopId)
        return "Assign a pickup stop before approving this student.";
    return "";
}

function buildStaffUserId(kind, recordId) {
    return `${kind === "drivers" ? "drv" : "con"}-${recordId.replace(/^(driver|conductor)-/i, "")}`;
}

function buildStaffNameInitials(name) {
    return String(name ?? "")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");
}

function syncStaffUser(data, kind, record) {
    if (kind !== "drivers" && kind !== "conductors")
        return { record };
    const role = kind === "drivers" ? "driver" : "conductor";
    const accountEmail = normalizeEmail(String(record.accountEmail ?? ""));
    const temporaryPassword = String(record.temporaryPassword ?? "");
    const cleaned = { ...record };
    delete cleaned.temporaryPassword;
    if (!accountEmail)
        return { record: cleaned };
    if (!isInstituteEmail(accountEmail))
        return { error: "Use an Indus University email for staff account access." };
    const passwordError = temporaryPassword ? validatePassword(temporaryPassword) : "";
    const existing = data.users.find((item) => item.id === cleaned.accountUserId || normalizeEmail(item.email) === accountEmail);
    if (!existing && !temporaryPassword)
        return { error: "Enter a temporary password when creating a staff login." };
    if (passwordError)
        return { error: passwordError };
    const user = existing ?? {
        id: cleaned.accountUserId || buildStaffUserId(kind, cleaned.id),
        role,
    };
    user.name = cleaned.name;
    user.email = accountEmail;
    user.role = role;
    user.status = cleaned.status ?? user.status ?? "active";
    user.initials = user.initials || buildStaffNameInitials(cleaned.name);
    user.routeCode = routeCodeFromAssignment(cleaned.assignment);
    if (temporaryPassword)
        user.passwordHash = hashPassword(temporaryPassword);
    delete user.password;
    if (!existing)
        data.users.push(user);
    cleaned.accountEmail = accountEmail;
    cleaned.accountUserId = user.id;
    return { record: cleaned };
}

function routeForUser(data, user) {
    const managedRoute = data.admin?.routes?.find((route) => route.code === user.routeCode);
    const routeTemplate = indusRoutes.find((route) => route.code === user.routeCode);
    if (managedRoute && routeTemplate) {
        return {
            ...routeTemplate,
            ...managedRoute,
            stops: managedRoute.stops?.length ? managedRoute.stops : routeTemplate.stops,
        };
    }
    return managedRoute ??
        routeTemplate ??
        null;
}

function buildUnassignedTransitData(data) {
    return {
        ...data.studentTransitData,
        assignmentStatus: "unassigned",
        bus: {
            ...data.studentTransitData.bus,
            id: "unassigned",
            number: "Pending",
            registration: "Not assigned",
            capacity: 0,
            occupiedSeats: 0,
            status: "pending",
            speed: 0,
            gpsUpdatedAt: "Not available",
            seatsUpdatedAt: "Not available",
        },
        route: {
            id: "unassigned",
            code: "",
            name: "Route assignment pending",
            startPoint: "",
            destination: "Indus University",
            distance: "-",
            scheduledArrival: "-",
            selectedStopId: "",
            mapCenter: data.studentTransitData.route.mapCenter,
            notes: "The transport office will assign a route and pickup stop.",
            stops: [],
        },
    };
}

function buildStudentTransitData(data, user) {
    const route = routeForUser(data, user);
    if (!route) {
        return buildUnassignedTransitData(data);
    }
    const preferredStopId = user.stopId ?? data.studentTransitData.route.selectedStopId;
    const selectedStopId = route.stops.some((stop) => stop.id === preferredStopId)
        ? preferredStopId
        : route.stops[Math.max(0, route.stops.length - 2)]?.id ?? route.stops[0]?.id;
    const selectedIndex = Math.max(0, route.stops.findIndex((stop) => stop.id === selectedStopId));
    const stops = withStopProgress(route, selectedStopId).map((stop, index) => ({
        ...stop,
        ...(stop.id === selectedStopId
            ? { eta: "8 min" }
            : index > selectedIndex
                ? { eta: stop.name === route.destination ? "23 min" : "14 min" }
                : {}),
    }));
    const fleetBus = data.admin?.fleetVehicles?.find((bus) => bus.route === route.code);
    return {
        ...data.studentTransitData,
        assignmentStatus: "assigned",
        bus: {
            ...data.studentTransitData.bus,
            id: fleetBus?.id ?? `bus-${route.primaryBusNumber}`,
            number: fleetBus?.number ?? route.primaryBusNumber,
            capacity: fleetBus?.capacity ?? data.studentTransitData.bus.capacity,
            occupiedSeats: fleetBus?.occupancy ?? data.studentTransitData.bus.occupiedSeats,
            status: fleetBus?.status === "delayed" ? "delayed" : data.studentTransitData.bus.status,
            speed: fleetBus?.speed ?? data.studentTransitData.bus.speed,
            gpsUpdatedAt: fleetBus?.gpsUpdated ?? data.studentTransitData.bus.gpsUpdatedAt,
            coordinates: fleetBus?.coordinates ?? data.studentTransitData.bus.coordinates,
        },
        route: {
            id: route.id,
            code: route.code,
            name: route.name,
            startPoint: route.startPoint,
            destination: route.destination,
            distance: route.distance,
            scheduledArrival: route.campusArrival ?? data.studentTransitData.route.scheduledArrival,
            selectedStopId,
            mapCenter: route.mapCenter ?? data.studentTransitData.route.mapCenter,
            notes: route.notes,
            stops,
        },
    };
}

function communicationsForUser(data, user) {
    if (user.role === "admin") {
        return data.communications;
    }
    if (user.role !== "student") {
        return { notifications: [], campaigns: [], complaints: [] };
    }
    return {
        notifications: data.communications.notifications.filter((item) => !item.routeCode || item.routeCode === user.routeCode),
        campaigns: [],
        complaints: data.communications.complaints.filter((complaint) => complaint.studentId === user.id),
    };
}

export function createApiServer(store, options = {}) {
    const otpEmailSender = options.otpEmailSender ?? sendSignupOtpEmail;
    const passwordResetEmailSender = options.passwordResetEmailSender ?? sendPasswordResetOtpEmail;
    const signupOtpLimiter = createRateLimiter({ limit: 3, windowMs: 15 * 60 * 1000 });
    const passwordResetOtpLimiter = createRateLimiter({ limit: 3, windowMs: 15 * 60 * 1000 });
    const loginFailureLimiter = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000, lockMs: 15 * 60 * 1000 });

    return createServer(async (request, response) => {
        if (request.method === "OPTIONS") {
            response.writeHead(204, jsonHeaders);
            response.end();
            return;
        }

        const url = new URL(request.url, `http://${request.headers.host}`);
        const pathname = url.pathname;
        const method = request.method;

        try {
            if (method === "GET" && (pathname === "/" || pathname === "/api" || pathname === "/api/health")) {
                send(response, 200, {
                    ok: true,
                    service: "SmartTransit API",
                    health: "/api/health",
                });
                return;
            }

            if (method === "POST" && pathname === "/api/auth/login") {
                const body = await readBody(request);
                const email = normalizeEmail(String(body.email ?? ""));
                const loginKey = clientKey(request, "login", email);
                const loginAllowed = loginFailureLimiter.check(loginKey);
                if (!loginAllowed.allowed) {
                    tooManyRequests(response, retryMessage("failed sign-in attempts", loginAllowed.retryAfterSeconds));
                    return;
                }
                const payload = await store.update((data) => {
                    const user = userByEmail(data, email);
                    if (!user || !verifyPassword(body.password, user))
                        return { error: "invalid" };
                    if (isInactive(user))
                        return { error: "inactive" };
                    if (!user.passwordHash) {
                        user.passwordHash = hashPassword(body.password);
                        delete user.password;
                    }
                    const token = randomUUID();
                    data.sessions[token] = createSession(user.id);
                    return { token, user: publicUser(user) };
                });
                if (payload.error === "inactive") {
                    send(response, 403, { message: "This account is inactive. Contact the transport office administrator." });
                    return;
                }
                if (payload.error === "invalid") {
                    const rateState = loginFailureLimiter.record(loginKey);
                    if (!rateState.allowed) {
                        tooManyRequests(response, retryMessage("failed sign-in attempts", rateState.retryAfterSeconds));
                        return;
                    }
                    send(response, 401, { message: "The email or password is incorrect." });
                    return;
                }
                loginFailureLimiter.reset(loginKey);
                send(response, 200, payload);
                return;
            }

            if (method === "POST" && pathname === "/api/auth/signup-otp") {
                const body = await readBody(request);
                const email = normalizeEmail(String(body.email ?? ""));
                if (!isInstituteEmail(email)) {
                    badRequest(response, signupEmailHelpText());
                    return;
                }
                const otpKey = clientKey(request, "signup-otp", email);
                const otpAllowed = signupOtpLimiter.check(otpKey);
                if (!otpAllowed.allowed) {
                    tooManyRequests(response, retryMessage("OTP requests", otpAllowed.retryAfterSeconds));
                    return;
                }
                const currentData = await store.get();
                if (currentData.users.some((user) => user.email.toLowerCase() === email)) {
                    send(response, 409, { message: "An account already exists for this university email." });
                    return;
                }
                signupOtpLimiter.record(otpKey);
                const code = createOtp();
                try {
                    await otpEmailSender({
                        to: email,
                        otp: code,
                        expiresInMinutes: signupOtpExpiryMinutes,
                    });
                }
                catch (error) {
                    logOtpEmailError(error);
                    serviceUnavailable(response, otpEmailErrorMessage(error));
                    return;
                }
                const result = await store.update((data) => {
                    if (data.users.some((user) => user.email.toLowerCase() === email))
                        return { error: "exists" };
                    ensureSignupOtps(data)[email] = {
                        codeHash: hashSignupOtp(email, code),
                        createdAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + signupOtpExpiryMinutes * 60 * 1000).toISOString(),
                    };
                    return {
                        ok: true,
                        expiresInMinutes: signupOtpExpiryMinutes,
                    };
                });
                if (result.error === "exists") {
                    send(response, 409, { message: "An account already exists for this university email." });
                    return;
                }
                send(response, 200, result);
                return;
            }

            if (method === "POST" && pathname === "/api/auth/register/student") {
                const body = await readBody(request);
                const email = normalizeEmail(String(body.email ?? ""));
                if (!isInstituteEmail(email)) {
                    badRequest(response, signupEmailHelpText());
                    return;
                }
                const signupError = validateStudentSignupBody(body);
                if (signupError) {
                    badRequest(response, signupError);
                    return;
                }
                const payload = await store.update((data) => {
                    const signupOtps = ensureSignupOtps(data);
                    const otpRecord = signupOtps[email];
                    if (!otpRecord)
                        return { error: "missing-otp" };
                    if (Date.parse(otpRecord.expiresAt) < Date.now()) {
                        delete signupOtps[email];
                        return { error: "expired-otp" };
                    }
                    if (!verifyStoredSignupOtp(email, body.otp, otpRecord))
                        return { error: "invalid-otp" };
                    if (data.users.some((user) => user.email.toLowerCase() === email))
                        return { error: "exists" };
                    const studentCode = studentCodeFromEmail(email);
                    const user = {
                        id: `stu-${Date.now()}`,
                        name: body.fullName.trim(),
                        email,
                        passwordHash: hashPassword(body.password),
                        role: "student",
                        initials: body.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0].toUpperCase()).join(""),
                        enrollment: studentCode,
                        phone: body.phone,
                        routeCode: "",
                        stopId: "",
                        status: "pending",
                    };
                    delete signupOtps[email];
                    data.users.push(user);
                    data.admin.records.students.push({
                        id: user.id,
                        name: user.name,
                        code: studentCode,
                        detail: "Verified institute email",
                        contact: user.email,
                        routeCode: user.routeCode,
                        stopId: user.stopId,
                        assignment: "Unassigned",
                        status: "pending",
                    });
                    const token = randomUUID();
                    data.sessions[token] = createSession(user.id);
                    return { token, user: publicUser(user) };
                });
                if (payload.error === "missing-otp") {
                    badRequest(response, "Request an OTP before creating your account.");
                    return;
                }
                if (payload.error === "expired-otp") {
                    badRequest(response, "The OTP has expired. Request a new code.");
                    return;
                }
                if (payload.error === "invalid-otp") {
                    badRequest(response, "The OTP is incorrect.");
                    return;
                }
                if (payload.error === "exists") {
                    send(response, 409, { message: "An account already exists for this university email." });
                    return;
                }
                send(response, 201, payload);
                return;
            }

            if (method === "POST" && pathname === "/api/auth/password-reset") {
                const body = await readBody(request);
                const email = normalizeEmail(String(body.email ?? ""));
                if (!isInstituteEmail(email)) {
                    badRequest(response, "Enter your Indus University email ending with indusuni.ac.in.");
                    return;
                }
                const resetKey = clientKey(request, "password-reset", email);
                const resetAllowed = passwordResetOtpLimiter.check(resetKey);
                if (!resetAllowed.allowed) {
                    tooManyRequests(response, retryMessage("password reset OTP requests", resetAllowed.retryAfterSeconds));
                    return;
                }
                const currentData = await store.get();
                const existingUser = userByEmail(currentData, email);
                if (!existingUser) {
                    passwordResetOtpLimiter.record(resetKey);
                    send(response, 200, {
                        ok: true,
                        expiresInMinutes: passwordResetOtpExpiryMinutes,
                    });
                    return;
                }
                passwordResetOtpLimiter.record(resetKey);
                const code = createOtp();
                try {
                    await passwordResetEmailSender({
                        to: email,
                        otp: code,
                        expiresInMinutes: passwordResetOtpExpiryMinutes,
                    });
                }
                catch (error) {
                    logPasswordResetEmailError(error);
                    serviceUnavailable(response, passwordResetEmailErrorMessage(error));
                    return;
                }
                await store.update((data) => {
                    if (!userByEmail(data, email))
                        return { ok: true };
                    ensurePasswordResetOtps(data)[email] = {
                        codeHash: hashPasswordResetOtp(email, code),
                        createdAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + passwordResetOtpExpiryMinutes * 60 * 1000).toISOString(),
                    };
                    return { ok: true };
                });
                send(response, 200, {
                    ok: true,
                    expiresInMinutes: passwordResetOtpExpiryMinutes,
                });
                return;
            }

            if (method === "POST" && pathname === "/api/auth/password-reset/confirm") {
                const body = await readBody(request);
                const email = normalizeEmail(String(body.email ?? ""));
                const password = String(body.password ?? "");
                if (!isInstituteEmail(email)) {
                    badRequest(response, "Enter your Indus University email ending with indusuni.ac.in.");
                    return;
                }
                const passwordError = validatePassword(password);
                if (passwordError) {
                    badRequest(response, passwordError);
                    return;
                }
                const result = await store.update((data) => {
                    const user = userByEmail(data, email);
                    const passwordResetOtps = ensurePasswordResetOtps(data);
                    const otpRecord = passwordResetOtps[email];
                    if (!user || !otpRecord)
                        return { error: "missing-otp" };
                    if (Date.parse(otpRecord.expiresAt) < Date.now()) {
                        delete passwordResetOtps[email];
                        return { error: "expired-otp" };
                    }
                    if (!verifyStoredPasswordResetOtp(email, body.otp, otpRecord))
                        return { error: "invalid-otp" };
                    user.passwordHash = hashPassword(password);
                    delete user.password;
                    delete passwordResetOtps[email];
                    for (const [token, session] of Object.entries(data.sessions ?? {})) {
                        if (session.userId === user.id)
                            delete data.sessions[token];
                    }
                    return { ok: true };
                });
                if (result.error === "missing-otp") {
                    badRequest(response, "Request a password reset OTP before changing your password.");
                    return;
                }
                if (result.error === "expired-otp") {
                    badRequest(response, "The OTP has expired. Request a new reset code.");
                    return;
                }
                if (result.error === "invalid-otp") {
                    badRequest(response, "The OTP is incorrect.");
                    return;
                }
                send(response, 200, result);
                return;
            }

            if (method === "GET" && pathname === "/api/auth/session") {
                const user = await requireUser(request, store);
                if (!user) {
                    send(response, 401, { message: "Authentication required." });
                    return;
                }
                if (isInactive(user)) {
                    send(response, 403, { message: "This account is inactive. Contact the transport office administrator." });
                    return;
                }
                send(response, 200, { user: publicUser(user) });
                return;
            }

            const user = await requireUser(request, store);
            if (!user) {
                send(response, 401, { message: "Authentication required." });
                return;
            }
            if (isInactive(user)) {
                send(response, 403, { message: "This account is inactive. Contact the transport office administrator." });
                return;
            }

            if (method === "GET" && pathname === "/api/student/transit") {
                if (!requireRole(user, ["student", "admin"])) {
                    send(response, 403, { message: "Only students can view assigned transit details." });
                    return;
                }
                const data = await store.get();
                send(response, 200, isPendingStudent(user) ? buildUnassignedTransitData(data) : buildStudentTransitData(data, user));
                return;
            }

            if (method === "GET" && pathname === "/api/student/complaints") {
                if (!requireRole(user, ["student", "admin"])) {
                    send(response, 403, { message: "Only students can view student complaints." });
                    return;
                }
                const data = await store.get();
                send(response, 200, data.communications.complaints.filter((complaint) => complaint.studentId === user.id));
                return;
            }

            if (method === "POST" && pathname === "/api/student/complaints") {
                if (!requireRole(user, ["student", "admin"])) {
                    send(response, 403, { message: "Only students can submit complaints." });
                    return;
                }
                const body = await readBody(request);
                const complaint = await store.update((data) => {
                    const next = buildComplaint(body, user);
                    data.communications.complaints.unshift(next);
                    return next;
                });
                send(response, 201, complaint);
                return;
            }

            if (method === "GET" && pathname === "/api/communications/bootstrap") {
                if (!requireRole(user, ["student", "admin"])) {
                    send(response, 403, { message: "Only students and admins can view communications." });
                    return;
                }
                const data = await store.get();
                send(response, 200, communicationsForUser(data, user));
                return;
            }

            if (method === "POST" && pathname === "/api/admin/notifications") {
                if (!requireRole(user, ["admin"])) {
                    send(response, 403, { message: "Only admins can send notifications." });
                    return;
                }
                const body = await readBody(request);
                const campaign = await store.update((data) => {
                    const recipientCount = body.audience === "all" ? totalStudentCount() : routeStudentCount(body.routeCode);
                    const next = {
                        ...body,
                        id: `NTF-${new Date().getFullYear()}-${String(data.communications.campaigns.length + 183).padStart(4, "0")}`,
                        createdAt: "Just now",
                        status: body.deliveryMode === "scheduled" ? "scheduled" : "delivered",
                        deliveredCount: body.deliveryMode === "scheduled" ? 0 : recipientCount,
                        recipientCount,
                        createdBy: user.name,
                    };
                    data.communications.campaigns.unshift(next);
                    if (next.status === "delivered") {
                        data.communications.notifications.unshift({
                            id: next.id,
                            type: next.type,
                            title: next.title,
                            message: next.message,
                            createdAt: "Just now",
                            unread: true,
                            routeCode: next.routeCode,
                        });
                    }
                    return next;
                });
                send(response, 201, campaign);
                return;
            }

            const complaintMatch = pathname.match(/^\/api\/admin\/complaints\/([^/]+)$/);
            if (method === "PATCH" && complaintMatch) {
                if (!requireRole(user, ["admin"])) {
                    send(response, 403, { message: "Only admins can update complaints." });
                    return;
                }
                const body = await readBody(request);
                const updated = await store.update((data) => {
                    const complaint = data.communications.complaints.find((item) => item.id === complaintMatch[1]);
                    if (!complaint)
                        return null;
                    const label = "Just now";
                    complaint.status = body.status;
                    complaint.assignedTo = body.assignedTo;
                    complaint.resolution = body.resolution?.trim() || complaint.resolution;
                    complaint.updatedAt = label;
                    if (body.internalNote?.trim()) {
                        complaint.internalNotes.push({
                            id: `note-${Date.now()}`,
                            author: user.name,
                            message: body.internalNote.trim(),
                            createdAt: label,
                        });
                    }
                    complaint.timeline.push({
                        id: `evt-${Date.now()}`,
                        title: "Complaint updated",
                        detail: `Status changed to ${body.status}.`,
                        timestamp: label,
                    });
                    return complaint;
                });
                if (!updated) {
                    notFound(response);
                    return;
                }
                send(response, 200, updated);
                return;
            }

            if (method === "GET" && pathname === "/api/admin/bootstrap") {
                if (!requireRole(user, ["admin"])) {
                    send(response, 403, { message: "Only admins can view admin data." });
                    return;
                }
                const data = await store.get();
                send(response, 200, data.admin);
                return;
            }

            const adminRecordMatch = pathname.match(/^\/api\/admin\/(buses|drivers|conductors|students|stops)\/([^/]+)(?:\/status)?$/);
            if ((method === "PUT" || method === "PATCH") && adminRecordMatch) {
                if (!requireRole(user, ["admin"])) {
                    send(response, 403, { message: "Only admins can manage records." });
                    return;
                }
                const body = await readBody(request);
                const updated = await store.update((data) => {
                    const kind = adminRecordMatch[1];
                    const id = adminRecordMatch[2];
                    let next = body?.id ? body : { ...data.admin.records[kind].find((item) => item.id === id), ...body };
                    if (kind === "students") {
                        const assignment = normalizeStudentRecordAssignment(data, next);
                        if (assignment.error)
                            return { error: assignment.error };
                        next = assignment.record;
                        const approvalError = validateActiveStudentAssignment(next);
                        if (approvalError)
                            return { error: approvalError };
                        syncStudentUserAssignment(data, next);
                    }
                    if (kind === "drivers" || kind === "conductors") {
                        const staffSync = syncStaffUser(data, kind, next);
                        if (staffSync.error)
                            return { error: staffSync.error };
                        next = staffSync.record;
                    }
                    const exists = data.admin.records[kind].some((item) => item.id === id);
                    data.admin.records[kind] = exists
                        ? data.admin.records[kind].map((item) => item.id === id ? next : item)
                        : [next, ...data.admin.records[kind]];
                    return next;
                });
                if (updated.error) {
                    badRequest(response, updated.error);
                    return;
                }
                send(response, 200, updated);
                return;
            }

            const routeMatch = pathname.match(/^\/api\/admin\/routes\/([^/]+)(?:\/status)?$/);
            if ((method === "PUT" || method === "PATCH") && routeMatch) {
                if (!requireRole(user, ["admin"])) {
                    send(response, 403, { message: "Only admins can manage routes." });
                    return;
                }
                const body = await readBody(request);
                const updated = await store.update((data) => {
                    const id = routeMatch[1];
                    const next = body?.id ? body : { ...data.admin.routes.find((item) => item.id === id), ...body };
                    const exists = data.admin.routes.some((item) => item.id === id);
                    data.admin.routes = exists
                        ? data.admin.routes.map((item) => item.id === id ? next : item)
                        : [next, ...data.admin.routes];
                    return next;
                });
                send(response, 200, updated);
                return;
            }

            if (method === "GET" && pathname === "/api/driver/trips/current") {
                if (!requireRole(user, ["driver", "admin"])) {
                    send(response, 403, { message: "Only drivers can view driver trip controls." });
                    return;
                }
                const data = await store.get();
                send(response, 200, data.operations);
                return;
            }

            if (method === "POST" && pathname.match(/^\/api\/driver\/trips\/([^/]+)\/start$/)) {
                if (!requireRole(user, ["driver", "admin"])) {
                    send(response, 403, { message: "Only drivers can start trips." });
                    return;
                }
                const data = await store.update((db) => {
                    db.operations.tripStatus = "active";
                    db.operations.gpsUpdatedAt = "Just now";
                    return db.operations;
                });
                send(response, 200, data);
                return;
            }

            if (method === "POST" && pathname.match(/^\/api\/driver\/trips\/([^/]+)\/end$/)) {
                if (!requireRole(user, ["driver", "admin"])) {
                    send(response, 403, { message: "Only drivers can end trips." });
                    return;
                }
                const data = await store.update((db) => {
                    db.operations.tripStatus = "completed";
                    db.operations.gpsUpdatedAt = "Sharing stopped";
                    return db.operations;
                });
                send(response, 200, data);
                return;
            }

            if (method === "GET" && pathname === "/api/conductor/trips/current") {
                if (!requireRole(user, ["conductor", "admin"])) {
                    send(response, 403, { message: "Only conductors can view conductor trip controls." });
                    return;
                }
                const data = await store.get();
                send(response, 200, data.operations);
                return;
            }

            if (method === "POST" && pathname.match(/^\/api\/conductor\/trips\/([^/]+)\/seat-updates$/)) {
                if (!requireRole(user, ["conductor", "admin"])) {
                    send(response, 403, { message: "Only conductors can submit seat updates." });
                    return;
                }
                const body = await readBody(request);
                const update = await store.update((data) => {
                    const next = { ...body, id: body.id ?? `SEAT-${Date.now().toString().slice(-5)}` };
                    data.operations.seatUpdates.unshift(next);
                    return next;
                });
                send(response, 201, update);
                return;
            }

            if (method === "POST" && pathname === "/api/staff/emergencies") {
                if (!requireRole(user, ["driver", "conductor", "admin"])) {
                    send(response, 403, { message: "Only transport staff can submit staff emergency alerts." });
                    return;
                }
                const body = await readBody(request);
                const report = await store.update((data) => {
                    const next = { ...body, id: body.id ?? `EMG-${Date.now().toString().slice(-6)}`, submittedBy: user.name, role: user.role };
                    data.operations.emergencies.unshift(next);
                    return next;
                });
                send(response, 201, report);
                return;
            }

            notFound(response);
        }
        catch (error) {
            send(response, 500, { message: error instanceof Error ? error.message : "Unexpected server error." });
        }
    });
}
