import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, } from "react";
import { apiRequest, backendConfig } from "../services/apiClient";
import { activeStaffTrip as fallbackActiveTrip, buildStaffTripForDirection, operationalCurrentStopId as fallbackCurrentStopId, operationalStops as fallbackStops, preTripItems } from "../services/operationsData";
import { defaultStaffRoute, routeForTripDirection, withStopProgress } from "../services/indusRoutes";
import { formatTime } from "../utils/dateLabels";
import { calculateSeatUpdate } from "../utils/seatCalculation";
import { createGpsSync } from './gpsSync.js';
import { useAuth } from '../auth/AuthContext';
const DriverContext = createContext(null);
const staffTripRefreshIntervalMs = 15000;
function geolocationErrorMessage(error) {
    if (error?.code === 1)
        return "Location permission is blocked. Allow location access for SmartTransit to share live GPS.";
    if (error?.code === 2)
        return "Your phone could not detect a reliable location yet.";
    if (error?.code === 3)
        return "Location request timed out. Keep GPS and mobile data enabled.";
    return "Unable to read phone GPS right now.";
}
export function DriverOperationsProvider({ children, }) {
    const { logout } = useAuth();
    const [activeTrip, setActiveTrip] = useState(backendConfig.enabled ? null : fallbackActiveTrip);
    const [stops, setStops] = useState(backendConfig.enabled ? [] : fallbackStops);
    const [tripStatus, setTripStatus] = useState("not-started");
    const [checklist, setChecklist] = useState([]);
    const [gpsUpdatedAt, setGpsUpdatedAt] = useState("Not sharing");
    const [gpsSharingStatus, setGpsSharingStatus] = useState("idle");
    const [gpsError, setGpsError] = useState("");
    const [tripLoadError, setTripLoadError] = useState("");
    const [lastGpsLocation, setLastGpsLocation] = useState(null);
    const [emergency, setEmergency] = useState(null);
    const [history, setHistory] = useState([]);
    const applyDriverTripData = useCallback((data, { preserveChecklist = false } = {}) => {
        setActiveTrip(data.activeStaffTrip ?? null);
        setStops(data.operationalStops ?? []);
        setTripStatus(data.tripStatus ?? "not-started");
        if (data.tripStatus === "active")
            setChecklist(preTripItems.map((item) => item.id));
        else if (!preserveChecklist || data.tripStatus === "completed")
            setChecklist([]);
        setGpsUpdatedAt(data.gpsUpdatedAt ?? "Not sharing");
        setLastGpsLocation(data.liveLocation ?? null);
        setHistory(data.tripHistory ?? []);
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
                if (!cancelled)
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
        setGpsSharingStatus("requesting");
        setGpsError("");
        let cancelled = false;
        const sync = createGpsSync({
            tripId: activeTrip?.id, request: apiRequest,
            onState: (status, message) => { setGpsSharingStatus(status); setGpsError(message); },
            onAccepted: (payload) => {
                setGpsUpdatedAt(payload.location.updatedAt);
                setLastGpsLocation(payload.location);
                if (payload.activeStaffTrip) setActiveTrip(payload.activeStaffTrip);
                if (payload.operationalStops) setStops(payload.operationalStops);
            },
        });
        let permissionDenied = false;
        const freshnessTimer = window.setInterval(() => { if (!permissionDenied) sync.checkFreshness(); }, 10000);
        const watchId = navigator.geolocation.watchPosition((position) => {
            permissionDenied = false;
            void sync.receive(position);
        }, (error) => {
            if (cancelled)
                return;
            permissionDenied = error?.code === 1;
            setGpsSharingStatus(permissionDenied ? 'permission' : 'error');
            setGpsError(geolocationErrorMessage(error));
        }, {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 12000,
        });
        return () => {
            cancelled = true;
            sync.dispose();
            window.clearInterval(freshnessTimer);
            navigator.geolocation.clearWatch(watchId);
        };
    }, [activeTrip?.id, tripStatus]);
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
        history,
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
                        setTripLoadError("");
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
                setHistory(data.tripHistory ?? []);
                setGpsUpdatedAt(data.gpsUpdatedAt ?? "Sharing stopped");
            }
            else {
                setTripStatus("completed");
                setGpsUpdatedAt("Sharing stopped");
            }
            setGpsSharingStatus("idle");
            setLastGpsLocation(null);
            setChecklist([]);
        },
        submitEmergency: async (type, note, id) => {
            const report = await apiRequest('/staff/emergencies', {
                method: 'POST', body: { id, type, note, tripId: activeTrip.id },
            });
            setEmergency(report);
            return report;
        },
    }), [activeTrip, stops, tripStatus, checklist, tripLoadError, gpsUpdatedAt, gpsSharingStatus, gpsError, lastGpsLocation, emergency, history, refreshDriverTrip]);
    return (<DriverContext.Provider value={value}>{!activeTrip ? <AssignmentUnavailable error={tripLoadError} retry={refreshDriverTrip} logout={logout}/> : children}</DriverContext.Provider>);
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
    const { logout } = useAuth();
    const [activeTrip, setActiveTrip] = useState(backendConfig.enabled ? null : fallbackActiveTrip);
    const [stops, setStops] = useState(backendConfig.enabled ? [] : fallbackStops);
    const [tripLoadError, setTripLoadError] = useState('');
    const seatRequest = useRef(null);
    const loadedTripId = useRef(null);
    const [tripStatus, setTripStatus] = useState(backendConfig.enabled ? "not-started" : "active");
    const [currentStopId, setCurrentStopId] = useState(fallbackCurrentStopId);
    const [occupiedSeats, setOccupiedSeats] = useState(0);
    const [updates, setUpdates] = useState([]);
    const [emergency, setEmergency] = useState(null);
    const applyConductorTripData = useCallback((data) => {
        const trip = data.activeStaffTrip ?? null;
        const seatUpdates = (data.seatUpdates ?? []).filter((update) => update.tripId === trip?.id);
        const tripOccupiedSeats = Number(trip?.occupiedSeats);
        const initialOccupiedSeats = Number.isFinite(tripOccupiedSeats) ? tripOccupiedSeats : 0;
        setActiveTrip(trip);
        setStops(data.operationalStops ?? []);
        setTripLoadError('');
        setTripStatus(data.tripStatus ?? "not-started");
        if (loadedTripId.current !== trip?.id) {
            loadedTripId.current = trip?.id;
            setCurrentStopId(data.operationalCurrentStopId ?? '');
        }
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
            .catch((error) => { if (!cancelled) setTripLoadError(error.message); });
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
        tripLoadError,
        refreshTrip: refreshConductorTrip,
        startTrip: () => setTripStatus("active"),
            setCurrentStop: setCurrentStopId,
        submitSeatUpdate: async (boarded, deboarded) => {
            if (tripStatus !== "active")
                throw new Error("Passenger counts can be submitted only after the driver starts the trip.");
            if (seatRequest.current?.sending) throw new Error('Passenger update is already being sent.');
            const calculation = calculateSeatUpdate(occupiedSeats, boarded, deboarded, activeTrip.capacity);
            const stop = stops.find((item) => item.id === currentStopId) ?? stops[0];
            const updatePayload = {
                id: crypto.randomUUID(),
                stopId: stop.id,
                stopName: stop.name,
                boarded,
                deboarded,
                ...calculation,
                timestamp: new Date().toISOString(),
            };
            const signature = JSON.stringify([activeTrip.id, stop.id, boarded, deboarded]);
            if (seatRequest.current?.signature !== signature)
                seatRequest.current = { signature, payload: updatePayload, sending: false };
            seatRequest.current.sending = true;
            try {
            const update = backendConfig.enabled
                ? await apiRequest(`/conductor/trips/${activeTrip.id}/seat-updates`, { method: "POST", body: seatRequest.current.payload })
                : updatePayload;
            const savedUpdate = update.update ?? update;
            setOccupiedSeats(savedUpdate.occupiedSeats ?? calculation.occupiedSeats);
            setUpdates((items) => [savedUpdate, ...items.filter((item) => item.id !== savedUpdate.id)]);
            if (update.activeStaffTrip)
                setActiveTrip(update.activeStaffTrip);
            if (update.operationalStops)
                setStops(update.operationalStops);
            if (update.operationalCurrentStopId)
                setCurrentStopId(update.operationalCurrentStopId);
            seatRequest.current = null;
            return savedUpdate;
            } finally { if (seatRequest.current) seatRequest.current.sending = false; }
        },
        submitEmergency: async (type, note, id) => {
            const report = await apiRequest('/staff/emergencies', {
                method: 'POST', body: { id, type, note, tripId: activeTrip.id },
            });
            setEmergency(report);
            return report;
        },
    }), [activeTrip, stops, tripStatus, currentStopId, occupiedSeats, updates, emergency, refreshConductorTrip, tripLoadError]);
    return (<ConductorContext.Provider value={value}>
      {!activeTrip ? <AssignmentUnavailable error={tripLoadError} retry={refreshConductorTrip} logout={logout}/> : <>{tripLoadError && <div className="connection-warning" role="alert">Connection interrupted. Passenger counts may be out of date.</div>}{children}</>}
    </ConductorContext.Provider>);
}
function AssignmentUnavailable({ error, retry, logout }) {
    return <main className="placeholder"><section className="placeholder__card"><h1>Assigned trip unavailable</h1><p>{error || 'Loading your assignment. If no route is assigned, contact the transport office.'}</p><button className="button button--primary" onClick={() => void retry().catch(() => {})}>Refresh assignment</button><button className="button button--secondary" onClick={logout}>Log out</button></section></main>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useConductorOperations() {
    const value = useContext(ConductorContext);
    if (!value)
        throw new Error("useConductorOperations must be used inside ConductorOperationsProvider");
    return value;
}
