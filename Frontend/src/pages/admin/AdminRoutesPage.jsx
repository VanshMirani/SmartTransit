import { ArrowDown, ArrowLeft, ArrowUp, BusFront, MapPin, Pencil, Plus, Route, Save, Search, ToggleLeft, ToggleRight, Trash2, UserRound, Users, X, } from "lucide-react";
import { useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, } from "react-leaflet";
import { useAdminData } from "../../admin/AdminDataContext";
import { AdminFeedback, AdminPageHeading, AdminStatusBadge, } from "../../components/admin/AdminUI";
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
        setEditing(structuredClone(route));
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
        setErrors(next);
        if (Object.keys(next).length)
            return;
        const route = { ...editing, id: editing.id || `route-${Date.now()}` };
        upsertRoute(route);
        setSelectedId(route.id);
        setEditing(null);
        setFeedback(`${route.code} was saved with ${route.stops.length} ordered stops.`);
    };
    return (<div>
      {editing ? (<RouteEditor route={editing} setRoute={setEditing} errors={errors} records={records} save={save} cancel={() => setEditing(null)}/>) : (<>
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
function RouteEditor({ route, setRoute, errors, records, save, cancel, }) {
    const [newStop, setNewStop] = useState({
        name: "",
        scheduledTime: "",
        lat: "23.0700",
        lng: "72.5400",
    });
    const [stopError, setStopError] = useState("");
    const updateStop = (index, patch) => setRoute({
        ...route,
        stops: route.stops.map((stop, i) => i === index ? { ...stop, ...patch } : stop),
    });
    const move = (index, direction) => {
        const target = index + direction;
        if (target < 0 || target >= route.stops.length)
            return;
        const stops = [...route.stops];
        [stops[index], stops[target]] = [stops[target], stops[index]];
        setRoute({ ...route, stops });
    };
    const addStop = () => {
        const lat = Number(newStop.lat), lng = Number(newStop.lng);
        if (!newStop.name.trim() ||
            !newStop.scheduledTime ||
            Number.isNaN(lat) ||
            Number.isNaN(lng)) {
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
                    coordinates: [lat, lng],
                },
            ],
        });
        setNewStop({ name: "", scheduledTime: "", lat: "23.0700", lng: "72.5400" });
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
                <div>
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
            <button type="button" className="button button--secondary" onClick={addStop}>
              <Plus /> Add stop
            </button>
          </div>
          {stopError && <small className="field-error">{stopError}</small>}
        </section>
        <section className="admin-panel route-editor-map">
          <div className="admin-panel-title">
            <div>
              <h2>Map preview</h2>
              <p>Updates with ordered stop coordinates</p>
            </div>
          </div>
          {route.stops.length ? (<MapContainer key={route.stops.map((stop) => stop.id).join()} center={route.stops[0].coordinates} zoom={11} scrollWheelZoom={false} className="admin-route-map">
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
              <Polyline positions={route.stops.map((stop) => stop.coordinates)} pathOptions={{ color: "#0b948f", weight: 5 }}/>
              {route.stops.map((stop, index) => (<CircleMarker key={stop.id} center={stop.coordinates} radius={8} pathOptions={{
                    color: "#0b948f",
                    fillColor: index === 0 ? "#ffb547" : "#fff",
                    fillOpacity: 1,
                    weight: 3,
                }}>
                  <Popup>
                    {index + 1}. {stop.name}
                  </Popup>
                </CircleMarker>))}
            </MapContainer>) : (<div className="route-map-empty">
              <MapPin />
              <strong>Add stops to preview the route</strong>
            </div>)}
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
