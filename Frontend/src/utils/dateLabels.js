export function currentDisplayDate() {
    return new Intl.DateTimeFormat("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
    }).format(new Date());
}

export function formatTime(value = new Date()) {
    return new Intl.DateTimeFormat("en-IN", {
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(value));
}

export function formatDateTime(value = new Date()) {
    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(value));
}

export function formatShortDateTime(value = new Date()) {
    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(value));
}

export function minutesAgo(minutes) {
    return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

export function relativeTimeLabel(value, fallback = "Not available") {
    const timestamp = Date.parse(value ?? "");
    if (!Number.isFinite(timestamp))
        return fallback;
    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    if (seconds < 45)
        return "Just now";
    if (seconds < 90)
        return "1 min ago";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60)
        return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24)
        return `${hours} hr ago`;
    return formatShortDateTime(value);
}

export function elapsedMinutesLabel(value) {
    const timestamp = Date.parse(value ?? "");
    if (!Number.isFinite(timestamp))
        return "--";
    const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
    if (minutes < 60)
        return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}
