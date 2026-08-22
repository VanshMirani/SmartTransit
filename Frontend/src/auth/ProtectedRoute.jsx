import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
export function ProtectedRoute({ roles, children }) {
    const { user } = useAuth();
    const location = useLocation();
    if (!user)
        return <Navigate to="/login" replace state={{ from: location.pathname }}/>;
    if (!roles.includes(user.role))
        return <Navigate to="/unauthorized" replace/>;
    return children;
}
