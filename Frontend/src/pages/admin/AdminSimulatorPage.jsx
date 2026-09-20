import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup } from 'react-leaflet';
import { FlaskConical, Pause, Play, RotateCcw, Square } from 'lucide-react';
import { useAdminData } from '../../admin/AdminDataContext';
import { AdminFeedback, AdminPageHeading } from '../../components/admin/AdminUI';
import { MapFitBounds, SmartTileLayer, StopNameTooltip } from '../../components/maps/SmartTransitMap';
import { apiRequest, backendConfig } from '../../services/apiClient';
import { formatEventTime, stopTimeLabel } from '../../utils/dateLabels';

export function AdminSimulatorPage() {
    const { routes } = useAdminData();
    const [routeId, setRouteId] = useState(routes[0]?.id ?? '');
    const [direction, setDirection] = useState('morning');
    const [speedKmh, setSpeedKmh] = useState(24);
    const [playbackRate, setPlaybackRate] = useState(30);
    const [scenario, setScenario] = useState(null);
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const generation = useRef(0);
    const busy = useRef(false);
    useEffect(() => {
        if (!routeId && routes.length) setRouteId(routes[0].id);
    }, [routeId, routes]);
    useEffect(() => {
        if (!scenario?.id) return;
        setRouteId(scenario.route.id);
        setDirection(scenario.route.direction);
        setSpeedKmh(scenario.speedKmh);
        setPlaybackRate(scenario.playbackRate);
    }, [scenario?.id, scenario?.route?.id, scenario?.route?.direction, scenario?.speedKmh, scenario?.playbackRate]);
    const command = async (method, body) => {
        if (busy.current) return;
        busy.current = true;
        const version = ++generation.current;
        setPending(true);
        setError('');
        try {
            const result = await apiRequest('/admin/simulation', { method, body });
            if (generation.current === version) setScenario(result);
        } catch (reason) { if (generation.current === version) setError(reason.message); }
        finally { busy.current = false; setPending(false); }
    };
    useEffect(() => {
        if (!backendConfig.enabled) return;
        let closed = false;
        let timer;
        const controller = new AbortController();
        const poll = async () => {
            const version = generation.current;
            try {
                if (!busy.current) {
                    const result = await apiRequest('/admin/simulation', { signal: controller.signal });
                    if (!closed && generation.current === version) { setScenario(result); setError(''); }
                }
            } catch (reason) { if (!closed && generation.current === version) setError(reason.message); }
            if (!closed) timer = window.setTimeout(poll, 2000);
        };
        void poll();
        return () => { closed = true; generation.current += 1; controller.abort(); window.clearTimeout(timer); };
    }, []);
    const active = scenario?.id;
    const route = scenario?.route ?? routes.find((item) => item.id === routeId);
    const stops = scenario?.stops ?? route?.stops ?? [];
    const coordinatesKey = JSON.stringify(stops.map((stop) => stop.coordinates).filter((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)));
    const points = useMemo(() => JSON.parse(coordinatesKey), [coordinatesKey]);
    const running = scenario?.status === 'running';
    const start = () => command('POST', { routeId, direction, speedKmh, playbackRate });
    return <div className="simulation-page">
      <AdminPageHeading eyebrow="Faculty demonstration" title="GPS simulator" description="Isolated simulation. No real bus location, passenger record or notification is changed." />
      <div className="simulation-notice" role="status"><FlaskConical /><span><strong>SIMULATION ONLY</strong> Movement follows the configured stop lines, not roads. Arrival times use approximate distance and speed; traffic is not included.</span></div>
      {!backendConfig.enabled && <p role="alert">The simulator requires the connected backend.</p>}
      {error && <AdminFeedback type="error" title="Simulator connection interrupted" message={`${error} The displayed position is the last received simulation update.`} dismiss={() => setError('')} />}
      <form className="simulation-controls" onSubmit={(event) => { event.preventDefault(); void start(); }}>
        <label className="admin-form-field"><span>Route</span><select value={routeId} disabled={Boolean(active) || pending} onChange={(event) => setRouteId(event.target.value)}>{routes.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></label>
        <label className="admin-form-field"><span>Direction</span><select value={direction} disabled={Boolean(active) || pending} onChange={(event) => setDirection(event.target.value)}><option value="morning">Morning pickup</option><option value="return">Return trip</option></select></label>
        <label className="admin-form-field"><span>Simulated speed: {speedKmh} km/h</span><input aria-label="Simulated bus speed" type="range" min="5" max="60" step="1" value={speedKmh} disabled={Boolean(active) || pending} onChange={(event) => setSpeedKmh(Number(event.target.value))} /></label>
        <label className="admin-form-field"><span>Playback</span><select value={playbackRate} disabled={Boolean(active) || pending} onChange={(event) => setPlaybackRate(Number(event.target.value))}>{[1, 10, 30, 60].map((rate) => <option key={rate} value={rate}>{rate}x {rate === 1 ? '(real time)' : '(accelerated)'}</option>)}</select></label>
        <div className="simulation-actions">
          {!active ? <button className="button admin-primary-button" disabled={pending || !routeId || !backendConfig.enabled}><Play /> {pending ? 'Starting...' : 'Start simulator'}</button> : <>
            {scenario.status !== 'completed' && <button type="button" className="button admin-primary-button" disabled={pending} onClick={() => void command('PATCH', { id: scenario.id, action: running ? 'pause' : 'resume' })}>{running ? <Pause /> : <Play />} {running ? 'Pause' : 'Resume'}</button>}
            <button type="button" className="button button--secondary" title="Restart simulation" disabled={pending} onClick={() => void start()}><RotateCcw /> Restart</button>
            <button type="button" className="button button--secondary" disabled={pending} onClick={() => void command('DELETE')}><Square /> Exit simulation</button>
          </>}
        </div>
      </form>
      {active && <div className="simulation-summary" aria-live="polite">
        <div><small>Simulation status</small><strong>{error ? 'Connection interrupted' : scenario.status}</strong></div>
        <div><small>Next stop</small><strong>{scenario.status === 'completed' ? 'Journey complete' : scenario.nextStopName}</strong></div>
        <div><small>Approximate distance</small><strong>{Number.isFinite(scenario.distanceToNextStopKm) ? `~${scenario.distanceToNextStopKm.toFixed(2)} km` : 'Unavailable'}</strong></div>
        <div><small>Estimated arrival</small><strong>{!error && running && scenario.nextStopEstimatedArrivalAt ? formatEventTime(scenario.nextStopEstimatedArrivalAt) : 'ETA unavailable'}</strong></div>
      </div>}
      <div className="simulation-workspace">
        <section aria-label="Simulation map" className="simulation-map">
          {points.length > 0 && <MapContainer key={route?.id ?? 'empty'} center={points[0]} zoom={13} scrollWheelZoom={false} className="simulation-leaflet">
            <SmartTileLayer /><MapFitBounds points={points} trigger={scenario?.id ?? routeId} />
            <Polyline positions={points} pathOptions={{ color: '#0b948f', weight: 4 }} />
            {stops.filter((stop) => Array.isArray(stop.coordinates) && stop.coordinates.length === 2 && stop.coordinates.every(Number.isFinite)).map((stop) => <CircleMarker key={stop.id} center={stop.coordinates} radius={6} pathOptions={{ color: '#0b948f', fillColor: stop.status === 'completed' ? '#0b948f' : '#fff', fillOpacity: 1 }}><StopNameTooltip permanent={stop.id === scenario?.nextStopId}>{stop.name}</StopNameTooltip><Popup>{stop.name}</Popup></CircleMarker>)}
            {scenario?.location && <CircleMarker center={scenario.location.coordinates} radius={11} pathOptions={{ color: '#8b5b00', fillColor: '#ffb547', fillOpacity: 1, weight: 3 }}><StopNameTooltip active>Simulated bus</StopNameTooltip></CircleMarker>}
          </MapContainer>}
          <p>Last simulation update: {formatEventTime(scenario?.location?.updatedAt)}</p>
        </section>
        <section className="simulation-stops" aria-label="Simulated stop arrivals"><h2>Stop arrivals</h2>{stops.map((stop, index) => <article key={stop.id}><span>{index + 1}</span><div><strong>{stop.name}</strong><small>{scenario?.status === 'completed' ? 'Journey complete' : active ? error ? 'ETA unavailable' : stopTimeLabel(stop, true) : 'Not started'}</small></div></article>)}</section>
      </div>
    </div>;
}
