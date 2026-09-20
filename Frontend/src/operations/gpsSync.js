export function createGpsSync({ tripId, request, onState, onAccepted, now = Date.now }) {
    let disposed = false;
    let inFlight = false;
    let lastAccepted = null;
    let lastAttemptAt = -Infinity;
    let lastFixAt = null;
    const controller = new AbortController();
    return {
        async receive(position) {
            if (disposed) return;
            const fixAt = Number(position.timestamp);
            const { latitude, longitude, accuracy, speed, heading } = position.coords;
            lastFixAt = fixAt;
            if (!Number.isFinite(fixAt) || now() - fixAt > 30000 || fixAt > now() + 5000) {
                onState('error', 'The phone location is outdated. Waiting for a new GPS fix.');
                return;
            }
            if (!Number.isFinite(accuracy) || accuracy > 250) {
                onState('weak', 'GPS accuracy is too weak. Waiting for a reliable location; the last accepted location is unchanged.');
                return;
            }
            if (inFlight || now() - lastAttemptAt < 10000 || (lastAccepted && fixAt <= lastAccepted.fixAt)) return;
            inFlight = true;
            lastAttemptAt = now();
            onState('sending', 'Phone location detected. Uploading to the transport service.');
            try {
                const payload = await request(`/driver/trips/${tripId}/location`, {
                    method: 'POST', signal: controller.signal,
                    body: { latitude, longitude, accuracy, speedMetersPerSecond: speed, heading, timestamp: new Date(fixAt).toISOString() },
                });
                if (disposed) return;
                if (!payload?.ok || !payload.location?.updatedAt) throw new Error('Unconfirmed GPS update');
                lastAccepted = { fixAt, acceptedAt: now() };
                onAccepted(payload);
                onState('sharing', accuracy > 80 ? 'GPS accuracy is weak; location is approximate.' : '');
            }
            catch {
                if (!disposed) onState('error', 'Phone GPS was detected, but upload was not confirmed. Waiting for a fresh fix to retry.');
            }
            finally { inFlight = false; }
        },
        checkFreshness() {
            if (!disposed && (!lastFixAt || now() - lastFixAt > 30000 || (lastAccepted && now() - lastAccepted.acceptedAt > 30000)))
                onState('error', 'No recent GPS synchronization. Last accepted location may be out of date.');
        },
        dispose() { disposed = true; controller.abort(); },
    };
}
