import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, backendConfig } from '../services/apiClient';
import { adminActivity, fleetVehicles, initialAdminRecords, initialRoutes } from '../services/adminData';
const AdminDataContext = createContext(null);
const adminRefreshIntervalMs = 15000;
function applyAdminBootstrap(data, setters) {
    setters.setRecords(data.records ?? initialAdminRecords);
    setters.setRoutes(data.routes ?? initialRoutes);
    setters.setFleet(data.fleetVehicles ?? fleetVehicles);
    setters.setActivity(data.adminActivity ?? adminActivity);
}
function nextRecordStatus(status) {
    return status === 'active' ? 'inactive' : 'active';
}

export function AdminDataProvider({ children }) {
    const [records, setRecords] = useState(initialAdminRecords);
    const [routes, setRoutes] = useState(initialRoutes);
    const [fleet, setFleet] = useState(fleetVehicles);
    const [activity, setActivity] = useState(adminActivity);
    const refreshData = useCallback(async () => {
        if (!backendConfig.enabled)
            return null;
        const data = await apiRequest('/admin/bootstrap');
        applyAdminBootstrap(data, { setRecords, setRoutes, setFleet, setActivity });
        return data;
    }, []);
    useEffect(() => {
        if (!backendConfig.enabled)
            return undefined;
        let cancelled = false;
        const load = () => apiRequest('/admin/bootstrap').then((data) => {
            if (cancelled)
                return;
            applyAdminBootstrap(data, { setRecords, setRoutes, setFleet, setActivity });
        }).catch(() => undefined);
        void load();
        const timer = window.setInterval(() => void load(), adminRefreshIntervalMs);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, []);
    const value = useMemo(() => ({
        records, routes, fleet, activity, refreshData,
        upsertRecord: async (kind, record) => {
            if (backendConfig.enabled) {
                const saved = await apiRequest(`/admin/${kind}/${record.id}`, { method: 'PUT', body: record });
                setRecords((current) => ({ ...current, [kind]: current[kind].some((item) => item.id === saved.id) ? current[kind].map((item) => item.id === saved.id ? saved : item) : [saved, ...current[kind]] }));
                void refreshData();
                return saved;
            }
            setRecords((current) => ({ ...current, [kind]: current[kind].some((item) => item.id === record.id) ? current[kind].map((item) => item.id === record.id ? record : item) : [record, ...current[kind]] }));
            return record;
        },
        toggleRecord: async (kind, id) => {
            const target = records[kind].find((item) => item.id === id);
            if (!target)
                throw new Error('Record not found.');
            const patched = { ...target, status: nextRecordStatus(target.status) };
            if (kind === 'students' && patched.status === 'active' && (!patched.routeCode || !patched.stopId))
                throw new Error('Assign a route and pickup stop before approving this student.');
            if (backendConfig.enabled) {
                const saved = await apiRequest(`/admin/${kind}/${id}/status`, { method: 'PATCH', body: patched });
                setRecords((current) => ({ ...current, [kind]: current[kind].map((item) => item.id === id ? saved : item) }));
                void refreshData();
                return saved;
            }
            setRecords((current) => ({ ...current, [kind]: current[kind].map((item) => item.id === id ? patched : item) }));
            return patched;
        },
        upsertRoute: async (route) => {
            if (backendConfig.enabled) {
                const saved = await apiRequest(`/admin/routes/${route.id}`, { method: 'PUT', body: route });
                setRoutes((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
                void refreshData();
                return saved;
            }
            setRoutes((current) => current.some((item) => item.id === route.id) ? current.map((item) => item.id === route.id ? route : item) : [route, ...current]);
            return route;
        },
        toggleRoute: async (id) => {
            const target = routes.find((item) => item.id === id);
            if (!target)
                throw new Error('Route not found.');
            const patched = { ...target, status: nextRecordStatus(target.status) };
            if (backendConfig.enabled) {
                const saved = await apiRequest(`/admin/routes/${id}/status`, { method: 'PATCH', body: patched });
                setRoutes((current) => current.map((item) => item.id === id ? saved : item));
                void refreshData();
                return saved;
            }
            setRoutes((current) => current.map((item) => item.id === id ? patched : item));
            return patched;
        },
    }), [activity, fleet, records, refreshData, routes]);
    return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAdminData() {
    const value = useContext(AdminDataContext);
    if (!value)
        throw new Error('useAdminData must be used inside AdminDataProvider');
    return value;
}
