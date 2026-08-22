import { Bell, CheckCheck, Inbox } from "lucide-react";
import { useMemo, useState } from "react";
import { useCommunications } from "../../communications/CommunicationsContext";
import { NotificationCard, PageHeading, } from "../../components/student/StudentUI";
export function NotificationsPage() {
    const { notifications, unreadCount, markAllNotificationsRead } = useCommunications();
    const [filter, setFilter] = useState("all");
    const [readFeedback, setReadFeedback] = useState(false);
    const filtered = useMemo(() => notifications.filter((notification) => filter === "all" || notification.type === filter), [filter, notifications]);
    const markRead = () => {
        markAllNotificationsRead();
        setReadFeedback(true);
    };
    return (<div>
      <PageHeading eyebrow="Stay informed" title="Notifications" description={`${unreadCount} unread update${unreadCount === 1 ? "" : "s"} about your transport service.`} action={<button className="button button--secondary desktop-action" onClick={markRead} disabled={!unreadCount}>
            <CheckCheck /> Mark all read
          </button>}/>
      <div className="notification-summary-strip">
        <span>
          <Bell />
          <strong>{notifications.length}</strong> total alerts
        </span>
        <span>
          <i /> Colour and icons identify each update type
        </span>
      </div>
      <div className="filter-pills notification-filter-pills" role="group" aria-label="Filter notifications">
        {[
            "all",
            "delay",
            "route-change",
            "cancellation",
            "general",
        ].map((item) => (<button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)} aria-pressed={filter === item}>
            {item === "all"
                ? "All"
                : item === "route-change"
                    ? "Route changes"
                    : item === "general"
                        ? "General"
                        : `${item[0].toUpperCase()}${item.slice(1)}`}
          </button>))}
      </div>
      {readFeedback && (<div className="app-alert app-alert--success" role="status">
          <CheckCheck />
          <div>
            <strong>You’re all caught up</strong>
            <span>All notifications have been marked as read.</span>
          </div>
        </div>)}
      {filtered.length ? (<div className="notification-list">
          {filtered.map((notification) => (<NotificationCard key={notification.id} notification={notification}/>))}
        </div>) : (<section className="state-card">
          <span className="state-card__icon">
            <Inbox />
          </span>
          <h2>No notifications here</h2>
          <p>
            New {filter.replace("-", " ")} notifications will appear in this
            list.
          </p>
        </section>)}
      <p className="notification-footer">
        <Bell /> Notifications are also available from the student mobile
        navigation.
      </p>
    </div>);
}
