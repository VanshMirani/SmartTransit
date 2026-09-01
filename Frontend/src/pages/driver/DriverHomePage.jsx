import { AlertTriangle, ArrowRight, BusFront, CheckCircle2, ClipboardCheck, Clock3, Navigation, Phone, Radio, Route } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { StaffPageHeading } from '../../components/staff/StaffUI';
import { useDriverOperations } from '../../operations/OperationsContext';
import { preTripItems } from '../../services/operationsData';
import { tripDirectionLabel } from '../../services/indusRoutes';
import { currentDisplayDate } from '../../utils/dateLabels';
function gpsSharingLabel(status, active) {
    if (!active)
        return "GPS Inactive";
    if (status === "sharing" || status === "demo")
        return "GPS Active";
    if (status === "requesting")
        return "Permission Required";
    if (status === "unsupported")
        return "GPS Inactive";
    if (status === "error")
        return "GPS Inactive";
    return "GPS Active";
}
export function DriverHomePage() {
    const { user } = useAuth();
    const { tripStatus, activeTrip, checklist, tripLoadError, gpsUpdatedAt, gpsSharingStatus, gpsError, setTripDirection } = useDriverOperations();
    const [changingDirection, setChangingDirection] = useState(false);
    const [directionError, setDirectionError] = useState('');
    const active = tripStatus === 'active';
    const firstName = user?.name?.split(' ')[0] ?? 'Driver';
    const gpsNeedsAttention = active && (gpsSharingStatus === "error" || gpsSharingStatus === "unsupported");
    if (tripLoadError) {
        return <div><StaffPageHeading eyebrow={currentDisplayDate()} title={`Good morning, ${firstName}`} description="We could not load your assigned bus and route yet." status={<span className="staff-status staff-status--not-started">Route check needed</span>}/>
        <section className="staff-state-card"><span><AlertTriangle /></span><h1>Assigned trip could not load</h1><p>{tripLoadError}</p><button className="button staff-primary-button" type="button" onClick={() => window.location.reload()}>Refresh driver dashboard</button></section>
      </div>;
    }
    const chooseDirection = async (direction) => {
        if (changingDirection || (tripStatus !== 'completed' && activeTrip.direction === direction))
            return;
        setChangingDirection(true);
        setDirectionError('');
        try {
            await setTripDirection(direction);
        }
        catch (reason) {
            setDirectionError(reason instanceof Error ? reason.message : 'Unable to change trip direction.');
        }
        finally {
            setChangingDirection(false);
        }
    };
    return <div><StaffPageHeading eyebrow={currentDisplayDate()} title={`Good morning, ${firstName}`} description={active ? 'Your trip is active. Keep your focus on the road.' : tripStatus === 'completed' ? 'Today’s assigned trip has been completed.' : 'Complete your safety checklist before starting today’s trip.'} status={<span className={`staff-status staff-status--${tripStatus}`}>{active ? 'Trip active' : tripStatus === 'completed' ? 'Trip completed' : 'Before trip'}</span>}/>
    <section className="staff-assignment-card"><div className="staff-assignment-card__header"><span className="staff-square-icon"><BusFront /></span><div><small>Assigned bus</small><h2>{activeTrip.registration}</h2><p>Bus {activeTrip.busNumber}</p></div><span className="staff-bus-visual">BUS</span></div><div className="staff-assignment-card__route"><Route /><span><small>Assigned route</small><strong>{activeTrip.routeCode} · {activeTrip.routeName}</strong><em>{activeTrip.distance} · {tripDirectionLabel(activeTrip.direction)} trip · {activeTrip.scheduledStart} to {activeTrip.scheduledEnd}</em></span></div>{!active && <div className="trip-direction-control"><span>{tripStatus === 'completed' ? 'Prepare next trip' : 'Trip direction'}</span><div role="group" aria-label="Trip direction"><button type="button" className={activeTrip.direction !== 'return' ? 'active' : ''} disabled={changingDirection} onClick={() => chooseDirection('morning')}>Morning pickup</button><button type="button" className={activeTrip.direction === 'return' ? 'active' : ''} disabled={changingDirection} onClick={() => chooseDirection('return')}>Return trip</button></div></div>}{directionError && <p className="field-error" role="alert">{directionError}</p>}</section>
    <div className="staff-home-grid"><section className="staff-action-card"><div className="staff-card-title"><span className="staff-square-icon staff-square-icon--small"><ClipboardCheck /></span><div><h2>Pre-trip checklist</h2><p>{checklist.length} of {preTripItems.length} checks complete</p></div></div><div className="check-progress"><span style={{ width: `${checklist.length / preTripItems.length * 100}%` }}/></div>{active ? <Link className="button staff-primary-button" to="/driver/trip"><Navigation /> Open active trip <ArrowRight /></Link> : tripStatus === 'completed' ? <Link className="button button--secondary" to="/driver/history"><Clock3 /> View trip history</Link> : <Link className="button staff-primary-button" to="/driver/checklist"><ClipboardCheck /> Continue checklist <ArrowRight /></Link>}{tripStatus === 'completed' && <p className="checklist-help">Choose Morning pickup or Return trip above to prepare the next trip.</p>}</section>
      <section className={`gps-card ${active && !gpsNeedsAttention ? 'gps-card--active' : ''} ${gpsNeedsAttention ? 'gps-card--warning' : ''}`}><div><Radio /><span><small>GPS sharing</small><strong>{gpsSharingLabel(gpsSharingStatus, active)}</strong></span><i /></div><p>{active ? gpsError || `Location updated ${gpsUpdatedAt}. Visible to authorized students and operators.` : 'Your location will be shared automatically only after you start the trip.'}</p></section>
      <section className="staff-contact-card"><div className="staff-card-title"><span className="staff-avatar-circle">{activeTrip.conductor.initials}</span><div><small>Assigned conductor</small><h2>{activeTrip.conductor.name}</h2><p>On duty · Bus {activeTrip.busNumber}</p></div></div><a href={`tel:${activeTrip.conductor.phone.replaceAll(' ', '')}`} aria-label={`Call ${activeTrip.conductor.name}`}><Phone /> Call conductor</a></section>
      <Link className="staff-emergency-card" to="/driver/emergency"><span><AlertTriangle /></span><div><small>Need assistance?</small><strong>Emergency / breakdown</strong><p>Your current location will be attached.</p></div><ArrowRight /></Link>
    </div>
    <section className="driver-guidance-note"><CheckCircle2 /><div><strong>Safe driving first</strong><p>Trip controls are intentionally limited while your bus is moving. Pull over safely before using emergency controls.</p></div></section>
  </div>;
}
