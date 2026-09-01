/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, } from "react";
import { defaultStaffRoute } from "../services/indusRoutes";
import { formatDateTime, minutesAgo } from "../utils/dateLabels";
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
        timestamp: formatDateTime(minutesAgo(38)),
        actor: "Admin Operator",
        category: "settings",
        action: `Updated Route ${defaultStaffRoute.code} schedule`,
    },
    {
        id: "AUD-240",
        timestamp: formatDateTime(minutesAgo(62)),
        actor: "Operations Manager",
        category: "assignment",
        action: `Assigned driver to bus ${defaultStaffRoute.primaryBusNumber}`,
    },
    {
        id: "AUD-239",
        timestamp: formatDateTime(minutesAgo(84)),
        actor: "Admin Operator",
        category: "complaint",
        action: "Resolved complaint CMP-2026-0412",
    },
    {
        id: "AUD-238",
        timestamp: formatDateTime(minutesAgo(119)),
        actor: "System",
        category: "tracking",
        action: `Raised stale-GPS warning for ${defaultStaffRoute.primaryBusNumber}`,
    },
    {
        id: "AUD-237",
        timestamp: formatDateTime(minutesAgo(156)),
        actor: "Conductor Rahul",
        category: "seats",
        action: "Updated seats at Shilaj Circle",
    },
    {
        id: "AUD-236",
        timestamp: formatDateTime(minutesAgo(18 * 60)),
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
                    timestamp: formatDateTime(),
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
