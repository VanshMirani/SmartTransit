import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authService } from '../services/authService';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => authService.getSession());
    const [checkingSession, setCheckingSession] = useState(() => Boolean(authService.getSession()));
    const [sessionError, setSessionError] = useState('');
    const [failedResources, setFailedResources] = useState([]);
    const [verified, setVerified] = useState(false);
    const epoch = useRef(0);
    const inFlight = useRef(false);
    const revalidate = useCallback(async () => {
        if (inFlight.current) return;
        inFlight.current = true;
        const generation = epoch.current;
        try {
            const session = await authService.validateSession();
            if (generation !== epoch.current) return;
            setUser(session);
            setVerified(Boolean(session));
            setSessionError('');
        }
        catch {
            if (generation === epoch.current)
                setSessionError('Connection interrupted. Reconnecting to verify your session. Last loaded information may be out of date.');
        }
        finally {
            inFlight.current = false;
            if (generation === epoch.current) setCheckingSession(false);
        }
    }, []);
    useEffect(() => {
        void revalidate();
        const timer = window.setInterval(revalidate, 15000);
        const offline = () => setSessionError('You are offline. Last loaded information may be out of date. Reconnect to save changes.');
        window.addEventListener('online', revalidate);
        window.addEventListener('offline', offline);
        const connection = ({ detail }) => setFailedResources((paths) => detail.failed
            ? [...new Set([...paths, detail.path])]
            : paths.filter((path) => path !== detail.path));
        window.addEventListener('smarttransit:connection', connection);
        return () => {
            epoch.current += 1;
            inFlight.current = false;
            window.clearInterval(timer);
            window.removeEventListener('online', revalidate);
            window.removeEventListener('offline', offline);
            window.removeEventListener('smarttransit:connection', connection);
        };
    }, [revalidate]);
    const value = useMemo(() => ({
        user,
        checkingSession,
        sessionError: sessionError || (failedResources.length ? 'Connection interrupted. Some data could not be refreshed or saved. Last loaded information may be out of date. Retry the failed action after reconnecting.' : ''),
        verified, revalidate,
        login: async (email, password) => {
            epoch.current += 1;
            const session = await authService.login(email, password);
            setUser(session);
            setVerified(true);
            setSessionError('');
            setFailedResources([]);
            setCheckingSession(false);
            return session;
        },
        requestSignupOtp: (email) => authService.requestSignupOtp(email),
        registerStudent: (input) => authService.registerStudent(input),
        logout: () => {
            epoch.current += 1;
            void authService.logout().catch(() => setSessionError('Signed out on this device. Server sign-out could not be confirmed; the session will expire automatically.'));
            setUser(null);
            setFailedResources([]);
            setVerified(false);
        },
    }), [checkingSession, user, sessionError, verified, revalidate, failedResources]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const value = useContext(AuthContext);
    if (!value)
        throw new Error('useAuth must be used inside AuthProvider');
    return value;
}
