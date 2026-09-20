import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../services/apiClient';
import { studentService } from '../services/studentService';
export function useStudentData({ pollIntervalMs = 15000 } = {}) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [disconnected, setDisconnected] = useState(() => !navigator.onLine);
    const generation = useRef(0);
    const inFlight = useRef(false);
    const load = useCallback(({ silent = false } = {}) => {
        if (!silent)
            setLoading(true);
        if (inFlight.current) return;
        inFlight.current = true;
        const current = generation.current;
        studentService.getTransitData().then((result) => {
            if (current !== generation.current) return;
            setData(result);
            setError('');
            setDisconnected(!navigator.onLine);
        }).catch((reason) => {
            if (current !== generation.current) return;
            setError(reason instanceof ApiError ? reason.message : 'We couldn’t load your transit details.');
            setDisconnected(true);
        }).finally(() => {
            if (current === generation.current) {
                inFlight.current = false;
                setLoading(false);
            }
        });
    }, []);
    useEffect(() => {
        load();
        const refresh = () => load({ silent: true });
        const offline = () => setDisconnected(true);
        const timer = pollIntervalMs ? window.setInterval(refresh, pollIntervalMs) : null;
        window.addEventListener('online', refresh);
        window.addEventListener('offline', offline);
        return () => {
            generation.current += 1;
            inFlight.current = false;
            window.clearInterval(timer);
            window.removeEventListener('online', refresh);
            window.removeEventListener('offline', offline);
        };
    }, [load, pollIntervalMs]);
    const retry = () => {
        setLoading(true);
        setError('');
        load();
    };
    const stale = disconnected && data?.bus ? {
        ...data, bus: { ...data.bus, gpsStatus: data.bus.tripActive ? 'stale' : 'not-sharing', distanceToNextStop: 'Unavailable offline' },
        route: { ...data.route, stops: (data.route?.stops ?? []).map((stop) => ({ ...stop, eta: 'ETA unavailable', estimatedArrivalAt: undefined, distanceFromBus: undefined })) },
    } : data;
    return { data: stale, error: data ? '' : error, loading, retry };
}
