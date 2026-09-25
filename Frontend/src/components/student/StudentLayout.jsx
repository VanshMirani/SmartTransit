import { Bell, BusFront, CircleHelp, Home, LogOut, MapPinned, Menu, MessageSquareText, Route, UserRound, X, } from "lucide-react";
import { useNavigationMenu } from '../../hooks/useNavigationMenu';
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useCommunications } from "../../communications/CommunicationsContext";
const mainLinks = [
    { to: "/student", end: true, icon: Home, label: "Home" },
    { to: "/student/track", icon: MapPinned, label: "Track" },
    { to: "/student/routes", icon: Route, label: "Routes" },
    { to: "/student/alerts", icon: Bell, label: "Alerts" },
    { to: "/student/profile", icon: UserRound, label: "Profile" },
];
export function StudentLayout() {
    const { open: menuOpen, setOpen: setMenuOpen, close, triggerRef, navigationRef } = useNavigationMenu();
    const { user, logout, sessionError } = useAuth();
    const { unreadCount } = useCommunications();
    const navigate = useNavigate();
    const signOut = () => {
        logout();
        navigate("/login", { replace: true });
    };
    return (<div className="student-app">
      <aside ref={navigationRef} id="student-navigation" className={`student-sidebar ${menuOpen ? "student-sidebar--open" : ""}`}>
        <div className="student-sidebar__brand">
          <NavLink className="sidebar-home-link" to="/student" aria-label="SmartTransit home" onClick={() => setMenuOpen(false)}><BusFront />
          <span>
            Smart<strong>Transit</strong>
          </span></NavLink>
          <button onClick={close} aria-label="Close navigation">
            <X />
          </button>
        </div>
        <nav aria-label="Student navigation">
          {mainLinks.map(({ to, end, icon: Icon, label }) => (<NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)}>
              <Icon />
              <span>{label}</span>
              {label === "Alerts" && unreadCount > 0 && <i>{unreadCount}</i>}
            </NavLink>))}
          <NavLink to="/student/complaints" onClick={() => setMenuOpen(false)}>
            <MessageSquareText />
            <span>Complaints</span>
          </NavLink>
          <NavLink to="/student/help" onClick={() => setMenuOpen(false)}>
            <CircleHelp />
            <span>Help & emergency</span>
          </NavLink>
        </nav>
        <div className="student-sidebar__account">
          <span>{user?.initials}</span>
          <div>
            <strong>{user?.name}</strong>
            <small>Student</small>
          </div>
          <button onClick={signOut} aria-label="Log out">
            <LogOut />
          </button>
        </div>
      </aside>
      {menuOpen && (<button className="sidebar-scrim" aria-label="Close navigation" onClick={close}/>)}
      <div className="student-main">
        <header className="student-topbar">
          <button ref={triggerRef} className="student-menu" onClick={() => setMenuOpen(true)} aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="student-navigation">
            <Menu />
          </button>
          <div className="student-topbar__brand">
            <BusFront /> Smart<span>Transit</span>
          </div>
          <div className="student-topbar__actions">
            <span className="sync-status">
              <i /> {sessionError ? 'Reconnecting' : 'Auto refresh'}
            </span>
            <NavLink to="/student/alerts" aria-label="Notifications">
              <Bell />
              {unreadCount > 0 && <i />}
            </NavLink>
            <NavLink to="/student/profile" className="student-avatar" aria-label="Profile">
              {user?.initials}
            </NavLink>
          </div>
        </header>
        <main className="student-content">
          <Outlet />
        </main>
      </div>
      <nav className="student-bottom-nav" aria-label="Mobile student navigation">
        {mainLinks.map(({ to, end, icon: Icon, label }) => (<NavLink key={to} to={to} end={end}>
            <span>
              <Icon />
              {label === "Alerts" && unreadCount > 0 && <i>{unreadCount}</i>}
            </span>
            <small>{label}</small>
          </NavLink>))}
      </nav>
    </div>);
}
