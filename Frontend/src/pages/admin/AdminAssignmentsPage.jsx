import { BusFront, CheckCircle2, ClipboardList, Save, UserRound, Users, } from "lucide-react";
import { useState } from "react";
import { useAdminData } from "../../admin/AdminDataContext";
import { AdminFeedback, AdminPageHeading, AdminStatusBadge, } from "../../components/admin/AdminUI";
export function AdminAssignmentsPage() {
    const { records, routes, upsertRoute } = useAdminData();
    const [drafts, setDrafts] = useState(Object.fromEntries(routes.map((route) => [
        route.id,
        {
            busId: route.busId,
            driverId: route.driverId,
            conductorId: route.conductorId,
        },
    ])));
    const [feedback, setFeedback] = useState(null);
    const save = (routeId) => {
        const route = routes.find((item) => item.id === routeId);
        const draft = drafts[routeId];
        if (!draft.busId || !draft.driverId || !draft.conductorId) {
            setFeedback({
                type: "error",
                title: "Assignment incomplete",
                message: `Select a bus, driver and conductor before saving ${route.code}.`,
            });
            return;
        }
        upsertRoute({ ...route, ...draft });
        setFeedback({
            type: "success",
            title: "Assignments saved",
            message: `${route.code} assignments were updated successfully.`,
        });
    };
    return (<div>
      <AdminPageHeading eyebrow="Operations setup" title="Assignment management" description="Assign a bus, driver and conductor to every active route."/>
      {feedback && (<AdminFeedback {...feedback} dismiss={() => setFeedback(null)}/>)}
      <section className="assignment-grid">
        {routes.map((route) => {
            const draft = drafts[route.id];
            return (<article key={route.id}>
              <header>
                <span className="admin-kpi-icon">
                  <ClipboardList />
                </span>
                <div>
                  <small>{route.code}</small>
                  <h2>{route.name}</h2>
                </div>
                <AdminStatusBadge status={route.status}/>
              </header>
              <label>
                <span>
                  <BusFront /> Assigned bus
                </span>
                <select value={draft.busId} onChange={(e) => setDrafts({
                    ...drafts,
                    [route.id]: { ...draft, busId: e.target.value },
                })}>
                  <option value="">Select bus</option>
                  {records.buses
                    .filter((item) => item.status === "active" || item.id === draft.busId)
                    .map((item) => (<option value={item.id} key={item.id}>
                        {item.name} · {item.code}
                      </option>))}
                </select>
              </label>
              <label>
                <span>
                  <UserRound /> Assigned driver
                </span>
                <select value={draft.driverId} onChange={(e) => setDrafts({
                    ...drafts,
                    [route.id]: { ...draft, driverId: e.target.value },
                })}>
                  <option value="">Select driver</option>
                  {records.drivers
                    .filter((item) => item.status === "active" || item.id === draft.driverId)
                    .map((item) => (<option value={item.id} key={item.id}>
                        {item.name} · {item.code}
                      </option>))}
                </select>
              </label>
              <label>
                <span>
                  <Users /> Assigned conductor
                </span>
                <select value={draft.conductorId} onChange={(e) => setDrafts({
                    ...drafts,
                    [route.id]: { ...draft, conductorId: e.target.value },
                })}>
                  <option value="">Select conductor</option>
                  {records.conductors
                    .filter((item) => item.status === "active" ||
                    item.id === draft.conductorId)
                    .map((item) => (<option value={item.id} key={item.id}>
                        {item.name} · {item.code}
                      </option>))}
                </select>
              </label>
              <button className="button admin-primary-button" onClick={() => save(route.id)}>
                <Save /> Save assignments
              </button>
              {draft.busId && draft.driverId && draft.conductorId && (<p className="assignment-complete">
                  <CheckCircle2 /> Assignment complete
                </p>)}
            </article>);
        })}
      </section>
    </div>);
}
