import { BusFront, CheckCircle2, Clock3, Filter, MessageSquareText, Route, Search, UserRound, Users, X, } from "lucide-react";
import { useMemo, useState } from "react";
import { useCommunications } from "../../communications/CommunicationsContext";
import { AdminFeedback, AdminPageHeading, AdminStatusBadge, } from "../../components/admin/AdminUI";
const teams = [
    "Unassigned",
    "Operations Team",
    "Route Supervisor",
    "Fleet Maintenance",
    "Student Support",
];
export function AdminComplaintsPage() {
    const { complaints, updateComplaint } = useCommunications();
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [routeFilter, setRouteFilter] = useState("all");
    const [selectedId, setSelectedId] = useState(complaints[0]?.id ?? "");
    const selected = complaints.find((item) => item.id === selectedId) ?? complaints[0];
    const [status, setStatus] = useState(selected?.status ?? "new");
    const [assignedTo, setAssignedTo] = useState(selected?.assignedTo ?? "Unassigned");
    const [internalNote, setInternalNote] = useState("");
    const [resolution, setResolution] = useState(selected?.resolution ?? "");
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const categories = useMemo(() => [...new Set(complaints.map((item) => item.category))], [complaints]);
    const routes = useMemo(() => [...new Set(complaints.map((item) => item.routeCode))], [complaints]);
    const visible = useMemo(() => complaints.filter((item) => {
        const matchesQuery = `${item.id} ${item.studentName} ${item.subject} ${item.busNumber}`
            .toLowerCase()
            .includes(query.toLowerCase());
        return (matchesQuery &&
            (statusFilter === "all" || item.status === statusFilter) &&
            (categoryFilter === "all" || item.category === categoryFilter) &&
            (routeFilter === "all" || item.routeCode === routeFilter));
    }), [categoryFilter, complaints, query, routeFilter, statusFilter]);
    const summary = {
        all: complaints.length,
        new: complaints.filter((item) => item.status === "new").length,
        inProgress: complaints.filter((item) => item.status === "in-progress")
            .length,
        resolved: complaints.filter((item) => item.status === "resolved").length,
    };
    const selectComplaint = (complaint) => {
        setSelectedId(complaint.id);
        setStatus(complaint.status);
        setAssignedTo(complaint.assignedTo);
        setInternalNote("");
        setResolution(complaint.resolution ?? "");
        setFeedback(null);
    };
    const save = async (markResolved = false) => {
        if (!selected)
            return;
        const nextStatus = markResolved ? "resolved" : status;
        if (nextStatus === "resolved" && resolution.trim().length < 10) {
            setFeedback({
                type: "error",
                title: "Resolution reply required",
                message: "Add a clear response of at least 10 characters before resolving this complaint.",
            });
            return;
        }
        setSaving(true);
        try {
            const updated = await updateComplaint({
                id: selected.id,
                status: nextStatus,
                assignedTo,
                internalNote,
                resolution,
            });
            setStatus(updated.status);
            setAssignedTo(updated.assignedTo);
            setInternalNote("");
            setResolution(updated.resolution ?? "");
            setFeedback({
                type: "success",
                title: markResolved ? "Complaint resolved" : "Complaint updated",
                message: `${updated.id} is now ${updated.status.replace("-", " ")} and assigned to ${updated.assignedTo}.`,
            });
        }
        catch {
            setFeedback({
                type: "error",
                title: "Update failed",
                message: "The complaint could not be updated. Please retry.",
            });
        }
        finally {
            setSaving(false);
        }
    };
    return (<div>
      <AdminPageHeading eyebrow="Student support" title="Complaints workspace" description="Search, assign, investigate and resolve student transport complaints."/>
      <section className="complaint-summary-grid" aria-label="Complaint summary">
        <article>
          <span className="admin-kpi-icon">
            <MessageSquareText />
          </span>
          <div>
            <small>Total complaints</small>
            <strong>{summary.all}</strong>
          </div>
        </article>
        <article>
          <span className="admin-kpi-icon admin-kpi-icon--red">
            <Clock3 />
          </span>
          <div>
            <small>New</small>
            <strong>{summary.new}</strong>
          </div>
        </article>
        <article>
          <span className="admin-kpi-icon admin-kpi-icon--gold">
            <Users />
          </span>
          <div>
            <small>In progress</small>
            <strong>{summary.inProgress}</strong>
          </div>
        </article>
        <article>
          <span className="admin-kpi-icon admin-kpi-icon--green">
            <CheckCircle2 />
          </span>
          <div>
            <small>Resolved</small>
            <strong>{summary.resolved}</strong>
          </div>
        </article>
      </section>
      {feedback && (<AdminFeedback {...feedback} dismiss={() => setFeedback(null)}/>)}
      <section className="complaint-filter-bar">
        <label className="admin-search">
          <Search />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ID, student, subject or bus…" aria-label="Search complaints"/>
          {query && (<button onClick={() => setQuery("")} aria-label="Clear complaint search">
              <X />
            </button>)}
        </label>
        <label className="admin-filter">
          <Filter />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter complaints by status">
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="in-progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        <label className="admin-filter">
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter complaints by category">
            <option value="all">All categories</option>
            {categories.map((category) => (<option key={category}>{category}</option>))}
          </select>
        </label>
        <label className="admin-filter">
          <Route />
          <select value={routeFilter} onChange={(event) => setRouteFilter(event.target.value)} aria-label="Filter complaints by route">
            <option value="all">All routes</option>
            {routes.map((route) => (<option key={route}>{route}</option>))}
          </select>
        </label>
      </section>
      <div className="complaints-admin-layout complaints-workspace">
        <section className="admin-table-card complaint-table-card">
          <div className="complaint-table-count">
            <span>{visible.length} matching complaints</span>
            <small>Newest first</small>
          </div>
          {visible.length ? (<div className="admin-table-scroll">
              <table className="complaint-admin-table">
                <thead>
                  <tr>
                    <th>Complaint</th>
                    <th>Student</th>
                    <th>Context</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (<tr key={item.id} className={selected?.id === item.id ? "selected" : ""}>
                      <td>
                        <button className="complaint-select-button" onClick={() => selectComplaint(item)}>
                          <small>
                            {item.id} · {item.category}
                          </small>
                          <strong>{item.subject}</strong>
                          <span>{item.createdAt}</span>
                        </button>
                      </td>
                      <td>
                        <strong>{item.studentName}</strong>
                        <small>{item.studentEmail}</small>
                      </td>
                      <td>
                        <strong>
                          {item.routeCode} · {item.busNumber}
                        </strong>
                        <small>{item.tripId}</small>
                      </td>
                      <td>
                        <AdminStatusBadge status={item.status}/>
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>) : (<div className="admin-empty">
              <Search />
              <strong>No search results</strong>
              <p>Adjust the filters or search terms.</p>
            </div>)}
        </section>
        {selected && (<aside className="admin-panel complaint-admin-detail complaint-case-detail">
            <header>
              <span>{selected.id}</span>
              <AdminStatusBadge status={selected.status}/>
            </header>
            <h2>{selected.subject}</h2>
            <p className="complaint-description">{selected.description}</p>
            <div className="complaint-context complaint-context--full">
              <div>
                <UserRound />
                <span>
                  <small>Student</small>
                  <strong>{selected.studentName}</strong>
                </span>
              </div>
              <div>
                <Route />
                <span>
                  <small>Route</small>
                  <strong>{selected.routeCode}</strong>
                </span>
              </div>
              <div>
                <BusFront />
                <span>
                  <small>Bus</small>
                  <strong>{selected.busNumber}</strong>
                </span>
              </div>
              <div>
                <Clock3 />
                <span>
                  <small>Trip</small>
                  <strong>{selected.tripId}</strong>
                </span>
              </div>
            </div>
            <section className="complaint-timeline">
              <h3>Complaint timeline</h3>
              {selected.timeline.map((event) => (<div key={event.id}>
                  <i />
                  <span>
                    <strong>{event.title}</strong>
                    <small>{event.detail}</small>
                    <time>{event.timestamp}</time>
                  </span>
                </div>))}
            </section>
            <div className="admin-form-row">
              <label className="admin-form-field">
                <span>Assigned team</span>
                <select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
                  {teams.map((team) => (<option key={team}>{team}</option>))}
                </select>
              </label>
              <label className="admin-form-field">
                <span>Status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="new">New</option>
                  <option value="in-progress">In progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </label>
            </div>
            <label className="admin-form-field">
              <span>Internal note</span>
              <textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Visible only to transport operators…"/>
            </label>
            {selected.internalNotes.length > 0 && (<section className="complaint-note-list">
                <h3>Internal notes</h3>
                {selected.internalNotes.map((note) => (<article key={note.id}>
                    <strong>{note.author}</strong>
                    <span>{note.message}</span>
                    <small>{note.createdAt}</small>
                  </article>))}
              </section>)}
            <label className="admin-form-field">
              <span>Resolution reply</span>
              <textarea value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="Explain the outcome to the student…"/>
            </label>
            <div className="complaint-detail-actions">
              <button className="button button--secondary" onClick={() => save(false)} disabled={saving}>
                {saving ? "Saving…" : "Save update"}
              </button>
              <button className="button admin-primary-button" onClick={() => save(true)} disabled={saving || selected.status === "resolved"}>
                <CheckCircle2 /> Mark as resolved
              </button>
            </div>
          </aside>)}
      </div>
    </div>);
}
