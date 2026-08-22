/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, } from "react";
import { defaultStaffRoute } from "../services/indusRoutes";
const initialSettings = {
    gpsUpdateSeconds: 30,
    staleGpsMinutes: 5,
    showStaleWarnings: true,
    emailCriticalAlerts: true,
    pushServiceAlerts: true,
    dailySummary: true,
};
const initialPermissions = {
    admin: {
        viewTracking: true,
        manageTrips: true,
        updateSeats: true,
        manageCommunications: true,
        manageSystem: true,
    },
    driver: {
        viewTracking: true,
        manageTrips: true,
        updateSeats: false,
        manageCommunications: false,
        manageSystem: false,
    },
    conductor: {
        viewTracking: true,
        manageTrips: false,
        updateSeats: true,
        manageCommunications: false,
        manageSystem: false,
    },
    student: {
        viewTracking: true,
        manageTrips: false,
        updateSeats: false,
        manageCommunications: false,
        manageSystem: false,
    },
};
const initialAuditLog = [
    {
        id: "AUD-241",
        timestamp: "21 Aug 2026, 10:42 AM",
        actor: "Admin Operator",
        category: "settings",
        action: `Updated Route ${defaultStaffRoute.code} schedule`,
    },
    {
        id: "AUD-240",
        timestamp: "21 Aug 2026, 10:18 AM",
        actor: "Operations Manager",
        category: "assignment",
        action: `Assigned driver to bus ${defaultStaffRoute.primaryBusNumber}`,
    },
    {
        id: "AUD-239",
        timestamp: "21 Aug 2026, 9:56 AM",
        actor: "Admin Operator",
        category: "complaint",
        action: "Resolved complaint CMP-2026-0412",
    },
    {
        id: "AUD-238",
        timestamp: "21 Aug 2026, 9:21 AM",
        actor: "System",
        category: "tracking",
        action: `Raised stale-GPS warning for ${defaultStaffRoute.primaryBusNumber}`,
    },
    {
        id: "AUD-237",
        timestamp: "21 Aug 2026, 8:44 AM",
        actor: "Conductor Rahul",
        category: "seats",
        action: "Updated seats at Shilaj Circle",
    },
    {
        id: "AUD-236",
        timestamp: "20 Aug 2026, 6:10 PM",
        actor: "Operations Manager",
        category: "settings",
        action: "Updated critical-alert recipients",
    },
];
const SettingsContext = createContext(null);
export function SystemSettingsProvider({ children }) {
    const [settings, setSettings] = useState(initialSettings);
    const [permissions, setPermissions] = useState(initialPermissions);
    const [auditLog, setAuditLog] = useState(initialAuditLog);
    const value = useMemo(() => ({
        settings,
        permissions,
        auditLog,
        saveSettings: async (nextSettings, nextPermissions) => {
            await new Promise((resolve) => window.setTimeout(resolve, 500));
            setSettings(nextSettings);
            setPermissions(nextPermissions);
            setAuditLog((events) => [
                {
                    id: `AUD-${242 + events.length}`,
                    timestamp: new Intl.DateTimeFormat("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                    }).format(new Date()),
                    actor: "Admin Operator",
                    category: "settings",
                    action: `Saved system settings (${nextSettings.gpsUpdateSeconds}s GPS, ${nextSettings.staleGpsMinutes}m stale threshold)`,
                },
                ...events,
            ]);
        },
    }), [auditLog, permissions, settings]);
    return (<SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>);
}
export function useSystemSettings() {
    const value = useContext(SettingsContext);
    if (!value)
        throw new Error("useSystemSettings must be used inside SystemSettingsProvider");
    return value;
}
