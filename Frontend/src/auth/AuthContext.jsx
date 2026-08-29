import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => authService.getSession());
    const [checkingSession, setCheckingSession] = useState(() => Boolean(authService.getSession()));
    useEffect(() => {
        let cancelled = false;
        authService.validateSession().then((session) => {
            if (cancelled)
                return;
            setUser(session);
        }).finally(() => {
            if (!cancelled)
                setCheckingSession(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    const value = useMemo(() => ({
        user,
        checkingSession,
        login: async (email, password) => {
            const session = await authService.login(email, password);
            setUser(session);
            return session;
        },
        requestSignupOtp: (email) => authService.requestSignupOtp(email),
        registerStudent: (input) => authService.registerStudent(input),
        logout: () => { authService.logout(); setUser(null); },
    }), [checkingSession, user]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const value = useContext(AuthContext);
    if (!value)
        throw new Error('useAuth must be used inside AuthProvider');
    return value;
}
