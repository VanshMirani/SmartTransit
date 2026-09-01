import { createContext, useContext, useEffect, useMemo, useRef, useState, } from "react";
import { apiRequest, backendConfig } from "../services/apiClient";
import { activeStaffTrip as fallbackActiveTrip, buildStaffTripForDirection, operationalCurrentStopId as fallbackCurrentStopId, operationalStops as fallbackStops, preTripItems } from "../services/operationsData";
import { defaultStaffRoute, routeForTripDirection, withStopProgress } from "../services/indusRoutes";
import { formatTime, minutesAgo } from "../utils/dateLabels";
import { calculateSeatUpdate } from "../utils/seatCalculation";
const DriverContext = createContext(null);
const driverGpsSendIntervalMs = 10000;
function syncBackend(path, options) {
    if (!backendConfig.enabled)
        return;
    void apiRequest(path, options).catch(() => undefined);
}
function geolocationErrorMessage(error) {
    if (error?.code === 1)
        return "Location permission is blocked. Allow location access for SmartTransit to share live GPS.";
    if (error?.code === 2)
        return "Your phone could not detect a reliable location yet.";
    if (error?.code === 3)
        return "Location request timed out. Keep GPS and mobile data enabled.";
    return "Unable to read phone GPS right now.";
}
function locationPayload(position) {
    return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speedMetersPerSecond: position.coords.speed,
        heading: position.coords.heading,
        timestamp: new Date(position.timestamp).toISOString(),
    };
}
function locationSnapshot(position) {
    return {
        coordinates: [position.coords.latitude, position.coords.longitude],
        accuracy: position.coords.accuracy,
        speedKmh: Number.isFinite(position.coords.speed) ? position.coords.speed * 3.6 : undefined,
        updatedAt: new Date().toISOString(),
    };
}
export function DriverOperationsProvider({ children, }) {
    const [activeTrip, setActiveTrip] = useState(fallbackActiveTrip);
    const [stops, setStops] = useState(fallbackStops);
    const [tripStatus, setTripStatus] = useState("not-started");
    const [checklist, setChecklist] = useState([]);
    const [gpsUpdatedAt, setGpsUpdatedAt] = useState("Not sharing");
    const [gpsSharingStatus, setGpsSharingStatus] = useState("idle");
    const [gpsError, setGpsError] = useState("");
    const [lastGpsLocation, setLastGpsLocation] = useState(null);
    const [emergency, setEmergency] = useState(null);
    const lastGpsSentAt = useRef(0);
    useEffect(() => {
        if (!backendConfig.enabled)
            return;
        let cancelled = false;
        apiRequest("/driver/trips/current")
            .then((data) => {
            if (cancelled)
                return;
            setActiveTrip(data.activeStaffTrip ?? fallbackActiveTrip);
            setStops(data.operationalStops ?? fallbackStops);
            setTripStatus(data.tripStatus ?? "not-started");
            setChecklist(data.tripStatus === "active" ? preTripItems.map((item) => item.id) : []);
            setGpsUpdatedAt(data.gpsUpdatedAt ?? "Not sharing");
            setLastGpsLocation(data.liveLocation ?? null);
            setEmergency(data.emergencies?.[0] ?? null);
        })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);
    useEffect(() => {
        if (tripStatus !== "active") {
            setGpsSharingStatus("idle");
            setGpsError("");
            setLastGpsLocation(null);
            return undefined;
        }
        if (!backendConfig.enabled) {
            setGpsSharingStatus("demo");
            return undefined;
        }
        if (!("geolocation" in navigator)) {
            setGpsSharingStatus("unsupported");
            setGpsError("This device or browser does not support GPS sharing.");
            return undefined;
        }
        let cancelled = false;
        setGpsSharingStatus("requesting");
        setGpsError("");
        const watchId = navigator.geolocation.watchPosition((position) => {
            if (cancelled)
                return;
            setLastGpsLocation(locationSnapshot(position));
            const now = Date.now();
            if (lastGpsSentAt.current && now - lastGpsSentAt.current < driverGpsSendIntervalMs)
                return;
            lastGpsSentAt.current = now;
            apiRequest(`/driver/trips/${activeTrip.id}/location`, {
                method: "POST",
                body: locationPayload(position),
            })
                .then((payload) => {
                if (cancelled)
                    return;
                setGpsSharingStatus("sharing");
                setGpsError("");
                setGpsUpdatedAt(payload.gpsUpdatedAt ?? formatTime());
                if (payload.activeStaffTrip)
                    setActiveTrip(payload.activeStaffTrip);
            })
                .catch(() => {
                if (cancelled)
                    return;
                setGpsSharingStatus("error");
                setGpsError("Phone GPS was detected, but SmartTransit could not sync it to the server.");
            });
        }, (error) => {
            if (cancelled)
                return;
            setGpsSharingStatus("error");
            setGpsError(geolocationErrorMessage(error));
        }, {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 15000,
        });
        return () => {
            cancelled = true;
            navigator.geolocation.clearWatch(watchId);
        };
    }, [activeTrip.id, tripStatus]);
    const value = useMemo(() => ({
        tripStatus,
        activeTrip,
        stops,
        checklist,
        gpsUpdatedAt,
        gpsSharingStatus,
        gpsError,
        lastGpsLocation,
        emergency,
        toggleCheck: (id) => setChecklist((items) => items.includes(id)
            ? items.filter((item) => item !== id)
            : [...items, id]),
        startTrip: async () => {
            if (backendConfig.enabled) {
                const data = await apiRequest(`/driver/trips/${activeTrip.id}/start`, { method: "POST" });
                setActiveTrip(data.activeStaffTrip ?? activeTrip);
                setTripStatus(data.tripStatus ?? "active");
                setChecklist(preTripItems.map((item) => item.id));
                setGpsUpdatedAt(data.gpsUpdatedAt ?? "Waiting for driver phone");
                return;
            }
            setTripStatus("active");
            setChecklist(preTripItems.map((item) => item.id));
            setGpsUpdatedAt(formatTime());
        },
        setTripDirection: async (direction) => {
            if (tripStatus === "active")
                throw new Error("End the active trip before changing trip direction.");
            if (backendConfig.enabled) {
                const data = await apiRequest("/driver/trips/current/direction", {
                    method: "POST",
                    body: { direction },
                });
                setActiveTrip(data.activeStaffTrip ?? activeTrip);
                setStops(data.operationalStops ?? stops);
                setTripStatus(data.tripStatus ?? "not-started");
                setGpsUpdatedAt(data.gpsUpdatedAt ?? "Not sharing");
                setLastGpsLocation(data.liveLocation ?? null);
                return data.activeStaffTrip;
            }
            const nextTrip = buildStaffTripForDirection(undefined, direction);
            const nextRoute = routeForTripDirection(defaultStaffRoute, direction);
            setActiveTrip(nextTrip);
            setStops(withStopProgress(nextRoute, nextTrip.nextStopId));
            setTripStatus("not-started");
            setChecklist([]);
            setGpsUpdatedAt("Not sharing");
            setLastGpsLocation(null);
            return nextTrip;
        },
        endTrip: async () => {
            if (backendConfig.enabled) {
                const data = await apiRequest(`/driver/trips/${activeTrip.id}/end`, { method: "POST" });
                setTripStatus(data.tripStatus ?? "completed");
                setGpsUpdatedAt(data.gpsUpdatedAt ?? "Sharing stopped");
            }
            else {
                setTripStatus("completed");
                setGpsUpdatedAt("Sharing stopped");
            }
            setGpsSharingStatus("idle");
            setLastGpsLocation(null);
        },
        submitEmergency: (type, note) => {
            const liveCoordinates = lastGpsLocation?.coordinates;
            const report = {
                id: `EMG-${Date.now().toString().slice(-6)}`,
                type,
                note,
                location: liveCoordinates ? "Driver phone GPS location" : `Near ${activeTrip.nextStopName}, Ahmedabad`,
                coordinates: liveCoordinates ?? stops.find((stop) => stop.id === activeTrip.nextStopId)?.coordinates,
                submittedAt: formatTime(),
            };
            setEmergency(report);
            syncBackend("/staff/emergencies", { method: "POST", body: report });
            return report;
        },
    }), [activeTrip, stops, tripStatus, checklist, gpsUpdatedAt, gpsSharingStatus, gpsError, lastGpsLocation, emergency]);
    return (<DriverContext.Provider value={value}>{children}</DriverContext.Provider>);
}
// eslint-disable-next-line react-refresh/only-export-components
export function useDriverOperations() {
    const value = useContext(DriverContext);
    if (!value)
        throw new Error("useDriverOperations must be used inside DriverOperationsProvider");
    return value;
}
const ConductorContext = createContext(null);
export function ConductorOperationsProvider({ children, }) {
    const [activeTrip, setActiveTrip] = useState(fallbackActiveTrip);
    const [stops, setStops] = useState(fallbackStops);
    const [tripStatus, setTripStatus] = useState("active");
    const [currentStopId, setCurrentStopId] = useState(fallbackCurrentStopId);
    const [occupiedSeats, setOccupiedSeats] = useState(30);
    const [updates, setUpdates] = useState([
        {
            id: "SEAT-001",
            stopId: fallbackStops[1].id,
            stopName: fallbackStops[1].name,
            boarded: 12,
            deboarded: 2,
            occupiedSeats: 30,
            availableSeats: 20,
            timestamp: formatTime(minutesAgo(8)),
        },
        {
            id: "SEAT-000",
            stopId: fallbackStops[0].id,
            stopName: fallbackStops[0].name,
            boarded: 20,
            deboarded: 0,
            occupiedSeats: 20,
            availableSeats: 30,
            timestamp: formatTime(minutesAgo(21)),
        },
    ]);
    const [emergency, setEmergency] = useState(null);
    useEffect(() => {
        if (!backendConfig.enabled)
            return;
        let cancelled = false;
        apiRequest("/conductor/trips/current")
            .then((data) => {
            if (cancelled)
                return;
            const trip = data.activeStaffTrip ?? fallbackActiveTrip;
            const seatUpdates = (data.seatUpdates ?? []).filter((update) => update.tripId ? update.tripId === trip.id : trip.direction !== "return");
            setActiveTrip(trip);
            setStops(data.operationalStops ?? fallbackStops);
            setTripStatus(data.tripStatus ?? "active");
            setCurrentStopId(data.operationalCurrentStopId ?? fallbackCurrentStopId);
            if (seatUpdates.length) {
                setUpdates(seatUpdates);
                setOccupiedSeats(seatUpdates[0].occupiedSeats ?? 30);
            }
            else if (trip.direction === "return") {
                setUpdates([]);
                setOccupiedSeats(0);
            }
            setEmergency(data.emergencies?.[0] ?? null);
        })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);
    const value = useMemo(() => ({
        tripStatus,
        activeTrip,
        stops,
        currentStopId,
        occupiedSeats,
        updates,
        emergency,
        startTrip: () => setTripStatus("active"),
            setCurrentStop: setCurrentStopId,
        submitSeatUpdate: async (boarded, deboarded) => {
            await new Promise((resolve) => window.setTimeout(resolve, 550));
            const calculation = calculateSeatUpdate(occupiedSeats, boarded, deboarded, activeTrip.capacity);
            const stop = stops.find((item) => item.id === currentStopId) ?? stops[0];
            const updatePayload = {
                id: `SEAT-${Date.now().toString().slice(-5)}`,
                stopId: stop.id,
                stopName: stop.name,
                boarded,
                deboarded,
                ...calculation,
                timestamp: formatTime(),
            };
            const update = backendConfig.enabled
                ? await apiRequest(`/conductor/trips/${activeTrip.id}/seat-updates`, { method: "POST", body: updatePayload })
                : updatePayload;
            const savedUpdate = update.update ?? update;
            setOccupiedSeats(savedUpdate.occupiedSeats ?? calculation.occupiedSeats);
            setUpdates((items) => [savedUpdate, ...items]);
            if (update.activeStaffTrip)
                setActiveTrip(update.activeStaffTrip);
            if (update.operationalStops)
                setStops(update.operationalStops);
            if (update.operationalCurrentStopId)
                setCurrentStopId(update.operationalCurrentStopId);
            return savedUpdate;
        },
        submitEmergency: (type, note) => {
            const report = {
                id: `EMG-${Date.now().toString().slice(-6)}`,
                type,
                note,
                location: `Near ${activeTrip.nextStopName}, Ahmedabad`,
                coordinates: stops.find((stop) => stop.id === activeTrip.nextStopId)?.coordinates,
                submittedAt: formatTime(),
            };
            setEmergency(report);
            syncBackend("/staff/emergencies", { method: "POST", body: report });
            return report;
        },
    }), [activeTrip, stops, tripStatus, currentStopId, occupiedSeats, updates, emergency]);
    return (<ConductorContext.Provider value={value}>
      {children}
    </ConductorContext.Provider>);
}
// eslint-disable-next-line react-refresh/only-export-components
export function useConductorOperations() {
    const value = useContext(ConductorContext);
    if (!value)
        throw new Error("useConductorOperations must be used inside ConductorOperationsProvider");
    return value;
}
