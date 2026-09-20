function scheduleMinutes(value) {
    const match = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (minutes > 59 || (match[3] ? hours < 1 || hours > 12 : hours > 23)) return null;
    if (match[3]) hours = hours % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
    return hours * 60 + minutes;
}

// Capture journey intervals, not wall-clock times, when the driver starts a run.
export function captureStopOffsets(stops = []) {
    let previous = null;
    let offsetMinutes = 0;
    const offsets = [];
    for (const stop of stops) {
        const minutes = scheduleMinutes(stop.scheduledTime);
        if (minutes === null) return [];
        if (previous !== null) {
            let difference = minutes - previous;
            if (difference < 0) {
                if (previous < 18 * 60 || minutes > 6 * 60) return [];
                difference += 1440;
            }
            offsetMinutes += difference;
        }
        offsets.push({ stopId: stop.id, offsetMinutes });
        previous = minutes;
    }
    return offsets;
}

export function stopsWithDepartureEstimates(stops = [], trip) {
    const startedAt = Date.parse(trip?.startedAt ?? '');
    const offsets = Array.isArray(trip?.plannedStopOffsets) ? trip.plannedStopOffsets : captureStopOffsets(stops);
    const byId = new Map(offsets.map((item) => [item.stopId, item.offsetMinutes]));
    return stops.map((stop) => {
        const offset = byId.get(stop.id);
        return {
            ...stop,
            departureEstimateAt: Number.isFinite(startedAt) && Number.isFinite(offset) && offset >= 0
                ? new Date(startedAt + offset * 60000).toISOString() : null,
        };
    });
}
