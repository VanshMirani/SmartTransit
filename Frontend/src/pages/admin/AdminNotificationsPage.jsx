import { Bell, CalendarClock, CheckCircle2, Clock3, Send, Users, } from "lucide-react";
import { useMemo, useState } from "react";
import { useCommunications } from "../../communications/CommunicationsContext";
import { AdminFeedback, AdminPageHeading, AdminStatusBadge, } from "../../components/admin/AdminUI";
import { defaultStudentRoute, indusRoutes } from "../../services/indusRoutes";
const routeOptions = indusRoutes.map((route) => route.code);
const totalStudentCount = indusRoutes.reduce((sum, route) => sum + route.studentCount, 0);
const typeLabels = {
    delay: "Delay",
    "route-change": "Route Change",
    cancellation: "Cancellation",
    general: "General Announcement",
};
const blankForm = {
    type: "delay",
    title: "",
    message: "",
    audience: "all",
    routeCode: defaultStudentRoute.code,
    deliveryMode: "now",
    scheduledFor: "",
};
export function AdminNotificationsPage() {
    const { campaigns, sendNotification } = useCommunications();
    const [form, setForm] = useState(blankForm);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [historyStatus, setHistoryStatus] = useState("all");
    const visibleCampaigns = useMemo(() => campaigns.filter((campaign) => historyStatus === "all" || campaign.status === historyStatus), [campaigns, historyStatus]);
    const submit = async (event) => {
        event.preventDefault();
        const scheduledForField = event.currentTarget.elements.namedItem("scheduledFor");
        const submittedForm = {
            ...form,
            scheduledFor: scheduledForField?.value ?? form.scheduledFor,
        };
        const nextErrors = {};
        if (submittedForm.title.trim().length < 5)
            nextErrors.title = "Enter a clear title of at least 5 characters.";
        if (submittedForm.message.trim().length < 10)
            nextErrors.message = "Enter a message of at least 10 characters.";
        if (submittedForm.audience === "route" && !submittedForm.routeCode)
            nextErrors.routeCode = "Select a route.";
        if (submittedForm.deliveryMode === "scheduled" && !submittedForm.scheduledFor)
            nextErrors.scheduledFor = "Choose a delivery date and time.";
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length) {
            setFeedback({
                type: "error",
                title: "Could not prepare notification",
                message: "Review the highlighted fields and try again.",
            });
            return;
        }
        setSubmitting(true);
        try {
            const campaign = await sendNotification({
                ...submittedForm,
                title: submittedForm.title.trim(),
                message: submittedForm.message.trim(),
                routeCode: submittedForm.audience === "route" ? submittedForm.routeCode : undefined,
                scheduledFor: submittedForm.deliveryMode === "scheduled" ? submittedForm.scheduledFor : undefined,
            });
            setFeedback({
                type: "success",
                title: campaign.status === "scheduled"
                    ? "Notification scheduled"
                    : "Notification sent",
                message: `${campaign.id} will reach ${campaign.recipientCount} ${campaign.audience === "all" ? "students" : `${campaign.routeCode} students`}.`,
            });
            setForm(blankForm);
            setErrors({});
        }
        catch {
            setFeedback({
                type: "error",
                title: "Delivery failed",
                message: "The notification could not be queued. Please retry.",
            });
        }
        finally {
            setSubmitting(false);
        }
    };
    return (<div>
      <AdminPageHeading eyebrow="Communication" title="Notification center" description="Compose, target, schedule and track student transport updates."/>
      {feedback && (<AdminFeedback {...feedback} dismiss={() => setFeedback(null)}/>)}
      <div className="admin-notification-grid notification-workspace">
        <form className="admin-panel admin-composer" onSubmit={submit} noValidate>
          <div className="admin-panel-title">
            <div>
              <h2>Compose notification</h2>
              <p>Required fields are marked with *</p>
            </div>
            <Bell />
          </div>
          <fieldset className="notification-type-picker">
            <legend>Notification type *</legend>
            {Object.keys(typeLabels).map((type) => (<label key={type} className={`notification-type-option notification-type-option--${type}`}>
                <input type="radio" name="notification-type" checked={form.type === type} onChange={() => setForm({ ...form, type })}/>
                <span>
                  <i />
                  {typeLabels[type]}
                </span>
              </label>))}
          </fieldset>
          <div className="admin-form-row">
            <label className="admin-form-field">
              <span>Audience *</span>
              <select value={form.audience} onChange={(event) => setForm({
            ...form,
            audience: event.target.value,
        })}>
                <option value="all">All students</option>
                <option value="route">Selected route</option>
              </select>
            </label>
            {form.audience === "route" ? (<label className="admin-form-field">
                <span>Route *</span>
                <select value={form.routeCode} onChange={(event) => setForm({ ...form, routeCode: event.target.value })} aria-invalid={Boolean(errors.routeCode)}>
                  {routeOptions.map((route) => (<option key={route}>{route}</option>))}
                </select>
                {errors.routeCode && <small>{errors.routeCode}</small>}
              </label>) : (<div className="notification-audience-note">
                <Users />
                <span>
                  <strong>{totalStudentCount} students</strong>
                  <small>All active student accounts</small>
                </span>
              </div>)}
          </div>
          <label className="admin-form-field">
            <span>Title *</span>
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Short, clear notification title" maxLength={80} aria-invalid={Boolean(errors.title)}/>
            <small className={errors.title ? "" : "field-hint"}>
              {errors.title || `${form.title.length}/80 characters`}
            </small>
          </label>
          <label className="admin-form-field">
            <span>Message *</span>
            <textarea value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Explain the service update and what students should do…" maxLength={300} aria-invalid={Boolean(errors.message)}/>
            <small className={errors.message ? "" : "field-hint"}>
              {errors.message || `${form.message.length}/300 characters`}
            </small>
          </label>
          <fieldset className="notification-delivery-picker">
            <legend>Delivery time *</legend>
            <label>
              <input type="radio" name="delivery" checked={form.deliveryMode === "now"} onChange={() => setForm({ ...form, deliveryMode: "now" })}/>
              <Send /> Send now
            </label>
            <label>
              <input type="radio" name="delivery" checked={form.deliveryMode === "scheduled"} onChange={() => setForm({ ...form, deliveryMode: "scheduled" })}/>
              <CalendarClock /> Schedule for later
            </label>
          </fieldset>
          {form.deliveryMode === "scheduled" && (<label className="admin-form-field">
              <span>Schedule date and time *</span>
              <input type="datetime-local" name="scheduledFor" value={form.scheduledFor} onChange={(event) => setForm({ ...form, scheduledFor: event.target.value })} aria-invalid={Boolean(errors.scheduledFor)}/>
              {errors.scheduledFor && <small>{errors.scheduledFor}</small>}
            </label>)}
          <button className="button admin-primary-button notification-submit" disabled={submitting}>
            {submitting ? (<>
                <span className="button-spinner"/> Queueing…
              </>) : form.deliveryMode === "scheduled" ? (<>
                <CalendarClock /> Schedule notification
              </>) : (<>
                <Send /> Send notification
              </>)}
          </button>
        </form>
        <section className="admin-panel admin-mobile-preview">
          <div className="admin-panel-title">
            <div>
              <h2>Mobile preview</h2>
              <p>Student alert appearance</p>
            </div>
          </div>
          <div className="notification-preview-phone">
            <div className="notification-preview-phone__top">
              <span>9:41</span>
              <strong>SmartTransit</strong>
              <span>●●●</span>
            </div>
            <article className={`preview-notification preview-notification--${form.type}`}>
              <span>{typeLabels[form.type]}</span>
              <h3>{form.title || "Notification title"}</h3>
              <p>{form.message || "Your transport update will appear here."}</p>
              <small>
                {form.audience === "all"
            ? "All students"
            : `Route ${form.routeCode}`}{" "}
                · Just now
              </small>
            </article>
            <div className="notification-preview-phone__safe">
              <CheckCircle2 /> Verified by Indus Transport
            </div>
          </div>
        </section>
      </div>
      <section className="admin-table-card notification-history-card">
        <div className="admin-panel-title notification-history-heading">
          <div>
            <h2>Notification history</h2>
            <p>Delivery status for recent announcements</p>
          </div>
          <label className="admin-filter">
            <span className="sr-only">Filter delivery status</span>
            <select value={historyStatus} onChange={(event) => setHistoryStatus(event.target.value)} aria-label="Filter notification delivery status">
              <option value="all">All delivery states</option>
              <option value="delivered">Delivered</option>
              <option value="scheduled">Scheduled</option>
              <option value="failed">Failed</option>
            </select>
          </label>
        </div>
        <div className="notification-history-list">
          {visibleCampaigns.map((item) => (<article key={item.id}>
              <span className={`notification-history-icon notification-history-icon--${item.type}`}>
                {item.status === "scheduled" ? (<CalendarClock />) : item.status === "delivered" ? (<CheckCircle2 />) : (<Bell />)}
              </span>
              <div className="notification-history-copy">
                <small>
                  {item.id} · {typeLabels[item.type]}
                </small>
                <strong>{item.title}</strong>
                <span>
                  {item.audience === "all"
                ? "All students"
                : `Route ${item.routeCode}`}{" "}
                  · by {item.createdBy}
                </span>
              </div>
              <div className="notification-history-delivery">
                <span>
                  <Clock3 /> {item.scheduledFor || item.createdAt}
                </span>
                <strong>
                  {item.status === "delivered"
                ? `${item.deliveredCount}/${item.recipientCount} delivered`
                : item.status === "scheduled"
                    ? `${item.recipientCount} recipients`
                    : "Retry required"}
                </strong>
              </div>
              <AdminStatusBadge status={item.status}/>
            </article>))}
        </div>
      </section>
    </div>);
}
