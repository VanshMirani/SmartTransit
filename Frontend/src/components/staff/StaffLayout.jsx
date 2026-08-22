import { AlertTriangle, BusFront, ClipboardCheck, History, Home, LogOut, Menu, Navigation, UserRound, Users, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
const roleConfig = {
    driver: {
        label: 'Driver',
        links: [
            { to: '/driver', end: true, icon: Home, label: 'Home' },
            { to: '/driver/checklist', end: false, icon: ClipboardCheck, label: 'Checklist' },
            { to: '/driver/trip', end: false, icon: Navigation, label: 'Active trip' },
            { to: '/driver/history', end: false, icon: History, label: 'Trip history' },
            { to: '/driver/profile', end: false, icon: UserRound, label: 'Profile' },
        ],
    },
    conductor: {
        label: 'Conductor',
        links: [
            { to: '/conductor', end: true, icon: Home, label: 'Home' },
            { to: '/conductor/trip', end: false, icon: Users, label: 'Seat update' },
            { to: '/conductor/history', end: false, icon: History, label: 'Update history' },
            { to: '/conductor/profile', end: false, icon: UserRound, label: 'Profile' },
        ],
    },
};
export function StaffLayout({ role }) {
    const [open, setOpen] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const config = roleConfig[role];
    const signOut = () => { logout(); navigate('/login', { replace: true }); };
    return <div className={`staff-app staff-app--${role}`}>
    <header className="staff-topbar"><button className="staff-menu" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu /></button><NavLink className="staff-brand" to={`/${role}`}><BusFront /><span>Smart<strong>Transit</strong></span></NavLink><div className="staff-topbar__role"><span>{user?.initials}</span><div><strong>{user?.name}</strong><small>{config.label}</small></div></div></header>
    <aside className={`staff-drawer ${open ? 'staff-drawer--open' : ''}`}><div className="staff-drawer__title"><span>Navigation</span><button onClick={() => setOpen(false)} aria-label="Close navigation"><X /></button></div><nav aria-label={`${config.label} navigation`}>{config.links.map(({ to, end, icon: Icon, label }) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}><Icon /><span>{label}</span></NavLink>)}</nav><NavLink className="staff-emergency-link" to={`/${role}/emergency`} onClick={() => setOpen(false)}><AlertTriangle /> Emergency alert</NavLink><button className="staff-logout" onClick={signOut}><LogOut /> Log out</button></aside>
    {open && <button className="staff-scrim" onClick={() => setOpen(false)} aria-label="Close navigation"/>}
    <main className="staff-content"><Outlet /></main>
    <nav className="staff-bottom-nav" aria-label={`Mobile ${config.label} navigation`}>{config.links.slice(0, 4).map(({ to, end, icon: Icon, label }) => <NavLink key={to} to={to} end={end}><Icon /><small>{label.replace('Active ', '').replace('Trip ', '')}</small></NavLink>)}</nav>
  </div>;
}
