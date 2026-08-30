import { AlertTriangle, BusFront, Clock3, MapPin, Navigation, RefreshCw, Signal, SignalZero, WifiOff, } from "lucide-react";
import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AssignmentPendingState, ErrorState, LoadingCards, PageHeading, } from "../../components/student/StudentUI";
import { useStudentData } from "../../hooks/useStudentData";
const busIcon = L.divIcon({
    className: "smart-map-marker",
    html: "<span>BUS</span>",
    iconSize: [42, 42],
    iconAnchor: [21, 21],
});
const selectedIcon = L.divIcon({
    className: "student-stop-marker",
    html: "<span>●</span>",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
});
function trackingStateForBus(bus) {
    if (bus.gpsStatus === "not-sharing")
        return "no-trip";
    if (bus.gpsStatus === "stale" || bus.gpsStatus === "waiting")
        return "stale";
    return "live";
}
export function LiveTrackingPage() {
    const { data, loading, error, retry } = useStudentData({ pollIntervalMs: 15000 });
    const [previewState, setPreviewState] = useState("live");
    const [recenterToken, setRecenterToken] = useState(0);
    const showDemoControls = import.meta.env.VITE_SHOW_DEMO_CONTROLS === "true";
    if (loading)
        return (<>
        <PageHeading title="Live tracking" description="Locating your assigned bus…"/>
        <LoadingCards count={2}/>
      </>);
    if (error || !data)
        return <ErrorState message={error} retry={retry}/>;
    const assignmentPending = data.assignmentStatus === "unassigned" || !data.route?.code || !data.route?.stops?.length;
    if (assignmentPending)
        return (<>
        <PageHeading title="Live tracking" description="Live bus tracking will be available after admin assigns your route."/>
        <AssignmentPendingState />
      </>);
    const selectedStop = data.route.stops.find((stop) => stop.id === data.route.selectedStopId) ?? data.route.stops[0];
    const currentStop = data.route.stops.find((stop) => stop.id === data.route.currentStopId) ??
        data.route.stops.find((stop) => stop.status === "current") ??
        selectedStop;
    const selectedStopEta = selectedStop.status === "completed" ? "Departed" : selectedStop.eta ?? "—";
    const nextStopDistance = currentStop.distanceFromBus ?? data.bus.distanceToNextStop ?? data.bus.remainingDistance;
    const nextStopDistanceText = nextStopDistance && nextStopDistance !== "Waiting for GPS"
        ? `${nextStopDistance} away`
        : "Distance updates after GPS sync";
    const busPosition = data.bus.coordinates ?? selectedStop.coordinates;
    const routePoints = data.route.stops.map((stop) => stop.coordinates);
    const mapCenter = data.route.mapCenter ?? routePoints[0];
    const state = showDemoControls ? previewState : trackingStateForBus(data.bus);
    const gpsWaiting = data.bus.gpsStatus === "waiting";
    if (state === "no-trip")
        return (<>
        <PageHeading title="Live tracking" description="Location is shared only during active trips." action={showDemoControls ? <StateDemo state={previewState} setState={setPreviewState}/> : undefined}/>
        <section className="state-card state-card--large">
          <span className="state-card__icon">
            <BusFront />
          </span>
          <h2>No active trip right now</h2>
          <p>
            Your assigned bus is not currently on a live trip. The next
            scheduled service is tomorrow at {selectedStop.scheduledTime}.
          </p>
          <button className="button button--secondary" onClick={() => showDemoControls ? setPreviewState("live") : retry()}>
            <RefreshCw /> Refresh status
          </button>
        </section>
      </>);
    return (<div className="tracking-page">
      <PageHeading eyebrow={`Route ${data.route.code}`} title="Live tracking" description={`Follow bus ${data.bus.number} as it approaches your stop.`} action={showDemoControls ? <StateDemo state={previewState} setState={setPreviewState}/> : undefined}/>
      {state === "stale" && (<div className="app-alert app-alert--warning" role="status">
          <AlertTriangle />
          <div>
            <strong>{gpsWaiting ? "Waiting for driver GPS" : "Location update delayed"}</strong>
            <span>
              {gpsWaiting
            ? "The driver has started the trip, but phone GPS has not synced yet."
            : "The marker shows the last known location until the next phone GPS update arrives."}
            </span>
          </div>
        </div>)}
      {state === "offline" && (<div className="app-alert app-alert--offline" role="status">
          <WifiOff />
          <div>
            <strong>You’re offline</strong>
            <span>
              Showing the last available route and location from your device.
            </span>
          </div>
        </div>)}
      <div className="tracking-layout">
        <section className="live-map-card">
          <div className="map-toolbar">
            <span className={`gps-chip gps-chip--${state}`}>
              {state === "live" ? <Signal /> : <SignalZero />}
              {state === "live"
            ? "GPS live"
            : state === "stale"
                ? gpsWaiting ? "GPS waiting" : "GPS stale"
                : "Offline copy"}
            </span>
            <button onClick={() => setRecenterToken((value) => value + 1)} aria-label="Center map on bus" title="Center map on bus">
              <Navigation />
            </button>
          </div>
          <MapContainer center={mapCenter} zoom={12} scrollWheelZoom={false} className="leaflet-map">
            <RecenterMap position={busPosition} trigger={recenterToken}/>
            <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
            <Polyline positions={routePoints} pathOptions={{ color: "#0b948f", weight: 5, opacity: 0.86 }}/>
            {data.route.stops.map((stop) => stop.id === selectedStop.id ? (<Marker key={stop.id} position={stop.coordinates} icon={selectedIcon}>
                  <Popup>Your stop: {stop.name}</Popup>
                </Marker>) : (<CircleMarker key={stop.id} center={stop.coordinates} radius={6} pathOptions={{
                color: "#0b948f",
                fillColor: "#fff",
                fillOpacity: 1,
                weight: 3,
            }}>
                  <Popup>{stop.name}</Popup>
                </CircleMarker>))}
            <Marker position={busPosition} icon={busIcon}>
              <Popup>
                Bus {data.bus.number} · {data.bus.speed} km/h
              </Popup>
            </Marker>
          </MapContainer>
          <div className="map-updated">
            <i /> Last GPS update:{" "}
            {state === "live" ? data.bus.gpsUpdatedAt : data.bus.gpsUpdatedAt ?? "Waiting for driver phone"}
          </div>
        </section>
        <aside className="tracking-details">
          <section className="tracking-bus">
            <div>
              <span className="app-icon">
                <BusFront />
              </span>
              <span>
                <small>Bus {data.bus.number}</small>
                <strong>{data.bus.registration}</strong>
              </span>
            </div>
            <span className="app-badge app-badge--on-time">On time</span>
          </section>
          <section className="tracking-eta">
            <small>Arriving at your stop</small>
            <strong>{selectedStopEta}</strong>
            <span>
              <MapPin /> {selectedStop.name}
            </span>
          </section>
          <div className="tracking-metrics">
            <div>
              <Navigation />
              <span>
                <small>Speed</small>
                <strong>{data.bus.speed} km/h</strong>
              </span>
            </div>
            <div>
              <Clock3 />
              <span>
                <small>Expected</small>
                <strong>{selectedStop.scheduledTime}</strong>
              </span>
            </div>
          </div>
          <section className="next-stop-card">
            <span>Next stop</span>
            <strong>{currentStop.name}</strong>
            <p>{nextStopDistanceText}</p>
          </section>
          <p className="privacy-note">
            <Signal /> Driver location is visible only while this trip is
            active.
          </p>
        </aside>
      </div>
    </div>);
}
function RecenterMap({ position, trigger, }) {
    const map = useMap();
    const [latitude, longitude] = position;
    useEffect(() => {
        if (trigger > 0)
            map.flyTo([latitude, longitude], 13, { duration: 0.5 });
    }, [latitude, longitude, map, trigger]);
    return null;
}
function StateDemo({ state, setState, }) {
    return (<label className="demo-state-select">
      <span>Preview state</span>
      <select value={state} onChange={(event) => setState(event.target.value)}>
        <option value="live">Live GPS</option>
        <option value="stale">Stale GPS</option>
        <option value="offline">Offline</option>
        <option value="no-trip">No active trip</option>
      </select>
    </label>);
}
