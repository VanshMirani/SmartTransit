import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../services/apiClient';
import { studentService } from '../services/studentService';
export function useStudentData({ pollIntervalMs = 0 } = {}) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const load = useCallback(({ silent = false } = {}) => {
        if (!silent)
            setLoading(true);
        setError('');
        studentService.getTransitData().then(setData).catch((reason) => {
            setError(reason instanceof ApiError ? reason.message : 'We couldn’t load your transit details.');
        }).finally(() => {
            if (!silent)
                setLoading(false);
        });
    }, []);
    useEffect(() => {
        load();
        if (!pollIntervalMs)
            return undefined;
        const timer = window.setInterval(() => load({ silent: true }), pollIntervalMs);
        return () => window.clearInterval(timer);
    }, [load, pollIntervalMs]);
    const retry = () => {
        setLoading(true);
        setError('');
        load();
    };
    return { data, error, loading, retry };
}
