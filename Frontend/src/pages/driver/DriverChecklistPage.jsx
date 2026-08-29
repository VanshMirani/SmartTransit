import { ArrowLeft, Check, CheckCircle2, ClipboardCheck, LoaderCircle, Play, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StaffPageHeading } from '../../components/staff/StaffUI';
import { useDriverOperations } from '../../operations/OperationsContext';
import { preTripItems } from '../../services/operationsData';
export function DriverChecklistPage() {
    const { activeTrip, checklist, toggleCheck, startTrip, tripStatus } = useDriverOperations();
    const [confirming, setConfirming] = useState(false);
    const [starting, setStarting] = useState(false);
    const [startError, setStartError] = useState("");
    const navigate = useNavigate();
    const complete = checklist.length === preTripItems.length;
    const start = async () => {
        setStarting(true);
        setStartError("");
        await new Promise((resolve) => window.setTimeout(resolve, 650));
        try {
            await startTrip();
            navigate('/driver/trip');
        }
        catch {
            setStartError("SmartTransit could not start this trip. Check your connection and try again.");
            setStarting(false);
        }
    };
    if (tripStatus === 'active')
        return <section className="staff-state-card"><span><CheckCircle2 /></span><h1>Your trip is already active</h1><p>The pre-trip checklist was completed before departure.</p><Link className="button staff-primary-button" to="/driver/trip">Open active trip</Link></section>;
    return <div><StaffPageHeading eyebrow="Before departure" title="Pre-trip safety checklist" description="Confirm every item while the bus is parked." status={<span className="checklist-count">{checklist.length} / {preTripItems.length} complete</span>}/>
    <section className="checklist-trip-summary"><div><span className="staff-square-icon"><ClipboardCheck /></span><span><small>Today’s assignment</small><strong>{activeTrip.routeCode} · {activeTrip.routeName}</strong><em>{activeTrip.registration} · Departure {activeTrip.scheduledStart}</em></span></div></section>
    <section className="driver-checklist"><div className="checklist-intro"><ShieldCheck /><p>Walk around the bus and verify each safety item. Do not start the trip if anything requires attention.</p></div>{preTripItems.map((item, index) => { const checked = checklist.includes(item.id); return <label className={`checklist-item ${checked ? 'checklist-item--checked' : ''}`} key={item.id}><input type="checkbox" checked={checked} onChange={() => toggleCheck(item.id)}/><span className="checklist-item__box">{checked ? <Check /> : index + 1}</span><span><strong>{item.label}</strong><small>{item.hint}</small></span></label>; })}<button className="button staff-primary-button checklist-start" disabled={!complete} onClick={() => setConfirming(true)}><Play /> Start trip</button>{!complete && <p className="checklist-help">Complete all {preTripItems.length} checks to enable trip start.</p>}</section>
    <Link className="staff-back-link" to="/driver"><ArrowLeft /> Back to home</Link>
    {confirming && <div className="staff-modal-backdrop" role="presentation"><section className="staff-modal" role="dialog" aria-modal="true" aria-labelledby="start-title"><span className="staff-modal__icon"><Play /></span><h2 id="start-title">Start this trip?</h2><p>GPS sharing will begin automatically and your live location will become visible to authorized students and transport operators.</p><div className="modal-trip-row"><span><strong>{activeTrip.routeCode}</strong>{activeTrip.routeName}</span><span><strong>{activeTrip.scheduledStart}</strong>Scheduled start</span></div>{startError && <p className="field-error" role="alert">{startError}</p>}<div className="staff-modal__actions"><button className="button button--secondary" onClick={() => setConfirming(false)} disabled={starting}>Cancel</button><button className="button staff-primary-button" onClick={start} disabled={starting}>{starting ? <><LoaderCircle className="spin"/> Starting…</> : <><Play /> Confirm & start</>}</button></div></section></div>}
  </div>;
}
