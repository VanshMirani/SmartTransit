import { AlertTriangle, CheckCircle2, MapPin, X } from 'lucide-react';
import { useState } from 'react';
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
    const submit = (event) => {
        event.preventDefault();
        if (!selected) {
            setError('Select an emergency type before sending.');
            return;
        }
        setReport(onSubmit(selected, note));
        setError('');
    };
    if (report)
        return <section className="emergency-success" role="status"><span><CheckCircle2 /></span><h2>Emergency alert submitted</h2><p>The transport control room has received alert <strong>{report.id}</strong> and your current location.</p><div><MapPin /><span><small>Attached location</small><strong>{report.location}</strong></span></div><button className="button button--secondary" onClick={() => setReport(null)}><X /> Close acknowledgement</button></section>;
    return <form className={`staff-emergency-form ${compact ? 'staff-emergency-form--compact' : ''}`} onSubmit={submit} noValidate><div className="emergency-warning"><AlertTriangle /><span><strong>Use only for urgent trip issues</strong>Your location and trip details will be attached automatically.</span></div><fieldset><legend>Select the emergency type</legend><div className="emergency-type-grid">{emergencyTypes.map(({ type, icon }) => <button type="button" key={type} className={selected === type ? 'active' : ''} onClick={() => setSelected(type)} aria-pressed={selected === type}><i>{icon}</i><span>{type}</span></button>)}</div>{error && <small className="field-error" role="alert">{error}</small>}</fieldset><div className="field"><label htmlFor="emergency-note">Additional details <small>(optional)</small></label><textarea id="emergency-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe what happened or what assistance is needed…" maxLength={240}/></div><div className="attached-location"><MapPin /><span><small>Current location attached</small><strong>{locationLabel}</strong></span></div><button className="button staff-danger-button" type="submit"><AlertTriangle /> Confirm & send alert</button></form>;
}
