import { ShieldX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { roleHome } from '../../services/authService';
export function UnauthorizedPage() {
    const { user } = useAuth();
    return <main className="placeholder"><div /><section className="placeholder__card"><span className="placeholder__icon"><ShieldX /></span><span className="section-kicker">Permission denied</span><h1>This area isn’t available for your role</h1><p>Your SmartTransit account only provides access to the tools assigned to you.</p><Link className="button button--primary" to={user ? roleHome[user.role] : '/login'}>Return to my dashboard</Link></section></main>;
}
