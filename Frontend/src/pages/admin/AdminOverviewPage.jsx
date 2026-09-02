import { AlertTriangle, ArrowRight, BusFront, Clock3, FileWarning, MapPin, Radio, Users, } from "lucide-react";
import { MapContainer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Link } from "react-router-dom";
import { useAdminData } from "../../admin/AdminDataContext";
import { AdminPageHeading, AdminStatusBadge, } from "../../components/admin/AdminUI";
import { CampusMapMarker, MapFitBounds, SmartTileLayer } from "../../components/maps/SmartTransitMap";
import { useCommunications } from "../../communications/CommunicationsContext";
import { INDUS_CAMPUS, indusRoutes } from "../../services/indusRoutes";
import { formatTime, minutesAgo, relativeTimeLabel } from "../../utils/dateLabels";
const fleetIcon = (status) => L.divIcon({
    className: `admin-fleet-marker admin-fleet-marker--${status}`,
    html: "<span>▣</span>",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
});
export function AdminOverviewPage() {
    const { complaints } = useCommunications();
    const { fleet, activity, records } = useAdminData();
    const openComplaints = complaints.filter((item) => item.status !== "resolved");
    const activeFleet = fleet.filter((item) => item.tripActive);
    const occupancy = activeFleet.map((item) => Math.round((item.occupancy / item.capacity) * 100));
    const averageOccupancy = occupancy.length
        ? Math.round(occupancy.reduce((sum, value) => sum + value, 0) / occupancy.length)
        : 0;
    const studentRecords = records.students ?? [];
    const totalStudentCount = studentRecords.length;
    const activeStudentCount = studentRecords.filter((item) => item.status === "active").length;
    const pendingStudentCount = studentRecords.filter((item) => item.status === "pending").length;
    const routeName = (code) => indusRoutes.find((route) => route.code === code)?.name ?? code;
    const delayedBus = fleet.find((item) => item.status === "delayed");
    const staleBus = fleet.find((item) => item.status === "stale-gps");
    const stoppedBus = fleet.find((item) => item.status === "stopped");
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const lastChangedAt = formatTime(minutesAgo(35));
    return (<div>
      <AdminPageHeading eyebrow="Operations command center" title={`${greeting}, Admin Operator`} description="Here’s what’s happening across Indus University transport today." actions={<span className="admin-last-updated">
            <Radio /> Updated {relativeTimeLabel(new Date().toISOString())}
          </span>}/>
      <section className="admin-kpi-grid">
        <article>
          <span className="admin-kpi-icon admin-kpi-icon--green">
            <Radio />
          </span>
          <div>
            <small>Active trips</small>
            <strong>{activeFleet.length}</strong>
            <em>All live</em>
          </div>
        </article>
        <article>
          <span className="admin-kpi-icon">
            <BusFront />
          </span>
          <div>
            <small>Total buses</small>
            <strong>{fleet.length}</strong>
            <em>{fleet.filter((item) => item.status !== "stopped").length} available</em>
          </div>
        </article>
        <article>
          <span className="admin-kpi-icon admin-kpi-icon--gold">
            <Users />
          </span>
          <div>
            <small>Total students</small>
            <strong>{totalStudentCount}</strong>
            <em>{pendingStudentCount ? `${pendingStudentCount} pending approval` : `${activeStudentCount} active`}</em>
          </div>
        </article>
        <article>
          <span className="admin-kpi-icon admin-kpi-icon--red">
            <FileWarning />
          </span>
          <div>
            <small>Open complaints</small>
            <strong>{openComplaints.length}</strong>
            <em>
              {openComplaints.filter((item) => item.status === "new").length}{" "}
              need attention
            </em>
          </div>
        </article>
      </section>
      <div className="admin-overview-grid">
        <section className="admin-panel admin-fleet-map-panel">
          <div className="admin-panel-title">
            <div>
              <h2>Live fleet map</h2>
              <p>{activeFleet.length} buses visible across active routes</p>
            </div>
            <Link to="/admin/live">
              Open live operations <ArrowRight />
            </Link>
          </div>
          <MapContainer center={indusRoutes[3].mapCenter} zoom={11} scrollWheelZoom={false} className="admin-overview-map">
            <MapFitBounds points={[INDUS_CAMPUS.coordinates, ...activeFleet.map((bus) => bus.coordinates)]} trigger={activeFleet.map((bus) => `${bus.id}-${bus.lastLocationAt ?? bus.gpsUpdatedAt ?? ""}`).join("|")}/>
            <SmartTileLayer />
            <CampusMapMarker position={INDUS_CAMPUS.coordinates} address={INDUS_CAMPUS.address}/>
            {activeFleet.map((bus) => (<Marker key={bus.id} position={bus.coordinates} icon={fleetIcon(bus.status)}>
                <Popup>
                  {bus.number} · {bus.route}
                  <br />
                  {bus.status.replace("-", " ")}
                </Popup>
              </Marker>))}
          </MapContainer>
          <div className="admin-map-legend">
            <span>
              <i className="on-trip"/> On trip
            </span>
            <span>
              <i className="delayed"/> Delayed
            </span>
            <span>
              <i className="stale"/> Stale GPS
            </span>
          </div>
        </section>
        <section className="admin-panel admin-delay-panel">
          <div className="admin-panel-title">
            <div>
              <h2>Delay alerts</h2>
              <p>Services needing attention</p>
            </div>
            <Link to="/admin/live">View all</Link>
          </div>
          {delayedBus && <article>
            <span className="admin-alert-symbol">
              <AlertTriangle />
            </span>
            <div>
              <strong>{delayedBus.number} · Route {delayedBus.route}</strong>
              <p>{routeName(delayedBus.route)}</p>
              <small>Expected delay: {delayedBus.eta}</small>
            </div>
            <AdminStatusBadge status="delayed"/>
          </article>}
          {staleBus && <article>
            <span className="admin-alert-symbol admin-alert-symbol--muted">
              <Clock3 />
            </span>
            <div>
              <strong>{staleBus.number} · Route {staleBus.route}</strong>
              <p>No GPS update for {staleBus.gpsUpdated}</p>
              <small>Driver: {staleBus.driver}</small>
            </div>
            <AdminStatusBadge status="stale-gps"/>
          </article>}
          {stoppedBus && <article>
            <span className="admin-alert-symbol admin-alert-symbol--gold">
              <MapPin />
            </span>
            <div>
              <strong>Route {stoppedBus.route}</strong>
              <p>Scheduled service inactive today</p>
              <small>Last changed {lastChangedAt}</small>
            </div>
            <AdminStatusBadge status="stopped"/>
          </article>}
        </section>
        <section className="admin-panel admin-occupancy-panel">
          <div className="admin-panel-title">
            <div>
              <h2>Seat occupancy</h2>
              <p>Live average across active trips</p>
            </div>
          </div>
          <div className="occupancy-summary">
            <div className="occupancy-ring" style={{ "--occupancy": `${averageOccupancy}%` }}>
              <span>
                <strong>{averageOccupancy}%</strong>
                <small>Average</small>
              </span>
            </div>
            <ul>
              <li>
                <i className="low"/>
                <span>Below 50%</span>
                <strong>
                  {occupancy.filter((value) => value < 50).length} bus
                </strong>
              </li>
              <li>
                <i className="medium"/>
                <span>50–75%</span>
                <strong>
                  {occupancy.filter((value) => value >= 50 && value <= 75)
            .length}{" "}
                  bus
                </strong>
              </li>
              <li>
                <i className="high"/>
                <span>Above 75%</span>
                <strong>
                  {occupancy.filter((value) => value > 75).length} buses
                </strong>
              </li>
            </ul>
          </div>
        </section>
        <section className="admin-panel admin-activity-panel">
          <div className="admin-panel-title">
            <div>
              <h2>Recent activity</h2>
              <p>Latest verified system events</p>
            </div>
          </div>
          <div className="admin-activity-list">
            {activity.map((item, index) => (<div key={item}>
                <span>{index + 1}</span>
                <p>{item}</p>
                <time>{relativeTimeLabel(minutesAgo(index * 4 + 2))}</time>
              </div>))}
          </div>
        </section>
      </div>
    </div>);
}
