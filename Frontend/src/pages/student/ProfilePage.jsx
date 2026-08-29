import { Bell, BusFront, CheckCircle2, ChevronRight, LockKeyhole, Mail, MapPin, Moon, Phone, Save, ShieldCheck, UserRound, } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { ErrorState, LoadingCards, PageHeading } from "../../components/student/StudentUI";
import { useStudentData } from "../../hooks/useStudentData";
import { studentTransitData } from "../../services/mockData";
export function ProfilePage() {
    const { user } = useAuth();
    const { data, loading, error, retry } = useStudentData();
    const studentCode = user?.enrollment ?? user?.email?.split("@")[0]?.toUpperCase() ?? "Assigned by transport office";
    const phone = user?.phone ? `+91 ${user.phone}` : "+91 98765 43210";
    const [saved, setSaved] = useState(false);
    const [prefs, setPrefs] = useState({
        delay: true,
        route: true,
        general: true,
    });
    const save = (event) => {
        event.preventDefault();
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2500);
    };
    if (loading)
        return <><PageHeading title="Profile & preferences"/><LoadingCards count={2}/></>;
    if (error)
        return <ErrorState message={error} retry={retry}/>;
    const { bus, route } = data ?? studentTransitData;
    const assignmentPending = data?.assignmentStatus === "unassigned" || !route?.code || !route?.stops?.length;
    const selectedStop = assignmentPending ? null : route.stops.find((stop) => stop.id === route.selectedStopId) ?? route.stops[0];
    return (<div>
      <PageHeading eyebrow="Your account" title="Profile & preferences" description="Manage your personal details and commute notifications."/>
      {saved && (<div className="app-alert app-alert--success">
          <CheckCircle2 />
          <div>
            <strong>Preferences saved</strong>
            <span>Your notification choices have been updated.</span>
          </div>
        </div>)}
      <form className="profile-grid" onSubmit={save}>
        <div className="profile-primary">
          <section className="profile-card">
            <div className="profile-card__identity">
              <span>{user?.initials}</span>
              <div>
                <h2>{user?.name}</h2>
                <p>Student transport account</p>
                <small>Student code: {studentCode}</small>
              </div>
            </div>
            <div className="profile-details">
              <div>
                <UserRound />
                <span>
                  <small>Full name</small>
                  <strong>{user?.name}</strong>
                </span>
              </div>
              <div>
                <Mail />
                <span>
                  <small>University email</small>
                  <strong>{user?.email}</strong>
                </span>
              </div>
              <div>
                <Phone />
                <span>
                  <small>Phone number</small>
                  <strong>{phone}</strong>
                </span>
              </div>
            </div>
          </section>
          <section className="profile-card">
            <div className="section-title-row">
              <div>
                <h2>My commute</h2>
                <p>Your route assignment is managed by the transport office.</p>
              </div>
            </div>
            <div className="commute-row">
                <BusFront />
              <span>
                <small>Assigned bus</small>
                <strong>{assignmentPending ? "Pending assignment" : `${bus.registration} · ${bus.number}`}</strong>
              </span>
              <ChevronRight />
            </div>
            <div className="commute-row">
              <MapPin />
              <span>
                <small>Assigned route</small>
                <strong>{assignmentPending ? "Pending assignment" : `${route.code} · ${route.name}`}</strong>
              </span>
              <ChevronRight />
            </div>
            <div className="commute-row">
              <MapPin />
              <span>
                <small>Pickup stop</small>
                <strong>{assignmentPending ? "To be assigned by transport office" : `${selectedStop.name} · ${selectedStop.scheduledTime}`}</strong>
              </span>
              <ChevronRight />
            </div>
          </section>
        </div>
        <aside className="profile-side">
          <section className="profile-card">
            <div className="section-title-row">
              <div>
                <h2>Notifications</h2>
                <p>Choose which updates you receive.</p>
              </div>
              <Bell />
            </div>
            <Toggle label="Delay alerts" checked={prefs.delay} onChange={(checked) => setPrefs({ ...prefs, delay: checked })}/>
            <Toggle label="Route changes" checked={prefs.route} onChange={(checked) => setPrefs({ ...prefs, route: checked })}/>
            <Toggle label="General announcements" checked={prefs.general} onChange={(checked) => setPrefs({ ...prefs, general: checked })}/>
            <button className="button button--primary profile-save">
              <Save /> Save preferences
            </button>
          </section>
          <section className="profile-card profile-links">
            <Link to="/privacy">
              <LockKeyhole />
              <span>
                <strong>Privacy information</strong>
                <small>How location and account data are used</small>
              </span>
              <ChevronRight />
            </Link>
            <Link to="/forgot-password">
              <ShieldCheck />
              <span>
                <strong>Account security</strong>
                <small>Request a secure password reset</small>
              </span>
              <ChevronRight />
            </Link>
            <div>
              <Moon />
              <span>
                <strong>Appearance</strong>
                <small>Uses your device’s accessible display settings</small>
              </span>
            </div>
          </section>
          <p className="privacy-note">
            <ShieldCheck /> Driver location is visible only during an active
            trip.
          </p>
        </aside>
      </form>
    </div>);
}
function Toggle({ label, checked, onChange, }) {
    return (<label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/>
      <i />
    </label>);
}
