import { AlertCircle, CheckCircle2, X } from 'lucide-react';
export function AdminPageHeading({ eyebrow, title, description, actions }) {
    return <header className="admin-page-heading"><div>{eyebrow && <span>{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="admin-page-heading__actions">{actions}</div>}</header>;
}
export function AdminFeedback({ type, title, message, dismiss }) {
    return <div className={`admin-feedback admin-feedback--${type}`} role={type === 'error' ? 'alert' : 'status'}>{type === 'success' ? <CheckCircle2 /> : <AlertCircle />}<div><strong>{title}</strong><span>{message}</span></div><button onClick={dismiss} aria-label="Dismiss message"><X /></button></div>;
}
export function AdminModal({ title, description, children, close, footer }) {
    return <div className="admin-modal-backdrop"><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title"><header><div><h2 id="admin-modal-title">{title}</h2>{description && <p>{description}</p>}</div><button onClick={close} aria-label="Close dialog"><X /></button></header><div className="admin-modal__body">{children}</div>{footer && <footer>{footer}</footer>}</section></div>;
}
export function AdminStatusBadge({ status, label }) { return <span className={`admin-status admin-status--${status.replaceAll(' ', '-')}`}>{label ?? status.replaceAll('-', ' ')}</span>; }
