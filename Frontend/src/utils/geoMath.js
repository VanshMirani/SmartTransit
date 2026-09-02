const earthRadiusMeters = 6371000;

function radians(value) {
    return Number(value) * Math.PI / 180;
}

export function hasCoordinates(value) {
    return Array.isArray(value) &&
        value.length >= 2 &&
        Number.isFinite(Number(value[0])) &&
        Number.isFinite(Number(value[1]));
}

export function distanceMetersBetween(start, end) {
    if (!hasCoordinates(start) || !hasCoordinates(end))
        return null;
    const startLat = Number(start[0]);
    const startLng = Number(start[1]);
    const endLat = Number(end[0]);
    const endLng = Number(end[1]);
    const latDelta = radians(endLat - startLat);
    const lngDelta = radians(endLng - startLng);
    const a = Math.sin(latDelta / 2) ** 2 +
        Math.cos(radians(startLat)) * Math.cos(radians(endLat)) * Math.sin(lngDelta / 2) ** 2;
    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
