import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, backendConfig } from '../services/apiClient';
import { adminActivity, fleetVehicles, initialAdminRecords, initialRoutes } from '../services/adminData';
const AdminDataContext = createContext(null);
function applyAdminBootstrap(data, setters) {
    setters.setRecords(data.records ?? initialAdminRecords);
    setters.setRoutes(data.routes ?? initialRoutes);
    setters.setFleet(data.fleetVehicles ?? fleetVehicles);
    setters.setActivity(data.adminActivity ?? adminActivity);
}
function syncBackend(path, options) {
    if (!backendConfig.enabled)
        return;
    void apiRequest(path, options).catch(() => undefined);
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
        apiRequest('/admin/bootstrap').then((data) => {
            if (cancelled)
                return;
            applyAdminBootstrap(data, { setRecords, setRoutes, setFleet, setActivity });
        }).catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);
    const value = useMemo(() => ({
        records, routes, fleet, activity, refreshData,
        upsertRecord: async (kind, record) => {
            if (backendConfig.enabled) {
                const saved = await apiRequest(`/admin/${kind}/${record.id}`, { method: 'PUT', body: record });
                setRecords((current) => ({ ...current, [kind]: current[kind].some((item) => item.id === saved.id) ? current[kind].map((item) => item.id === saved.id ? saved : item) : [saved, ...current[kind]] }));
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
                return saved;
            }
            setRecords((current) => ({ ...current, [kind]: current[kind].map((item) => item.id === id ? patched : item) }));
            return patched;
        },
        upsertRoute: (route) => {
            setRoutes((current) => current.some((item) => item.id === route.id) ? current.map((item) => item.id === route.id ? route : item) : [route, ...current]);
            syncBackend(`/admin/routes/${route.id}`, { method: 'PUT', body: route });
        },
        toggleRoute: (id) => {
            setRoutes((current) => {
                const next = current.map((item) => item.id === id ? { ...item, status: item.status === 'active' ? 'inactive' : 'active' } : item);
                syncBackend(`/admin/routes/${id}/status`, { method: 'PATCH', body: next.find((item) => item.id === id) });
                return next;
            });
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
