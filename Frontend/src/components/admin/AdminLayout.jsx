import { AlertTriangle, Bell, BusFront, ChevronDown, ClipboardList, FileBarChart, Gauge, LayoutDashboard, LogOut, MapPinned, Menu, Route, Search, Settings, Users, X, } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useCommunications } from "../../communications/CommunicationsContext";
const links = [
    { to: "/admin", end: true, icon: LayoutDashboard, label: "Overview" },
    { to: "/admin/live", end: false, icon: Gauge, label: "Live operations" },
    { to: "/admin/buses", end: false, icon: BusFront, label: "Buses" },
    { to: "/admin/routes", end: false, icon: Route, label: "Routes" },
    { to: "/admin/stops", end: false, icon: MapPinned, label: "Stops" },
    { to: "/admin/drivers", end: false, icon: Users, label: "Drivers" },
    { to: "/admin/conductors", end: false, icon: Users, label: "Conductors" },
    { to: "/admin/students", end: false, icon: Users, label: "Students" },
    {
        to: "/admin/assignments",
        end: false,
        icon: ClipboardList,
        label: "Assignments",
    },
    {
        to: "/admin/notifications",
        end: false,
        icon: Bell,
        label: "Notifications",
    },
    {
        to: "/admin/complaints",
        end: false,
        icon: AlertTriangle,
        label: "Complaints",
    },
    { to: "/admin/reports", end: false, icon: FileBarChart, label: "Reports" },
    { to: "/admin/settings", end: false, icon: Settings, label: "Settings" },
];
export function AdminLayout() {
    const [open, setOpen] = useState(false);
    const [globalQuery, setGlobalQuery] = useState("");
    const { user, logout } = useAuth();
    const { campaigns, complaints } = useCommunications();
    const scheduledCount = campaigns.filter((item) => item.status === "scheduled").length;
    const openComplaintCount = complaints.filter((item) => item.status !== "resolved").length;
    const navigate = useNavigate();
    const submitGlobalSearch = (event) => {
        event.preventDefault();
        const query = globalQuery.trim();
        if (!query)
            return;
        navigate(`/admin/search?q=${encodeURIComponent(query)}`);
    };
    return (<div className="admin-app">
      <aside className={`admin-sidebar ${open ? "admin-sidebar--open" : ""}`}>
        <div className="admin-sidebar__brand">
          <BusFront />
          <span>
            Smart<strong>Transit</strong>
          </span>
          <button onClick={() => setOpen(false)} aria-label="Close navigation">
            <X />
          </button>
        </div>
        <div className="admin-sidebar__role">Admin / Transport Operator</div>
        <nav aria-label="Admin navigation">
          {links.map(({ to, end, icon: Icon, label }) => {
            const badge = label === "Notifications"
                ? scheduledCount
                : label === "Complaints"
                    ? openComplaintCount
                    : 0;
            return (<NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}>
                <Icon />
                <span>{label}</span>
                {badge > 0 && <i>{badge}</i>}
              </NavLink>);
        })}
        </nav>
        <button className="admin-sidebar__logout" onClick={() => {
            logout();
            navigate("/login", { replace: true });
        }}>
          <LogOut /> Log out
        </button>
      </aside>
      {open && (<button className="admin-scrim" onClick={() => setOpen(false)} aria-label="Close navigation"/>)}
      <div className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu />
          </button>
          <form className="admin-global-search" onSubmit={submitGlobalSearch} role="search">
            <button type="submit" aria-label="Search admin records">
              <Search />
            </button>
            <input aria-label="Search SmartTransit admin" placeholder="Search buses, routes, people…" value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)}/>
          </form>
          <div className="admin-topbar__actions">
            <span className="admin-updated">
              <i /> Data live
            </span>
            <NavLink to="/admin/notifications" aria-label="Notifications">
              <Bell />
              <i />
            </NavLink>
            <NavLink className="admin-user" to="/admin/settings" aria-label="Open account and system settings">
              <span>{user?.initials}</span>
              <div>
                <strong>{user?.name}</strong>
                <small>Transport Admin</small>
              </div>
              <ChevronDown />
            </NavLink>
          </div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>);
}
