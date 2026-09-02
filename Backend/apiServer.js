import { createServer } from "node:http";
import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { getBusRegistration, INDUS_CAMPUS, indusRoutes, normalizeTripDirection, routeForTripDirection, tripDirectionLabel, withStopProgress } from "../Frontend/src/services/indusRoutes.js";
import { buildPhysicalStopRecords, getRouteStaffAssignment } from "../Frontend/src/services/adminData.js";
import { isInstituteEmail, normalizeEmail, signupEmailHelpText, validatePassword } from "../Frontend/src/utils/registrationValidation.js";
import { sendPasswordResetOtpEmail, sendSignupOtpEmail } from "./emailService.js";
import { hashPassword, verifyPassword } from "./passwords.js";

const signupOtpExpiryMinutes = 10;
const passwordResetOtpExpiryMinutes = 10;
const defaultSessionHours = 8;
const defaultGpsStaleMinutes = 2;
const defaultEtaSpeedKmh = 24;
const minimumEtaSpeedKmh = 12;
const maximumEtaSpeedKmh = 60;
const roadDistanceFactor = 1.25;
const stopPassedThresholdKm = 0.08;
const stopArrivalRadiusKm = 0.18;
const allowedOrigin = process.env.SMARTTRANSIT_ALLOWED_ORIGIN || "*";
const localAllowedOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(allowedOrigin);

const jsonHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    ...(localAllowedOrigin ? { "Access-Control-Allow-Private-Network": "true" } : {}),
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

function currentShortDateTime() {
    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date());
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

function routeCodeFromAssignment(assignment) {
    return String(assignment ?? "").match(/\bIU-R\d+\b/i)?.[0]?.toUpperCase() ?? "";
}

function routeValue(value, fallback) {
    return value === undefined || value === null || value === "" ? fallback : value;
}

function normalizedStopName(name) {
    return String(name ?? "").trim().toLowerCase();
}

function templateStopForRouteStop(stop, templateStops = []) {
    return templateStops.find((item) => item.id === stop?.id) ??
        templateStops.find((item) => normalizedStopName(item.name) === normalizedStopName(stop?.name));
}

function normalizedRouteStops(stops = [], templateStops = []) {
    return stops.map((stop) => {
        const templateStop = templateStopForRouteStop(stop, templateStops);
        if (/indus university/i.test(String(stop?.name ?? templateStop?.name ?? "")))
            return { ...stop, coordinates: INDUS_CAMPUS.coordinates };
        if (templateStop?.coordinates?.length)
            return { ...stop, coordinates: templateStop.coordinates };
        return stop;
    });
}

function routeFromData(data, routeCode) {
    const normalizedRouteCode = String(routeCode ?? "").trim().toUpperCase();
    const managedRoute = data.admin?.routes?.find((route) => String(route.code ?? "").toUpperCase() === normalizedRouteCode);
    const routeTemplate = indusRoutes.find((route) => route.code === normalizedRouteCode);
    const assignedBus = managedRoute?.busId
        ? data.admin?.records?.buses?.find((bus) => bus.id === managedRoute.busId)
        : null;
    const assignedBusNumber = assignedBus?.name;
    if (managedRoute && routeTemplate) {
        return {
            ...routeTemplate,
            ...managedRoute,
            id: routeValue(managedRoute.id, routeTemplate.id),
            code: routeValue(managedRoute.code, routeTemplate.code),
            name: routeValue(managedRoute.name, routeTemplate.name),
            busNumbers: managedRoute.busNumbers?.length ? managedRoute.busNumbers : assignedBusNumber ? [assignedBusNumber] : routeTemplate.busNumbers,
            primaryBusNumber: routeValue(managedRoute.primaryBusNumber, assignedBusNumber ?? routeTemplate.primaryBusNumber),
            startPoint: routeValue(managedRoute.startPoint, routeTemplate.startPoint),
            destination: routeValue(managedRoute.destination, routeTemplate.destination),
            campusArrival: routeValue(managedRoute.campusArrival, routeTemplate.campusArrival),
            distance: routeValue(managedRoute.distance, routeTemplate.distance),
            mapCenter: managedRoute.mapCenter?.length ? managedRoute.mapCenter : routeTemplate.mapCenter,
            notes: routeValue(managedRoute.notes, routeTemplate.notes),
            studentCount: routeValue(managedRoute.studentCount, routeTemplate.studentCount),
            stops: normalizedRouteStops(managedRoute.stops?.length ? managedRoute.stops : routeTemplate.stops, routeTemplate.stops),
        };
    }
    if (managedRoute) {
        return {
            ...managedRoute,
            code: normalizedRouteCode,
            busNumbers: managedRoute.busNumbers?.length ? managedRoute.busNumbers : assignedBusNumber ? [assignedBusNumber] : [],
            primaryBusNumber: routeValue(managedRoute.primaryBusNumber, assignedBusNumber),
            stops: normalizedRouteStops(managedRoute.stops ?? []),
        };
    }
    return routeTemplate ? { ...routeTemplate, stops: normalizedRouteStops(routeTemplate.stops, routeTemplate.stops) } : null;
}

function routeForTrip(data, trip) {
    if (!trip)
        return null;
    const route = routeFromData(data, trip.routeCode);
    return route ? routeForTripDirection(route, trip.direction) : null;
}

function findRouteByCode(data, routeCode) {
    return routeFromData(data, routeCode);
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
        (item.id === record.id || cleanEmail(item.email) === cleanEmail(record.contact)));
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

function studentRecordRouteCode(record) {
    return String(record?.routeCode ?? routeCodeFromAssignment(record?.assignment)).trim().toUpperCase();
}

function activeStudentRecords(data) {
    return data.admin?.records?.students?.filter((record) => (record.status ?? "active") === "active") ?? [];
}

function studentRecipientCount(data, routeCode = "") {
    const students = activeStudentRecords(data);
    if (!routeCode)
        return students.length;
    const normalizedRouteCode = String(routeCode).trim().toUpperCase();
    return students.filter((record) => studentRecordRouteCode(record) === normalizedRouteCode).length;
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
    return `${scope}:${cleanEmail(identifier) || ip}`;
}

function cleanEmail(value) {
    return normalizeEmail(String(value ?? ""));
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

function isRejectedStudent(user) {
    return user.role === "student" && (user.status ?? "active") === "rejected";
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

function studentRecordWithConsistentAssignment(data, student) {
    const { record } = normalizeStudentRecordAssignment(data, student);
    const approvalError = validateActiveStudentAssignment(record);
    return approvalError ? { ...record, status: "pending" } : record;
}

function buildStaffUserId(kind, recordId) {
    return `${kind === "drivers" ? "drv" : "con"}-${String(recordId ?? randomUUID()).replace(/^(driver|conductor)-/i, "")}`;
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
    const accountEmail = cleanEmail(record.accountEmail);
    const temporaryPassword = String(record.temporaryPassword ?? "");
    const cleaned = { ...record };
    delete cleaned.temporaryPassword;
    if (!accountEmail)
        return { record: cleaned };
    if (!isInstituteEmail(accountEmail))
        return { error: "Use an Indus University email for staff account access." };
    const passwordError = temporaryPassword ? validatePassword(temporaryPassword) : "";
    const existing = data.users.find((item) => item.id === cleaned.accountUserId || cleanEmail(item.email) === accountEmail);
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

function normalizedStaffName(name) {
    return String(name ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function routeForUser(data, user) {
    return routeFromData(data, user.routeCode);
}

function gpsStaleMs() {
    const minutes = Number(process.env.SMARTTRANSIT_GPS_STALE_MINUTES ?? defaultGpsStaleMinutes);
    return (Number.isFinite(minutes) && minutes > 0 ? minutes : defaultGpsStaleMinutes) * 60 * 1000;
}

function liveLocationMap(data) {
    return data.operations?.liveLocations && typeof data.operations.liveLocations === "object" && !Array.isArray(data.operations.liveLocations)
        ? data.operations.liveLocations
        : {};
}

function ensureLiveLocations(data) {
    if (!data.operations)
        data.operations = {};
    if (!data.operations.liveLocations || typeof data.operations.liveLocations !== "object" || Array.isArray(data.operations.liveLocations))
        data.operations.liveLocations = {};
    return data.operations.liveLocations;
}

function ensureRouteTrips(data) {
    if (!data.operations)
        data.operations = {};
    if (!data.operations.routeTrips || typeof data.operations.routeTrips !== "object" || Array.isArray(data.operations.routeTrips))
        data.operations.routeTrips = {};
    return data.operations.routeTrips;
}

function routeTripSnapshot(state) {
    return {
        activeStaffTrip: state.activeStaffTrip,
        operationalStops: state.operationalStops ?? [],
        operationalCurrentStopId: state.operationalCurrentStopId ?? state.activeStaffTrip?.nextStopId ?? "",
        tripStatus: state.tripStatus ?? "not-started",
        gpsUpdatedAt: state.gpsUpdatedAt ?? "Not sharing",
        activeSeatTripId: state.activeSeatTripId ?? state.activeStaffTrip?.id,
    };
}

function routeTripStateForRoute(data, routeCode) {
    const routeTrips = data.operations?.routeTrips;
    const routeState = routeTrips && typeof routeTrips === "object" && !Array.isArray(routeTrips)
        ? routeTrips[routeCode]
        : null;
    if (routeState?.activeStaffTrip) {
        return routeTripSnapshot(routeState);
    }
    if (data.operations?.activeStaffTrip?.routeCode === routeCode)
        return data.operations;
    return null;
}

function routeTripStateForTripId(data, tripId) {
    if (data.operations?.activeStaffTrip?.id === tripId)
        return data.operations;
    const routeTrips = data.operations?.routeTrips;
    if (!routeTrips || typeof routeTrips !== "object" || Array.isArray(routeTrips))
        return null;
    const state = Object.values(routeTrips).find((item) => item?.activeStaffTrip?.id === tripId);
    return state ? { ...data.operations, ...state } : null;
}

function saveRouteTripState(data, routeCode, state) {
    const snapshot = routeTripSnapshot(state);
    ensureRouteTrips(data)[routeCode] = snapshot;
    if (!data.operations.activeStaffTrip || data.operations.activeStaffTrip.routeCode === routeCode) {
        Object.assign(data.operations, snapshot);
    }
    return snapshot;
}

function roundCoordinate(value) {
    return Number(Number(value).toFixed(6));
}

function roundMetric(value, decimals = 1) {
    return Number(Number(value).toFixed(decimals));
}

function hasCoordinates(value) {
    return Array.isArray(value) &&
        value.length >= 2 &&
        Number.isFinite(Number(value[0])) &&
        Number.isFinite(Number(value[1]));
}

function radians(value) {
    return Number(value) * Math.PI / 180;
}

function directDistanceKmBetween(start, end) {
    if (!hasCoordinates(start) || !hasCoordinates(end))
        return null;
    const earthRadiusKm = 6371;
    const startLat = Number(start[0]);
    const startLng = Number(start[1]);
    const endLat = Number(end[0]);
    const endLng = Number(end[1]);
    const latDelta = radians(endLat - startLat);
    const lngDelta = radians(endLng - startLng);
    const a = Math.sin(latDelta / 2) ** 2 +
        Math.cos(radians(startLat)) * Math.cos(radians(endLat)) * Math.sin(lngDelta / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceKmBetween(start, end) {
    const distanceKm = directDistanceKmBetween(start, end);
    return distanceKm === null ? null : distanceKm * roadDistanceFactor;
}

function gpsSpeedFromPreviousLocation(previousLocation, currentLocation) {
    if (!hasCoordinates(previousLocation?.coordinates) || !hasCoordinates(currentLocation?.coordinates))
        return null;
    const previousAt = Date.parse(previousLocation.updatedAt ?? previousLocation.reportedAt ?? "");
    const currentAt = Date.parse(currentLocation.reportedAt ?? currentLocation.updatedAt ?? "");
    if (!Number.isFinite(previousAt) || !Number.isFinite(currentAt) || currentAt <= previousAt)
        return null;
    const elapsedSeconds = (currentAt - previousAt) / 1000;
    if (elapsedSeconds < 3 || elapsedSeconds > 180)
        return null;
    const distanceKm = directDistanceKmBetween(previousLocation.coordinates, currentLocation.coordinates);
    if (distanceKm === null)
        return null;
    const speedKmh = distanceKm / (elapsedSeconds / 3600);
    if (!Number.isFinite(speedKmh) || speedKmh <= 0)
        return null;
    return Math.max(minimumEtaSpeedKmh, Math.min(maximumEtaSpeedKmh, speedKmh));
}

function routeDistanceKm(stops, fromIndex, toIndex) {
    if (!Array.isArray(stops) || fromIndex >= toIndex)
        return 0;
    let distance = 0;
    for (let index = Math.max(0, fromIndex); index < toIndex; index += 1) {
        const segmentDistance = distanceKmBetween(stops[index]?.coordinates, stops[index + 1]?.coordinates);
        if (segmentDistance === null)
            return null;
        distance += segmentDistance;
    }
    return distance;
}

function cumulativeRouteDistancesKm(stops) {
    if (!Array.isArray(stops) || !stops.length)
        return [];
    const distances = [0];
    for (let index = 1; index < stops.length; index += 1) {
        const segmentDistance = directDistanceKmBetween(stops[index - 1]?.coordinates, stops[index]?.coordinates);
        distances[index] = distances[index - 1] + (segmentDistance ?? 0);
    }
    return distances;
}

function localPointMeters(coordinates, origin) {
    if (!hasCoordinates(coordinates) || !hasCoordinates(origin))
        return null;
    const lat = Number(coordinates[0]);
    const lng = Number(coordinates[1]);
    const originLat = Number(origin[0]);
    const originLng = Number(origin[1]);
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = metersPerDegreeLat * Math.cos(radians(originLat));
    return {
        x: (lng - originLng) * metersPerDegreeLng,
        y: (lat - originLat) * metersPerDegreeLat,
    };
}

function closestRouteProjection(stops, coordinates, cumulativeDistances) {
    if (!Array.isArray(stops) || stops.length === 0 || !hasCoordinates(coordinates))
        return null;
    if (stops.length === 1) {
        const distanceKm = directDistanceKmBetween(coordinates, stops[0]?.coordinates);
        return {
            routeKm: 0,
            distanceMeters: distanceKm === null ? null : distanceKm * 1000,
        };
    }
    const origin = stops[0]?.coordinates;
    const point = localPointMeters(coordinates, origin);
    if (!point)
        return null;
    let best = null;
    for (let index = 0; index < stops.length - 1; index += 1) {
        const start = localPointMeters(stops[index]?.coordinates, origin);
        const end = localPointMeters(stops[index + 1]?.coordinates, origin);
        if (!start || !end)
            continue;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const segmentLengthSquared = dx * dx + dy * dy;
        if (segmentLengthSquared <= 0)
            continue;
        const rawT = ((point.x - start.x) * dx + (point.y - start.y) * dy) / segmentLengthSquared;
        const t = Math.max(0, Math.min(1, rawT));
        const projected = {
            x: start.x + dx * t,
            y: start.y + dy * t,
        };
        const distanceMeters = Math.hypot(point.x - projected.x, point.y - projected.y);
        const segmentLengthKm = Math.sqrt(segmentLengthSquared) / 1000;
        const routeKm = (cumulativeDistances[index] ?? 0) + segmentLengthKm * t;
        if (!best || distanceMeters < best.distanceMeters) {
            best = {
                routeKm,
                distanceMeters,
                segmentIndex: index,
            };
        }
    }
    return best;
}

function stopProgressFromLocation(route, coordinates, trip = {}) {
    const stops = route?.stops ?? [];
    if (!stops.length)
        return null;
    const previousNextStopId = typeof trip === "string" ? trip : trip?.nextStopId;
    const previousNextStopIndex = stops.findIndex((stop) => stop.id === previousNextStopId);
    const currentIndex = previousNextStopIndex >= 0 ? previousNextStopIndex : 0;
    const currentStop = stops[currentIndex];
    const previousReachedStopId = typeof trip === "string" ? "" : trip?.lastReachedStopId;
    const hasReachedAStop = stops.some((stop) => stop.id === previousReachedStopId);
    if (!hasCoordinates(coordinates)) {
        return {
            nextStopId: currentStop?.id ?? stops[0].id,
            nextStopIndex: currentIndex,
            lastReachedStopId: hasReachedAStop ? previousReachedStopId : "",
            distanceFromRouteMeters: null,
            routeProgressKm: null,
        };
    }
    const cumulativeDistances = cumulativeRouteDistancesKm(stops);
    const projection = closestRouteProjection(stops, coordinates, cumulativeDistances);
    if (!projection) {
        return {
            nextStopId: currentStop?.id ?? stops[0].id,
            nextStopIndex: currentIndex,
            lastReachedStopId: hasReachedAStop ? previousReachedStopId : "",
            distanceFromRouteMeters: null,
            routeProgressKm: null,
        };
    }
    const distanceToCurrentStopKm = directDistanceKmBetween(coordinates, currentStop?.coordinates);
    let lastReachedStopId = hasReachedAStop ? previousReachedStopId : "";
    if (distanceToCurrentStopKm !== null && distanceToCurrentStopKm <= stopArrivalRadiusKm)
        lastReachedStopId = currentStop.id;
    let nextStopIndex = currentIndex;
    if (lastReachedStopId) {
        const passedLineKm = projection.routeKm - stopPassedThresholdKm;
        nextStopIndex = stops.findIndex((_stop, index) => (cumulativeDistances[index] ?? 0) >= passedLineKm);
        if (nextStopIndex < 0)
            nextStopIndex = stops.length - 1;
        if (nextStopIndex < currentIndex)
            nextStopIndex = currentIndex;
        const nextStop = stops[nextStopIndex];
        const distanceToNextStopKm = directDistanceKmBetween(coordinates, nextStop?.coordinates);
        if (distanceToNextStopKm !== null && distanceToNextStopKm <= stopArrivalRadiusKm)
            lastReachedStopId = nextStop.id;
    }
    return {
        nextStopId: stops[nextStopIndex]?.id ?? stops.at(-1)?.id,
        nextStopIndex,
        lastReachedStopId,
        distanceFromRouteMeters: projection.distanceMeters,
        routeProgressKm: projection.routeKm,
    };
}

function etaSpeedKmh(location) {
    const speed = Number(location?.speedKmh);
    if (Number.isFinite(speed) && speed > 0)
        return Math.max(minimumEtaSpeedKmh, Math.min(maximumEtaSpeedKmh, speed));
    return defaultEtaSpeedKmh;
}

function etaLabel(distanceKm, speedKmh) {
    if (!Number.isFinite(distanceKm) || distanceKm < 0 || !Number.isFinite(speedKmh) || speedKmh <= 0)
        return "Waiting for GPS";
    const minutes = Math.max(1, Math.round(distanceKm / speedKmh * 60));
    if (minutes < 60)
        return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

function distanceLabel(distanceKm) {
    if (!Number.isFinite(distanceKm) || distanceKm < 0)
        return "Waiting for GPS";
    if (distanceKm < 0.1)
        return "<100 m";
    if (distanceKm < 1)
        return `${Math.round(distanceKm * 1000)} m`;
    return `${distanceKm.toFixed(distanceKm >= 10 ? 0 : 1)} km`;
}

function stopDistanceFromLiveLocation(route, nextStopIndex, targetStopIndex, location) {
    if (targetStopIndex < nextStopIndex)
        return null;
    const stops = route?.stops ?? [];
    const nextStop = stops[nextStopIndex];
    if (!nextStop)
        return null;
    const distanceToNextStop = distanceKmBetween(location?.coordinates, nextStop.coordinates);
    if (distanceToNextStop === null)
        return null;
    const distanceAfterNextStop = routeDistanceKm(stops, nextStopIndex, targetStopIndex);
    if (distanceAfterNextStop === null)
        return null;
    return distanceToNextStop + distanceAfterNextStop;
}

function buildLiveEtaContext(data, route, trip, locationOverride) {
    if (!route || !trip) {
        return {
            nextStopId: "",
            nextStopName: "",
            nextStopEta: "Waiting for GPS",
            remainingDistance: "Waiting for GPS",
            etaSource: "unavailable",
            distanceToNextStopKm: null,
        };
    }
    const tripNextStopId = route.stops?.some((stop) => stop.id === trip.nextStopId)
        ? trip.nextStopId
        : route.stops?.[Math.max(0, route.stops.length - 2)]?.id ?? route.stops?.[0]?.id ?? "";
    const tripActive = tripIsSharingLocation(data, route.code);
    const location = locationOverride ?? (tripActive ? liveLocationForRoute(data, route.code) : null);
    const gpsStatus = tripActive ? liveLocationStatus(location) : "not-sharing";
    const hasPhoneLocation = tripActive && hasCoordinates(location?.coordinates);
    const locationProgress = hasPhoneLocation
        ? stopProgressFromLocation(route, location.coordinates, {
            ...trip,
            nextStopId: tripNextStopId,
        })
        : null;
    const nextStopId = locationProgress?.nextStopId ?? tripNextStopId;
    const nextStopIndex = Math.max(0, route.stops?.findIndex((stop) => stop.id === nextStopId) ?? 0);
    const nextStop = route.stops?.[nextStopIndex];
    if (!tripActive) {
        return {
            nextStopId: nextStop?.id ?? nextStopId,
            nextStopName: nextStop?.name ?? trip.nextStopName,
            nextStopEta: trip.nextStopEta ?? "--",
            remainingDistance: trip.remainingDistance ?? "--",
            etaSource: "scheduled",
            distanceToNextStopKm: null,
            gpsStatus,
        };
    }
    if (!hasPhoneLocation) {
        return {
            nextStopId: nextStop?.id ?? nextStopId,
            nextStopName: nextStop?.name ?? trip.nextStopName,
            nextStopEta: "Waiting for GPS",
            remainingDistance: "Waiting for GPS",
            etaSource: "waiting-for-gps",
            distanceToNextStopKm: null,
            gpsStatus,
        };
    }
    const speedKmh = etaSpeedKmh(location);
    const distanceToNextStopKm = stopDistanceFromLiveLocation(route, nextStopIndex, nextStopIndex, location);
    return {
        nextStopId: nextStop?.id ?? nextStopId,
        nextStopName: nextStop?.name ?? trip.nextStopName,
        nextStopEta: etaLabel(distanceToNextStopKm, speedKmh),
        remainingDistance: distanceLabel(distanceToNextStopKm),
        etaSource: location?.speedSource === "device" && Number(location?.speedKmh) > 0
            ? "driver-phone-speed"
            : location?.speedSource === "calculated" && Number(location?.speedKmh) > 0
                ? "gps-calculated-speed"
                : "driver-phone-average",
        etaSpeedKmh: speedKmh,
        distanceToNextStopKm,
        gpsStatus,
        location,
        routeProgressKm: locationProgress?.routeProgressKm,
        distanceFromRouteMeters: locationProgress?.distanceFromRouteMeters,
        lastReachedStopId: locationProgress?.lastReachedStopId ?? trip.lastReachedStopId,
        stopDistanceKm(targetStopId) {
            const targetStopIndex = route.stops?.findIndex((stop) => stop.id === targetStopId) ?? -1;
            if (targetStopIndex < 0)
                return null;
            return stopDistanceFromLiveLocation(route, nextStopIndex, targetStopIndex, location);
        },
    };
}

function etaForStop(etaContext, stopId) {
    const distanceKm = etaContext?.stopDistanceKm?.(stopId);
    if (distanceKm === null || distanceKm === undefined)
        return null;
    return {
        eta: etaLabel(distanceKm, etaContext.etaSpeedKmh),
        distanceFromBus: distanceLabel(distanceKm),
    };
}

function locationAgeLabel(updatedAt) {
    const timestamp = Date.parse(updatedAt ?? "");
    if (!Number.isFinite(timestamp))
        return "Not sharing";
    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    if (seconds < 45)
        return "Just now";
    if (seconds < 90)
        return "1 min ago";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60)
        return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return `${hours} hr ago`;
}

function liveLocationStatus(location) {
    if (!location)
        return "waiting";
    const timestamp = Date.parse(location.updatedAt ?? "");
    if (!Number.isFinite(timestamp))
        return "waiting";
    return Date.now() - timestamp > gpsStaleMs() ? "stale" : "live";
}

function liveLocationForRoute(data, routeCode) {
    const routeState = routeTripStateForRoute(data, routeCode);
    const tripId = routeState?.activeStaffTrip?.id;
    if (tripId)
        return liveLocationMap(data)[tripId] ?? null;
    return Object.values(liveLocationMap(data)).find((location) => location.routeCode === routeCode) ?? null;
}

function tripIsSharingLocation(data, routeCode) {
    return routeTripStateForRoute(data, routeCode)?.tripStatus === "active";
}

function busWithLiveLocation(data, bus, routeCode) {
    const routeState = routeTripStateForRoute(data, routeCode);
    if (!routeState?.activeStaffTrip) {
        return {
            ...bus,
            tripActive: false,
            gpsStatus: "not-sharing",
            gpsUpdated: "Not sharing",
            gpsUpdatedAt: "Not sharing",
            etaSource: bus.etaSource ?? "scheduled",
            status: "stopped",
        };
    }
    const tripActive = routeState.tripStatus === "active";
    const location = tripActive ? liveLocationForRoute(data, routeCode) : null;
    const trip = routeState.activeStaffTrip;
    const route = trip ? routeForTrip(data, trip) : routeFromData(data, routeCode);
    const etaContext = buildLiveEtaContext(data, route, trip, location);
    const gpsStatus = tripActive ? liveLocationStatus(location) : "not-sharing";
    const gpsUpdated = location ? locationAgeLabel(location.updatedAt) : tripActive ? "Waiting for driver phone" : "Not sharing";
    const speed = Number.isFinite(location?.speedKmh)
        ? Math.round(location.speedKmh)
        : tripActive && !location
            ? 0
            : bus.speed;
    return {
        ...bus,
        tripActive,
        coordinates: location?.coordinates ?? bus.coordinates,
        speed,
        gpsUpdated,
        gpsUpdatedAt: gpsUpdated,
        gpsStatus,
        gpsAccuracy: location?.accuracy,
        lastLocationAt: location?.updatedAt,
        locationSource: location?.source,
        eta: etaContext.nextStopEta ?? bus.eta,
        nextStopId: etaContext.nextStopId,
        nextStopName: etaContext.nextStopName,
        nextStopEta: etaContext.nextStopEta,
        remainingDistance: etaContext.remainingDistance,
        etaSource: etaContext.etaSource,
        distanceToNextStop: etaContext.distanceToNextStopKm === null
            ? etaContext.remainingDistance
            : distanceLabel(etaContext.distanceToNextStopKm),
        status: !tripActive ? "stopped" : gpsStatus === "live" ? bus.status === "stopped" || bus.status === "stale-gps" ? "on-trip" : bus.status : "stale-gps",
    };
}

function initialsForName(name) {
    return String(name ?? "").split(/\s+/).map((part) => part[0]?.toUpperCase()).join("");
}

function routeByStaffRecord(data, kind, recordId) {
    if (!recordId)
        return null;
    const key = kind === "drivers" ? "driverId" : "conductorId";
    const managedRoute = data.admin?.routes?.find((route) => route[key] === recordId);
    if (managedRoute)
        return routeFromData(data, managedRoute.code);
    const staticRoute = kind === "drivers"
        ? routeForDriverRecord(recordId)
        : routeForConductorRecord(recordId);
    return staticRoute ? routeFromData(data, staticRoute.code) : null;
}

function busRecordForRoute(data, route) {
    if (!route)
        return null;
    const records = data.admin?.records?.buses ?? [];
    return records.find((bus) => bus.id === route.busId) ??
        records.find((bus) => bus.name === route.primaryBusNumber) ??
        null;
}

function busNumberForRoute(data, route) {
    return busRecordForRoute(data, route)?.name ??
        route?.primaryBusNumber ??
        route?.busNumbers?.[0] ??
        "";
}

function fleetBusMatchesRouteSelection(data, bus, route) {
    if (!bus || !route)
        return false;
    const busNumber = busNumberForRoute(data, route);
    if (route.busId)
        return bus.id === route.busId || bus.number === busNumber;
    if (busNumber)
        return bus.number === busNumber;
    return bus.route === route.code;
}

function busRegistrationForRoute(data, route) {
    const busRecord = busRecordForRoute(data, route);
    const busNumber = busNumberForRoute(data, route);
    if (busRecord?.code)
        return busRecord.code;
    if (busNumber)
        return `GJ-01-FT-${busNumber}`;
    return route?.primaryBusNumber ? getBusRegistration(route) : "Not assigned";
}

function capacityFromBusRecord(busRecord) {
    const match = String(busRecord?.contact ?? "").match(/\d+/);
    const capacity = Number(match?.[0]);
    return Number.isFinite(capacity) && capacity > 0 ? capacity : null;
}

function staffAssignmentForRoute(data, route) {
    const fallback = getRouteStaffAssignment(route?.code);
    const drivers = data.admin?.records?.drivers ?? [];
    const conductors = data.admin?.records?.conductors ?? [];
    const driverRecord = drivers.find((driver) => driver.id === route?.driverId);
    const conductorRecord = conductors.find((conductor) => conductor.id === route?.conductorId);
    return {
        driver: {
            id: driverRecord?.id ?? fallback.driver.id,
            name: driverRecord?.name ?? fallback.driver.name,
            licence: driverRecord?.detail ?? fallback.driver.licence,
            phone: driverRecord?.contact ?? fallback.driver.phone,
            accountEmail: driverRecord?.accountEmail ?? fallback.driver.accountEmail,
            accountUserId: driverRecord?.accountUserId ?? fallback.driver.accountUserId,
        },
        conductor: {
            id: conductorRecord?.id ?? fallback.conductor.id,
            name: conductorRecord?.name ?? fallback.conductor.name,
            phone: conductorRecord?.contact ?? fallback.conductor.phone,
            accountEmail: conductorRecord?.accountEmail ?? fallback.conductor.accountEmail,
            accountUserId: conductorRecord?.accountUserId ?? fallback.conductor.accountUserId,
        },
    };
}

function findFleetBusForRoute(data, route) {
    const busNumber = busNumberForRoute(data, route);
    const fleet = data.admin?.fleetVehicles ?? [];
    return fleet.find((bus) => bus.id === route?.busId) ??
        fleet.find((bus) => bus.number === busNumber) ??
        fleet.find((bus) => bus.route === route?.code && fleetBusMatchesRouteSelection(data, bus, route)) ??
        null;
}

function buildFleetBusForRoute(data, route) {
    const busRecord = busRecordForRoute(data, route);
    const busNumber = busNumberForRoute(data, route);
    if (!route || !busNumber)
        return null;
    const staff = staffAssignmentForRoute(data, route);
    const firstStop = route.stops?.[0];
    return {
        id: busRecord?.id ?? route.busId ?? `bus-${busNumber}`,
        number: busNumber,
        route: route.code,
        driver: staff.driver.name,
        speed: 0,
        eta: "--",
        occupancy: 0,
        capacity: capacityFromBusRecord(busRecord) ?? 50,
        gpsUpdated: "Not sharing",
        status: "stopped",
        tripActive: false,
        coordinates: firstStop?.coordinates,
    };
}

function fleetBusForRoute(data, route) {
    return findFleetBusForRoute(data, route) ?? buildFleetBusForRoute(data, route);
}

function ensureFleetBusForRoute(data, route) {
    const existing = findFleetBusForRoute(data, route);
    if (existing)
        return existing;
    const next = buildFleetBusForRoute(data, route);
    if (!next)
        return null;
    if (!data.admin)
        data.admin = {};
    if (!Array.isArray(data.admin.fleetVehicles))
        data.admin.fleetVehicles = [];
    data.admin.fleetVehicles.unshift(next);
    return next;
}

function activeTripWithConsistentAssignments(data, trip) {
    if (!trip)
        return trip;
    const templateRoute = indusRoutes.find((item) => item.code === trip.routeCode || item.primaryBusNumber === trip.busNumber);
    const baseRoute = routeFromData(data, trip.routeCode) ?? (templateRoute ? routeFromData(data, templateRoute.code) : null);
    if (!baseRoute)
        return trip;
    const direction = normalizeTripDirection(trip.direction);
    const route = routeForTripDirection(baseRoute, direction);
    const staff = staffAssignmentForRoute(data, baseRoute);
    const fleetBus = fleetBusForRoute(data, baseRoute);
    const busNumber = busNumberForRoute(data, baseRoute) || trip.busNumber;
    const capacity = Number(fleetBus?.capacity ?? trip.capacity ?? 50);
    const occupiedSeatValue = Number(fleetBus?.occupancy ?? trip.occupiedSeats ?? 0);
    const occupiedSeats = Math.min(capacity, Math.max(0, Number.isFinite(occupiedSeatValue) ? occupiedSeatValue : 0));
    const nextStopId = route.stops?.some((stop) => stop.id === trip.nextStopId)
        ? trip.nextStopId
        : route.stops?.[0]?.id;
    const etaContext = buildLiveEtaContext(data, route, {
        ...trip,
        routeCode: baseRoute.code,
        direction,
        nextStopId,
    });
    const etaNextStop = route.stops?.find((stop) => stop.id === etaContext.nextStopId) ??
        route.stops?.find((stop) => stop.id === nextStopId);
    return {
        ...trip,
        direction,
        directionLabel: tripDirectionLabel(direction),
        routeCode: baseRoute.code,
        routeName: route.name,
        busNumber,
        registration: busRegistrationForRoute(data, baseRoute),
        capacity,
        occupiedSeats,
        availableSeats: capacity - occupiedSeats,
        scheduledStart: route.stops[0]?.scheduledTime ?? trip.scheduledStart,
        scheduledEnd: route.stops.at(-1)?.scheduledTime ?? route.campusArrival ?? trip.scheduledEnd,
        distance: baseRoute.distance ?? trip.distance,
        nextStopId: etaNextStop?.id ?? trip.nextStopId,
        nextStopName: etaNextStop?.name ?? trip.nextStopName,
        nextStopEta: etaContext.nextStopEta,
        remainingDistance: etaContext.remainingDistance,
        etaSource: etaContext.etaSource,
        etaSpeedKmh: etaContext.etaSpeedKmh,
        lastReachedStopId: etaContext.lastReachedStopId ?? trip.lastReachedStopId ?? "",
        distanceToNextStop: etaContext.distanceToNextStopKm === null
            ? etaContext.remainingDistance
            : distanceLabel(etaContext.distanceToNextStopKm),
        driver: {
            ...(trip.driver ?? {}),
            id: staff.driver.accountUserId || trip.driver?.id,
            name: staff.driver.name,
            phone: staff.driver.phone,
            initials: initialsForName(staff.driver.name),
        },
        conductor: {
            ...(trip.conductor ?? {}),
            id: staff.conductor.accountUserId || trip.conductor?.id,
            name: staff.conductor.name,
            phone: staff.conductor.phone,
            initials: initialsForName(staff.conductor.name),
        },
    };
}

function routeForDriverRecord(driverId) {
    return indusRoutes.find((route) => getRouteStaffAssignment(route.code).driver.id === driverId);
}

function routeForConductorRecord(conductorId) {
    return indusRoutes.find((route) => getRouteStaffAssignment(route.code).conductor.id === conductorId);
}

function adminDataWithConsistentAssignments(data) {
    const admin = data.admin ?? {};
    const records = admin.records ?? {};
    const buses = (records.buses ?? []).map((bus) => {
        const route = (admin.routes ?? [])
            .map((routeRecord) => routeFromData(data, routeRecord.code))
            .find((item) => item && (item.busId === bus.id || item.primaryBusNumber === bus.name));
        if (!route)
            return bus;
        const staff = staffAssignmentForRoute(data, route);
        return {
            ...bus,
            name: bus.name || busNumberForRoute(data, route),
            code: bus.code || busRegistrationForRoute(data, route),
            assignment: `${route.code} - ${staff.driver.name}`,
        };
    });
    const drivers = (records.drivers ?? []).map((driver) => {
        const route = routeByStaffRecord(data, "drivers", driver.id);
        const busNumber = route ? busNumberForRoute(data, route) : "";
        return {
            ...driver,
            assignment: route ? `${busNumber || "Unassigned bus"} - ${route.code}` : "Unassigned",
            accountEmail: driver.accountEmail || (driver.id === "driver-101" ? "driver@transport.indusuni.ac.in" : ""),
            accountUserId: driver.accountUserId || (driver.id === "driver-101" ? "drv-101" : ""),
        };
    });
    const conductors = (records.conductors ?? []).map((conductor) => {
        const route = routeByStaffRecord(data, "conductors", conductor.id);
        const busNumber = route ? busNumberForRoute(data, route) : "";
        return {
            ...conductor,
            assignment: route ? `${busNumber || "Unassigned bus"} - ${route.code}` : "Unassigned",
            accountEmail: conductor.accountEmail || (conductor.id === "conductor-101" ? "conductor@transport.indusuni.ac.in" : ""),
            accountUserId: conductor.accountUserId || (conductor.id === "conductor-101" ? "con-101" : ""),
        };
    });
    const students = (records.students ?? []).map((student) => studentRecordWithConsistentAssignment(data, student));
    const routes = (admin.routes ?? []).map((routeRecord) => {
        const route = routeFromData(data, routeRecord.code) ?? indusRoutes.find((item) => item.id === routeRecord.id);
        if (!route)
            return routeRecord;
        const staff = staffAssignmentForRoute(data, route);
        const busRecord = busRecordForRoute(data, route);
        return {
            ...routeRecord,
            busId: routeRecord.busId || busRecord?.id || `bus-${busNumberForRoute(data, route)}`,
            driverId: routeRecord.driverId || staff.driver.id,
            conductorId: routeRecord.conductorId || staff.conductor.id,
            primaryBusNumber: busNumberForRoute(data, route),
            stops: route.stops,
        };
    });
    const fleetById = new Map();
    for (const bus of admin.fleetVehicles ?? []) {
        const route = routeFromData(data, bus.route) ??
            (admin.routes ?? [])
                .map((routeRecord) => routeFromData(data, routeRecord.code))
                .find((item) => item && (item.busId === bus.id || bus.number === busNumberForRoute(data, item)));
        if (!route)
            fleetById.set(bus.id ?? bus.number, bus);
        else if (fleetBusMatchesRouteSelection(data, bus, route))
            fleetById.set(bus.id ?? bus.number, {
            ...bus,
            id: bus.id || busRecordForRoute(data, route)?.id || `bus-${busNumberForRoute(data, route)}`,
            number: busNumberForRoute(data, route),
            route: route.code,
            driver: staffAssignmentForRoute(data, route).driver.name,
            capacity: bus.capacity ?? capacityFromBusRecord(busRecordForRoute(data, route)) ?? 50,
        });
    }
    for (const route of routes.map((routeRecord) => routeFromData(data, routeRecord.code)).filter(Boolean)) {
        const bus = fleetBusForRoute(data, route);
        if (bus)
            fleetById.set(bus.id ?? bus.number, {
                ...bus,
                number: busNumberForRoute(data, route),
                route: route.code,
                driver: staffAssignmentForRoute(data, route).driver.name,
            });
    }
    const fleetVehicles = [...fleetById.values()];
    const stopStatusById = new Map((records.stops ?? []).map((stop) => [stop.id, stop.status]));
    const stops = buildPhysicalStopRecords(routes).map((stop) => ({
        ...stop,
        status: stopStatusById.get(stop.id) ?? stop.status,
    }));
    return {
        ...admin,
        records: {
            ...records,
            buses,
            drivers,
            conductors,
            students,
            stops,
        },
        routes,
        fleetVehicles,
    };
}

function adminDataWithLiveLocations(data) {
    const admin = adminDataWithConsistentAssignments(data);
    return {
        ...admin,
        fleetVehicles: admin.fleetVehicles.map((bus) => busWithLiveLocation({ ...data, admin }, bus, bus.route)),
    };
}

function operationsWithLiveLocation(data, sourceOperations = data.operations) {
    const trip = activeTripWithConsistentAssignments(data, sourceOperations?.activeStaffTrip);
    const route = trip ? routeForTrip(data, trip) : null;
    const currentStopId = route?.stops?.some((stop) => stop.id === trip?.nextStopId)
        ? trip.nextStopId
        : sourceOperations?.operationalCurrentStopId;
    const operationalStops = route?.stops?.length
        ? withStopProgress(route, currentStopId)
        : sourceOperations?.operationalStops;
    const location = sourceOperations?.tripStatus === "active" && trip ? liveLocationMap(data)[trip.id] : null;
    const allSeatUpdates = data.operations?.seatUpdates ?? [];
    const currentTripSeatUpdates = trip ? allSeatUpdates.filter((update) => update.tripId === trip.id) : [];
    const legacySeatUpdates = trip && !trip.startedAt && sourceOperations === data.operations
        ? allSeatUpdates.filter((update) => !update.tripId)
        : [];
    return {
        ...data.operations,
        ...sourceOperations,
        seatUpdates: currentTripSeatUpdates.length ? currentTripSeatUpdates : legacySeatUpdates,
        operationalStops,
        operationalCurrentStopId: currentStopId,
        gpsUpdatedAt: location ? locationAgeLabel(location.updatedAt) : sourceOperations?.gpsUpdatedAt,
        liveLocation: location
            ? {
                ...location,
                gpsStatus: liveLocationStatus(location),
                gpsUpdatedAt: locationAgeLabel(location.updatedAt),
            }
            : null,
        activeStaffTrip: location
            ? {
                ...trip,
                currentCoordinates: location.coordinates,
                currentSpeed: location.speedKmh,
                gpsUpdatedAt: locationAgeLabel(location.updatedAt),
            }
            : trip,
    };
}

function validateLocationPayload(body) {
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
        return { error: "Latitude must be a valid number between -90 and 90." };
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
        return { error: "Longitude must be a valid number between -180 and 180." };
    const accuracy = body.accuracy === undefined || body.accuracy === null ? null : Number(body.accuracy);
    if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 10000))
        return { error: "GPS accuracy must be a positive value." };
    const speedKmhInput = body.speedKmh === undefined || body.speedKmh === null || body.speedKmh === ""
        ? null
        : Number(body.speedKmh);
    const speedMpsInput = body.speedMetersPerSecond === undefined || body.speedMetersPerSecond === null || body.speedMetersPerSecond === ""
        ? null
        : Number(body.speedMetersPerSecond);
    const speedKmh = Number.isFinite(speedKmhInput)
        ? Math.max(0, Math.min(160, speedKmhInput))
        : Number.isFinite(speedMpsInput)
            ? Math.max(0, Math.min(160, speedMpsInput * 3.6))
            : null;
    const headingInput = body.heading === undefined || body.heading === null || body.heading === "" ? null : Number(body.heading);
    const heading = Number.isFinite(headingInput) ? Math.max(0, Math.min(360, headingInput)) : null;
    const phoneTimestamp = Date.parse(body.timestamp ?? "");
    const now = Date.now();
    return {
        location: {
            coordinates: [roundCoordinate(latitude), roundCoordinate(longitude)],
            accuracy: accuracy === null ? undefined : roundMetric(accuracy),
            speedKmh: speedKmh === null ? undefined : roundMetric(speedKmh),
            speedSource: speedKmh === null ? undefined : "device",
            heading: heading === null ? undefined : roundMetric(heading, 0),
            reportedAt: Number.isFinite(phoneTimestamp) && phoneTimestamp <= now + 60 * 1000
                ? new Date(phoneTimestamp).toISOString()
                : new Date(now).toISOString(),
        },
    };
}

function validateDriverTripUpdate(data, user, tripId) {
    const tripState = routeTripStateForTripId(data, tripId);
    const trip = tripState?.activeStaffTrip;
    if (!trip || trip.id !== tripId)
        return "Trip not found.";
    if (tripState.tripStatus !== "active")
        return "Start the trip before sharing phone GPS.";
    if (user.role === "driver") {
        const assignedRoute = assignedRouteForStaff(data, user);
        if (assignedRoute && assignedRoute.code !== trip.routeCode)
            return "This trip is not assigned to your account.";
        if (!assignedRoute && user.routeCode && user.routeCode !== trip.routeCode)
            return "This trip is not assigned to your account.";
    }
    return "";
}

function validateConductorTripUpdate(data, user, tripId) {
    const tripState = routeTripStateForTripId(data, tripId);
    const trip = tripState?.activeStaffTrip;
    if (!trip || trip.id !== tripId)
        return "Trip not found.";
    const assignedRoute = assignedRouteForStaff(data, user);
    if (assignedRoute && assignedRoute.code !== trip.routeCode)
        return "This trip is not assigned to your account.";
    if (!assignedRoute && user.routeCode && user.routeCode !== trip.routeCode)
        return "This trip is not assigned to your account.";
    return "";
}

function storeDriverLocation(data, user, tripId, locationInput) {
    const tripState = routeTripStateForTripId(data, tripId);
    const trip = tripState.activeStaffTrip;
    const updatedAt = new Date().toISOString();
    const liveLocations = ensureLiveLocations(data);
    const previousLocation = liveLocations[tripId];
    const location = {
        tripId,
        routeCode: trip.routeCode,
        busNumber: trip.busNumber,
        driverId: user.id,
        driverName: user.name,
        source: "driver-phone",
        updatedAt,
        ...locationInput,
    };
    const calculatedSpeedKmh = gpsSpeedFromPreviousLocation(previousLocation, location);
    if (!Number.isFinite(location.speedKmh) && Number.isFinite(calculatedSpeedKmh)) {
        location.speedKmh = roundMetric(calculatedSpeedKmh);
        location.speedSource = "calculated";
    }
    liveLocations[tripId] = location;
    const route = routeForTrip(data, trip);
    const etaContext = buildLiveEtaContext(data, route, trip, location);
    tripState.gpsUpdatedAt = updatedAt;
    if (route?.stops?.length && etaContext.nextStopId) {
        tripState.operationalCurrentStopId = etaContext.nextStopId;
        tripState.operationalStops = withStopProgress(route, etaContext.nextStopId);
    }
    tripState.activeStaffTrip = {
        ...trip,
        nextStopId: etaContext.nextStopId || trip.nextStopId,
        nextStopName: etaContext.nextStopName || trip.nextStopName,
        nextStopEta: etaContext.nextStopEta,
        remainingDistance: etaContext.remainingDistance,
        etaSource: etaContext.etaSource,
        etaSpeedKmh: etaContext.etaSpeedKmh,
        lastReachedStopId: etaContext.lastReachedStopId ?? trip.lastReachedStopId ?? "",
        distanceToNextStop: etaContext.distanceToNextStopKm === null
            ? etaContext.remainingDistance
            : distanceLabel(etaContext.distanceToNextStopKm),
        currentCoordinates: location.coordinates,
        currentSpeed: location.speedKmh,
        gpsUpdatedAt: updatedAt,
    };
    saveRouteTripState(data, trip.routeCode, tripState);
    const fleetBus = ensureFleetBusForRoute(data, route);
    if (fleetBus) {
        fleetBus.coordinates = location.coordinates;
        fleetBus.speed = Number.isFinite(location.speedKmh) ? Math.round(location.speedKmh) : fleetBus.speed;
        fleetBus.gpsUpdated = updatedAt;
        fleetBus.tripActive = true;
        fleetBus.eta = etaContext.nextStopEta;
        fleetBus.nextStopId = etaContext.nextStopId;
        fleetBus.nextStopName = etaContext.nextStopName;
        fleetBus.nextStopEta = etaContext.nextStopEta;
        fleetBus.remainingDistance = etaContext.remainingDistance;
        fleetBus.etaSource = etaContext.etaSource;
        fleetBus.distanceToNextStop = etaContext.distanceToNextStopKm === null
            ? etaContext.remainingDistance
            : distanceLabel(etaContext.distanceToNextStopKm);
        if (fleetBus.status === "stopped" || fleetBus.status === "stale-gps")
            fleetBus.status = "on-trip";
    }
    return {
        ok: true,
        location,
        gpsUpdatedAt: locationAgeLabel(updatedAt),
        activeStaffTrip: tripState.activeStaffTrip,
    };
}

function tripIdForRoute(routeCode, direction) {
    return normalizeTripDirection(direction) === "return"
        ? `TRIP-2026-0821-${routeCode}-PM`
        : `TRIP-2026-0821-${routeCode}`;
}

function directionFromTripId(tripId, fallbackDirection = "morning") {
    return String(tripId ?? "").endsWith("-PM") ? "return" : normalizeTripDirection(fallbackDirection);
}

function staffRecordForUser(data, user) {
    const kind = user.role === "driver" ? "drivers" : user.role === "conductor" ? "conductors" : "";
    if (!kind)
        return null;
    const email = cleanEmail(user.email);
    const records = data.admin?.records?.[kind] ?? [];
    const linkedRecord = records.find((record) => record.accountUserId === user.id || cleanEmail(record.accountEmail) === email);
    if (linkedRecord)
        return linkedRecord;
    const staffName = normalizedStaffName(user.name);
    if (!staffName)
        return null;
    return records.find((record) => normalizedStaffName(record.name) === staffName) ?? null;
}

function assignedRouteForStaff(data, user) {
    if (!user || (user.role !== "driver" && user.role !== "conductor"))
        return null;
    const record = staffRecordForUser(data, user);
    const managedRoute = routeByStaffRecord(data, user.role === "driver" ? "drivers" : "conductors", record?.id);
    if (managedRoute)
        return managedRoute;
    const assignedRouteCode = routeCodeFromAssignment(record?.assignment);
    if (assignedRouteCode)
        return routeFromData(data, assignedRouteCode);
    const staticRoute = user.role === "driver"
        ? routeForDriverRecord(record?.id)
        : routeForConductorRecord(record?.id);
    if (staticRoute)
        return routeFromData(data, staticRoute.code);
    return routeForUser(data, user);
}

function buildStaffTripForRoute(data, route, direction = "morning", overrides = {}) {
    const normalizedDirection = normalizeTripDirection(direction);
    const directedRoute = routeForTripDirection(route, normalizedDirection);
    const currentTrip = routeTripStateForRoute(data, route.code)?.activeStaffTrip ?? {};
    const fleetBus = fleetBusForRoute(data, route);
    const capacity = fleetBus?.capacity ?? currentTrip.capacity ?? 50;
    const busNumber = busNumberForRoute(data, route) || currentTrip.busNumber;
    const nextStop = overrides.nextStopId
        ? directedRoute.stops.find((stop) => stop.id === overrides.nextStopId) ?? directedRoute.stops[0]
        : directedRoute.stops[0];
    return activeTripWithConsistentAssignments(data, {
        ...currentTrip,
        ...overrides,
        id: overrides.id ?? tripIdForRoute(route.code, normalizedDirection),
        direction: normalizedDirection,
        directionLabel: tripDirectionLabel(normalizedDirection),
        routeCode: route.code,
        routeName: directedRoute.name,
        busNumber,
        registration: busRegistrationForRoute(data, route),
        capacity,
        scheduledStart: directedRoute.stops[0]?.scheduledTime,
        scheduledEnd: directedRoute.stops.at(-1)?.scheduledTime,
        distance: route.distance,
        nextStopId: nextStop.id,
        nextStopName: nextStop.name,
        nextStopEta: overrides.nextStopEta ?? (normalizedDirection === "return" ? "Ready to depart" : "--"),
        remainingDistance: overrides.remainingDistance ?? (normalizedDirection === "return" ? "At campus" : "--"),
        lastReachedStopId: overrides.lastReachedStopId ?? "",
        currentCoordinates: undefined,
        currentSpeed: undefined,
        startedAt: undefined,
        completedAt: undefined,
    });
}

function operationsForAssignedStaff(data, user) {
    const assignedRoute = assignedRouteForStaff(data, user);
    if (!assignedRoute) {
        return {
            ...data.operations,
            activeStaffTrip: null,
            operationalStops: [],
            operationalCurrentStopId: "",
            tripStatus: "unassigned",
            gpsUpdatedAt: "No route assigned",
            liveLocation: null,
            seatUpdates: [],
        };
    }
    const routeState = routeTripStateForRoute(data, assignedRoute.code);
    if (routeState?.activeStaffTrip)
        return operationsWithLiveLocation(data, routeState);
    const direction = normalizeTripDirection(fleetBusForRoute(data, assignedRoute)?.direction ?? "morning");
    const trip = buildStaffTripForRoute(data, assignedRoute, direction);
    const directedRoute = routeForTripDirection(assignedRoute, direction);
    return {
        ...data.operations,
        activeStaffTrip: trip,
        operationalStops: withStopProgress(directedRoute, trip.nextStopId),
        operationalCurrentStopId: trip.nextStopId,
        tripStatus: "not-started",
        gpsUpdatedAt: "Not sharing",
        liveLocation: null,
        seatUpdates: (data.operations?.seatUpdates ?? []).filter((update) => update.tripId === trip.id),
    };
}

function operationsForStaffOrAdmin(data, user) {
    if (user.role === "driver" || user.role === "conductor")
        return operationsForAssignedStaff(data, user);
    return operationsWithLiveLocation(data);
}

function prepareAssignedStaffTrip(data, user, tripId) {
    if (user.role !== "driver" && user.role !== "conductor")
        return "";
    const assignedRoute = assignedRouteForStaff(data, user);
    if (!assignedRoute)
        return "No route is assigned to this staff account.";
    const routeState = routeTripStateForRoute(data, assignedRoute.code);
    const currentTrip = routeState?.activeStaffTrip;
    if (currentTrip?.routeCode === assignedRoute.code)
        return "";
    const direction = directionFromTripId(tripId, currentTrip?.direction);
    const trip = buildStaffTripForRoute(data, assignedRoute, direction);
    const directedRoute = routeForTripDirection(assignedRoute, direction);
    saveRouteTripState(data, assignedRoute.code, {
        activeStaffTrip: trip,
        operationalCurrentStopId: trip.nextStopId,
        operationalStops: withStopProgress(directedRoute, trip.nextStopId),
        tripStatus: "not-started",
        gpsUpdatedAt: "Not sharing",
        activeSeatTripId: trip.id,
    });
    return "";
}

function resetTripForDirection(data, requestedDirection, user = null) {
    const staffRoute = user ? assignedRouteForStaff(data, user) : null;
    const routeState = staffRoute ? routeTripStateForRoute(data, staffRoute.code) : data.operations;
    const currentTrip = routeState?.activeStaffTrip;
    if (routeState?.tripStatus === "active")
        return { error: "End the active trip before changing trip direction." };
    const baseRoute = staffRoute ?? routeFromData(data, currentTrip?.routeCode);
    if (!currentTrip && !baseRoute)
        return { error: "Trip not found." };
    if (!baseRoute?.stops?.length)
        return { error: "Trip route does not have stops configured." };
    const direction = normalizeTripDirection(requestedDirection);
    const route = routeForTripDirection(baseRoute, direction);
    const nextStop = route.stops[0];
    const fleetBus = ensureFleetBusForRoute(data, baseRoute);
    const capacity = fleetBus?.capacity ?? currentTrip?.capacity ?? 50;
    const initialOccupiedSeats = 0;
    if (fleetBus)
        fleetBus.occupancy = initialOccupiedSeats;
    const busNumber = busNumberForRoute(data, baseRoute) || currentTrip?.busNumber;
    const trip = activeTripWithConsistentAssignments(data, {
        ...(currentTrip ?? {}),
        id: direction === "return" ? `TRIP-2026-0821-${baseRoute.code}-PM` : `TRIP-2026-0821-${baseRoute.code}`,
        direction,
        directionLabel: tripDirectionLabel(direction),
        routeCode: baseRoute.code,
        routeName: route.name,
        busNumber,
        registration: busRegistrationForRoute(data, baseRoute),
        capacity,
        scheduledStart: route.stops[0]?.scheduledTime,
        scheduledEnd: route.stops.at(-1)?.scheduledTime,
        nextStopId: nextStop.id,
        nextStopName: nextStop.name,
        nextStopEta: direction === "return" ? "Ready to depart" : currentTrip?.nextStopEta ?? "--",
        remainingDistance: direction === "return" ? "At campus" : currentTrip?.remainingDistance ?? "--",
        lastReachedStopId: "",
        currentCoordinates: undefined,
        currentSpeed: undefined,
        startedAt: undefined,
        completedAt: undefined,
    });
    const nextState = {
        activeStaffTrip: trip,
        operationalCurrentStopId: nextStop.id,
        operationalStops: withStopProgress(route, nextStop.id),
        tripStatus: "not-started",
        gpsUpdatedAt: "Not sharing",
        activeSeatTripId: trip.id,
    };
    const liveLocations = ensureLiveLocations(data);
    if (currentTrip?.id)
        delete liveLocations[currentTrip.id];
    delete liveLocations[trip.id];
    saveRouteTripState(data, baseRoute.code, nextState);
    if (fleetBus) {
        fleetBus.tripActive = false;
        fleetBus.status = "stopped";
        fleetBus.occupancy = initialOccupiedSeats;
        fleetBus.gpsUpdated = "Not sharing";
        fleetBus.seatsUpdatedAt = "Awaiting conductor update";
        fleetBus.nextStopId = nextStop.id;
        fleetBus.nextStopName = nextStop.name;
        fleetBus.nextStopEta = trip.nextStopEta;
        fleetBus.eta = trip.nextStopEta;
        fleetBus.remainingDistance = trip.remainingDistance;
        fleetBus.direction = direction;
    }
    return operationsWithLiveLocation(data, nextState);
}

function currentSeatCount(data, trip) {
    const route = routeForTrip(data, trip);
    const fleetBus = fleetBusForRoute(data, route);
    const updates = data.operations?.seatUpdates ?? [];
    const latestTripUpdate = updates.find((update) => update.tripId === trip.id);
    const canUseLegacyUpdate = !trip.startedAt &&
        data.operations?.activeStaffTrip?.id === trip.id &&
        data.operations?.activeStaffTrip?.routeCode === trip.routeCode;
    const legacyUpdate = canUseLegacyUpdate
        ? updates.find((update) => !update.tripId && normalizeTripDirection(trip.direction) === "morning")
        : null;
    const value = Number(latestTripUpdate?.occupiedSeats ?? legacyUpdate?.occupiedSeats ?? fleetBus?.occupancy ?? 0);
    const occupiedSeats = Number.isFinite(value) ? value : 0;
    const capacity = Number(trip.capacity ?? fleetBus?.capacity);
    if (!Number.isFinite(capacity) || capacity <= 0)
        return Math.max(0, occupiedSeats);
    return Math.min(capacity, Math.max(0, occupiedSeats));
}

function resetTripSeatState(data, tripState) {
    const trip = tripState?.activeStaffTrip;
    if (!trip)
        return;
    const capacity = Number(trip.capacity);
    const safeCapacity = Number.isFinite(capacity) && capacity > 0 ? capacity : 0;
    tripState.activeStaffTrip = {
        ...trip,
        occupiedSeats: 0,
        availableSeats: safeCapacity,
    };
    if (Array.isArray(data.operations?.seatUpdates)) {
        data.operations.seatUpdates = data.operations.seatUpdates.filter((update) => update.tripId !== trip.id);
    }
    const fleetBus = ensureFleetBusForRoute(data, routeForTrip(data, tripState.activeStaffTrip));
    if (fleetBus) {
        fleetBus.occupancy = 0;
        fleetBus.seatsUpdatedAt = "Awaiting conductor update";
    }
}

function updateTripProgressFromSeatUpdate(data, tripId, body) {
    const tripState = routeTripStateForTripId(data, tripId);
    const trip = tripState?.activeStaffTrip;
    if (!trip || trip.id !== tripId) {
        return { error: "Trip not found." };
    }
    const route = routeForTrip(data, trip);
    if (!route?.stops?.length) {
        return { error: "Trip route does not have stops configured." };
    }
    const boarded = Number(body.boarded);
    const deboarded = Number(body.deboarded);
    if (!Number.isInteger(boarded) || boarded < 0 || !Number.isInteger(deboarded) || deboarded < 0) {
        return { error: "Boarded and deboarded counts must be zero or positive whole numbers." };
    }
    const capacity = Number(trip.capacity);
    const previousOccupiedSeats = currentSeatCount(data, trip);
    const occupiedSeats = previousOccupiedSeats + boarded - deboarded;
    if (occupiedSeats < 0 || occupiedSeats > capacity) {
        return { error: `Seat count must stay between 0 and ${capacity}.` };
    }
    const stop = route.stops.find((item) => item.id === body.stopId) ??
        route.stops.find((item) => item.id === tripState?.operationalCurrentStopId) ??
        route.stops[0];
    const update = {
        ...body,
        id: body.id ?? `SEAT-${Date.now().toString().slice(-5)}`,
        tripId: trip.id,
        direction: normalizeTripDirection(trip.direction),
        stopId: stop.id,
        stopName: stop.name,
        boarded,
        deboarded,
        occupiedSeats,
        availableSeats: capacity - occupiedSeats,
        timestamp: body.timestamp ?? new Intl.DateTimeFormat("en-IN", {
            hour: "numeric",
            minute: "2-digit",
        }).format(new Date()),
    };
    data.operations.seatUpdates.unshift(update);
    const etaContext = buildLiveEtaContext(data, route, trip);
    const nextStop = route.stops.find((item) => item.id === etaContext.nextStopId) ??
        route.stops.find((item) => item.id === trip.nextStopId) ??
        stop;
    tripState.operationalCurrentStopId = nextStop.id;
    tripState.operationalStops = withStopProgress(route, nextStop.id);
    tripState.activeStaffTrip = {
        ...trip,
        nextStopId: nextStop.id,
        nextStopName: nextStop.name,
        nextStopEta: etaContext.nextStopEta,
        remainingDistance: etaContext.remainingDistance,
        etaSource: etaContext.etaSource,
        etaSpeedKmh: etaContext.etaSpeedKmh,
        distanceToNextStop: etaContext.distanceToNextStopKm === null
            ? etaContext.remainingDistance
            : distanceLabel(etaContext.distanceToNextStopKm),
    };
    saveRouteTripState(data, trip.routeCode, tripState);
    const fleetBus = ensureFleetBusForRoute(data, route);
    if (fleetBus) {
        fleetBus.occupancy = occupiedSeats;
        fleetBus.seatsUpdatedAt = update.timestamp;
        fleetBus.nextStopId = nextStop.id;
        fleetBus.nextStopName = nextStop.name;
        fleetBus.nextStopEta = etaContext.nextStopEta;
        fleetBus.eta = etaContext.nextStopEta;
        fleetBus.remainingDistance = etaContext.remainingDistance;
        fleetBus.etaSource = etaContext.etaSource;
        fleetBus.distanceToNextStop = etaContext.distanceToNextStopKm === null
            ? etaContext.remainingDistance
            : distanceLabel(etaContext.distanceToNextStopKm);
    }
    return {
        ...update,
        update,
        activeStaffTrip: tripState.activeStaffTrip,
        operationalStops: tripState.operationalStops,
        operationalCurrentStopId: tripState.operationalCurrentStopId,
    };
}

function buildUnassignedTransitData(data, approvalStatus = "pending") {
    return {
        ...data.studentTransitData,
        assignmentStatus: "unassigned",
        approvalStatus,
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
            gpsStatus: "unassigned",
            tripActive: false,
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
    const assignedRoute = routeForUser(data, user);
    if (!assignedRoute) {
        return buildUnassignedTransitData(data, user.status === "active" ? "approved" : user.status);
    }
    const preferredStopId = user.stopId ?? data.studentTransitData.route.selectedStopId;
    const selectedStopId = assignedRoute.stops.some((stop) => stop.id === preferredStopId)
        ? preferredStopId
        : assignedRoute.stops[Math.max(0, assignedRoute.stops.length - 2)]?.id ?? assignedRoute.stops[0]?.id;
    const routeState = routeTripStateForRoute(data, assignedRoute.code);
    const activeTrip = activeTripWithConsistentAssignments(data, routeState?.activeStaffTrip);
    const hasRouteTrip = activeTrip?.routeCode === assignedRoute.code && routeState?.tripStatus !== "completed";
    const tripActive = routeState?.tripStatus === "active" && hasRouteTrip;
    const route = hasRouteTrip
        ? routeForTrip(data, activeTrip) ?? assignedRoute
        : assignedRoute;
    const tripNextStopId = tripActive ? activeTrip.nextStopId : "";
    const progressStopId = tripActive && route.stops.some((stop) => stop.id === tripNextStopId)
        ? tripNextStopId
        : selectedStopId;
    const progressIndex = Math.max(0, route.stops.findIndex((stop) => stop.id === progressStopId));
    const etaContext = tripActive
        ? buildLiveEtaContext(data, route, activeTrip)
        : null;
    const stops = withStopProgress(route, progressStopId).map((stop, index) => ({
        ...stop,
        ...(etaForStop(etaContext, stop.id) ??
            (stop.id === progressStopId && etaContext
                ? {
                    eta: etaContext.nextStopEta,
                    distanceFromBus: etaContext.remainingDistance,
                }
                : index > progressIndex && etaContext?.etaSource === "scheduled"
                    ? { eta: stop.name === route.destination ? "23 min" : "14 min" }
                    : {})),
    }));
    const fleetBus = fleetBusForRoute(data, assignedRoute);
    const assignedBusNumber = busNumberForRoute(data, assignedRoute);
    const bus = busWithLiveLocation(data, {
        ...data.studentTransitData.bus,
        id: fleetBus?.id ?? `bus-${assignedBusNumber}`,
        number: fleetBus?.number ?? assignedBusNumber,
        registration: busRegistrationForRoute(data, assignedRoute),
        capacity: fleetBus?.capacity ?? data.studentTransitData.bus.capacity,
        occupiedSeats: fleetBus?.occupancy ?? data.studentTransitData.bus.occupiedSeats,
        status: fleetBus?.status === "delayed" ? "delayed" : data.studentTransitData.bus.status,
        speed: fleetBus?.speed ?? data.studentTransitData.bus.speed,
        gpsUpdatedAt: fleetBus?.gpsUpdated ?? data.studentTransitData.bus.gpsUpdatedAt,
        gpsUpdated: fleetBus?.gpsUpdated ?? data.studentTransitData.bus.gpsUpdatedAt,
        tripActive,
        coordinates: fleetBus?.coordinates ?? data.studentTransitData.bus.coordinates,
    }, assignedRoute.code);
    return {
        ...data.studentTransitData,
        assignmentStatus: "assigned",
        approvalStatus: "approved",
        bus,
        route: {
            id: route.id,
            code: route.code,
            direction: route.direction ?? "morning",
            name: route.name,
            startPoint: route.startPoint,
            destination: route.destination,
            distance: route.distance,
            scheduledArrival: route.campusArrival ?? data.studentTransitData.route.scheduledArrival,
            selectedStopId,
            currentStopId: progressStopId,
            etaSource: etaContext?.etaSource ?? bus.etaSource,
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
                    if (isRejectedStudent(user))
                        return { error: "rejected" };
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
                if (payload.error === "rejected") {
                    send(response, 403, { message: "Your account has been rejected. Please contact transport admin." });
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
                if (isRejectedStudent(user)) {
                    send(response, 403, { message: "Your account has been rejected. Please contact transport admin." });
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
            if (isRejectedStudent(user)) {
                send(response, 403, { message: "Your account has been rejected. Please contact transport admin." });
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

            if (method === "GET" && pathname === "/api/student/live-location") {
                if (!requireRole(user, ["student", "admin"])) {
                    send(response, 403, { message: "Only students can view assigned live location." });
                    return;
                }
                const data = await store.get();
                if (isPendingStudent(user)) {
                    send(response, 200, { gpsStatus: "unassigned", location: null });
                    return;
                }
                const route = routeForUser(data, user);
                if (!route) {
                    send(response, 200, { gpsStatus: "unassigned", location: null });
                    return;
                }
                if (!tripIsSharingLocation(data, route.code)) {
                    send(response, 200, { gpsStatus: "not-sharing", location: null });
                    return;
                }
                const location = liveLocationForRoute(data, route.code);
                send(response, 200, {
                    gpsStatus: liveLocationStatus(location),
                    gpsUpdatedAt: location ? locationAgeLabel(location.updatedAt) : "Waiting for driver phone",
                    location,
                });
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
                if (!requireRole(user, ["student", "driver", "conductor", "admin"])) {
                    send(response, 403, { message: "Only signed-in SmartTransit users can view communications." });
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
                    const recipientCount = body.audience === "all"
                        ? studentRecipientCount(data)
                        : studentRecipientCount(data, body.routeCode);
                    const next = {
                        ...body,
                        id: `NTF-${new Date().getFullYear()}-${String(data.communications.campaigns.length + 183).padStart(4, "0")}`,
                        createdAt: currentShortDateTime(),
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
                            createdAt: currentShortDateTime(),
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
                    const label = currentShortDateTime();
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
                send(response, 200, adminDataWithLiveLocations(data));
                return;
            }

            if (method === "GET" && pathname === "/api/admin/live-locations") {
                if (!requireRole(user, ["admin"])) {
                    send(response, 403, { message: "Only admins can view live fleet locations." });
                    return;
                }
                const data = await store.get();
                const locations = Object.values(liveLocationMap(data)).map((location) => ({
                    ...location,
                    gpsStatus: liveLocationStatus(location),
                    gpsUpdatedAt: locationAgeLabel(location.updatedAt),
                }));
                send(response, 200, { locations });
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
                send(response, 200, operationsForStaffOrAdmin(data, user));
                return;
            }

            if (method === "POST" && pathname === "/api/driver/trips/current/direction") {
                if (!requireRole(user, ["driver", "admin"])) {
                    send(response, 403, { message: "Only drivers can choose trip direction." });
                    return;
                }
                const body = await readBody(request);
                const updated = await store.update((data) => resetTripForDirection(data, body.direction, user));
                if (updated.error) {
                    badRequest(response, updated.error);
                    return;
                }
                send(response, 200, updated);
                return;
            }

            const startTripMatch = pathname.match(/^\/api\/driver\/trips\/([^/]+)\/start$/);
            if (method === "POST" && startTripMatch) {
                if (!requireRole(user, ["driver", "admin"])) {
                    send(response, 403, { message: "Only drivers can start trips." });
                    return;
                }
                const data = await store.update((db) => {
                    const assignmentError = prepareAssignedStaffTrip(db, user, startTripMatch[1]);
                    if (assignmentError)
                        return { error: assignmentError };
                    const tripState = routeTripStateForTripId(db, startTripMatch[1]);
                    if (!tripState?.activeStaffTrip || tripState.activeStaffTrip.id !== startTripMatch[1])
                        return { error: "Trip not found." };
                    const route = routeForTrip(db, tripState.activeStaffTrip);
                    const firstStop = route?.stops?.[0];
                    tripState.tripStatus = "active";
                    tripState.gpsUpdatedAt = "Waiting for driver phone";
                    if (firstStop) {
                        tripState.operationalCurrentStopId = firstStop.id;
                        tripState.operationalStops = withStopProgress(route, firstStop.id);
                    }
                    tripState.activeStaffTrip = {
                        ...tripState.activeStaffTrip,
                        ...(firstStop
                            ? {
                                nextStopId: firstStop.id,
                                nextStopName: firstStop.name,
                                nextStopEta: "Waiting for GPS",
                                remainingDistance: "Waiting for GPS",
                                etaSource: "waiting-for-gps",
                                distanceToNextStop: "Waiting for GPS",
                                lastReachedStopId: "",
                            }
                            : {}),
                        startedAt: new Date().toISOString(),
                        completedAt: undefined,
                    };
                    delete ensureLiveLocations(db)[tripState.activeStaffTrip.id];
                    resetTripSeatState(db, tripState);
                    saveRouteTripState(db, tripState.activeStaffTrip.routeCode, tripState);
                    const fleetBus = ensureFleetBusForRoute(db, routeForTrip(db, tripState.activeStaffTrip));
                    if (fleetBus) {
                        fleetBus.occupancy = 0;
                        fleetBus.seatsUpdatedAt = "Awaiting conductor update";
                        fleetBus.tripActive = true;
                        fleetBus.gpsUpdated = "Waiting for driver phone";
                        fleetBus.direction = normalizeTripDirection(tripState.activeStaffTrip.direction);
                        fleetBus.coordinates = firstStop?.coordinates ?? fleetBus.coordinates;
                        fleetBus.nextStopId = firstStop?.id ?? fleetBus.nextStopId;
                        fleetBus.nextStopName = firstStop?.name ?? fleetBus.nextStopName;
                        fleetBus.nextStopEta = "Waiting for GPS";
                        fleetBus.eta = "Waiting for GPS";
                        fleetBus.remainingDistance = "Waiting for GPS";
                        fleetBus.etaSource = "waiting-for-gps";
                        fleetBus.distanceToNextStop = "Waiting for GPS";
                        if (fleetBus.status === "stopped")
                            fleetBus.status = "stale-gps";
                    }
                    return operationsWithLiveLocation(db, tripState);
                });
                if (data.error) {
                    badRequest(response, data.error);
                    return;
                }
                send(response, 200, data);
                return;
            }

            const driverLocationMatch = pathname.match(/^\/api\/driver\/trips\/([^/]+)\/location$/);
            if (method === "POST" && driverLocationMatch) {
                if (!requireRole(user, ["driver", "admin"])) {
                    send(response, 403, { message: "Only drivers can share trip location." });
                    return;
                }
                const body = await readBody(request);
                const parsed = validateLocationPayload(body);
                if (parsed.error) {
                    badRequest(response, parsed.error);
                    return;
                }
                const saved = await store.update((data) => {
                    const error = validateDriverTripUpdate(data, user, driverLocationMatch[1]);
                    if (error)
                        return { error };
                    return storeDriverLocation(data, user, driverLocationMatch[1], parsed.location);
                });
                if (saved.error) {
                    badRequest(response, saved.error);
                    return;
                }
                send(response, 201, saved);
                return;
            }

            if (method === "POST" && pathname.match(/^\/api\/driver\/trips\/([^/]+)\/end$/)) {
                if (!requireRole(user, ["driver", "admin"])) {
                    send(response, 403, { message: "Only drivers can end trips." });
                    return;
                }
                const endTripId = pathname.match(/^\/api\/driver\/trips\/([^/]+)\/end$/)?.[1];
                const data = await store.update((db) => {
                    const error = user.role === "driver"
                        ? validateDriverTripUpdate(db, user, endTripId)
                        : routeTripStateForTripId(db, endTripId)?.activeStaffTrip?.id === endTripId ? "" : "Trip not found.";
                    if (error)
                        return { error };
                    const tripState = routeTripStateForTripId(db, endTripId);
                    tripState.tripStatus = "completed";
                    tripState.gpsUpdatedAt = "Sharing stopped";
                    tripState.activeStaffTrip = {
                        ...tripState.activeStaffTrip,
                        completedAt: new Date().toISOString(),
                    };
                    delete ensureLiveLocations(db)[endTripId];
                    saveRouteTripState(db, tripState.activeStaffTrip.routeCode, tripState);
                    const fleetBus = ensureFleetBusForRoute(db, routeForTrip(db, tripState.activeStaffTrip));
                    if (fleetBus) {
                        fleetBus.tripActive = false;
                        fleetBus.gpsUpdated = "Not sharing";
                        fleetBus.status = "stopped";
                    }
                    return operationsWithLiveLocation(db, tripState);
                });
                if (data.error) {
                    badRequest(response, data.error);
                    return;
                }
                send(response, 200, data);
                return;
            }

            if (method === "GET" && pathname === "/api/conductor/trips/current") {
                if (!requireRole(user, ["conductor", "admin"])) {
                    send(response, 403, { message: "Only conductors can view conductor trip controls." });
                    return;
                }
                const data = await store.get();
                send(response, 200, operationsForStaffOrAdmin(data, user));
                return;
            }

            const seatUpdateMatch = pathname.match(/^\/api\/conductor\/trips\/([^/]+)\/seat-updates$/);
            if (method === "POST" && seatUpdateMatch) {
                if (!requireRole(user, ["conductor", "admin"])) {
                    send(response, 403, { message: "Only conductors can submit seat updates." });
                    return;
                }
                const body = await readBody(request);
                const update = await store.update((data) => {
                    if (user.role === "conductor") {
                        const assignmentError = validateConductorTripUpdate(data, user, seatUpdateMatch[1]);
                        if (assignmentError)
                            return { error: assignmentError };
                    }
                    return updateTripProgressFromSeatUpdate(data, seatUpdateMatch[1], body);
                });
                if (update.error) {
                    badRequest(response, update.error);
                    return;
                }
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
            console.error("[smarttransit-api]", request.method, new URL(request.url, "http://localhost").pathname, error);
            send(response, 500, { message: error instanceof Error ? error.message : "Unexpected server error." });
        }
    });
}
