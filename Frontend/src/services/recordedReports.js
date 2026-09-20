export function transportDate(value = new Date()) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date) : '';
}

export function recordedReports(history) {
    return history.filter((trip) => trip.completedAt && trip.startedAt).map((trip) => {
        const planned = Date.parse(trip.scheduledArrivalAt);
        const completed = Date.parse(trip.completedAt);
        const measured = Number.isFinite(planned) && Number.isFinite(completed);
        const delay = measured ? Math.max(0, Math.round((completed - planned) / 60000)) : 0;
        return {
            date: transportDate(trip.completedAt), routeCode: trip.routeCode, routeName: trip.routeName,
            trips: 1, measuredTrips: measured ? 1 : 0,
            onTimeTrips: measured && !delay ? 1 : 0, delayedTrips: delay > 0 ? 1 : 0,
            averageDelayMinutes: delay,
            studentJourneys: (trip.seatUpdates ?? []).reduce((sum, update) => sum + (Number(update.boarded) || 0), 0),
        };
    });
}
