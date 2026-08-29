import { AlertCircle, BusFront, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Brand } from '../../components/Brand';
import { useAuth } from '../../auth/AuthContext';
import { demoAccounts, getDemoAccountPassword, roleHome } from '../../services/authService';
const showDemoControls = import.meta.env.DEV &&
    import.meta.env.VITE_USE_BACKEND !== 'true' &&
    import.meta.env.VITE_SHOW_DEMO_CONTROLS === 'true';
const demoLoginOptions = [
    { role: 'student', label: 'Student' },
    { role: 'driver', label: 'Driver' },
    { role: 'conductor', label: 'Conductor' },
    { role: 'admin', label: 'Admin' },
];
export function LoginPage() {
    const { checkingSession, user, login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const registration = location.state;
    const registeredEmail = registration?.registeredEmail ?? '';
    const [email, setEmail] = useState(registeredEmail);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [errors, setErrors] = useState({});
    if (checkingSession)
        return <main className="placeholder"><section className="placeholder__card"><p>Checking secure session...</p></section></main>;
    if (user)
        return <Navigate to={roleHome[user.role]} replace/>;
    const fillDemoAccount = (role) => {
        const account = demoAccounts[role];
        setEmail(account.email);
        setPassword(getDemoAccountPassword(role));
        setError('');
        setErrors({});
    };
    const submit = async (event) => {
        event.preventDefault();
        const nextErrors = {};
        if (!email.trim())
            nextErrors.email = 'University email is required.';
        else if (!/^\S+@\S+\.\S+$/.test(email))
            nextErrors.email = 'Enter a valid email address.';
        if (!password)
            nextErrors.password = 'Password is required.';
        else if (password.length < 8)
            nextErrors.password = 'Password must contain at least 8 characters.';
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length)
            return;
        setLoading(true);
        setError('');
        try {
            const session = await login(email, password);
            const requested = location.state?.from;
            navigate(requested?.startsWith(`/${session.role}`) ? requested : roleHome[session.role], { replace: true });
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to sign in. Try again.');
        }
        finally {
            setLoading(false);
        }
    };
    return (<main className="auth-page">
      <section className="auth-story">
        <div className="auth-story__inner"><Brand light/><div className="auth-story__copy"><span className="auth-story__icon"><BusFront /></span><h1>Welcome back to a smarter commute.</h1><p>One secure place for live tracking, trip operations and campus transport management.</p><div className="auth-benefits"><span><ShieldCheck /> Role-based access</span><span><CheckCircle2 /> University verified</span></div></div><small>SmartTransit · Indus University</small></div>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-mobile-brand"><Brand /></div>
        <form className="auth-card" onSubmit={submit} noValidate>
          <div className="auth-heading"><span className="auth-lock"><LockKeyhole /></span><h2>Sign in to SmartTransit</h2><p>Enter your credentials. SmartTransit will open the correct portal for your account.</p></div>
          {registeredEmail && <div className="form-alert form-alert--success" role="status"><CheckCircle2 /><span><strong>Account created</strong>{registration?.registeredName ? `Welcome, ${registration.registeredName}. ` : ''}Enter your new password to sign in.</span></div>}
          {error && <div className="form-alert form-alert--error" role="alert"><AlertCircle /><span><strong>Sign in failed</strong>{error}</span></div>}
          <div className="field"><label htmlFor="email">University email</label><div className={`input-wrap ${errors.email ? 'input-wrap--error' : ''}`}><UserRound /><input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined}/></div>{errors.email && <small id="email-error" className="field-error">{errors.email}</small>}</div>
          <div className="field"><div className="field__label-row"><label htmlFor="password">Password</label><Link to="/forgot-password">Forgot password?</Link></div><div className={`input-wrap ${errors.password ? 'input-wrap--error' : ''}`}><LockKeyhole /><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined}/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button></div>{errors.password && <small id="password-error" className="field-error">{errors.password}</small>}</div>
          <button className="button button--primary auth-submit" type="submit" disabled={loading}>{loading ? <><LoaderCircle className="spin"/> Signing in…</> : 'Sign in'}</button>
          <p className="auth-signup-prompt">New student? <Link to="/signup">Create an account</Link></p>
          {showDemoControls && <div className="demo-note"><strong>Demo shortcuts</strong><span>{demoLoginOptions.map((item) => <button key={item.role} type="button" onClick={() => fillDemoAccount(item.role)}>{item.label}</button>)}</span></div>}
          <p className="auth-security"><ShieldCheck /> Secure access. Your data stays protected.</p>
        </form>
        <Link className="auth-back" to="/">← Back to public website</Link>
      </section>
    </main>);
}
