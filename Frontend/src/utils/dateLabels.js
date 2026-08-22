export function currentDisplayDate() {
    return new Intl.DateTimeFormat("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
    }).format(new Date());
}
