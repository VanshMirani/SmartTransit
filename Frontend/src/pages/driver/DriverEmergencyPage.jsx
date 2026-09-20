import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmergencyForm, StaffPageHeading } from '../../components/staff/StaffUI';
import { useDriverOperations } from '../../operations/OperationsContext';
export function DriverEmergencyPage() {
    const { submitEmergency, tripStatus } = useDriverOperations();
    return <div className="staff-narrow-page"><StaffPageHeading eyebrow="Urgent assistance" title="Emergency / breakdown alert" description="Pull over safely before using these controls." status={<span className={`staff-status staff-status--${tripStatus}`}>{tripStatus === 'active' ? 'Active trip' : 'No active trip'}</span>}/><EmergencyForm onSubmit={submitEmergency} locationLabel="Last reliable server location, if available. No location is assumed from the next stop."/><Link className="staff-back-link" to={tripStatus === 'active' ? '/driver/trip' : '/driver'}><ArrowLeft /> Back to {tripStatus === 'active' ? 'active trip' : 'home'}</Link></div>;
}
