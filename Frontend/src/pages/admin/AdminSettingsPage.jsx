import { Bell, BookOpenCheck, Clock3, ExternalLink, FileClock, LockKeyhole, Save, Search, ShieldCheck, Users, } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminFeedback, AdminPageHeading, } from "../../components/admin/AdminUI";
import { useSystemSettings } from "../../settings/SystemSettingsContext";
const tabs = [
    { value: "general", label: "System settings" },
    { value: "permissions", label: "Roles & permissions" },
    { value: "privacy", label: "Privacy" },
    { value: "audit", label: "Audit log" },
];
const roles = [
    {
        key: "admin",
        label: "Admin / Operator",
        detail: "Transport operations and configuration",
    },
    {
        key: "driver",
        label: "Driver",
        detail: "Assigned trips and active-trip GPS sharing",
    },
    {
        key: "conductor",
        label: "Conductor",
        detail: "Stop progress and verified seat updates",
    },
    {
        key: "student",
        label: "Student",
        detail: "Assigned commute information only",
    },
];
const permissions = [
    { key: "viewTracking", label: "View tracking" },
    { key: "manageTrips", label: "Manage trips" },
    { key: "updateSeats", label: "Update seats" },
    { key: "manageCommunications", label: "Notifications & complaints" },
    { key: "manageSystem", label: "System settings" },
];
const lockedPermission = (role, permission) => (role === "admin" && permission === "manageSystem") ||
    (role === "driver" && permission === "updateSeats") ||
    (role === "student" && permission === "manageSystem");
export function AdminSettingsPage() {
    const { settings, permissions: storedPermissions, auditLog, saveSettings, } = useSystemSettings();
    const [tab, setTab] = useState("general");
    const [draft, setDraft] = useState({ ...settings });
    const [rolePermissions, setRolePermissions] = useState(() => structuredClone(storedPermissions));
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [auditSearch, setAuditSearch] = useState("");
    const [auditCategory, setAuditCategory] = useState("all");
    const filteredAudit = useMemo(() => {
        const query = auditSearch.trim().toLowerCase();
        return auditLog.filter((event) => (auditCategory === "all" || event.category === auditCategory) &&
            (!query ||
                `${event.actor} ${event.action} ${event.id}`
                    .toLowerCase()
                    .includes(query)));
    }, [auditCategory, auditLog, auditSearch]);
    const updateSetting = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
    const togglePermission = (role, permission) => {
        if (lockedPermission(role, permission))
            return;
        setRolePermissions((current) => ({
            ...current,
            [role]: { ...current[role], [permission]: !current[role][permission] },
        }));
    };
    const handleSave = async () => {
        if (draft.staleGpsMinutes * 60 <= draft.gpsUpdateSeconds) {
            setFeedback({
                type: "error",
                title: "Check GPS thresholds",
                message: "The stale-GPS threshold must be longer than the GPS update interval.",
            });
            return;
        }
        setSaving(true);
        setFeedback(null);
        try {
            await saveSettings(draft, rolePermissions);
            setFeedback({
                type: "success",
                title: "Settings saved",
                message: "GPS, notifications and role permissions were updated. An audit entry was created.",
            });
        }
        catch {
            setFeedback({
                type: "error",
                title: "Save failed",
                message: "The settings service is unavailable. No changes were applied.",
            });
        }
        finally {
            setSaving(false);
        }
    };
    return (<div>
      <AdminPageHeading eyebrow="System administration" title="Settings, access & audit" description="Control tracking freshness, alerts, permissions and privacy safeguards." actions={(tab === "general" || tab === "permissions") && (<button className="button admin-primary-button" disabled={saving} onClick={handleSave}>
              <Save /> {saving ? "Saving…" : "Save changes"}
            </button>)}/>
      {feedback && (<AdminFeedback {...feedback} dismiss={() => setFeedback(null)}/>)}

      <nav className="settings-tabs" aria-label="Settings sections">
        {tabs.map((item) => (<button key={item.value} aria-pressed={tab === item.value} onClick={() => setTab(item.value)}>
            {item.label}
          </button>))}
      </nav>

      {tab === "general" && (<div className="settings-admin-grid">
          <section className="admin-panel settings-card">
            <div className="admin-panel-title">
              <div>
                <h2>GPS & tracking</h2>
                <p>Live-operation freshness rules</p>
              </div>
              <Clock3 />
            </div>
            <label className="admin-form-field" htmlFor="gps-interval">
              <span>GPS update interval</span>
              <select id="gps-interval" value={draft.gpsUpdateSeconds} onChange={(event) => updateSetting("gpsUpdateSeconds", Number(event.target.value))}>
                <option value={15}>15 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={60}>60 seconds</option>
              </select>
              <small>How often an active driver device submits location.</small>
            </label>
            <label className="admin-form-field" htmlFor="stale-threshold">
              <span>Stale GPS threshold</span>
              <select id="stale-threshold" value={draft.staleGpsMinutes} onChange={(event) => updateSetting("staleGpsMinutes", Number(event.target.value))}>
                <option value={3}>3 minutes</option>
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
              </select>
              <small>
                When operators and students see a stale-location warning.
              </small>
            </label>
            <SettingToggle label="Show stale-GPS warnings" detail="Warn authorized users when a live location is delayed" checked={draft.showStaleWarnings} onChange={(value) => updateSetting("showStaleWarnings", value)}/>
          </section>

          <section className="admin-panel settings-card">
            <div className="admin-panel-title">
              <div>
                <h2>Notification settings</h2>
                <p>Operator alert preferences</p>
              </div>
              <Bell />
            </div>
            <SettingToggle label="Email critical alerts" detail="Emergency and cancellation events" checked={draft.emailCriticalAlerts} onChange={(value) => updateSetting("emailCriticalAlerts", value)}/>
            <SettingToggle label="Push service alerts" detail="Delay, route change and stale-GPS events" checked={draft.pushServiceAlerts} onChange={(value) => updateSetting("pushServiceAlerts", value)}/>
            <SettingToggle label="Daily operations summary" detail="Performance digest at 7:00 PM" checked={draft.dailySummary} onChange={(value) => updateSetting("dailySummary", value)}/>
          </section>

          <section className="admin-panel settings-help-card">
            <BookOpenCheck />
            <div>
              <h2>Application states</h2>
              <p>
                Review the standardized loading, offline, error and trip-status
                components used throughout SmartTransit.
              </p>
              <Link className="button button--secondary" to="/admin/settings/states">
                Open state library <ExternalLink />
              </Link>
            </div>
          </section>
          <section className="admin-panel settings-help-card settings-help-card--privacy">
            <ShieldCheck />
            <div>
              <h2>Active-trip privacy</h2>
              <p>
                Driver location is shared only after a trip starts and stops
                immediately when it ends or is cancelled.
              </p>
              <button onClick={() => setTab("privacy")}>
                Review privacy controls
              </button>
            </div>
          </section>
        </div>)}

      {tab === "permissions" && (<section className="admin-table-card permission-card">
          <header>
            <div>
              <h2>Role permission matrix</h2>
              <p>
                Changes apply to future protected-route and service
                authorization.
              </p>
            </div>
            <Users />
          </header>
          <div className="permission-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  {permissions.map((permission) => (<th key={permission.key}>{permission.label}</th>))}
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (<tr key={role.key}>
                    <td>
                      <strong>{role.label}</strong>
                      <small>{role.detail}</small>
                    </td>
                    {permissions.map((permission) => {
                    const locked = lockedPermission(role.key, permission.key);
                    return (<td key={permission.key}>
                          <label className="permission-checkbox" title={locked
                            ? "This permission is fixed by a safety rule"
                            : undefined}>
                            <input type="checkbox" checked={rolePermissions[role.key][permission.key]} disabled={locked} onChange={() => togglePermission(role.key, permission.key)} aria-label={`${role.label}: ${permission.label}`}/>
                            <span>
                              {rolePermissions[role.key][permission.key]
                            ? "Allowed"
                            : "Denied"}
                            </span>
                            {locked && <LockKeyhole aria-label="Safety rule"/>}
                          </label>
                        </td>);
                })}
                  </tr>))}
              </tbody>
            </table>
          </div>
          <footer>
            <ShieldCheck />
            <span>
              Drivers can never receive seat-count controls. Administrative
              settings remain restricted to operators.
            </span>
          </footer>
        </section>)}

      {tab === "privacy" && (<div className="privacy-settings-grid">
          <section className="admin-panel privacy-principle-card">
            <ShieldCheck />
            <div>
              <span>Location minimization</span>
              <h2>Driver location is visible only during an active trip.</h2>
              <p>
                SmartTransit does not expose a driver’s position before the
                operator-approved start confirmation, after trip completion, or
                after cancellation.
              </p>
            </div>
          </section>
          <section className="admin-panel privacy-rule-list">
            <h2>Who can see live location?</h2>
            <ul>
              <li>
                <strong>Assigned students</strong>
                <span>Only the bus and route relevant to their commute.</span>
              </li>
              <li>
                <strong>Transport operators</strong>
                <span>Active fleet operations and emergency response.</span>
              </li>
              <li>
                <strong>Drivers</strong>
                <span>Their own sharing state, accuracy and last update.</span>
              </li>
            </ul>
          </section>
          <section className="admin-panel privacy-rule-list">
            <h2>Operational safeguards</h2>
            <ul>
              <li>
                <strong>Trip-bound sharing</strong>
                <span>
                  GPS appears active only while trip status is active.
                </span>
              </li>
              <li>
                <strong>Freshness warnings</strong>
                <span>
                  Stale GPS is visibly labelled; it is never presented as
                  current.
                </span>
              </li>
              <li>
                <strong>Auditability</strong>
                <span>
                  Settings and operator actions create timestamped audit
                  records.
                </span>
              </li>
            </ul>
          </section>
          <section className="admin-panel privacy-policy-link">
            <LockKeyhole />
            <div>
              <h2>Privacy information</h2>
              <p>
                Review the student- and staff-facing summary of how transport
                data is used.
              </p>
              <Link to="/privacy">
                View full privacy information <ExternalLink />
              </Link>
            </div>
          </section>
        </div>)}

      {tab === "audit" && (<section className="admin-table-card audit-card audit-card--expanded">
          <header>
            <div>
              <h2>Audit log</h2>
              <p>Administrative, safety and system events</p>
            </div>
            <FileClock />
          </header>
          <div className="audit-filter-bar">
            <label>
              <Search />
              <input value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} placeholder="Search actor, action or ID" aria-label="Search audit log"/>
            </label>
            <select value={auditCategory} onChange={(event) => setAuditCategory(event.target.value)} aria-label="Audit category">
              <option value="all">All categories</option>
              <option value="settings">Settings</option>
              <option value="assignment">Assignments</option>
              <option value="complaint">Complaints</option>
              <option value="tracking">Tracking</option>
              <option value="seats">Seat updates</option>
            </select>
          </div>
          {filteredAudit.length ? (<div className="audit-list">
              {filteredAudit.map((event) => (<article key={event.id}>
                  <time>{event.timestamp}</time>
                  <span className={`audit-category audit-category--${event.category}`}>
                    {event.category}
                  </span>
                  <strong>{event.actor}</strong>
                  <span>{event.action}</span>
                  <small>{event.id}</small>
                </article>))}
            </div>) : (<div className="report-table-empty">
              <Search />
              <span>No audit events match the current filters.</span>
            </div>)}
        </section>)}
    </div>);
}
function SettingToggle({ label, detail, checked, onChange, }) {
    return (<label className="admin-toggle">
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/>
      <i />
    </label>);
}
