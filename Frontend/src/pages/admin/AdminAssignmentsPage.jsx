import { BusFront, CheckCircle2, ClipboardList, Save, UserRound, Users, } from "lucide-react";
import { useEffect, useState } from "react";
import { useAdminData } from "../../admin/AdminDataContext";
import { AdminFeedback, AdminPageHeading, AdminStatusBadge, } from "../../components/admin/AdminUI";

function draftFromRoute(route) {
    return {
        busId: route.busId ?? "",
        driverId: route.driverId ?? "",
        conductorId: route.conductorId ?? "",
    };
}

export function AdminAssignmentsPage() {
    const { records, routes, upsertRoute } = useAdminData();
    const [drafts, setDrafts] = useState(Object.fromEntries(routes.map((route) => [
        route.id,
        draftFromRoute(route),
    ])));
    const [feedback, setFeedback] = useState(null);
    const [savingId, setSavingId] = useState("");
    useEffect(() => {
        setDrafts(Object.fromEntries(routes.map((route) => [
            route.id,
            draftFromRoute(route),
        ])));
    }, [routes]);
    const save = async (routeId) => {
        const route = routes.find((item) => item.id === routeId);
        const draft = drafts[routeId];
        if (!route || !draft?.busId || !draft?.driverId || !draft?.conductorId) {
            setFeedback({
                type: "error",
                title: "Assignment incomplete",
                message: `Select a bus, driver and conductor before saving ${route?.code ?? "this route"}.`,
            });
            return;
        }
        setSavingId(routeId);
        try {
            const saved = await upsertRoute({ ...route, ...draft });
            setDrafts((current) => ({
                ...current,
                [saved.id]: {
                    busId: saved.busId,
                    driverId: saved.driverId,
                    conductorId: saved.conductorId,
                },
            }));
            setFeedback({
                type: "success",
                title: "Assignments saved",
                message: `${saved.code} is now synced across admin, driver, conductor and student dashboards.`,
            });
        }
        catch (error) {
            setFeedback({
                type: "error",
                title: "Could not save",
                message: error instanceof Error ? error.message : "The assignment could not be saved to the backend.",
            });
        }
        finally {
            setSavingId("");
        }
    };
    return (<div>
      <AdminPageHeading eyebrow="Operations setup" title="Assignment management" description="Assign a bus, driver and conductor to every active route."/>
      {feedback && (<AdminFeedback {...feedback} dismiss={() => setFeedback(null)}/>)}
      <section className="assignment-grid">
        {routes.map((route) => {
            const draft = drafts[route.id] ?? draftFromRoute(route);
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
              <button className="button admin-primary-button" onClick={() => void save(route.id)} disabled={savingId === route.id}>
                <Save /> {savingId === route.id ? "Saving..." : "Save assignments"}
              </button>
              {draft.busId && draft.driverId && draft.conductorId && (<p className="assignment-complete">
                  <CheckCircle2 /> Assignment complete
                </p>)}
            </article>);
        })}
      </section>
    </div>);
}
