import { AlertCircle, CheckCircle2, ChevronDown, Clock3, LoaderCircle, MessageSquareText, Plus, Search, Send, X, } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useCommunications } from "../../communications/CommunicationsContext";
import { ComplaintStatusBadge, PageHeading, } from "../../components/student/StudentUI";
import { useStudentData } from "../../hooks/useStudentData";
import { studentTransitData } from "../../services/mockData";
const fallbackAssignedService = `${studentTransitData.bus.number} / Route ${studentTransitData.route.code}`;
const blankForm = {
    category: "",
    subject: "",
    relatedService: "",
    description: "",
};
export function ComplaintsPage() {
    const { user } = useAuth();
    const { data } = useStudentData();
    const { complaints, createComplaint } = useCommunications();
    const transit = data ?? studentTransitData;
    const assignmentPending = transit.assignmentStatus === "unassigned" || !transit.route?.code || !transit.route?.stops?.length;
    const assignedService = assignmentPending ? "Pending route assignment" : `${transit.bus.number} / Route ${transit.route.code}`;
    const routeOnlyService = assignmentPending ? "" : `Route ${transit.route.code} only`;
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState(() => ({
        ...blankForm,
        relatedService: assignedService,
    }));
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [successId, setSuccessId] = useState("");
    const [expanded, setExpanded] = useState(null);
    const [statusFilter, setStatusFilter] = useState("all");
    const [query, setQuery] = useState("");
    useEffect(() => {
        setForm((current) => !current.relatedService || current.relatedService === fallbackAssignedService
            ? {
                ...current,
                relatedService: assignedService,
            }
            : current);
    }, [assignedService]);
    const studentComplaints = useMemo(() => complaints.filter((complaint) => complaint.studentId === user?.id), [complaints, user?.id]);
    const visibleComplaints = useMemo(() => studentComplaints.filter((complaint) => {
        const matchesStatus = statusFilter === "all" || complaint.status === statusFilter;
        const matchesQuery = `${complaint.id} ${complaint.subject} ${complaint.category}`
            .toLowerCase()
            .includes(query.toLowerCase());
        return matchesStatus && matchesQuery;
    }), [query, statusFilter, studentComplaints]);
    const counts = {
        new: studentComplaints.filter((item) => item.status === "new").length,
        inProgress: studentComplaints.filter((item) => item.status === "in-progress").length,
        resolved: studentComplaints.filter((item) => item.status === "resolved")
            .length,
    };
    const submit = async (event) => {
        event.preventDefault();
        const nextErrors = {};
        if (!form.category)
            nextErrors.category = "Select a complaint category.";
        if (form.subject.trim().length < 5)
            nextErrors.subject = "Enter a short, descriptive subject.";
        if (form.description.trim().length < 20)
            nextErrors.description = "Please provide at least 20 characters.";
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length)
            return;
        setSubmitting(true);
        setSubmitError("");
        try {
            const complaint = await createComplaint(form);
            setSuccessId(complaint.id);
            setExpanded(complaint.id);
            setForm({
                ...blankForm,
                relatedService: assignedService,
            });
            setFormOpen(false);
        }
        catch {
            setSubmitError("Your complaint could not be submitted. Please retry.");
        }
        finally {
            setSubmitting(false);
        }
    };
    return (<div>
      <PageHeading eyebrow="Support" title="Complaints & feedback" description="Report a transport issue and follow every resolution step." action={<button className="button button--primary" onClick={() => setFormOpen(!formOpen)}>
            {formOpen ? <X /> : <Plus />}
            {formOpen ? "Close form" : "New complaint"}
          </button>}/>
      <section className="student-complaint-summary" aria-label="Complaint summary">
        <article>
          <span>New</span>
          <strong>{counts.new}</strong>
        </article>
        <article>
          <span>In progress</span>
          <strong>{counts.inProgress}</strong>
        </article>
        <article>
          <span>Resolved</span>
          <strong>{counts.resolved}</strong>
        </article>
      </section>
      {successId && (<div className="app-alert app-alert--success" role="status">
          <CheckCircle2 />
          <div>
            <strong>Complaint submitted successfully</strong>
            <span>
              Your complaint ID is <b>{successId}</b>. Keep it for your records.
            </span>
          </div>
          <button onClick={() => setSuccessId("")} aria-label="Dismiss success message">
            <X />
          </button>
        </div>)}
      {submitError && (<div className="app-alert app-alert--error" role="alert">
          <AlertCircle />
          <div>
            <strong>Submission failed</strong>
            <span>{submitError}</span>
          </div>
          <button onClick={() => setSubmitError("")} aria-label="Dismiss error message">
            <X />
          </button>
        </div>)}
      {formOpen && (<form className="complaint-form" onSubmit={submit} noValidate>
          <div className="section-title-row">
            <div>
              <h2>Raise a complaint or share feedback</h2>
              <p>Transport staff will review your submission.</p>
            </div>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="category">Category *</label>
              <div className={`select-wrap ${errors.category ? "input-wrap--error" : ""}`}>
                <select id="category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} aria-invalid={Boolean(errors.category)}>
                  <option value="">Select category</option>
                  <option>Delay</option>
                  <option>Bus condition</option>
                  <option>Driver or staff behaviour</option>
                  <option>Route or stop</option>
                  <option>Safety concern</option>
                  <option>General feedback</option>
                </select>
                <ChevronDown />
              </div>
              {errors.category && (<small className="field-error">{errors.category}</small>)}
            </div>
            <div className="field">
              <label htmlFor="service">Related bus or route *</label>
              <div className="select-wrap">
                <select id="service" value={form.relatedService} onChange={(event) => setForm({ ...form, relatedService: event.target.value })}>
                  <option>{assignedService}</option>
                  {!assignmentPending && <option>{routeOnlyService}</option>}
                  <option>Not related to a service</option>
                </select>
                <ChevronDown />
              </div>
            </div>
            <div className="field form-grid__full">
              <label htmlFor="subject">Subject *</label>
              <div className={`input-wrap ${errors.subject ? "input-wrap--error" : ""}`}>
                <MessageSquareText />
                <input id="subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Briefly describe the issue" maxLength={80} aria-invalid={Boolean(errors.subject)}/>
              </div>
              {errors.subject && (<small className="field-error">{errors.subject}</small>)}
            </div>
            <div className="field form-grid__full">
              <div className="field__label-row">
                <label htmlFor="description">Description *</label>
                <small>{form.description.length}/500</small>
              </div>
              <textarea id="description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Tell us what happened, including the stop and approximate time…" maxLength={500} aria-invalid={Boolean(errors.description)}/>
              {errors.description && (<small className="field-error">{errors.description}</small>)}
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="button button--secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button className="button button--primary" disabled={submitting}>
              {submitting ? (<>
                  <LoaderCircle className="spin"/> Submitting…
                </>) : (<>
                  <Send /> Submit complaint
                </>)}
            </button>
          </div>
        </form>)}
      <section className="complaint-history">
        <div className="section-title-row">
          <div>
            <h2>Complaint history</h2>
            <p>View current status and transport team responses.</p>
          </div>
          <span>{visibleComplaints.length} records</span>
        </div>
        <div className="student-complaint-filters">
          <label>
            <Search />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search complaint ID or subject" aria-label="Search complaint history"/>
          </label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter complaint history by status">
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="in-progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        {visibleComplaints.length ? (<div className="complaint-list">
            {visibleComplaints.map((complaint) => (<article key={complaint.id} className="complaint-item">
                <button onClick={() => setExpanded(expanded === complaint.id ? null : complaint.id)} aria-expanded={expanded === complaint.id}>
                  <span className="complaint-item__icon">
                    <MessageSquareText />
                  </span>
                  <span>
                    <small>
                      {complaint.id} · {complaint.category}
                    </small>
                    <strong>{complaint.subject}</strong>
                    <em>Submitted {complaint.createdAt}</em>
                  </span>
                  <ComplaintStatusBadge status={complaint.status}/>
                  <ChevronDown className={expanded === complaint.id ? "rotate" : ""}/>
                </button>
                {expanded === complaint.id && (<div className="complaint-detail">
                    <p>{complaint.description}</p>
                    <div>
                      <span>
                        <strong>Last updated</strong>
                        {complaint.updatedAt}
                      </span>
                      <span>
                        <strong>Related service</strong>
                        {complaint.relatedService}
                      </span>
                    </div>
                    <div className="student-complaint-timeline">
                      {complaint.timeline.map((event) => (<span key={event.id}>
                          <i />
                          <b>{event.title}</b>
                          <small>{event.timestamp}</small>
                        </span>))}
                    </div>
                    {complaint.resolution ? (<section>
                        <CheckCircle2 />
                        <span>
                          <strong>Resolution from transport office</strong>
                          {complaint.resolution}
                        </span>
                      </section>) : (<section className="complaint-pending">
                        <Clock3 />
                        <span>
                          <strong>
                            {complaint.status === "new"
                            ? "Submitted for review"
                            : "Resolution in progress"}
                          </strong>
                          {complaint.assignedTo === "Unassigned"
                            ? "The transport team will assign this complaint shortly."
                            : `Assigned to ${complaint.assignedTo}.`}
                        </span>
                      </section>)}
                  </div>)}
              </article>))}
          </div>) : (<section className="state-card">
            <span className="state-card__icon">
              <MessageSquareText />
            </span>
            <h2>No matching complaints</h2>
            <p>Try a different search or status filter.</p>
          </section>)}
      </section>
    </div>);
}
