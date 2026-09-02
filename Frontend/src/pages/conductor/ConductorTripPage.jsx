import { AlertCircle, BusFront, Check, CheckCircle2, ChevronDown, Clock3, LoaderCircle, MapPin, Minus, Plus, Send, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { StaffPageHeading } from '../../components/staff/StaffUI';
import { useConductorOperations } from '../../operations/OperationsContext';
import { tripDirectionLabel } from '../../services/indusRoutes';
export function ConductorTripPage() {
    const { activeTrip, stops, tripStatus, currentStopId, setCurrentStop, occupiedSeats, submitSeatUpdate } = useConductorOperations();
    const [boarded, setBoarded] = useState(0);
    const [deboarded, setDeboarded] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);
    const calculatedOccupied = occupiedSeats + boarded - deboarded;
    const available = activeTrip.capacity - calculatedOccupied;
    const invalid = calculatedOccupied < 0 || calculatedOccupied > activeTrip.capacity;
    const currentStop = stops.find((stop) => stop.id === currentStopId) ?? stops[0];
    const canSubmit = boarded + deboarded > 0 && !invalid && !submitting;
    if (tripStatus !== 'active')
        return <section className="staff-state-card"><span><BusFront /></span><h1>No active trip</h1><p>Passenger counts can be submitted after the driver starts this route.</p><Link className="button staff-primary-button" to="/conductor">Return home</Link></section>;
    const submit = async () => {
        if (!canSubmit)
            return;
        setSubmitting(true);
        setError('');
        setSuccess(null);
        try {
            const update = await submitSeatUpdate(boarded, deboarded);
            setSuccess(update);
            setBoarded(0);
            setDeboarded(0);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to submit the seat update.');
        }
        finally {
            setSubmitting(false);
        }
    };
    return <div><StaffPageHeading eyebrow={`${activeTrip.routeCode} · ${tripDirectionLabel(activeTrip.direction)} active trip`} title="Passenger & seat update" description="Enter counts after the bus stops and boarding is complete." status={<span className="staff-status staff-status--active"><i /> On duty</span>}/>
    {success && <div className="staff-success-banner" role="status"><CheckCircle2 /><div><strong>Seat update confirmed</strong><span>{success.stopName}: {success.occupiedSeats} occupied, {success.availableSeats} available · {success.timestamp}</span></div><button onClick={() => setSuccess(null)} aria-label="Dismiss confirmation">×</button></div>}
    {error && <div className="counter-error" role="alert"><AlertCircle /> {error}</div>}
    <section className="stop-selector-card"><div><MapPin /><span><small>Current stop</small><strong>{currentStop.name}</strong></span></div><label><span>Select stop</span><div className="select-wrap"><select value={currentStopId} onChange={(event) => { setCurrentStop(event.target.value); setSuccess(null); }}>{stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.name} · {stop.scheduledTime}</option>)}</select><ChevronDown /></div></label></section>
    <div className="conductor-update-grid"><section className="seat-update-card"><div className="seat-before-row"><span>Previous occupied seats</span><strong>{occupiedSeats}</strong></div><div className="passenger-counters"><PassengerCounter label="Boarded students" tone="positive" value={boarded} decrease={() => setBoarded(Math.max(0, boarded - 1))} increase={() => setBoarded(boarded + 1)} canIncrease={calculatedOccupied < activeTrip.capacity}/><PassengerCounter label="Deboarded students" tone="negative" value={deboarded} decrease={() => setDeboarded(Math.max(0, deboarded - 1))} increase={() => setDeboarded(deboarded + 1)} canIncrease={calculatedOccupied > 0}/></div><div className="seat-formula"><span>Previous occupied</span><i>+</i><span>Boarded</span><i>−</i><span>Deboarded</span><i>=</i><strong>New occupied</strong><div><b>{occupiedSeats}</b><i>+</i><b>{boarded}</b><i>−</i><b>{deboarded}</b><i>=</i><b>{calculatedOccupied}</b></div></div>{invalid && <div className="counter-error" role="alert"><AlertCircle /> {calculatedOccupied < 0 ? 'Occupied seats cannot fall below zero.' : `Occupied seats cannot exceed capacity (${activeTrip.capacity}).`}</div>}<div className="calculated-seats"><div><small>Calculated occupied</small><strong>{Math.max(0, calculatedOccupied)}</strong></div><div><small>Available seats</small><strong>{Math.max(0, available)} <em>/ {activeTrip.capacity}</em></strong></div></div><button className="button staff-primary-button seat-submit" disabled={!canSubmit} onClick={submit}>{submitting ? <><LoaderCircle className="spin"/> Submitting…</> : <><Send /> Submit seat update</>}</button>{boarded + deboarded === 0 && <p className="seat-submit-help">Enter at least one boarded or deboarded student.</p>}</section>
      <aside className="conductor-trip-progress"><h2>Stop progress</h2><p>Route progress follows driver GPS. Select the stop above only for seat count.</p>{stops.map((stop, index) => <div className={`conductor-stop conductor-stop--${stop.id === currentStopId ? 'selected' : stop.status}`} key={stop.id}><span>{stop.status === 'completed' ? <Check /> : index + 1}</span><div><strong>{stop.name}</strong><small>{stop.scheduledTime}{stop.id === currentStopId ? ' · Seat update stop' : ''}</small></div></div>)}<Link to="/conductor/history"><Clock3 /> View update history</Link></aside>
    </div>
    <p className="seat-timestamp-note"><Clock3 /> Every confirmed update records and displays its submission time.</p>
  </div>;
}
function PassengerCounter({ label, tone, value, decrease, increase, canIncrease }) {
    return <div className={`passenger-counter passenger-counter--${tone}`}><span className="passenger-counter__label"><Users /> {label}</span><div><button onClick={decrease} disabled={value === 0} aria-label={`Decrease ${label}`}><Minus /></button><strong aria-live="polite">{value}</strong><button onClick={increase} disabled={!canIncrease} aria-label={`Increase ${label}`}><Plus /></button></div></div>;
}
