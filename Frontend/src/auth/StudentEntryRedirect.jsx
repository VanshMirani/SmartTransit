import { Navigate } from "react-router-dom";
import { roleHome } from "../services/authService";
import { useAuth } from "./AuthContext";
export function StudentEntryRedirect({ to }) {
    const { user } = useAuth();
    if (!user)
        return <Navigate to="/login" replace state={{ from: to }}/>;
    return (<Navigate to={user.role === "student" ? to : roleHome[user.role]} replace/>);
}
