import { ArrowDown, ArrowLeft, ArrowUp, BusFront, MapPin, Pencil, Plus, Route, Save, Search, ToggleLeft, ToggleRight, Trash2, UserRound, Users, X, } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, } from "react-leaflet";
import { useMap, useMapEvents } from "react-leaflet";
import { useAdminData } from "../../admin/AdminDataContext";
import { AdminFeedback, AdminPageHeading, AdminStatusBadge, } from "../../components/admin/AdminUI";
const defaultMapCenter = [23.07, 72.54];
const ahmedabadSearchViewbox = "72.35,23.18,72.75,22.9";
const formatCoordinate = (value) => Number.isFinite(Number(value)) ? String(Math.round(Number(value) * 1000000) / 1000000) : "";
const normalizeSearchText = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const coordinatesFromStop = (stop) => {
    const lat = Number(stop.lat ?? stop.coordinates?.[0]);
    const lng = Number(stop.lng ?? stop.coordinates?.[1]);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90)
        return null;
    if (!Number.isFinite(lng) || lng < -180 || lng > 180)
        return null;
    return [lat, lng];
};
const prepareRouteForEdit = (route) => ({
    ...structuredClone(route),
    stops: (route.stops ?? []).map((stop) => ({
        ...stop,
        lat: formatCoordinate(stop.coordinates?.[0]),
        lng: formatCoordinate(stop.coordinates?.[1]),
    })),
});
const cleanRouteForSave = (route) => ({
    ...route,
    stops: route.stops.map(({ lat, lng, ...stop }) => ({
        ...stop,
        coordinates: coordinatesFromStop({ lat, lng, coordinates: stop.coordinates }),
    })),
});
const emptyRoute = () => ({
    id: "",
    code: "",
    name: "",
    startPoint: "",
    destination: "",
    status: "active",
    busId: "",
    driverId: "",
    conductorId: "",
    stops: [],
});
const uniqueLocationResults = (results) => {
    const seen = new Set();
    return results.filter((result) => {
        const key = `${normalizeSearchText(result.name)}-${formatCoordinate(result.lat)}-${formatCoordinate(result.lng)}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
};
const routeLocationResults = (query, routes) => {
    const search = normalizeSearchText(query);
    if (!search)
        return [];
    return uniqueLocationResults(routes.flatMap((route) => (route.stops ?? []).map((stop, index) => {
        const coordinates = coordinatesFromStop(stop);
        if (!coordinates)
            return null;
        return {
            id: `${route.id}-${stop.id}`,
            name: stop.name,
            description: `${route.code} · stop ${index + 1}`,
            lat: coordinates[0],
            lng: coordinates[1],
            source: "Saved stop",
        };
    }).filter(Boolean)).filter((result) => normalizeSearchText(`${result.name} ${result.description}`).includes(search))).slice(0, 6);
};
export function AdminRoutesPage() {
    const { routes, records, upsertRoute, toggleRoute } = useAdminData();
    const [selectedId, setSelectedId] = useState(routes[0]?.id ?? "");
    const [query, setQuery] = useState("");
    const [editing, setEditing] = useState(null);
    const [errors, setErrors] = useState({});
    const [feedback, setFeedback] = useState(null);
    const filtered = useMemo(() => routes.filter((route) => `${route.code} ${route.name} ${route.startPoint} ${route.destination}`
        .toLowerCase()
        .includes(query.toLowerCase())), [routes, query]);
    const selected = routes.find((route) => route.id === selectedId) ?? filtered[0] ?? routes[0];
    const beginEdit = (route) => {
        setEditing(prepareRouteForEdit(route));
        setErrors({});
    };
    const save = (event) => {
        event.preventDefault();
        if (!editing)
            return;
        const next = {};
        if (!editing.code.trim())
            next.code = "Route code is required.";
        if (!editing.name.trim())
            next.name = "Route name is required.";
        if (!editing.startPoint.trim())
            next.startPoint = "Start point is required.";
        if (!editing.destination.trim())
            next.destination = "Destination is required.";
        if (routes.some((route) => route.code.toLowerCase() === editing.code.trim().toLowerCase() &&
            route.id !== editing.id))
            next.code = "Route code already exists.";
        if (editing.stops.length < 2)
            next.stops = "Add at least two ordered stops.";
        if (editing.stops.some((stop) => !stop.name.trim() || !stop.scheduledTime.trim()))
            next.stops = "Every stop needs a name and scheduled time.";
        if (editing.stops.some((stop) => !coordinatesFromStop(stop)))
            next.stops = "Every stop needs valid latitude and longitude.";
        setErrors(next);
        if (Object.keys(next).length)
            return;
        const route = cleanRouteForSave({ ...editing, id: editing.id || `route-${Date.now()}` });
        upsertRoute(route);
        setSelectedId(route.id);
        setEditing(null);
        setFeedback(`${route.code} was saved with ${route.stops.length} ordered stops.`);
    };
    return (<div>
      {editing ? (<RouteEditor route={editing} setRoute={setEditing} errors={errors} records={records} routes={routes} save={save} cancel={() => setEditing(null)}/>) : (<>
          <AdminPageHeading eyebrow="Network planning" title="Routes & stops builder" description="Create routes, order stops, schedule arrivals and assign operating teams." actions={<button className="button admin-primary-button" onClick={() => beginEdit(emptyRoute())}>
                <Plus /> Add route
              </button>}/>
          {feedback && (<AdminFeedback type="success" title="Route saved" message={feedback} dismiss={() => setFeedback(null)}/>)}
          <div className="route-builder-layout">
            <aside className="admin-route-list">
              <label className="admin-search">
                <Search />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search routes…" aria-label="Search routes"/>
              </label>
              <div>
                {filtered.map((route) => (<button key={route.id} className={selected?.id === route.id ? "active" : ""} onClick={() => setSelectedId(route.id)}>
                    <span className="admin-kpi-icon admin-kpi-icon--small">
                      <Route />
                    </span>
                    <span>
                      <small>{route.code}</small>
                      <strong>{route.name}</strong>
                      <em>
                        {route.stops.length} stops · {route.startPoint} to{" "}
                        {route.destination}
                      </em>
                    </span>
                    <AdminStatusBadge status={route.status}/>
                  </button>))}
              </div>
            </aside>
            {selected && (<section className="route-detail-workspace">
                <header>
                  <div>
                    <span>{selected.code}</span>
                    <h2>{selected.name}</h2>
                    <p>
                      <MapPin /> {selected.startPoint} to {selected.destination}
                    </p>
                  </div>
                  <div>
                    <button className="button button--secondary" onClick={() => toggleRoute(selected.id)}>
                      {selected.status === "active" ? (<ToggleRight />) : (<ToggleLeft />)}
                      {selected.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                    <button className="button admin-primary-button" onClick={() => beginEdit(selected)}>
                      <Pencil /> Edit route
                    </button>
                  </div>
                </header>
                <div className="route-detail-grid">
                  <section className="route-stop-view">
                    <div className="admin-panel-title">
                      <div>
                        <h3>Ordered stop timeline</h3>
                        <p>Scheduled morning arrivals</p>
                      </div>
                      <span>{selected.stops.length} stops</span>
                    </div>
                    {selected.stops.map((stop, index) => (<div className="admin-route-stop" key={stop.id}>
                        <span>{index + 1}</span>
                        <div>
                          <strong>{stop.name}</strong>
                          <small>
                            {index === 0
                        ? "Start point"
                        : index === selected.stops.length - 1
                            ? "Destination"
                            : `Stop ${index + 1}`}
                          </small>
                        </div>
                        <time>{stop.scheduledTime}</time>
                      </div>))}
                  </section>
                  <section className="route-preview-map">
                    <MapContainer key={selected.id} center={selected.stops[0]?.coordinates ?? [23.07, 72.54]} zoom={11} scrollWheelZoom={false} className="admin-route-map">
                      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                      <Polyline positions={selected.stops.map((stop) => stop.coordinates)} pathOptions={{ color: "#0b948f", weight: 5 }}/>
                      {selected.stops.map((stop, index) => (<CircleMarker key={stop.id} center={stop.coordinates} radius={8} pathOptions={{
                        color: "#0b948f",
                        fillColor: index === 0 ? "#ffb547" : "#fff",
                        fillOpacity: 1,
                        weight: 3,
                    }}>
                          <Popup>
                            {index + 1}. {stop.name} · {stop.scheduledTime}
                          </Popup>
                        </CircleMarker>))}
                    </MapContainer>
                  </section>
                </div>
                <div className="route-assignments-view">
                  <AssignmentItem icon={<BusFront />} label="Bus" value={records.buses.find((item) => item.id === selected.busId)
                    ?.name ?? "Unassigned"}/>
                  <AssignmentItem icon={<UserRound />} label="Driver" value={records.drivers.find((item) => item.id === selected.driverId)?.name ?? "Unassigned"}/>
                  <AssignmentItem icon={<Users />} label="Conductor" value={records.conductors.find((item) => item.id === selected.conductorId)?.name ?? "Unassigned"}/>
                </div>
              </section>)}
          </div>
        </>)}
    </div>);
}
function RouteEditor({ route, setRoute, errors, records, routes, save, cancel, }) {
    const [newStop, setNewStop] = useState({
        name: "",
        scheduledTime: "",
        lat: "23.0700",
        lng: "72.5400",
    });
    const [coordinateTarget, setCoordinateTarget] = useState("new");
    const [stopError, setStopError] = useState("");
    const [locationQuery, setLocationQuery] = useState("");
    const [locationResults, setLocationResults] = useState([]);
    const [locationMessage, setLocationMessage] = useState("");
    const [searchingLocation, setSearchingLocation] = useState(false);
    const [mapFocus, setMapFocus] = useState(null);
    const validStops = route.stops
        .map((stop, index) => ({ stop, index, coordinates: coordinatesFromStop(stop) }))
        .filter((item) => item.coordinates);
    const draftCoordinates = coordinatesFromStop(newStop);
    const mapCenter = validStops[0]?.coordinates ?? draftCoordinates ?? defaultMapCenter;
    const targetStop = route.stops.find((stop) => stop.id === coordinateTarget);
    const coordinateTargetLabel = coordinateTarget === "new" ? "the new stop" : targetStop?.name || "the selected stop";
    const targetStopName = coordinateTarget === "new" ? newStop.name : targetStop?.name ?? "";
    const targetCoordinates = coordinateTarget === "new" ? draftCoordinates : targetStop ? coordinatesFromStop(targetStop) : null;
    const searchText = locationQuery.trim() || targetStopName.trim();
    useEffect(() => {
        setLocationResults([]);
        setLocationMessage("");
        setLocationQuery(targetStopName);
    }, [coordinateTarget, targetStopName]);
    const updateStop = (index, patch) => setRoute({
        ...route,
        stops: route.stops.map((stop, i) => i === index ? { ...stop, ...patch } : stop),
    });
    const applyCoordinatesToTarget = ({ lat, lng }, name = "") => {
        const coordinatePatch = {
            lat: formatCoordinate(lat),
            lng: formatCoordinate(lng),
        };
        setMapFocus([Number(lat), Number(lng)]);
        if (coordinateTarget === "new") {
            setNewStop((current) => ({
                ...current,
                ...(!current.name.trim() && name ? { name } : {}),
                ...coordinatePatch,
            }));
            return;
        }
        setRoute({
            ...route,
            stops: route.stops.map((stop) => stop.id === coordinateTarget ? { ...stop, ...coordinatePatch } : stop),
        });
    };
    const applyMapCoordinate = ({ lat, lng }) => applyCoordinatesToTarget({ lat, lng });
    const searchLocation = async () => {
        const query = searchText;
        if (!query) {
            setLocationMessage("Enter a stop name or area to search.");
            return;
        }
        const savedMatches = routeLocationResults(query, routes);
        setLocationResults(savedMatches);
        setLocationMessage(savedMatches.length ? "Choose a saved stop or wait for more map results." : "");
        setSearchingLocation(true);
        try {
            const url = new URL("https://nominatim.openstreetmap.org/search");
            url.searchParams.set("format", "jsonv2");
            url.searchParams.set("q", /ahmedabad|gandhinagar|gujarat|india/i.test(query) ? query : `${query}, Ahmedabad, Gujarat, India`);
            url.searchParams.set("limit", "6");
            url.searchParams.set("countrycodes", "in");
            url.searchParams.set("addressdetails", "1");
            url.searchParams.set("dedupe", "1");
            url.searchParams.set("bounded", "1");
            url.searchParams.set("viewbox", ahmedabadSearchViewbox);
            const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
            if (!response.ok)
                throw new Error("Map search failed.");
            const found = await response.json();
            const mapMatches = found
                .map((item) => ({
                id: `osm-${item.place_id}`,
                name: item.name || item.display_name?.split(",")[0] || query,
                description: item.display_name,
                lat: Number(item.lat),
                lng: Number(item.lon),
                source: "Map result",
            }))
                .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
            const results = uniqueLocationResults([...savedMatches, ...mapMatches]).slice(0, 8);
            setLocationResults(results);
            setLocationMessage(results.length ? "Select the correct location to fill coordinates." : "No matching location found. Try a nearby landmark.");
        }
        catch {
            setLocationMessage(savedMatches.length ? "Map search is unavailable. Saved stop matches are shown." : "Map search is unavailable. Click the map as a fallback.");
        }
        finally {
            setSearchingLocation(false);
        }
    };
    const chooseLocation = (result) => {
        applyCoordinatesToTarget({ lat: result.lat, lng: result.lng }, result.name);
        setLocationMessage(`${result.name} selected.`);
    };
    const move = (index, direction) => {
        const target = index + direction;
        if (target < 0 || target >= route.stops.length)
            return;
        const stops = [...route.stops];
        [stops[index], stops[target]] = [stops[target], stops[index]];
        setRoute({ ...route, stops });
    };
    const addStop = () => {
        const coordinates = coordinatesFromStop(newStop);
        if (!newStop.name.trim() ||
            !newStop.scheduledTime ||
            !coordinates) {
            setStopError("Enter a stop name, time and valid coordinates.");
            return;
        }
        setRoute({
            ...route,
            stops: [
                ...route.stops,
                {
                    id: `rs-${Date.now()}`,
                    name: newStop.name,
                    scheduledTime: newStop.scheduledTime,
                    coordinates,
                    lat: newStop.lat,
                    lng: newStop.lng,
                },
            ],
        });
        setNewStop({ name: "", scheduledTime: "", lat: "23.0700", lng: "72.5400" });
        setCoordinateTarget("new");
        setStopError("");
    };
    return (<form onSubmit={save} noValidate>
      <AdminPageHeading eyebrow={route.id ? "Edit route" : "New route"} title={route.id ? `${route.code} · ${route.name}` : "Create a route"} description="Configure route details, ordered stops, schedule and assignments." actions={<button type="button" className="button button--secondary" onClick={cancel}>
            <X /> Cancel
          </button>}/>
      <div className="route-editor-grid">
        <section className="admin-panel route-editor-details">
          <div className="admin-panel-title">
            <div>
              <h2>Route details</h2>
              <p>Required network information</p>
            </div>
          </div>
          <div className="admin-form-row">
            <RouteField label="Route code" value={route.code} setValue={(value) => setRoute({ ...route, code: value })} error={errors.code}/>
            <RouteField label="Route name" value={route.name} setValue={(value) => setRoute({ ...route, name: value })} error={errors.name}/>
          </div>
          <div className="admin-form-row">
            <RouteField label="Start point" value={route.startPoint} setValue={(value) => setRoute({ ...route, startPoint: value })} error={errors.startPoint}/>
            <RouteField label="Destination" value={route.destination} setValue={(value) => setRoute({ ...route, destination: value })} error={errors.destination}/>
          </div>
          <label className="admin-form-field">
            <span>Route status</span>
            <select value={route.status} onChange={(e) => setRoute({
            ...route,
            status: e.target.value,
        })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </section>
        <section className="admin-panel route-editor-assign">
          <div className="admin-panel-title">
            <div>
              <h2>Assignments</h2>
              <p>Bus and operating staff</p>
            </div>
          </div>
          <label className="admin-form-field">
            <span>Assign bus</span>
            <select value={route.busId} onChange={(e) => setRoute({ ...route, busId: e.target.value })}>
              <option value="">Unassigned</option>
              {records.buses
            .filter((item) => item.status === "active" || item.id === route.busId)
            .map((item) => (<option key={item.id} value={item.id}>
                    {item.name} · {item.code}
                  </option>))}
            </select>
          </label>
          <label className="admin-form-field">
            <span>Assign driver</span>
            <select value={route.driverId} onChange={(e) => setRoute({ ...route, driverId: e.target.value })}>
              <option value="">Unassigned</option>
              {records.drivers
            .filter((item) => item.status === "active" || item.id === route.driverId)
            .map((item) => (<option key={item.id} value={item.id}>
                    {item.name}
                  </option>))}
            </select>
          </label>
          <label className="admin-form-field">
            <span>Assign conductor</span>
            <select value={route.conductorId} onChange={(e) => setRoute({ ...route, conductorId: e.target.value })}>
              <option value="">Unassigned</option>
              {records.conductors
            .filter((item) => item.status === "active" || item.id === route.conductorId)
            .map((item) => (<option key={item.id} value={item.id}>
                    {item.name}
                  </option>))}
            </select>
          </label>
        </section>
        <section className="admin-panel route-editor-stops">
          <div className="admin-panel-title">
            <div>
              <h2>Ordered stops & schedule</h2>
              <p>Reorder with arrows or edit stop details inline</p>
            </div>
            <span>{route.stops.length} stops</span>
          </div>
          {errors.stops && (<div className="route-editor-error">{errors.stops}</div>)}
          <div className="route-editor-stop-list">
            {route.stops.map((stop, index) => (<div key={stop.id}>
                <span className="route-stop-order">{index + 1}</span>
                <input aria-label={`Stop ${index + 1} name`} value={stop.name} onChange={(e) => updateStop(index, { name: e.target.value })}/>
                <input aria-label={`Stop ${index + 1} time`} value={stop.scheduledTime} onChange={(e) => updateStop(index, { scheduledTime: e.target.value })}/>
                <input aria-label={`Stop ${index + 1} latitude`} value={stop.lat ?? formatCoordinate(stop.coordinates?.[0])} onChange={(e) => updateStop(index, { lat: e.target.value })} placeholder="Latitude"/>
                <input aria-label={`Stop ${index + 1} longitude`} value={stop.lng ?? formatCoordinate(stop.coordinates?.[1])} onChange={(e) => updateStop(index, { lng: e.target.value })} placeholder="Longitude"/>
                <div>
                  <button type="button" className={coordinateTarget === stop.id ? "route-pick-button route-pick-button--active" : "route-pick-button"} onClick={() => setCoordinateTarget(stop.id)} aria-label={`Pick ${stop.name} coordinates on map`}>
                    <MapPin />
                  </button>
                  <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${stop.name} up`}>
                    <ArrowUp />
                  </button>
                  <button type="button" disabled={index === route.stops.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${stop.name} down`}>
                    <ArrowDown />
                  </button>
                  <button type="button" onClick={() => setRoute({
                ...route,
                stops: route.stops.filter((item) => item.id !== stop.id),
            })} aria-label={`Remove ${stop.name}`}>
                    <Trash2 />
                  </button>
                </div>
              </div>))}
          </div>
          <div className="route-add-stop">
            <input aria-label="New stop name" value={newStop.name} onChange={(e) => setNewStop({ ...newStop, name: e.target.value })} placeholder="Stop name"/>
            <input aria-label="New stop time" value={newStop.scheduledTime} onChange={(e) => setNewStop({ ...newStop, scheduledTime: e.target.value })} placeholder="e.g. 7:30 AM"/>
            <input aria-label="New stop latitude" value={newStop.lat} onChange={(e) => setNewStop({ ...newStop, lat: e.target.value })} placeholder="Latitude"/>
            <input aria-label="New stop longitude" value={newStop.lng} onChange={(e) => setNewStop({ ...newStop, lng: e.target.value })} placeholder="Longitude"/>
            <button type="button" className={coordinateTarget === "new" ? "route-pick-button route-pick-button--active" : "route-pick-button"} onClick={() => setCoordinateTarget("new")}>
              <MapPin /> Pick
            </button>
            <button type="button" className="button button--secondary" onClick={addStop}>
              <Plus /> Add stop
            </button>
          </div>
          {stopError && <small className="field-error">{stopError}</small>}
        </section>
        <section className="admin-panel route-editor-map">
          <div className="admin-panel-title">
            <div>
              <h2>Stop location</h2>
              <p>Search, select a result, or click the map for {coordinateTargetLabel}</p>
            </div>
          </div>
          <div className="route-location-search">
            <label className="admin-search">
              <Search />
              <input value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                void searchLocation();
            }
        }} placeholder="Search stop or landmark" aria-label="Search stop location"/>
            </label>
            <button type="button" className="button button--secondary" onClick={() => void searchLocation()} disabled={searchingLocation}>
              <Search /> {searchingLocation ? "Finding..." : "Find"}
            </button>
          </div>
          {locationMessage && <small className="route-location-message">{locationMessage}</small>}
          {locationResults.length > 0 && (<div className="route-location-results">
              {locationResults.map((result) => (<button type="button" key={result.id} onClick={() => chooseLocation(result)}>
                  <span>
                    <strong>{result.name}</strong>
                    <small>{result.description}</small>
                  </span>
                  <em>{result.source}</em>
                </button>))}
            </div>)}
          <MapContainer key={`${route.id || "new-route"}-${mapCenter.join(",")}-${validStops.length}`} center={mapCenter} zoom={11} scrollWheelZoom={false} className="admin-route-map">
              <MapAutoCenter position={mapFocus ?? targetCoordinates ?? mapCenter}/>
              <MapCoordinatePicker onPick={applyMapCoordinate}/>
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
              {validStops.length > 1 && <Polyline positions={validStops.map((item) => item.coordinates)} pathOptions={{ color: "#0b948f", weight: 5 }}/>}
              {validStops.map(({ stop, index, coordinates }) => (<CircleMarker key={stop.id} center={coordinates} radius={8} pathOptions={{
                    color: "#0b948f",
                    fillColor: coordinateTarget === stop.id ? "#ffb547" : index === 0 ? "#0b948f" : "#fff",
                    fillOpacity: 1,
                    weight: 3,
                }}>
                  <Popup>
                    {index + 1}. {stop.name}
                  </Popup>
                </CircleMarker>))}
              {coordinateTarget === "new" && draftCoordinates && (<CircleMarker center={draftCoordinates} radius={7} pathOptions={{ color: "#ffb547", fillColor: "#ffb547", fillOpacity: 0.85, weight: 3 }}>
                  <Popup>New stop coordinates</Popup>
                </CircleMarker>)}
            </MapContainer>
          <p className="route-map-picker-hint">
            Select a stop’s pin button, then click the exact point on the map.
          </p>
        </section>
      </div>
      <div className="route-editor-actions">
        <button type="button" className="button button--secondary" onClick={cancel}>
          <ArrowLeft /> Discard changes
        </button>
        <button className="button admin-primary-button">
          <Save /> Save route
        </button>
      </div>
    </form>);
}
function MapCoordinatePicker({ onPick }) {
    useMapEvents({
        click(event) {
            onPick(event.latlng);
        },
    });
    return null;
}
function MapAutoCenter({ position }) {
    const map = useMap();
    const latitude = position?.[0];
    const longitude = position?.[1];
    useEffect(() => {
        if (Number.isFinite(latitude) && Number.isFinite(longitude))
            map.flyTo([latitude, longitude], 14, { duration: 0.45 });
    }, [latitude, longitude, map]);
    return null;
}
function RouteField({ label, value, setValue, error, }) {
    return (<label className="admin-form-field">
      <span>{label} *</span>
      <input value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={Boolean(error)}/>
      {error && <small>{error}</small>}
    </label>);
}
function AssignmentItem({ icon, label, value, }) {
    return (<div>
      <span className="admin-kpi-icon admin-kpi-icon--small">{icon}</span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>);
}
