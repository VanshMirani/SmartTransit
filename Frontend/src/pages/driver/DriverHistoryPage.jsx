import { BusFront, CalendarDays, CheckCircle2, Clock3, Route } from 'lucide-react';
import { StaffPageHeading } from '../../components/staff/StaffUI';
import { useDriverOperations } from '../../operations/OperationsContext';
import { formatDateTime, formatTime } from '../../utils/dateLabels';

export function DriverHistoryPage() {
    const { history = [] } = useDriverOperations();
    const minutes = (trip) => Math.max(0, Math.round((Date.parse(trip.completedAt) - Date.parse(trip.startedAt)) / 60000)) || 0;
    const total = history.reduce((sum, trip) => sum + minutes(trip), 0);
    return <div>
        <StaffPageHeading eyebrow="Your records" title="Trip history" description="Completed services recorded by the transport server."/>
        <div className="staff-kpi-row">
            <div><BusFront/><span><small>Recorded trips</small><strong>{history.length}</strong></span></div>
            <div><Clock3/><span><small>Recorded trip time</small><strong>{Math.floor(total / 60)}h {total % 60}m</strong></span></div>
            <div><CheckCircle2/><span><small>Completed trips</small><strong>{history.length}</strong></span></div>
        </div>
        <section className="staff-history-card">
            <div className="staff-history-header"><span>Trip</span><span>Actual times</span><span>Duration</span><span>Status</span></div>
            {!history.length && <p>No completed trips have been recorded for this assignment.</p>}
            {history.map((trip) => <article key={trip.id}>
                <div><span className="staff-square-icon staff-square-icon--small"><Route/></span><span><small>{trip.direction === 'return' ? 'Return trip' : 'Morning pickup'}</small><strong>{trip.routeCode} · {trip.routeName}</strong><em>Bus {trip.busNumber}</em></span></div>
                <div><CalendarDays/><span><small>Started {formatDateTime(trip.startedAt)}</small><strong>Ended {formatTime(trip.completedAt)}</strong></span></div>
                <strong>{minutes(trip)} min</strong><span className="staff-record-status staff-record-status--completed">Completed</span>
            </article>)}
        </section>
    </div>;
}
