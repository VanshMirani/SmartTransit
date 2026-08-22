import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmergencyForm, StaffPageHeading } from '../../components/staff/StaffUI';
import { useConductorOperations } from '../../operations/OperationsContext';
export function ConductorEmergencyPage() {
    const { activeTrip, submitEmergency } = useConductorOperations();
    return <div className="staff-narrow-page"><StaffPageHeading eyebrow="Urgent assistance" title="Send emergency alert" description="Notify the transport control room and attach this trip’s location." status={<span className="staff-status staff-status--active">Active trip</span>}/><EmergencyForm onSubmit={submitEmergency} locationLabel={`Near ${activeTrip.nextStopName}, Ahmedabad`}/><Link className="staff-back-link" to="/conductor"><ArrowLeft /> Back to home</Link></div>;
}
