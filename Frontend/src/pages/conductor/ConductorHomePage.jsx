import { AlertTriangle, ArrowRight, BusFront, Clock3, MapPin, Navigation, Route, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { StaffPageHeading } from '../../components/staff/StaffUI';
import { useConductorOperations } from '../../operations/OperationsContext';
import { tripDirectionLabel } from '../../services/indusRoutes';
import { currentDisplayDate } from '../../utils/dateLabels';
export function ConductorHomePage() {
    const { user } = useAuth();
    const { tripStatus, activeTrip, stops, occupiedSeats, updates, currentStopId } = useConductorOperations();
    const available = activeTrip.capacity - occupiedSeats;
    const utilization = Math.round(occupiedSeats / activeTrip.capacity * 100);
    const currentStop = stops.find((stop) => stop.id === currentStopId) ?? stops[0];
    const completedStops = stops.filter((stop) => stop.status === 'completed').length;
    const firstName = user?.name?.split(' ')[0] ?? 'Conductor';
    return <div><StaffPageHeading eyebrow={currentDisplayDate()} title={`Good morning, ${firstName}`} description="Keep the passenger count accurate at every stop." status={<span className={`staff-status staff-status--${tripStatus}`}><i /> {tripStatus === 'active' ? 'On duty' : tripStatus}</span>}/>
    <section className="conductor-trip-card"><div className="conductor-trip-card__top"><span className="staff-square-icon"><BusFront /></span><div><small>{tripDirectionLabel(activeTrip.direction)} trip</small><h2>{activeTrip.routeCode} · {activeTrip.routeName}</h2><p>{activeTrip.registration} · Bus {activeTrip.busNumber}</p></div><span className="staff-status staff-status--active">Trip active</span></div><div className="conductor-capacity"><div><small>Total seats</small><strong>{activeTrip.capacity}</strong></div><div><small>Occupied</small><strong>{occupiedSeats}</strong></div><div><small>Available</small><strong>{available}</strong></div><div><small>Utilization</small><strong>{utilization}%</strong></div></div><div className="seat-capacity-bar"><span style={{ width: `${utilization}%` }}/></div><p className="seat-last-update"><Clock3 /> Last seat update: {updates[0]?.timestamp ?? 'No update yet'}</p></section>
    <div className="conductor-home-grid"><section className="current-stop-card"><span className="staff-square-icon"><MapPin /></span><div><small>Current stop</small><h2>{currentStop.name}</h2><p>Scheduled {currentStop.scheduledTime}</p></div><Link className="button staff-primary-button" to="/conductor/trip"><Users /> Update seats <ArrowRight /></Link></section><section className="conductor-progress-card"><div className="staff-card-title"><Route /><div><h2>Stop progress</h2><p>{completedStops} of {stops.length} stops completed</p></div></div><div className="mini-stop-progress">{stops.map((stop) => <span className={`mini-stop-progress__item mini-stop-progress__item--${stop.status}`} key={stop.id}><i>{stop.status === 'completed' ? '✓' : ''}</i><small>{stop.name}</small></span>)}</div></section><section className="conductor-driver-card"><span className="staff-avatar-circle">{activeTrip.driver.initials}</span><div><small>Assigned driver</small><strong>{activeTrip.driver.name}</strong><p>Bus {activeTrip.busNumber} · On trip</p></div></section><Link className="staff-emergency-card" to="/conductor/emergency"><span><AlertTriangle /></span><div><small>Need urgent assistance?</small><strong>Send emergency alert</strong><p>Trip and location are attached.</p></div><ArrowRight /></Link></div>
    <div className="conductor-reminder"><Navigation /><p>Update boarded and deboarded counts only after the bus has stopped safely.</p></div>
  </div>;
}
