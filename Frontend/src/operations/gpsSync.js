export function createGpsSync({ tripId, request, onState, onAccepted, now = Date.now }) {
    let disposed = false;
    let inFlight = false;
    let lastAccepted = null;
    let lastAttemptAt = -Infinity;
    let lastFixAt = null;
    const requestedAt = now();
    let state = 'requesting';
    const controller = new AbortController();
    const reportState = (status, message) => {
        state = status;
        onState(status, message);
    };
    return {
        async receive(position) {
            if (disposed) return;
            const fixAt = Number(position.timestamp);
            const { latitude, longitude, accuracy, speed, heading } = position.coords;
            lastFixAt = fixAt;
            if (!Number.isFinite(fixAt) || now() - fixAt > 30000 || fixAt > now() + 5000) {
                reportState('error', 'The phone location is outdated. Waiting for a new GPS fix.');
                return;
            }
            if (!Number.isFinite(accuracy) || accuracy > 250) {
                reportState('weak', 'GPS accuracy is too weak. Waiting for a reliable location; no new location has been shared.');
                return;
            }
            if (inFlight || now() - lastAttemptAt < 10000 || (lastAccepted && fixAt <= lastAccepted.fixAt)) return;
            inFlight = true;
            lastAttemptAt = now();
            reportState('sending', 'Phone location detected. Uploading to the transport service.');
            try {
                const payload = await request(`/driver/trips/${tripId}/location`, {
                    method: 'POST', signal: controller.signal,
                    body: { latitude, longitude, accuracy, speedMetersPerSecond: speed, heading, timestamp: new Date(fixAt).toISOString() },
                });
                if (disposed) return;
                if (!payload?.ok || !payload.location?.updatedAt) throw new Error('Unconfirmed GPS update');
                lastAccepted = { fixAt, acceptedAt: now() };
                onAccepted(payload);
                if (state === 'sending') reportState('sharing', accuracy > 80 ? 'GPS accuracy is weak; location is approximate.' : '');
            }
            catch {
                if (!disposed && state === 'sending') reportState('error', 'Phone GPS was detected, but upload was not confirmed. Waiting for a fresh fix to retry.');
            }
            finally { inFlight = false; }
        },
        reportError(error) {
            if (disposed) return;
            if (error?.code === 1) {
                reportState('permission', 'Location access is blocked. Allow location for SmartTransit in your browser and device settings, then retry GPS.');
            } else {
                reportState('error', error?.code === 3
                    ? 'Location detection timed out. Check device Location Services and your connection, then retry GPS.'
                    : 'Your device could not detect a reliable location. Check Location Services and try a GPS-capable phone outdoors.');
            }
        },
        checkFreshness() {
            // Keep the actionable permission/device/upload error until a new fix or retry.
            if (disposed || inFlight || ['permission', 'weak', 'error'].includes(state)) return;
            if (!lastAccepted && now() - requestedAt > 30000) {
                reportState('waiting', 'No GPS location has been received yet. Check browser location permission and device Location Services, then retry GPS.');
            } else if (lastAccepted && (!lastFixAt || now() - lastFixAt > 30000 || now() - lastAccepted.acceptedAt > 30000)) {
                reportState('error', 'No recent GPS synchronization. The map shows the last accepted location until a fresh update arrives.');
            }
        },
        dispose() { disposed = true; controller.abort(); },
    };
}
