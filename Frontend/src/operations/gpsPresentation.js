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
    const hasPlan = Number.isFinite(Date.parse(nextStop?.departureEstimateAt ?? ''));
    return {
        sharing,
        label: hasGpsEstimate ? 'Live ETA' : hasPlan ? 'Start-based arrival' : 'Live ETA',
        value: hasGpsEstimate ? trip.nextStopEta : hasPlan ? formatTime(nextStop.departureEstimateAt) : 'ETA unavailable',
        note: hasGpsEstimate ? 'Approximate GPS estimate' : hasPlan ? 'Departure plan, not a live GPS estimate' : 'Waiting for a reliable location',
        distance: sharing ? (/\d/.test(trip.remainingDistance ?? '') ? trip.remainingDistance : 'Distance unavailable') : 'Waiting for GPS',
        speed: sharing && Number.isFinite(trip.currentSpeed) ? `${Math.round(trip.currentSpeed)} km/h` : 'Waiting for GPS',
        lastAccepted: hasAcceptedLocation ? formatEventTime(updatedAt) : 'No location received yet',
        message: error || (hasAcceptedLocation
            ? 'Waiting for a fresh GPS update. The map retains the last accepted location.'
            : 'No GPS location has been received yet. Allow location access for SmartTransit and enable Location Services on your device, then retry GPS.'),
    };
}
