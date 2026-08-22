/* eslint-disable react-refresh/only-export-components */
import { AlertTriangle, Ban, BusFront, CheckCircle2, CircleAlert, CloudOff, MapPinOff, RadioTower, Route, SearchX, ServerCrash, ShieldX, } from "lucide-react";
export const applicationStatePresets = {
    loading: {
        label: "Loading",
        title: "Loading transport data",
        message: "Please wait while the latest information is retrieved.",
        tone: "neutral",
        icon: RadioTower,
    },
    empty: {
        label: "Empty",
        title: "Nothing here yet",
        message: "New records will appear here when they are available.",
        tone: "neutral",
        icon: BusFront,
    },
    offline: {
        label: "Offline",
        title: "You are offline",
        message: "Live updates are paused. Previously loaded transport information remains available.",
        action: "Try again",
        tone: "warning",
        icon: CloudOff,
    },
    "server-error": {
        label: "Server error",
        title: "We could not load this page",
        message: "The SmartTransit service is temporarily unavailable. Your existing data is safe.",
        action: "Retry",
        tone: "error",
        icon: ServerCrash,
    },
    "permission-denied": {
        label: "Permission denied",
        title: "Access is restricted",
        message: "Your account does not have permission to view this information.",
        action: "Go to my dashboard",
        tone: "error",
        icon: ShieldX,
    },
    "stale-gps": {
        label: "Stale GPS",
        title: "Bus location may be outdated",
        message: "The last GPS update was 7 minutes ago. Use the displayed location with care.",
        action: "Refresh status",
        tone: "warning",
        icon: MapPinOff,
    },
    "no-active-trip": {
        label: "No active trip",
        title: "No trip is running",
        message: "Live driver location will become visible only after an assigned trip starts.",
        action: "View schedule",
        tone: "neutral",
        icon: BusFront,
    },
    "trip-cancelled": {
        label: "Trip cancelled",
        title: "This trip has been cancelled",
        message: "Students assigned to this route have been notified. Check alerts for alternatives.",
        action: "View alerts",
        tone: "error",
        icon: Ban,
    },
    "route-changed": {
        label: "Route changed",
        title: "Your route has changed",
        message: "A temporary stop sequence is in effect today. Review the updated route before travelling.",
        action: "Review route",
        tone: "info",
        icon: Route,
    },
    "emergency-submitted": {
        label: "Emergency submitted",
        title: "Emergency alert submitted",
        message: "The transport operations team received the alert and its current location.",
        action: "View alert status",
        tone: "success",
        icon: CircleAlert,
    },
    "form-success": {
        label: "Form success",
        title: "Changes saved",
        message: "Your information was submitted successfully.",
        tone: "success",
        icon: CheckCircle2,
    },
    "validation-failure": {
        label: "Validation failure",
        title: "Check the highlighted fields",
        message: "Some information is missing or invalid. Correct the fields and submit again.",
        action: "Review form",
        tone: "error",
        icon: AlertTriangle,
    },
    "no-search-results": {
        label: "No search results",
        title: "No matching records",
        message: "Try a different search term or clear one of the active filters.",
        action: "Clear filters",
        tone: "neutral",
        icon: SearchX,
    },
};
export function ApplicationStatePanel({ kind, onAction, }) {
    const preset = applicationStatePresets[kind];
    const Icon = preset.icon;
    if (kind === "loading") {
        return (<section className="system-state-panel system-state-panel--loading" aria-label="Loading transport data" aria-busy="true">
        <div className="system-state-spinner"/>
        <div>
          <span />
          <span />
          <span />
        </div>
        <p>Loading transport data…</p>
      </section>);
    }
    return (<section className={`system-state-panel system-state-panel--${preset.tone}`} role={preset.tone === "error" ? "alert" : "status"}>
      <span className="system-state-icon">
        <Icon />
      </span>
      <h2>{preset.title}</h2>
      <p>{preset.message}</p>
      {preset.action && (<button className="button button--secondary" onClick={onAction}>
          {preset.action}
        </button>)}
    </section>);
}
