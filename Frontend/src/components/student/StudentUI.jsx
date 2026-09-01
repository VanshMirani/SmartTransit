import { AlertCircle, BellRing, BusFront, Clock3, MapPin, RefreshCw, Users, } from "lucide-react";
export function PageHeading({ eyebrow, title, description, action, }) {
    return (<header className="app-page-heading">
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>);
}
export function LoadingCards({ count = 3 }) {
    return (<div className="skeleton-grid" aria-label="Loading content" aria-live="polite">
      {Array.from({ length: count }, (_, index) => (<div className="skeleton-card" key={index}>
          <span />
          <span />
          <span />
        </div>))}
    </div>);
}
export function ErrorState({ message, retry, }) {
    return (<section className="state-card" role="alert">
      <span className="state-card__icon state-card__icon--error">
        <AlertCircle />
      </span>
      <h2>Something went off route</h2>
      <p>{message}</p>
      <button className="button button--secondary" onClick={retry}>
        <RefreshCw /> Try again
      </button>
    </section>);
}

function assignmentStatusCopy(status) {
    if (status === "approved") {
        return {
            title: "Your account has been approved.",
            message: "Your route and pickup stop still need to be assigned by the transport admin before commute details appear.",
        };
    }
    if (status === "rejected") {
        return {
            title: "Your account has been rejected.",
            message: "Please contact transport admin for help with your student transport access.",
        };
    }
    return {
        title: "Your account is pending admin approval.",
        message: "Your student account has been created. The transport admin will verify it, assign your route, bus and pickup stop, then activate full commute access.",
    };
}

export function AssignmentPendingState({ action, status = "pending", }) {
    const copy = assignmentStatusCopy(status);
    return (<section className="state-card state-card--large" role="status">
      <span className="state-card__icon">
        <BusFront />
      </span>
      <h2>{copy.title}</h2>
      <p>{copy.message}</p>
      {action}
    </section>);
}

export function BusOverviewCard({ bus, routeName, stopName, eta, tripActive = false, }) {
    const available = bus.capacity - bus.occupiedSeats;
    const gpsLabel = tripActive ? `GPS updated ${bus.gpsUpdatedAt}` : `GPS ${bus.gpsUpdatedAt}`;
    return (<article className="assigned-bus-card">
      <div className="assigned-bus-card__top">
        <span className="app-icon">
          <BusFront />
        </span>
        <div>
          <small>Your assigned bus</small>
          <h2>{bus.registration}</h2>
          <p>{routeName}</p>
        </div>
        <span className={`app-badge app-badge--${bus.status}`}>
          {bus.status.replace("-", " ")}
        </span>
      </div>
      <div className="assigned-bus-card__stats">
        <div>
          <Clock3 />
          <span>
            <small>{tripActive ? `ETA to ${stopName}` : "Scheduled pickup"}</small>
            <strong>{eta}</strong>
          </span>
        </div>
        <div>
          <Users />
          <span>
            <small>Available seats</small>
            <strong>
              {available} <em>/ {bus.capacity}</em>
            </strong>
          </span>
        </div>
      </div>
      <div className="assigned-bus-card__updates">
        <span>
          <i /> {gpsLabel}
        </span>
        <span>Seats updated {bus.seatsUpdatedAt}</span>
      </div>
    </article>);
}
const notifIcons = {
    delay: Clock3,
    "route-change": MapPin,
    cancellation: AlertCircle,
    general: BellRing,
};
export function NotificationCard({ notification, }) {
    const Icon = notifIcons[notification.type];
    const label = notification.type === "route-change"
        ? "Route change"
        : notification.type === "general"
            ? "General announcement"
            : `${notification.type[0].toUpperCase()}${notification.type.slice(1)}`;
    return (<article className={`notification-card notification-card--${notification.type} ${notification.unread ? "notification-card--unread" : ""}`} aria-label={`${label}: ${notification.title}`}>
      <span className="notification-card__icon">
        <Icon />
      </span>
      <div>
        <div className="notification-card__heading">
          <span>{label}</span>
          <time>{notification.createdAt}</time>
        </div>
        <h3>{notification.title}</h3>
        <p>{notification.message}</p>
        {notification.routeCode && (<small className="notification-route-tag">
            <MapPin /> Route {notification.routeCode}
          </small>)}
      </div>
      {notification.unread && <i className="unread-dot" title="Unread"/>}
    </article>);
}
export function ComplaintStatusBadge({ status }) {
    return (<span className={`complaint-status complaint-status--${status}`}>
      {status === "in-progress" ? "In progress" : status}
    </span>);
}
