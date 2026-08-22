import { createContext, useContext, useEffect, useMemo, useState, } from "react";
import { apiRequest, backendConfig } from "../services/apiClient";
import { activeStaffTrip as fallbackActiveTrip, operationalCurrentStopId as fallbackCurrentStopId, operationalStops as fallbackStops } from "../services/operationsData";
import { calculateSeatUpdate } from "../utils/seatCalculation";
const DriverContext = createContext(null);
function syncBackend(path, options) {
    if (!backendConfig.enabled)
        return;
    void apiRequest(path, options).catch(() => undefined);
}
export function DriverOperationsProvider({ children, }) {
    const [activeTrip, setActiveTrip] = useState(fallbackActiveTrip);
    const [stops, setStops] = useState(fallbackStops);
    const [tripStatus, setTripStatus] = useState("not-started");
    const [checklist, setChecklist] = useState([]);
    const [gpsUpdatedAt, setGpsUpdatedAt] = useState("Not sharing");
    const [emergency, setEmergency] = useState(null);
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
            setGpsUpdatedAt(data.gpsUpdatedAt ?? "Not sharing");
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
        checklist,
        gpsUpdatedAt,
        emergency,
        toggleCheck: (id) => setChecklist((items) => items.includes(id)
            ? items.filter((item) => item !== id)
            : [...items, id]),
        startTrip: () => {
            setTripStatus("active");
            setGpsUpdatedAt("Just now");
            syncBackend(`/driver/trips/${activeTrip.id}/start`, { method: "POST" });
        },
        endTrip: () => {
            setTripStatus("completed");
            setGpsUpdatedAt("Sharing stopped");
            syncBackend(`/driver/trips/${activeTrip.id}/end`, { method: "POST" });
        },
        submitEmergency: (type, note) => {
            const report = {
                id: `EMG-${Date.now().toString().slice(-6)}`,
                type,
                note,
                location: `Near ${activeTrip.nextStopName}, Ahmedabad`,
                coordinates: stops.find((stop) => stop.id === activeTrip.nextStopId)?.coordinates,
                submittedAt: "Just now",
            };
            setEmergency(report);
            syncBackend("/staff/emergencies", { method: "POST", body: report });
            return report;
        },
    }), [activeTrip, stops, tripStatus, checklist, gpsUpdatedAt, emergency]);
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
            timestamp: "7:44 AM",
        },
        {
            id: "SEAT-000",
            stopId: fallbackStops[0].id,
            stopName: fallbackStops[0].name,
            boarded: 20,
            deboarded: 0,
            occupiedSeats: 20,
            availableSeats: 30,
            timestamp: "7:31 AM",
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
            const seatUpdates = data.seatUpdates ?? [];
            setActiveTrip(data.activeStaffTrip ?? fallbackActiveTrip);
            setStops(data.operationalStops ?? fallbackStops);
            setTripStatus(data.tripStatus ?? "active");
            setCurrentStopId(data.operationalCurrentStopId ?? fallbackCurrentStopId);
            if (seatUpdates.length) {
                setUpdates(seatUpdates);
                setOccupiedSeats(seatUpdates[0].occupiedSeats ?? 30);
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
                timestamp: new Date().toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                }),
            };
            const update = backendConfig.enabled
                ? await apiRequest(`/conductor/trips/${activeTrip.id}/seat-updates`, { method: "POST", body: updatePayload })
                : updatePayload;
            setOccupiedSeats(calculation.occupiedSeats);
            setUpdates((items) => [update, ...items]);
            return update;
        },
        submitEmergency: (type, note) => {
            const report = {
                id: `EMG-${Date.now().toString().slice(-6)}`,
                type,
                note,
                location: `Near ${activeTrip.nextStopName}, Ahmedabad`,
                coordinates: stops.find((stop) => stop.id === activeTrip.nextStopId)?.coordinates,
                submittedAt: "Just now",
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
