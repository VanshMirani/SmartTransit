import { AlertTriangle, BusFront, Clock3, Gauge, MapPin, Radio, Route, Search, Users, } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, } from "react-leaflet";
import L from "leaflet";
import { useAdminData } from "../../admin/AdminDataContext";
import { AdminModal, AdminPageHeading, AdminStatusBadge, } from "../../components/admin/AdminUI";
import { indusRoutes } from "../../services/indusRoutes";
const liveIcon = (status, selected) => L.divIcon({
    className: `admin-live-marker admin-live-marker--${status} ${selected ? "admin-live-marker--selected" : ""}`,
    html: "<span>BUS</span>",
    iconSize: selected ? [46, 46] : [38, 38],
    iconAnchor: selected ? [23, 23] : [19, 19],
});
export function AdminLiveOperationsPage() {
    const { fleet, routes, refreshData } = useAdminData();
    const [selectedId, setSelectedId] = useState("");
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("all");
    const [showEmergency, setShowEmergency] = useState(false);
    const visible = useMemo(() => fleet.filter((bus) => (status === "all" || bus.status === status) &&
        `${bus.number} ${bus.driver} ${bus.route}`
            .toLowerCase()
            .includes(query.toLowerCase())), [fleet, query, status]);
    const selected = fleet.find((bus) => bus.id === selectedId) ??
        visible[0] ??
        fleet[0];
    const fallbackRoute = routes[0] ?? indusRoutes[0];
    const route = routes.find((item) => item.code === selected?.route) ??
        fallbackRoute;
    const mapRoute = indusRoutes.find((item) => item.code === route.code) ?? indusRoutes[0];
    const emergencyBus = fleet.find((bus) => bus.status === "stale-gps") ?? fleet[0];
    const emergencyRoute = routes.find((item) => item.code === emergencyBus?.route) ?? fallbackRoute;
    const emergencyLocation = emergencyRoute?.stops?.at(-2)?.name ?? emergencyRoute?.startPoint ?? "the assigned route";
    useEffect(() => {
        refreshData?.();
        const timer = window.setInterval(() => refreshData?.(), 15000);
        return () => window.clearInterval(timer);
    }, [refreshData]);
    if (!selected) {
        return (<div>
      <AdminPageHeading eyebrow="Real-time monitoring" title="Live operations" description="Monitor active buses, service health and emergencies from one view." actions={<span className="admin-last-updated">
            <Radio /> Waiting for fleet data
          </span>}/>
      <div className="admin-empty">
        <BusFront />
        <strong>No fleet data available</strong>
        <p>Start the backend or add buses to see live operations.</p>
      </div>
    </div>);
    }
    return (<div>
      <AdminPageHeading eyebrow="Real-time monitoring" title="Live operations" description="Monitor active buses, service health and emergencies from one view." actions={<span className="admin-last-updated">
            <Radio /> GPS feed live
          </span>}/>
      {emergencyBus && <div className="admin-emergency-banner">
        <AlertTriangle />
        <div>
          <strong>Emergency alert: Medical assistance requested</strong>
          <span>
            Bus {emergencyBus.number} · Route {emergencyBus.route} · Near {emergencyLocation} · Submitted 2 min ago
          </span>
        </div>
        <button onClick={() => setShowEmergency(true)}>View alert</button>
      </div>}
      <div className="live-operations-layout">
        <aside className="live-fleet-list">
          <div className="live-list-filters">
            <label>
              <Search />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search fleet…" aria-label="Search live fleet"/>
            </label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter live fleet status">
              <option value="all">All statuses</option>
              <option value="on-trip">On trip</option>
              <option value="delayed">Delayed</option>
              <option value="stopped">Stopped</option>
              <option value="stale-gps">Stale GPS</option>
            </select>
          </div>
          <div className="live-fleet-scroll">
            {visible.map((bus) => (<button key={bus.id} className={selected.id === bus.id ? "active" : ""} onClick={() => setSelectedId(bus.id)}>
                <span className="live-bus-icon">
                  <BusFront />
                </span>
                <span>
                  <strong>{bus.number}</strong>
                  <small>
                    {bus.route} · {bus.driver}
                  </small>
                  <em>
                    {bus.tripActive
                ? `${bus.speed} km/h · GPS ${bus.gpsUpdated}`
                : "Driver location not shared"}
                  </em>
                </span>
                <AdminStatusBadge status={bus.status}/>
              </button>))}
          </div>
          {!visible.length && (<div className="admin-empty">
              <Search />
              <strong>No fleet matches</strong>
              <p>Adjust search or status filters.</p>
            </div>)}
        </aside>
        <section className="live-map-workspace">
          <MapContainer center={mapRoute.mapCenter} zoom={11} scrollWheelZoom={false} className="admin-live-map">
            <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
            <Polyline positions={route.stops.map((stop) => stop.coordinates)} pathOptions={{ color: "#0b948f", weight: 5 }}/>
            {fleet
            .filter((bus) => bus.tripActive)
            .map((bus) => (<Marker key={bus.id} position={bus.coordinates} icon={liveIcon(bus.status, bus.id === selected.id)} eventHandlers={{ click: () => setSelectedId(bus.id) }}>
                  <Popup>
                    {bus.number} · {bus.route}
                  </Popup>
                </Marker>))}
          </MapContainer>
          <div className="live-map-updated">
            <i /> Last fleet update: {selected.gpsUpdatedAt ?? selected.gpsUpdated ?? "just now"}
          </div>
        </section>
        <aside className="live-bus-detail">
          <div className="live-bus-detail__head">
            <span className="admin-kpi-icon">
              <BusFront />
            </span>
            <div>
              <small>Selected bus</small>
              <h2>{selected.number}</h2>
              <p>{selected.route} · {selected.driver}</p>
            </div>
            <AdminStatusBadge status={selected.status}/>
          </div>
          <div className="live-detail-grid">
            <div>
              <Gauge />
              <span>
                <small>Speed</small>
                <strong>
                  {selected.tripActive ? `${selected.speed} km/h` : "—"}
                </strong>
              </span>
            </div>
            <div>
              <Clock3 />
              <span>
                <small>ETA</small>
                <strong>{selected.tripActive ? selected.eta : "—"}</strong>
              </span>
            </div>
            <div>
              <Users />
              <span>
                <small>Occupancy</small>
                <strong>
                  {selected.occupancy} / {selected.capacity}
                </strong>
              </span>
            </div>
            <div>
              <Radio />
              <span>
                <small>GPS update</small>
                <strong>
                  {selected.tripActive ? selected.gpsUpdated : "Not sharing"}
                </strong>
              </span>
            </div>
          </div>
          {!selected.tripActive && (<p className="live-location-private">
              <Radio /> Driver location is hidden because no trip is active.
            </p>)}
          <div className="live-detail-route">
            <Route />
            <span>
              <small>
                {selected.tripActive ? "Active route" : "Assigned route"}
              </small>
              <strong>{route.name}</strong>
            </span>
          </div>
          <div className="live-detail-route">
            <MapPin />
            <span>
              <small>Next stop</small>
              <strong>
                {selected.tripActive
            ? (route.stops[1]?.name ?? route.destination)
            : "Trip not started"}
              </strong>
            </span>
          </div>
        </aside>
      </div>
      {showEmergency && emergencyBus && (<AdminModal title="Medical assistance requested" description="Emergency EMG-2026-118 · Submitted 2 minutes ago" close={() => setShowEmergency(false)} footer={<button className="button admin-primary-button" onClick={() => setShowEmergency(false)}>
              Acknowledge alert
            </button>}>
          <dl className="admin-detail-list">
            <div>
              <dt>Bus and route</dt>
              <dd>{emergencyBus.number} · {emergencyBus.route}</dd>
            </div>
            <div>
              <dt>Submitted by</dt>
              <dd>Driver {emergencyBus.driver}</dd>
            </div>
            <div>
              <dt>Current location</dt>
              <dd>Near {emergencyLocation}, Ahmedabad</dd>
            </div>
            <div>
              <dt>Details</dt>
              <dd>
                A student requires medical assistance. The bus is stopped
                safely.
              </dd>
            </div>
          </dl>
        </AdminModal>)}
    </div>);
}
