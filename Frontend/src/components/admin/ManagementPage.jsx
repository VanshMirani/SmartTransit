import { ArrowDownAZ, ChevronLeft, ChevronRight, Eye, Filter, Pencil, Plus, Search, ToggleLeft, ToggleRight, } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAdminData } from "../../admin/AdminDataContext";
import { AdminFeedback, AdminModal, AdminPageHeading, AdminStatusBadge, } from "./AdminUI";
import { isInstituteEmail, normalizeEmail, validatePassword } from "../../utils/registrationValidation";
const labels = {
    buses: {
        singular: "bus",
        title: "Bus management",
        description: "Manage the university fleet, capacity and service status.",
        name: "Bus number",
        code: "Registration number",
        detail: "Model",
        contact: "Capacity",
        assignment: "Route & driver",
    },
    drivers: {
        singular: "driver",
        title: "Driver management",
        description: "Manage driver accounts, licences and current assignments.",
        name: "Driver name",
        code: "Driver ID",
        detail: "Licence details",
        contact: "Phone number",
        assignment: "Bus & route",
    },
    conductors: {
        singular: "conductor",
        title: "Conductor management",
        description: "Manage conductor accounts, shifts and assignments.",
        name: "Conductor name",
        code: "Conductor ID",
        detail: "Shift details",
        contact: "Phone number",
        assignment: "Bus & route",
    },
    students: {
        singular: "student",
        title: "Student management",
        description: "Manage student access and transport assignments.",
        name: "Student name",
        code: "Student code",
        detail: "Programme",
        contact: "University email",
        assignment: "Route & stop",
    },
    stops: {
        singular: "stop",
        title: "Stop management",
        description: "Manage route stops, coordinates and scheduled arrivals.",
        name: "Stop name",
        code: "Stop ID",
        detail: "Coordinates",
        contact: "Scheduled time",
        assignment: "Route & order",
    },
};
const emptyRecord = (kind) => ({
    id: "",
    name: "",
    code: "",
    detail: "",
    contact: "",
    assignment: kind === "students" ? "" : "Unassigned",
    ...(kind === "students" ? { routeCode: "", stopId: "" } : {}),
    ...(kind === "drivers" || kind === "conductors" ? { accountEmail: "", temporaryPassword: "" } : {}),
    status: kind === "students" ? "pending" : "active",
});

function routeCodeFromAssignment(assignment) {
    return assignment?.match(/\bIU-R\d+\b/i)?.[0]?.toUpperCase() ?? "";
}

function isStaffKind(kind) {
    return kind === "drivers" || kind === "conductors";
}

function nextRecordStatus(status) {
    return status === "active" ? "inactive" : "active";
}

function assignmentForStudentRoute(routeCode, stopId, routes) {
    if (!routeCode)
        return "Unassigned";
    const route = routes.find((item) => item.code === routeCode);
    const stop = route?.stops?.find((item) => item.id === stopId);
    return `${routeCode} - ${stop?.name ?? "Pending stop assignment"}`;
}

function stopIdFromAssignment(route, assignment) {
    if (!route)
        return "";
    const stopName = assignment?.replace(new RegExp(`^${route.code}\\s*-\\s*`, "i"), "").trim();
    return route.stops?.find((stop) => stop.name.toLowerCase() === stopName?.toLowerCase())?.id ?? "";
}

function prepareEditableRecord(record, kind, routes) {
    if (kind !== "students")
        return { ...record };
    const routeCode = record.routeCode || routeCodeFromAssignment(record.assignment);
    const route = routes.find((item) => item.code === routeCode);
    const stopId = route?.stops?.some((stop) => stop.id === record.stopId)
        ? record.stopId
        : stopIdFromAssignment(route, record.assignment);
    return {
        ...record,
        routeCode,
        stopId,
        assignment: assignmentForStudentRoute(routeCode, stopId, routes),
    };
}

function normalizeStudentRecord(record, routes) {
    return {
        ...record,
        routeCode: record.routeCode ?? "",
        stopId: record.stopId ?? "",
        assignment: assignmentForStudentRoute(record.routeCode, record.stopId, routes),
        status: record.status ?? "pending",
    };
}

export function ManagementPage({ kind }) {
    const config = labels[kind];
    const [searchParams] = useSearchParams();
    const { records, routes, upsertRecord, toggleRecord } = useAdminData();
    const [query, setQuery] = useState(() => searchParams.get("search") ?? "");
    const [filter, setFilter] = useState("all");
    const [ascending, setAscending] = useState(true);
    const [page, setPage] = useState(1);
    const [editing, setEditing] = useState(null);
    const [viewing, setViewing] = useState(null);
    const [confirming, setConfirming] = useState(null);
    const [errors, setErrors] = useState({});
    const [feedback, setFeedback] = useState(null);
    const [savingRecord, setSavingRecord] = useState(false);
    const [savingStatus, setSavingStatus] = useState(false);
    const pageSize = 5;
    useEffect(() => {
        setQuery(searchParams.get("search") ?? "");
        setPage(1);
    }, [searchParams]);
    const filtered = useMemo(() => records[kind]
        .filter((item) => (filter === "all" || item.status === filter) &&
        `${item.name} ${item.code} ${item.assignment}`
            .toLowerCase()
            .includes(query.toLowerCase()))
        .sort((a, b) => (ascending ? 1 : -1) * a.name.localeCompare(b.name)), [records, kind, filter, query, ascending]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
    const openAdd = () => {
        setEditing(prepareEditableRecord(emptyRecord(kind), kind, routes));
        setErrors({});
    };
    const save = async (event) => {
        event.preventDefault();
        if (!editing || savingRecord)
            return;
        const recordToSave = kind === "students" ? normalizeStudentRecord(editing, routes) : editing;
        const isNew = !recordToSave.id;
        const next = {};
        if (!recordToSave.name.trim())
            next.name = `${config.name} is required.`;
        if (!recordToSave.code.trim())
            next.code = `${config.code} is required.`;
        if (!recordToSave.detail.trim())
            next.detail = `${config.detail} is required.`;
        if (records[kind].some((item) => item.code.toLowerCase() === recordToSave.code.toLowerCase() &&
            item.id !== recordToSave.id))
            next.code = `${config.code} already exists.`;
        if (kind === "students" && recordToSave.status === "active") {
            if (!recordToSave.routeCode)
                next.assignment = "Assign a route before approving this student.";
            else if (!recordToSave.stopId)
                next.assignment = "Assign a pickup stop before approving this student.";
        }
        if (isStaffKind(kind)) {
            const accountEmail = normalizeEmail(recordToSave.accountEmail ?? "");
            if (isNew && !accountEmail)
                next.accountEmail = "Enter the staff login email.";
            else if (accountEmail && !isInstituteEmail(accountEmail))
                next.accountEmail = "Use an Indus University email.";
            if (isNew && !recordToSave.temporaryPassword?.trim()) {
                next.temporaryPassword = "Enter a temporary password for this staff login.";
            }
            const passwordError = recordToSave.temporaryPassword?.trim()
                ? validatePassword(recordToSave.temporaryPassword)
                : "";
            if (passwordError)
                next.temporaryPassword = passwordError;
        }
        setErrors(next);
        if (Object.keys(next).length) {
            setFeedback({
                type: "error",
                title: "Could not save",
                message: "Review the highlighted fields and try again.",
            });
            return;
        }
        setSavingRecord(true);
        try {
            const saved = await upsertRecord(kind, {
                ...recordToSave,
                id: recordToSave.id || `${kind}-${Date.now()}`,
            });
            setEditing(null);
            setFeedback({
                type: "success",
                title: `${config.singular[0].toUpperCase() + config.singular.slice(1)} ${isNew ? "added" : "updated"}`,
                message: `${saved.name} was saved successfully.`,
            });
        }
        catch {
            setFeedback({
                type: "error",
                title: "Could not save",
                message: "The change could not be saved to the backend. Please retry.",
            });
        }
        finally {
            setSavingRecord(false);
        }
    };
    return (<div>
      <AdminPageHeading eyebrow="Fleet & people" title={config.title} description={config.description} actions={<button className="button admin-primary-button" onClick={openAdd}>
            <Plus /> Add {config.singular}
          </button>}/>
      {feedback && (<AdminFeedback {...feedback} dismiss={() => setFeedback(null)}/>)}
      <section className="admin-table-card">
        <div className="admin-table-toolbar">
          <label className="admin-search">
            <Search />
            <input value={query} onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
        }} placeholder={`Search ${kind}…`} aria-label={`Search ${kind}`}/>
          </label>
          <label className="admin-filter">
            <Filter />
            <select value={filter} onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
        }} aria-label={`Filter ${kind} by status`}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              {kind === "students" && (<option value="pending">Pending approval</option>)}
              <option value="inactive">Inactive</option>
              {kind === "buses" && (<option value="maintenance">Maintenance</option>)}
            </select>
          </label>
          <button className="admin-sort" onClick={() => setAscending(!ascending)}>
            <ArrowDownAZ /> {ascending ? "A–Z" : "Z–A"}
          </button>
        </div>
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{config.name}</th>
                <th>{config.code}</th>
                <th>{config.detail}</th>
                <th>{config.contact}</th>
                <th>{config.assignment}</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (<tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>{item.code}</td>
                  <td>{item.detail}</td>
                  <td>{item.contact}</td>
                  <td>{item.assignment}</td>
                  <td>
                    <AdminStatusBadge status={item.status}/>
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <button onClick={() => setViewing(item)} aria-label={`View ${item.name}`}>
                        <Eye />
                      </button>
                      <button onClick={() => {
                setEditing(prepareEditableRecord(item, kind, routes));
                setErrors({});
            }} aria-label={`Edit ${item.name}`}>
                        <Pencil />
                      </button>
                      <button onClick={() => setConfirming(item)} aria-label={`${nextRecordStatus(item.status) === "inactive" ? "Deactivate" : "Activate"} ${item.name}`}>
                        {item.status === "active" ? (<ToggleRight />) : (<ToggleLeft />)}
                      </button>
                    </div>
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>
        {!visible.length && (<div className="admin-empty">
            <Search />
            <strong>No matching {kind}</strong>
            <p>Try a different search or status filter.</p>
          </div>)}
        <footer className="admin-pagination">
          <span>
            Showing {visible.length} of {filtered.length} records
          </span>
          <div>
            <button disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
              <ChevronLeft />
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button disabled={page === totalPages} onClick={() => setPage(page + 1)} aria-label="Next page">
              <ChevronRight />
            </button>
          </div>
        </footer>
      </section>
      {editing && (<AdminModal title={`${editing.id ? "Edit" : "Add"} ${config.singular}`} description="Fields marked with * are required." close={() => setEditing(null)} footer={<>
              <button className="button button--secondary" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="button admin-primary-button" onClick={save} disabled={savingRecord}>
                {savingRecord ? "Saving..." : `Save ${config.singular}`}
              </button>
            </>}>
          <form className="admin-record-form" onSubmit={save} noValidate>
            <AdminField label={config.name} value={editing.name} setValue={(value) => setEditing({ ...editing, name: value })} error={errors.name}/>
            <AdminField label={config.code} value={editing.code} setValue={(value) => setEditing({ ...editing, code: value })} error={errors.code}/>
            <AdminField label={config.detail} value={editing.detail} setValue={(value) => setEditing({ ...editing, detail: value })} error={errors.detail}/>
            <AdminField label={config.contact} value={editing.contact} setValue={(value) => setEditing({ ...editing, contact: value })}/>
            {kind === "students" ? (<StudentAssignmentFields student={editing} setStudent={setEditing} routes={routes} error={errors.assignment}/>) : (<AdminField label={config.assignment} value={editing.assignment} setValue={(value) => setEditing({ ...editing, assignment: value })}/>)}
            {isStaffKind(kind) && (<StaffAccountFields record={editing} setRecord={setEditing} errors={errors} isNew={!editing.id}/>)}
            <label className="admin-form-field">
              <span>Status</span>
              <select value={editing.status} onChange={(e) => setEditing({
                ...editing,
                status: e.target.value,
            })}>
                {kind === "students" && (<option value="pending">Pending approval</option>)}
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                {kind === "buses" && (<option value="maintenance">Maintenance</option>)}
              </select>
            </label>
          </form>
        </AdminModal>)}
      {viewing && (<AdminModal title={viewing.name} description={`${config.singular[0].toUpperCase() + config.singular.slice(1)} details`} close={() => setViewing(null)}>
          <dl className="admin-detail-list">
            <div>
              <dt>{config.code}</dt>
              <dd>{viewing.code}</dd>
            </div>
            <div>
              <dt>{config.detail}</dt>
              <dd>{viewing.detail}</dd>
            </div>
            <div>
              <dt>{config.contact}</dt>
              <dd>{viewing.contact}</dd>
            </div>
            <div>
              <dt>{config.assignment}</dt>
              <dd>{viewing.assignment}</dd>
            </div>
            {isStaffKind(kind) && (<div>
              <dt>Staff login email</dt>
              <dd>{viewing.accountEmail || "Not issued"}</dd>
            </div>)}
            <div>
              <dt>Status</dt>
              <dd>
                <AdminStatusBadge status={viewing.status}/>
              </dd>
            </div>
          </dl>
        </AdminModal>)}
      {confirming && (<AdminModal title={`${nextRecordStatus(confirming.status) === "inactive" ? "Deactivate" : "Activate"} ${confirming.name}?`} description={`This will change access and availability for this ${config.singular}.`} close={() => setConfirming(null)} footer={<>
              <button className="button button--secondary" onClick={() => setConfirming(null)}>
                Cancel
              </button>
              <button className="button admin-primary-button" disabled={savingStatus} onClick={async () => {
                    setSavingStatus(true);
                    try {
                        const saved = await toggleRecord(kind, confirming.id);
                        setFeedback({
                            type: "success",
                            title: "Status updated",
                            message: `${saved.name} is now ${saved.status}.`,
                        });
                        setConfirming(null);
                    }
                    catch (reason) {
                        setFeedback({
                            type: "error",
                            title: "Status not changed",
                            message: reason instanceof Error ? reason.message : "The status could not be updated.",
                        });
                    }
                    finally {
                        setSavingStatus(false);
                    }
                }}>
                {savingStatus ? "Updating..." : "Confirm status change"}
              </button>
            </>}>
          <p className="admin-confirm-copy">
            Existing historical records will be preserved.
          </p>
        </AdminModal>)}
    </div>);
}

function StaffAccountFields({ record, setRecord, errors, isNew, }) {
    return (<div className="admin-staff-account-fields">
      <div className="admin-form-section-title">
        <strong>Staff login</strong>
        <small>{isNew ? "Admin issues the first password." : "Leave password blank unless resetting access."}</small>
      </div>
      <AdminField label="Login email" value={record.accountEmail ?? ""} setValue={(value) => setRecord({ ...record, accountEmail: value })} error={errors.accountEmail} required={isNew}/>
      <AdminField label={isNew ? "Temporary password" : "Reset password"} value={record.temporaryPassword ?? ""} setValue={(value) => setRecord({ ...record, temporaryPassword: value })} error={errors.temporaryPassword} type="password" autoComplete="new-password" required={isNew}/>
    </div>);
}

function StudentAssignmentFields({ student, setStudent, routes, error, }) {
    const selectedRoute = routes.find((route) => route.code === student.routeCode);
    const stops = selectedRoute?.stops ?? [];
    return (<div className="admin-form-row">
      <label className="admin-form-field">
        <span>Assigned route</span>
        <select value={student.routeCode ?? ""} onChange={(event) => setStudent({
            ...student,
            routeCode: event.target.value,
            stopId: "",
            assignment: assignmentForStudentRoute(event.target.value, "", routes),
        })} aria-invalid={Boolean(error)}>
          <option value="">Unassigned</option>
          {routes.map((route) => (<option key={route.id} value={route.code}>
              {route.code} - {route.name}
            </option>))}
        </select>
        {error && <small>{error}</small>}
      </label>
      <label className="admin-form-field">
        <span>Pickup stop</span>
        <select value={student.stopId ?? ""} disabled={!selectedRoute} onChange={(event) => setStudent({
            ...student,
            stopId: event.target.value,
            assignment: assignmentForStudentRoute(student.routeCode, event.target.value, routes),
        })}>
          <option value="">Pending stop assignment</option>
          {stops.map((stop) => (<option key={stop.id} value={stop.id}>
              {stop.name} · {stop.scheduledTime}
            </option>))}
        </select>
      </label>
    </div>);
}
function AdminField({ label, value, setValue, error, type = "text", autoComplete, required = true, }) {
    return (<label className="admin-form-field">
      <span>{label}{required ? " *" : ""}</span>
      <input type={type} autoComplete={autoComplete} value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={Boolean(error)}/>
      {error && <small>{error}</small>}
    </label>);
}
