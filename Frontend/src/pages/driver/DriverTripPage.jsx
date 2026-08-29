import { AlertTriangle, ArrowLeft, BusFront, CheckCircle2, Clock3, Flag, Gauge, MapPin, Navigation, Radio, Square } from 'lucide-react';
import { useState } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import { Link, useNavigate } from 'react-router-dom';
import { StaffPageHeading } from '../../components/staff/StaffUI';
import { useDriverOperations } from '../../operations/OperationsContext';
const driverBusIcon = L.divIcon({ className: 'staff-bus-marker', html: '<span>BUS</span>', iconSize: [46, 46], iconAnchor: [23, 23] });
function gpsStatusText(status) {
    if (status === "sharing")
        return "GPS live";
    if (status === "requesting")
        return "Waiting for permission";
    if (status === "unsupported")
        return "GPS unavailable";
    if (status === "error")
        return "GPS needs attention";
    return "GPS active";
}
export function DriverTripPage() {
    const { tripStatus, activeTrip, stops, gpsUpdatedAt, gpsSharingStatus, gpsError, endTrip } = useDriverOperations();
    const [confirmingEnd, setConfirmingEnd] = useState(false);
    const [ending, setEnding] = useState(false);
    const navigate = useNavigate();
    if (tripStatus === 'not-started')
        return <section className="staff-state-card"><span><BusFront /></span><h1>No active trip</h1><p>Complete the pre-trip safety checklist before starting location sharing.</p><Link className="button staff-primary-button" to="/driver/checklist">Open pre-trip checklist</Link></section>;
    if (tripStatus === 'completed')
        return <section className="staff-state-card staff-state-card--success"><span><CheckCircle2 /></span><h1>Trip completed safely</h1><p>GPS sharing has stopped. This trip is now available in your history.</p><Link className="button staff-primary-button" to="/driver/history">View trip history</Link><Link className="staff-back-link" to="/driver"><ArrowLeft /> Return home</Link></section>;
    const routePoints = stops.map((stop) => stop.coordinates);
    const nextStop = stops.find((stop) => stop.id === activeTrip.nextStopId) ??
        stops.find((stop) => stop.status === 'current') ??
        stops[0];
    const busPosition = activeTrip.currentCoordinates ?? nextStop.coordinates;
    const currentSpeed = Number.isFinite(activeTrip.currentSpeed) ? Math.round(activeTrip.currentSpeed) : 32;
    return <div className="driver-active-page"><StaffPageHeading eyebrow={`${activeTrip.routeCode} · Active trip`} title="Stay focused. Drive safely." description="Only essential trip information is shown while you’re moving." status={<span className="staff-status staff-status--active"><i /> {gpsStatusText(gpsSharingStatus)}</span>}/>
    <section className="active-trip-hero"><div><span><Navigation /></span><div><small>Next stop</small><h2>{nextStop.name}</h2><p>{activeTrip.remainingDistance} remaining · ETA {activeTrip.nextStopEta}</p></div></div><div className="active-trip-countdown"><small>Estimated arrival</small><strong>{nextStop.scheduledTime}</strong><span>scheduled stop time</span></div></section>
    <div className="driver-trip-grid"><section className="driver-route-map"><MapContainer center={busPosition} zoom={11} scrollWheelZoom={false} className="staff-leaflet-map"><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Polyline positions={routePoints} pathOptions={{ color: '#0b948f', weight: 5 }}/>{stops.map((stop) => <CircleMarker key={stop.id} center={stop.coordinates} radius={6} pathOptions={{ color: '#0b948f', fillColor: '#fff', fillOpacity: 1, weight: 3 }}><Popup>{stop.name}</Popup></CircleMarker>)}<Marker position={busPosition} icon={driverBusIcon}><Popup>Bus {activeTrip.busNumber}</Popup></Marker></MapContainer><div className="driver-map-caption"><span><Radio /> GPS updated {gpsUpdatedAt}</span><span>{gpsError || 'Location visible during active trip'}</span></div></section>
      <aside className="driver-trip-side"><section className="driver-metrics"><div><Gauge /><span><small>Speed</small><strong>{currentSpeed} km/h</strong></span></div><div><Clock3 /><span><small>Trip time</small><strong>28 min</strong></span></div><div><MapPin /><span><small>Remaining</small><strong>{activeTrip.remainingDistance}</strong></span></div></section><section className="driver-route-progress"><h3>Route guidance</h3>{stops.slice(1, 5).map((stop) => <div key={stop.id} className={`driver-stop driver-stop--${stop.status}`}><i>{stop.status === 'completed' ? '✓' : ''}</i><span><strong>{stop.name}</strong><small>{stop.status === 'current' ? 'Next stop' : stop.scheduledTime}</small></span></div>)}</section><Link className="driver-emergency-button" to="/driver/emergency"><AlertTriangle /> Emergency / breakdown</Link><button className="driver-end-button" onClick={() => setConfirmingEnd(true)}><Square /> End trip</button></aside>
    </div>
    {confirmingEnd && <div className="staff-modal-backdrop"><section className="staff-modal" role="dialog" aria-modal="true" aria-labelledby="end-trip-title"><span className="staff-modal__icon staff-modal__icon--end"><Flag /></span><h2 id="end-trip-title">End this trip?</h2><p>Only end the trip after reaching the destination and parking safely. GPS sharing will stop immediately.</p><div className="staff-modal__actions"><button className="button button--secondary" onClick={() => setConfirmingEnd(false)} disabled={ending}>Continue trip</button><button className="button staff-danger-button" disabled={ending} onClick={async () => { setEnding(true); await endTrip(); navigate('/driver'); }}><Square /> {ending ? 'Ending trip...' : 'Confirm end trip'}</button></div></section></div>}
  </div>;
}
