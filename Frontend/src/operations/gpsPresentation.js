import { formatEventTime, formatTime } from '../utils/dateLabels.js';

export function gpsSharingLabel(status, active = true) {
    if (!active) return 'GPS Inactive';
    return {
        sharing: 'GPS Active', requesting: 'Requesting location', sending: 'Uploading location',
        permission: 'Permission Required', unsupported: 'GPS unavailable on this device',
        weak: 'Weak GPS signal', waiting: 'Waiting for GPS', error: 'GPS needs attention',
    }[status] || 'GPS Inactive';
}

export function driverGpsDisplay({ trip, nextStop, status, updatedAt, error }) {
    const hasAcceptedLocation = Number.isFinite(Date.parse(updatedAt ?? ''));
    const sharing = status === 'sharing' && hasAcceptedLocation;
    const hasGpsEstimate = sharing && ['driver-phone-speed', 'gps-calculated-speed', 'driver-phone-average'].includes(trip.etaSource)
        && /\d/.test(trip.nextStopEta ?? '');
    const arrival = trip.nextStopEstimatedArrivalAt ?? nextStop?.estimatedArrivalAt;
    const hasArrival = hasGpsEstimate && Number.isFinite(Date.parse(arrival ?? ''));
    return {
        sharing,
        label: 'Estimated arrival',
        value: hasArrival ? formatTime(arrival) : 'ETA unavailable',
        note: sharing ? `${hasArrival ? `${trip.nextStopEta} away. ` : ''}${trip.etaNote || 'Waiting for a distance-based estimate.'}` : 'Waiting for a reliable GPS location',
        distance: sharing ? (/\d/.test(trip.remainingDistance ?? '') ? trip.remainingDistance : 'Distance unavailable') : 'Waiting for GPS',
        speed: sharing && Number.isFinite(trip.currentSpeed) ? `${Math.round(trip.currentSpeed)} km/h` : 'Waiting for GPS',
        lastAccepted: hasAcceptedLocation ? formatEventTime(updatedAt) : 'No location received yet',
        message: error || (hasAcceptedLocation
            ? 'Waiting for a fresh GPS update. The map retains the last accepted location.'
            : 'No GPS location has been received yet. Allow location access for SmartTransit and enable Location Services on your device, then retry GPS.'),
    };
}
