export const defaultAhmedabadMapCenter = [23.07, 72.54];

export const formatCoordinate = (value) => Number.isFinite(Number(value))
    ? String(Math.round(Number(value) * 1000000) / 1000000)
    : "";

export const normalizeSearchText = (value) => String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const coordinatesFromStop = (stop) => {
    const lat = Number(stop?.lat ?? stop?.coordinates?.[0]);
    const lng = Number(stop?.lng ?? stop?.coordinates?.[1]);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90)
        return null;
    if (!Number.isFinite(lng) || lng < -180 || lng > 180)
        return null;
    return [lat, lng];
};

export const uniqueLocationResults = (results) => {
    const seen = new Set();
    return results.filter((result) => {
        const key = `${normalizeSearchText(result.name)}-${formatCoordinate(result.lat)}-${formatCoordinate(result.lng)}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
};

export const routeLocationResults = (query, routes) => {
    const search = normalizeSearchText(query);
    if (!search)
        return [];
    return uniqueLocationResults(routes.flatMap((route) => (route.stops ?? []).map((stop, index) => {
        const coordinates = coordinatesFromStop(stop);
        if (!coordinates)
            return null;
        return {
            id: `${route.id}-${stop.id}`,
            name: stop.name,
            description: `${route.code} - stop ${index + 1}`,
            lat: coordinates[0],
            lng: coordinates[1],
            source: "Saved stop",
        };
    }).filter(Boolean)).filter((result) => normalizeSearchText(`${result.name} ${result.description}`).includes(search))).slice(0, 8);
};

function coordinatePairFromMatch(match) {
    if (!match)
        return null;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90)
        return null;
    if (!Number.isFinite(lng) || lng < -180 || lng > 180)
        return null;
    return [lat, lng];
}

export function coordinatesFromText(value) {
    const text = String(value ?? "").trim();
    if (!text)
        return null;
    const patterns = [
        /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
        /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
        /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
        /\b(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\b/,
    ];
    for (const pattern of patterns) {
        const coordinates = coordinatePairFromMatch(text.match(pattern));
        if (coordinates)
            return coordinates;
    }
    return null;
}

export async function currentBrowserLocation() {
    if (!("geolocation" in navigator))
        throw new Error("This browser does not support location access.");
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition((position) => {
            resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
            });
        }, () => {
            reject(new Error("Location permission is blocked or unavailable."));
        }, {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 12000,
        });
    });
}
