import { AlertTriangle, ArrowRight, BusFront, Clock3, MapPin, Navigation, PhoneCall, Route, ShieldAlert, Users, } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useCommunications } from "../../communications/CommunicationsContext";
import { AssignmentPendingState, BusOverviewCard, ErrorState, LoadingCards, NotificationCard, PageHeading, } from "../../components/student/StudentUI";
import { useStudentData } from "../../hooks/useStudentData";
import { currentDisplayDate } from "../../utils/dateLabels";
export function StudentDashboardPage() {
    const { user } = useAuth();
    const { notifications } = useCommunications();
    const { data, loading, error, retry } = useStudentData({ pollIntervalMs: 30000 });
    if (loading)
        return (<>
        <PageHeading title={`Good morning, ${user?.name.split(" ")[0] ?? "Student"}`} description="Here’s your commute at a glance."/>
        <LoadingCards count={4}/>
      </>);
    if (error || !data)
        return <ErrorState message={error} retry={retry}/>;
    const assignmentPending = data.assignmentStatus === "unassigned" || !data.route?.code || !data.route?.stops?.length;
    if (assignmentPending)
        return (<div className="student-dashboard">
      <PageHeading eyebrow={currentDisplayDate()} title={`Good morning, ${user?.name.split(" ")[0] ?? "Student"}`} description="Your student account is waiting for admin approval and route assignment."/>
      <AssignmentPendingState status={data.approvalStatus} action={<Link className="button button--secondary" to="/student/help">
            Contact transport support <ArrowRight />
          </Link>}/>
    </div>);
    const tripActive = data.bus.tripActive === true;
    const selectedStop = data.route.stops.find((stop) => stop.id === data.route.selectedStopId) ?? data.route.stops[0];
    const currentStop = tripActive
        ? data.route.stops.find((stop) => stop.id === data.route.currentStopId) ??
            data.route.stops.find((stop) => stop.status === "current") ??
            selectedStop
        : selectedStop;
    const selectedStopIndex = Math.max(0, data.route.stops.findIndex((stop) => stop.id === selectedStop.id));
    const currentStopIndex = Math.max(0, data.route.stops.findIndex((stop) => stop.id === currentStop.id));
    const compactAnchorIndex = tripActive ? currentStopIndex : selectedStopIndex;
    const compactStart = Math.max(0, Math.min(compactAnchorIndex - 1, Math.max(0, data.route.stops.length - 4)));
    const compactStops = data.route.stops.slice(compactStart, compactStart + 4);
    const selectedStopEta = tripActive
        ? selectedStop.status === "completed" ? "Departed" : selectedStop.eta ?? "—"
        : selectedStop.scheduledTime ?? "Not started";
    const busPassedPickup = tripActive && selectedStop.status === "completed";
    const displayStopStatus = (stop) => tripActive ? stop.status : stop.id === selectedStop.id ? "current" : "upcoming";
    return (<div className="student-dashboard">
      <PageHeading eyebrow={currentDisplayDate()} title={`Good morning, ${user?.name.split(" ")[0]} 👋`} description={tripActive ? busPassedPickup ? "Your bus has passed your pickup stop and is continuing toward campus." : "Your bus is active and moving toward your stop." : "Your route is assigned. Live tracking starts when the driver begins the trip."} action={<Link className="button button--primary desktop-action" to="/student/track">
            <Navigation /> {tripActive ? "Track live" : "View tracking"}
          </Link>}/>
      <div className="dashboard-grid">
        <div className="dashboard-primary">
          <BusOverviewCard bus={data.bus} routeName={`${data.route.code} · ${data.route.name}`} stopName={selectedStop.name} eta={selectedStopEta} tripActive={tripActive}/>
          <section className="progress-card">
            <div className="card-title">
              <div>
                <span className="app-icon app-icon--small">
                  <Route />
                </span>
                <span>
                  <small>{tripActive ? "Trip progress" : "Scheduled pickup"}</small>
                  <h2>{tripActive ? `Next stop: ${currentStop.name}` : `Your stop: ${selectedStop.name}`}</h2>
                </span>
              </div>
              <Link to="/student/routes">
                Full route <ArrowRight />
              </Link>
            </div>
            <div className="compact-route">
              <div className="compact-route__line"/>
              {compactStops.map((stop) => {
                const stopStatus = displayStopStatus(stop);
                return (<div key={stop.id} className={`compact-route__stop compact-route__stop--${stopStatus}`}>
                  <span>{tripActive && stopStatus === "completed" ? "✓" : ""}</span>
                  <small>{stop.name}</small>
                  <time>{tripActive ? stop.eta ?? stop.scheduledTime : stop.scheduledTime}</time>
                </div>);
            })}
            </div>
          </section>
          <section className="recent-card">
            <div className="section-title-row">
              <div>
                <h2>Recent notifications</h2>
                <p>Updates about your assigned service</p>
              </div>
              <Link to="/student/alerts">
                View all <ArrowRight />
              </Link>
            </div>
            <div className="notification-list notification-list--compact">
              {notifications.slice(0, 2).map((notification) => (<NotificationCard key={notification.id} notification={notification}/>))}
            </div>
          </section>
        </div>
        <aside className="dashboard-side">
          <section className="quick-info-card">
            <h2>Today’s trip</h2>
            <div>
              <MapPin />
              <span>
                <small>Your stop</small>
                <strong>{selectedStop.name}</strong>
              </span>
            </div>
            <div>
              <Clock3 />
              <span>
                <small>Scheduled pickup</small>
                <strong>{selectedStop.scheduledTime}</strong>
              </span>
            </div>
            <div>
              <BusFront />
              <span>
                <small>Bus number</small>
                <strong>{data.bus.number}</strong>
              </span>
            </div>
            <div>
              <Users />
              <span>
                <small>Capacity</small>
                <strong>{data.bus.capacity} seats</strong>
              </span>
            </div>
          </section>
          <section className="traffic-note">
            <AlertTriangle />
            <div>
              <strong>{tripActive ? "Traffic update" : "Trip status"}</strong>
              <p>
                {tripActive
            ? busPassedPickup ? `Bus has passed your pickup stop and is now near ${currentStop.name}.` : `Moderate traffic near ${currentStop.name}. ETA already includes the delay.`
            : "Driver phone GPS will become visible here after the trip is started."}
              </p>
            </div>
          </section>
          <Link className="emergency-card" to="/student/help">
            <span>
              <ShieldAlert />
            </span>
            <div>
              <small>Need urgent help?</small>
              <strong>Emergency assistance</strong>
              <p>Contact campus security or transport support.</p>
            </div>
            <PhoneCall />
          </Link>
        </aside>
      </div>
      <Link className="mobile-track-fab" to="/student/track">
        <Navigation /> {tripActive ? "Track bus live" : "View tracking"}
      </Link>
    </div>);
}
