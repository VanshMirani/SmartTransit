import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
export function ProtectedRoute({ roles, children }) {
    const { checkingSession, user } = useAuth();
    const location = useLocation();
    if (checkingSession)
        return <main className="placeholder"><section className="placeholder__card"><p>Checking secure session...</p></section></main>;
    if (!user)
        return <Navigate to="/login" replace state={{ from: location.pathname }}/>;
    if (!roles.includes(user.role))
        return <Navigate to="/unauthorized" replace/>;
    return children;
}
