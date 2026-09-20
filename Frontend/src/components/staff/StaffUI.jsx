import { AlertTriangle, CheckCircle2, MapPin, X } from 'lucide-react';
import { useRef, useState } from 'react';
export function StaffPageHeading({ eyebrow, title, description, status }) {
    return <header className="staff-page-heading"><div>{eyebrow && <span>{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{status}</header>;
}
const emergencyTypes = [
    { type: 'Breakdown', icon: '🔧' }, { type: 'Accident', icon: '⚠️' }, { type: 'Medical', icon: '✚' }, { type: 'Traffic Block', icon: '🚧' }, { type: 'Other', icon: '•••' },
];
export function EmergencyForm({ onSubmit, compact = false, locationLabel = 'the current trip location' }) {
    const [selected, setSelected] = useState('');
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [report, setReport] = useState(null);
    const [sending, setSending] = useState(false);
    const attempt = useRef(null);
    const submit = async (event) => {
        event.preventDefault();
        if (attempt.current?.sending) return;
        if (!selected) {
            setError('Select an emergency type before sending.');
            return;
        }
        const signature = JSON.stringify([selected, note]);
        if (attempt.current?.signature !== signature)
            attempt.current = { id: crypto.randomUUID(), signature };
        attempt.current.sending = true;
        setSending(true);
        setError('');
        try {
            const saved = await onSubmit(selected, note, attempt.current.id);
            if (!saved?.id || saved.status !== 'saved') throw new Error('Server confirmation is missing.');
            setReport(saved);
            attempt.current = null;
        }
        catch {
            setError('Alert submission was not confirmed. Your details are kept. Retry to confirm the same alert, or call the transport office for urgent help.');
        }
        finally {
            if (attempt.current) attempt.current.sending = false;
            setSending(false);
        }
    };
    if (report)
        return <section className="emergency-success" role="status"><span><CheckCircle2 /></span><h2>Alert saved by server</h2><p>Alert <strong>{report.id}</strong> is available to transport administrators. Delivery to a phone and administrator acknowledgement are not confirmed. Call the transport office if help is urgent.</p><div><MapPin /><span><small>Attached location</small><strong>{report.location}</strong></span></div><button className="button button--secondary" onClick={() => setReport(null)}><X /> Close confirmation</button></section>;
    return <form className={`staff-emergency-form ${compact ? 'staff-emergency-form--compact' : ''}`} onSubmit={submit} noValidate><div className="emergency-warning"><AlertTriangle /><span><strong>Use only for urgent trip issues</strong>The server will attach the last reliable trip location, when available.</span></div><fieldset disabled={sending}><legend>Select the emergency type</legend><div className="emergency-type-grid">{emergencyTypes.map(({ type, icon }) => <button type="button" key={type} className={selected === type ? 'active' : ''} onClick={() => setSelected(type)} aria-pressed={selected === type}><i>{icon}</i><span>{type}</span></button>)}</div>{error && <small className="field-error" role="alert">{error}</small>}</fieldset><div className="field"><label htmlFor="emergency-note">Additional details <small>(optional)</small></label><textarea id="emergency-note" disabled={sending} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe what happened or what assistance is needed…" maxLength={240}/></div><div className="attached-location"><MapPin /><span><small>Location information</small><strong>{locationLabel}</strong></span></div><button className="button staff-danger-button" type="submit" disabled={sending}><AlertTriangle /> {sending ? 'Sending...' : 'Confirm & send alert'}</button></form>;
}
