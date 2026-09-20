import { coordinatesFromStop, formatCoordinate } from '../services/locationSearch.js';

export const prepareRouteForEdit = (route) => ({
    ...structuredClone(route),
    stops: (route.stops ?? []).map((stop) => ({
        ...stop,
        lat: formatCoordinate(stop.coordinates?.[0]),
        lng: formatCoordinate(stop.coordinates?.[1]),
    })),
});

export const cleanRouteForSave = (route) => ({
    ...route,
    stops: route.stops.map(({ lat, lng, ...stop }) => ({
        ...stop,
        coordinates: coordinatesFromStop({ lat, lng, coordinates: stop.coordinates }),
    })),
});

export const initialCoordinateTarget = (route) => route.id && route.stops.length ? route.stops[0].id : 'new';

export function updateStopCoordinates(route, stopId, { lat, lng }) {
    return {
        ...route,
        stops: route.stops.map((stop) => stop.id === stopId
            ? { ...stop, lat: formatCoordinate(lat), lng: formatCoordinate(lng) }
            : stop),
    };
}
