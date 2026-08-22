import { useEffect, useState } from 'react';
import { studentService } from '../services/studentService';
export function useStudentData() {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const load = () => {
        setLoading(true);
        setError('');
        studentService.getTransitData().then(setData).catch(() => setError('We couldn’t load your transit details.')).finally(() => setLoading(false));
    };
    useEffect(load, []);
    return { data, error, loading, retry: load };
}
