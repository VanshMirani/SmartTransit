import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
export function ProtectedRoute({ roles, children }) {
    const { checkingSession, user, verified, sessionError, revalidate } = useAuth();
    const location = useLocation();
    if (checkingSession)
        return <main className="placeholder"><section className="placeholder__card"><p>Checking secure session...</p></section></main>;
    if (!user)
        return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }}/>;
    if (!verified)
        return <main className="placeholder"><section className="placeholder__card" role="alert"><h1>Unable to verify your session</h1><p>{sessionError}</p><button className="button button--primary" onClick={revalidate}>Retry connection</button></section></main>;
    if (!roles.includes(user.role))
        return <Navigate to="/unauthorized" replace/>;
    return <>{sessionError && <div className="connection-warning" role="status">{sessionError}</div>}{children}</>;
}
