import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, backendConfig } from '../services/apiClient';
import { adminActivity, fleetVehicles, initialAdminRecords, initialRoutes } from '../services/adminData';
const AdminDataContext = createContext(null);
function syncBackend(path, options) {
    if (!backendConfig.enabled)
        return;
    void apiRequest(path, options).catch(() => undefined);
}
export function AdminDataProvider({ children }) {
    const [records, setRecords] = useState(initialAdminRecords);
    const [routes, setRoutes] = useState(initialRoutes);
    const [fleet, setFleet] = useState(fleetVehicles);
    const [activity, setActivity] = useState(adminActivity);
    useEffect(() => {
        if (!backendConfig.enabled)
            return;
        let cancelled = false;
        apiRequest('/admin/bootstrap').then((data) => {
            if (cancelled)
                return;
            setRecords(data.records ?? initialAdminRecords);
            setRoutes(data.routes ?? initialRoutes);
            setFleet(data.fleetVehicles ?? fleetVehicles);
            setActivity(data.adminActivity ?? adminActivity);
        }).catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);
    const value = useMemo(() => ({
        records, routes, fleet, activity,
        upsertRecord: (kind, record) => {
            setRecords((current) => ({ ...current, [kind]: current[kind].some((item) => item.id === record.id) ? current[kind].map((item) => item.id === record.id ? record : item) : [record, ...current[kind]] }));
            syncBackend(`/admin/${kind}/${record.id}`, { method: 'PUT', body: record });
        },
        toggleRecord: (kind, id) => {
            setRecords((current) => {
                const next = current[kind].map((item) => item.id === id ? { ...item, status: item.status === 'active' ? 'inactive' : 'active' } : item);
                syncBackend(`/admin/${kind}/${id}/status`, { method: 'PATCH', body: next.find((item) => item.id === id) });
                return { ...current, [kind]: next };
            });
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
    }), [activity, fleet, records, routes]);
    return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAdminData() {
    const value = useContext(AdminDataContext);
    if (!value)
        throw new Error('useAdminData must be used inside AdminDataProvider');
    return value;
}
