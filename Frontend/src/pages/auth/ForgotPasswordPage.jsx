import { ArrowLeft, CheckCircle2, LoaderCircle, Mail, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Brand } from '../../components/Brand';
import { authService } from '../../services/authService';
export function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);
    const submit = async (event) => {
        event.preventDefault();
        setError('');
        if (!email.trim()) {
            setError('Institute email is required.');
            return;
        }
        setLoading(true);
        try {
            await authService.requestPasswordReset(email);
            setSent(true);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to send reset instructions.');
        }
        finally {
            setLoading(false);
        }
    };
    return <main className="simple-auth"><div className="simple-auth__brand"><Brand /></div><section className="auth-card auth-card--compact">{sent ? <div className="auth-success"><span><CheckCircle2 /></span><h1>Check your inbox</h1><p>If an account exists for <strong>{email}</strong>, password reset instructions have been sent.</p><Link className="button button--primary" to="/login"><ArrowLeft /> Return to sign in</Link></div> : <><div className="auth-heading"><span className="auth-lock"><Mail /></span><h1>Reset your password</h1><p>Enter your Indus University email and we’ll send reset instructions.</p></div><form onSubmit={submit} noValidate><div className="field"><label htmlFor="reset-email">Institute email</label><div className={`input-wrap ${error ? 'input-wrap--error' : ''}`}><Mail /><input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@indusuni.ac.in" aria-invalid={Boolean(error)}/></div>{error && <small className="field-error" role="alert">{error}</small>}</div><button className="button button--primary auth-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin"/> Sending…</> : 'Send reset instructions'}</button></form><Link className="auth-back" to="/login"><ArrowLeft /> Back to sign in</Link><p className="auth-security"><ShieldCheck /> Your password is never shared with SmartTransit staff.</p></>}</section></main>;
}
