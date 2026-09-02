import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, } from "react";
import { apiRequest, backendConfig } from "../services/apiClient";
import { activeStaffTrip as fallbackActiveTrip, buildStaffTripForDirection, operationalCurrentStopId as fallbackCurrentStopId, operationalStops as fallbackStops, preTripItems } from "../services/operationsData";
import { defaultStaffRoute, routeForTripDirection, withStopProgress } from "../services/indusRoutes";
import { formatTime } from "../utils/dateLabels";
import { distanceMetersBetween } from "../utils/geoMath";
import { calculateSeatUpdate } from "../utils/seatCalculation";
const DriverContext = createContext(null);
const driverGpsSendIntervalMs = 10000;
const driverGpsForceRefreshMs = 30000;
const driverGpsMovementThresholdMeters = 20;
const driverGpsWeakAccuracyMeters = 80;
const driverGpsMaxAccuracyMeters = 250;
const staffTripRefreshIntervalMs = 15000;
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
        heading: Number.isFinite(position.coords.heading) ? position.coords.heading : undefined,
        updatedAt: new Date(position.timestamp).toISOString(),
    };
}
function headingChanged(left, right) {
    if (!Number.isFinite(left) || !Number.isFinite(right))
        return false;
    const delta = Math.abs(left - right);
    return Math.min(delta, 360 - delta) >= 20;
}
function speedChanged(left, right) {
    if (!Number.isFinite(left) || !Number.isFinite(right))
        return false;
    return Math.abs(left - right) >= 6;
}
function shouldSendGpsSnapshot(snapshot, lastSent) {
    if (!lastSent)
        return true;
    const elapsed = Date.now() - lastSent.sentAt;
    if (elapsed < driverGpsSendIntervalMs)
        return false;
    if (elapsed >= driverGpsForceRefreshMs)
        return true;
    const movedMeters = distanceMetersBetween(lastSent.coordinates, snapshot.coordinates);
    return (Number.isFinite(movedMeters) && movedMeters >= driverGpsMovementThresholdMeters) ||
        speedChanged(lastSent.speedKmh, snapshot.speedKmh) ||
        headingChanged(lastSent.heading, snapshot.heading);
}
function gpsAccuracyWarning(accuracy) {
    if (!Number.isFinite(accuracy))
        return "";
    if (accuracy > driverGpsMaxAccuracyMeters)
        return "GPS accuracy is very weak. Keeping the last reliable server location until the phone gets a better signal.";
    if (accuracy > driverGpsWeakAccuracyMeters)
        return "GPS accuracy is weak, so the map marker may move slightly.";
    return "";
}
export function DriverOperationsProvider({ children, }) {
    const [activeTrip, setActiveTrip] = useState(fallbackActiveTrip);
    const [stops, setStops] = useState(fallbackStops);
    const [tripStatus, setTripStatus] = useState("not-started");
    const [checklist, setChecklist] = useState([]);
    const [gpsUpdatedAt, setGpsUpdatedAt] = useState("Not sharing");
    const [gpsSharingStatus, setGpsSharingStatus] = useState("idle");
    const [gpsError, setGpsError] = useState("");
    const [tripLoadError, setTripLoadError] = useState("");
    const [lastGpsLocation, setLastGpsLocation] = useState(null);
    const [emergency, setEmergency] = useState(null);
    const lastGpsSent = useRef(null);
    const gpsSyncInFlight = useRef(false);
    const applyDriverTripData = useCallback((data, { preserveChecklist = false } = {}) => {
        setActiveTrip(data.activeStaffTrip ?? fallbackActiveTrip);
        setStops(data.operationalStops ?? fallbackStops);
        setTripStatus(data.tripStatus ?? "not-started");
        if (data.tripStatus === "active")
            setChecklist(preTripItems.map((item) => item.id));
        else if (!preserveChecklist || data.tripStatus === "completed")
            setChecklist([]);
        setGpsUpdatedAt(data.gpsUpdatedAt ?? "Not sharing");
        setLastGpsLocation(data.liveLocation ?? null);
        setEmergency(data.emergencies?.[0] ?? null);
        setTripLoadError("");
    }, []);
    const refreshDriverTrip = useCallback(async ({ silent = false } = {}) => {
        if (!backendConfig.enabled)
            return null;
        try {
            const data = await apiRequest("/driver/trips/current");
            applyDriverTripData(data, { preserveChecklist: silent });
            return data;
        }
        catch (reason) {
            if (!silent)
                setTripLoadError(reason instanceof Error ? reason.message : "Unable to load your assigned trip.");
            return null;
        }
    }, [applyDriverTripData]);
    useEffect(() => {
        if (!backendConfig.enabled)
            return undefined;
        let cancelled = false;
        const load = async (silent = false) => {
            const data = await apiRequest("/driver/trips/current").catch((reason) => {
                if (!silent && !cancelled)
                    setTripLoadError(reason instanceof Error ? reason.message : "Unable to load your assigned trip.");
                return null;
            });
            if (cancelled || !data)
                return;
            applyDriverTripData(data, { preserveChecklist: silent });
        };
        void load(false);
        const timer = window.setInterval(() => void load(true), staffTripRefreshIntervalMs);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [applyDriverTripData]);
    useEffect(() => {
        if (tripStatus !== "active") {
            setGpsSharingStatus("idle");
            setGpsError("");
            setLastGpsLocation(null);
            lastGpsSent.current = null;
            gpsSyncInFlight.current = false;
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
        lastGpsSent.current = null;
        const watchId = navigator.geolocation.watchPosition((position) => {
            if (cancelled)
                return;
            const snapshot = locationSnapshot(position);
            const warning = gpsAccuracyWarning(snapshot.accuracy);
            setLastGpsLocation(snapshot);
            if (warning)
                setGpsError(warning);
            else
                setGpsError("");
            const hasReliablePreviousLocation = Boolean(lastGpsSent.current);
            if (warning && Number(snapshot.accuracy) > driverGpsMaxAccuracyMeters && hasReliablePreviousLocation) {
                setGpsSharingStatus("sharing");
                return;
            }
            if (!shouldSendGpsSnapshot(snapshot, lastGpsSent.current) || gpsSyncInFlight.current)
                return;
            gpsSyncInFlight.current = true;
            lastGpsSent.current = { ...snapshot, sentAt: Date.now() };
            apiRequest(`/driver/trips/${activeTrip.id}/location`, {
                method: "POST",
                body: locationPayload(position),
            })
                .then((payload) => {
                if (cancelled)
                    return;
                setGpsSharingStatus("sharing");
                setGpsError(warning);
                setGpsUpdatedAt(payload.gpsUpdatedAt ?? formatTime());
                if (payload.activeStaffTrip)
                    setActiveTrip(payload.activeStaffTrip);
                if (payload.operationalStops)
                    setStops(payload.operationalStops);
                if (payload.tripStatus)
                    setTripStatus(payload.tripStatus);
            })
                .catch(() => {
                if (cancelled)
                    return;
                setGpsSharingStatus("error");
                setGpsError("Phone GPS was detected, but SmartTransit could not sync it to the server.");
            })
                .finally(() => {
                gpsSyncInFlight.current = false;
            });
        }, (error) => {
            if (cancelled)
                return;
            setGpsSharingStatus("error");
            setGpsError(geolocationErrorMessage(error));
        }, {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 12000,
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
        tripLoadError,
        gpsUpdatedAt,
        gpsSharingStatus,
        gpsError,
        lastGpsLocation,
        emergency,
        refreshTrip: refreshDriverTrip,
        toggleCheck: (id) => setChecklist((items) => items.includes(id)
            ? items.filter((item) => item !== id)
            : [...items, id]),
        startTrip: async () => {
            if (backendConfig.enabled) {
                const data = await apiRequest(`/driver/trips/${activeTrip.id}/start`, { method: "POST" });
                setActiveTrip(data.activeStaffTrip ?? activeTrip);
                setStops(data.operationalStops ?? stops);
                setTripStatus(data.tripStatus ?? "active");
                setChecklist(preTripItems.map((item) => item.id));
                setGpsUpdatedAt(data.gpsUpdatedAt ?? "Waiting for driver phone");
                lastGpsSent.current = null;
                gpsSyncInFlight.current = false;
                setTripLoadError("");
                return;
            }
            setTripStatus("active");
            setChecklist(preTripItems.map((item) => item.id));
            setGpsUpdatedAt(formatTime());
            lastGpsSent.current = null;
            gpsSyncInFlight.current = false;
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
                lastGpsSent.current = null;
                gpsSyncInFlight.current = false;
                setChecklist([]);
                setTripLoadError("");
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
            lastGpsSent.current = null;
            gpsSyncInFlight.current = false;
            return nextTrip;
        },
        endTrip: async () => {
            if (backendConfig.enabled) {
                const data = await apiRequest(`/driver/trips/${activeTrip.id}/end`, { method: "POST" });
                if (data.activeStaffTrip)
                    setActiveTrip(data.activeStaffTrip);
                if (data.operationalStops)
                    setStops(data.operationalStops);
                setTripStatus(data.tripStatus ?? "completed");
                setGpsUpdatedAt(data.gpsUpdatedAt ?? "Sharing stopped");
            }
            else {
                setTripStatus("completed");
                setGpsUpdatedAt("Sharing stopped");
            }
            setGpsSharingStatus("idle");
            setLastGpsLocation(null);
            lastGpsSent.current = null;
            gpsSyncInFlight.current = false;
            setChecklist([]);
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
    }), [activeTrip, stops, tripStatus, checklist, tripLoadError, gpsUpdatedAt, gpsSharingStatus, gpsError, lastGpsLocation, emergency, refreshDriverTrip]);
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
    const [tripStatus, setTripStatus] = useState(backendConfig.enabled ? "not-started" : "active");
    const [currentStopId, setCurrentStopId] = useState(fallbackCurrentStopId);
    const [occupiedSeats, setOccupiedSeats] = useState(0);
    const [updates, setUpdates] = useState([]);
    const [emergency, setEmergency] = useState(null);
    const applyConductorTripData = useCallback((data) => {
        const trip = data.activeStaffTrip ?? fallbackActiveTrip;
        const seatUpdates = (data.seatUpdates ?? []).filter((update) => update.tripId ? update.tripId === trip.id : trip.direction !== "return");
        const tripOccupiedSeats = Number(trip.occupiedSeats);
        const initialOccupiedSeats = Number.isFinite(tripOccupiedSeats) ? tripOccupiedSeats : 0;
        setActiveTrip(trip);
        setStops(data.operationalStops ?? fallbackStops);
        setTripStatus(data.tripStatus ?? "not-started");
        setCurrentStopId(data.operationalCurrentStopId ?? fallbackCurrentStopId);
        if (seatUpdates.length) {
            setUpdates(seatUpdates);
            setOccupiedSeats(seatUpdates[0].occupiedSeats ?? initialOccupiedSeats);
        }
        else {
            setUpdates([]);
            setOccupiedSeats(initialOccupiedSeats);
        }
        setEmergency(data.emergencies?.[0] ?? null);
    }, []);
    const refreshConductorTrip = useCallback(async () => {
        if (!backendConfig.enabled)
            return null;
        const data = await apiRequest("/conductor/trips/current");
        applyConductorTripData(data);
        return data;
    }, [applyConductorTripData]);
    useEffect(() => {
        if (!backendConfig.enabled)
            return undefined;
        let cancelled = false;
        const load = () => apiRequest("/conductor/trips/current")
            .then((data) => {
            if (cancelled)
                return;
            applyConductorTripData(data);
        })
            .catch(() => undefined);
        void load();
        const timer = window.setInterval(() => void load(), staffTripRefreshIntervalMs);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [applyConductorTripData]);
    const value = useMemo(() => ({
        tripStatus,
        activeTrip,
        stops,
        currentStopId,
        occupiedSeats,
        updates,
        emergency,
        refreshTrip: refreshConductorTrip,
        startTrip: () => setTripStatus("active"),
            setCurrentStop: setCurrentStopId,
        submitSeatUpdate: async (boarded, deboarded) => {
            if (tripStatus !== "active")
                throw new Error("Passenger counts can be submitted only after the driver starts the trip.");
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
    }), [activeTrip, stops, tripStatus, currentStopId, occupiedSeats, updates, emergency, refreshConductorTrip]);
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
