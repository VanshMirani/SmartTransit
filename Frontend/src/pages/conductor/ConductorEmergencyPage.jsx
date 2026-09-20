import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmergencyForm, StaffPageHeading } from '../../components/staff/StaffUI';
import { useConductorOperations } from '../../operations/OperationsContext';
export function ConductorEmergencyPage() {
    const { tripStatus, submitEmergency } = useConductorOperations();
    return <div className="staff-narrow-page"><StaffPageHeading eyebrow="Urgent assistance" title="Send emergency alert" description="Notify the transport control room and attach this trip’s location." status={<span className="staff-status">{tripStatus === 'active' ? 'Active trip' : 'No active trip'}</span>}/><EmergencyForm onSubmit={submitEmergency} locationLabel="Last reliable server location, if available. No location is assumed from the next stop."/><Link className="staff-back-link" to="/conductor"><ArrowLeft /> Back to home</Link></div>;
}
