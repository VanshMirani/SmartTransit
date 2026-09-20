import { randomUUID } from 'node:crypto';

const radians = (degrees) => degrees * Math.PI / 180;
function distance(a, b) {
    const angle = Math.sin(radians(b[0] - a[0]) / 2) ** 2 + Math.cos(radians(a[0])) * Math.cos(radians(b[0])) * Math.sin(radians(b[1] - a[1]) / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(angle), Math.sqrt(1 - Math.min(1, angle)));
}
const validPoint = (point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180;
const ttl = 30 * 60 * 1000;

// Session-owned, memory-only scenarios never share the operational database or phone GPS endpoint.
export function createGpsSimulator({ project, clock = Date.now }) {
    const sessions = new Map();
    const purge = () => {
        for (const [key, value] of sessions) if (clock() - value.touchedAt > ttl) sessions.delete(key);
    };
    const emit = (state) => {
        const now = clock();
        const stops = state.route.stops;
        const from = stops[state.segment].coordinates;
        const to = stops[Math.min(state.segment + 1, stops.length - 1)].coordinates;
        const segmentKm = distance(from, to);
        const fraction = segmentKm ? Math.min(1, state.segmentDistance / segmentKm) : 1;
        const coordinates = from.map((value, index) => value + (to[index] - value) * fraction);
        const location = { coordinates, speedKmh: state.status === 'running' ? state.speedKmh : 0, speedSource: 'device', source: 'simulation', updatedAt: new Date(now).toISOString(), reportedAt: new Date(now).toISOString(), accuracy: 5 };
        state.frame = project(state.route, state.trip, location);
        state.trip.nextStopId = state.frame.nextStopId;
        state.trip.lastReachedStopId = state.frame.lastReachedStopId;
        state.location = location;
    };
    const advance = (state) => {
        const now = clock();
        if (state.status === 'running') {
            // A closed/background tab must not fast-forward a whole journey on its next request.
            const elapsed = Math.min(10, Math.max(0, (now - state.lastTick) / 1000));
            let remaining = elapsed / 3600 * state.speedKmh * state.playbackRate;
            while (remaining > 0 && state.status === 'running') {
                const segmentLength = distance(state.route.stops[state.segment].coordinates, state.route.stops[state.segment + 1].coordinates);
                const step = Math.min(0.05, remaining, Math.max(0, segmentLength - state.segmentDistance));
                state.segmentDistance += step;
                state.travelledKm += step;
                remaining -= step;
                emit(state);
                if (state.segmentDistance >= segmentLength - 0.000001) {
                    if (state.segment === state.route.stops.length - 2) state.status = 'completed';
                    else { state.segment += 1; state.segmentDistance = 0; }
                }
            }
            emit(state);
        }
        state.lastTick = now;
        state.touchedAt = now;
    };
    const output = (state) => ({
        id: state.id, simulation: true, status: state.status,
        route: state.route, speedKmh: state.speedKmh, playbackRate: state.playbackRate,
        startedAt: state.trip.startedAt, location: state.location,
        travelledKm: state.travelledKm, ...state.frame,
    });
    return {
        create(key, route, { speedKmh = 24, playbackRate = 30 } = {}) {
            purge();
            if (!route?.stops || route.stops.length < 2 || route.stops.some((stop) => !validPoint(stop.coordinates))) return { error: 'This route needs at least two stops with valid coordinates.' };
            if (route.stops.some((stop, index) => index > 0 && distance(route.stops[index - 1].coordinates, stop.coordinates) < 0.005)) return { error: 'Adjacent stops are at the same location. Correct the route coordinates first.' };
            if (!Number.isFinite(speedKmh) || speedKmh < 5 || speedKmh > 60 || ![1, 10, 30, 60].includes(playbackRate)) return { error: 'Choose a speed from 5 to 60 km/h and a valid playback rate.' };
            if (!sessions.has(key) && sessions.size >= 100) return { error: 'The simulator is busy. Please retry later.' };
            const now = clock();
            const state = { id: randomUUID(), route: structuredClone(route), status: 'running', speedKmh, playbackRate, segment: 0, segmentDistance: 0, travelledKm: 0, lastTick: now, touchedAt: now,
                trip: { id: `SIM-${randomUUID()}`, routeCode: route.code, nextStopId: route.stops[0].id, lastReachedStopId: '', startedAt: new Date(now).toISOString() } };
            emit(state);
            sessions.set(key, state);
            return output(state);
        },
        get(key) {
            purge();
            const state = sessions.get(key);
            if (!state) return { simulation: true, status: 'idle' };
            advance(state);
            return output(state);
        },
        update(key, { id, action }) {
            purge();
            const state = sessions.get(key);
            if (!state || state.id !== id) return { error: 'This simulation has ended or changed. Start a new one.' };
            if (!['pause', 'resume'].includes(action)) return { error: 'Choose pause or resume.' };
            advance(state);
            if (state.status === 'completed') return { error: 'This simulation has completed. Start a new one.' };
            state.status = action === 'pause' ? 'paused' : 'running';
            emit(state);
            return output(state);
        },
        remove(key) { sessions.delete(key); return { simulation: true, status: 'idle' }; },
    };
}
