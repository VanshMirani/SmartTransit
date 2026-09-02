export const defaultAhmedabadMapCenter = [23.07, 72.54];
const defaultOnlineSearchUrl = "https://nominatim.openstreetmap.org/search";
const ahmedabadGandhinagarBounds = {
    south: 22.9,
    west: 72.38,
    north: 23.24,
    east: 72.7,
};
const ahmedabadGandhinagarViewbox = `${ahmedabadGandhinagarBounds.west},${ahmedabadGandhinagarBounds.north},${ahmedabadGandhinagarBounds.east},${ahmedabadGandhinagarBounds.south}`;

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

const onlineSearchUrl = () => import.meta.env?.VITE_LOCATION_SEARCH_URL?.trim() || defaultOnlineSearchUrl;

function isInsideAhmedabadGandhinagar(lat, lng) {
    return lat >= ahmedabadGandhinagarBounds.south &&
        lat <= ahmedabadGandhinagarBounds.north &&
        lng >= ahmedabadGandhinagarBounds.west &&
        lng <= ahmedabadGandhinagarBounds.east;
}

function regionalizeQuery(query) {
    return /ahmedabad|gandhinagar|gujarat|india/i.test(query)
        ? query
        : `${query}, Ahmedabad, Gujarat, India`;
}

function onlineQueryVariants(query) {
    const trimmed = String(query ?? "").trim();
    const placeVariants = [
        trimmed,
        trimmed.replace(/\bcrossroad\b/gi, "Cross Road"),
        trimmed.replace(/\bcircle\b/gi, ""),
        trimmed.replace(/\bchar rasta\b/gi, "Cross Road"),
    ];
    const regionalVariants = placeVariants.flatMap((variant) => {
        const place = variant.trim();
        if (!place)
            return [];
        if (/ahmedabad|gandhinagar|gujarat|india/i.test(place))
            return [place];
        return [
            regionalizeQuery(place),
            `${place}, Gandhinagar, Gujarat, India`,
            `${place}, Gujarat, India`,
        ];
    });
    return [...new Set(regionalVariants)].slice(0, 6);
}

function onlineResultLabel(item) {
    return String(item.name || item.display_name?.split(",")[0] || "Online map result").trim();
}

function onlineResultDescription(item) {
    const parts = String(item.display_name ?? "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    return parts.slice(1, 5).join(", ") || "Ahmedabad / Gandhinagar";
}

async function fetchOnlineLocations(query, limit, signal) {
    const params = new URLSearchParams({
        format: "jsonv2",
        q: query,
        limit: String(limit),
        addressdetails: "1",
        countrycodes: "in",
        viewbox: ahmedabadGandhinagarViewbox,
        bounded: "1",
    });
    const response = await fetch(`${onlineSearchUrl()}?${params}`, {
        headers: {
            Accept: "application/json",
            "Accept-Language": "en",
            "User-Agent": "SmartTransit-Indus-map-search/1.0",
        },
        signal,
    });
    if (!response.ok)
        throw new Error("Online map search is unavailable right now.");
    return response.json();
}

export async function onlineLocationResults(query, { limit = 6, signal } = {}) {
    const search = String(query ?? "").trim();
    if (!search)
        return [];
    const controller = signal ? null : new AbortController();
    const timeoutId = controller
        ? globalThis.setTimeout(() => controller.abort(), 9000)
        : null;
    const allResults = [];
    let lastError = null;
    try {
        for (const variant of onlineQueryVariants(search)) {
            try {
                const items = await fetchOnlineLocations(variant, limit, signal ?? controller?.signal);
                allResults.push(...items);
                if (allResults.length >= limit)
                    break;
            }
            catch (error) {
                lastError = error;
            }
        }
    }
    finally {
        if (timeoutId)
            globalThis.clearTimeout(timeoutId);
    }
    const results = uniqueLocationResults(allResults.map((item) => {
        const lat = Number(item.lat);
        const lng = Number(item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInsideAhmedabadGandhinagar(lat, lng))
            return null;
        return {
            id: `online-${item.place_id}`,
            name: onlineResultLabel(item),
            description: onlineResultDescription(item),
            lat,
            lng,
            source: "Online map",
        };
    }).filter(Boolean)).slice(0, limit);
    if (!results.length && lastError)
        throw lastError;
    return results;
}

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
