import { ArrowRight, BusFront, CalendarClock, Check, Clock3, MapPin, Navigation, Route as RouteIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AssignmentPendingState, ErrorState, LoadingCards, PageHeading } from '../../components/student/StudentUI';
import { useStudentData } from '../../hooks/useStudentData';
export function RoutesPage() {
    const { data, loading, error, retry } = useStudentData();
    if (loading)
        return <><PageHeading title="Route & stops"/><LoadingCards count={2}/></>;
    if (error || !data)
        return <ErrorState message={error} retry={retry}/>;
    const assignmentPending = data.assignmentStatus === "unassigned" || !data.route?.code || !data.route?.stops?.length;
    if (assignmentPending)
        return <><PageHeading eyebrow="Your commute" title="Route & stops" description="Your route will appear here after admin assignment."/><AssignmentPendingState status={data.approvalStatus}/></>;
    const returnTrip = data.route.direction === "return";
    const firstStopTime = data.route.stops[0]?.scheduledTime ?? data.route.scheduledArrival;
    return <div><PageHeading eyebrow="Your commute" title="Route & stops" description={`The complete ${returnTrip ? "return" : "morning"} schedule for your assigned route.`} action={<Link className="button button--secondary desktop-action" to="/student/track"><Navigation /> View live map</Link>}/>
    <section className="route-summary-card"><div className="route-summary-card__icon"><RouteIcon /></div><div><span>Assigned route</span><h2>{data.route.code} · {data.route.name}</h2><p><MapPin /> {data.route.startPoint} to {data.route.destination}</p></div><div className="route-summary-card__meta"><span><strong>{data.route.distance}</strong><small>Total distance</small></span><span><strong>{data.route.stops.length}</strong><small>Stops</small></span><span><strong>{data.route.scheduledArrival}</strong><small>Campus arrival</small></span></div></section>
    <div className="route-page-grid"><section className="route-timeline-card"><div className="section-title-row"><div><h2>{returnTrip ? "Return" : "Morning"} stop timeline</h2><p>Scheduled times and current progress</p></div><span className="app-badge app-badge--on-time">Trip active</span></div><div className="full-route-timeline">{data.route.stops.map((stop, index) => <div className={`timeline-stop timeline-stop--${stop.status}`} key={stop.id}><div className="timeline-stop__rail"><span>{stop.status === 'completed' ? <Check /> : index + 1}</span>{index < data.route.stops.length - 1 && <i />}</div><div className="timeline-stop__content"><div><strong>{stop.name}</strong>{stop.id === data.route.selectedStopId && <em>Your stop</em>}<small>{stop.status === 'completed' ? 'Bus departed' : stop.status === 'current' ? 'Bus approaching' : 'Upcoming'}</small></div><div><time>{stop.scheduledTime}</time>{stop.eta && <span>ETA {stop.eta}</span>}</div></div></div>)}</div></section>
      <aside className="route-side"><section><span className="app-icon"><BusFront /></span><h3>Assigned bus</h3><strong>{data.bus.registration}</strong><p>Bus {data.bus.number} · {data.bus.capacity} seats</p><Link to="/student/track">Track bus <ArrowRight /></Link></section><section><span className="app-icon app-icon--gold"><CalendarClock /></span><h3>{returnTrip ? "Return departure" : "Evening return"}</h3><strong>{returnTrip ? firstStopTime : "4:35 PM"}</strong><p>{returnTrip ? `${data.route.startPoint} to ${data.route.destination}` : `${data.route.destination} to ${data.route.startPoint}`}</p></section><section className="route-tip"><Clock3 /><p>Arrive at your stop at least 5 minutes before the scheduled pickup.</p></section></aside>
    </div>
  </div>;
}
