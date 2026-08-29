import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail, Phone, ShieldCheck, UserPlus, UserRound, } from "lucide-react";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { BrandLogo } from "../../components/Brand";
import { roleHome } from "../../services/authService";
import { normalizeIndianPhone, validateStudentRegistration, } from "../../utils/registrationValidation";
const initialValues = {
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    otp: "",
    acceptedTerms: false,
};
const coreSignupFields = ["fullName", "email", "phone", "password", "confirmPassword"];
function getVisibleSignupErrors(values, options = {}) {
    const nextErrors = validateStudentRegistration(values, options);
    const hasCoreError = coreSignupFields.some((field) => nextErrors[field]);
    if (hasCoreError) {
        delete nextErrors.acceptedTerms;
        delete nextErrors.otp;
    }
    return nextErrors;
}
export function SignupPage() {
    const { user, requestSignupOtp, registerStudent } = useAuth();
    const [values, setValues] = useState(initialValues);
    const [errors, setErrors] = useState({});
    const [serverError, setServerError] = useState("");
    const [otpInfo, setOtpInfo] = useState(null);
    const [otpSent, setOtpSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [registeredName, setRegisteredName] = useState("");
    if (user)
        return <Navigate to={roleHome[user.role]} replace/>;
    const update = (key, value) => {
        setValues((current) => ({ ...current, [key]: value, ...(key === "email" ? { otp: "" } : {}) }));
        setErrors((current) => ({ ...current, [key]: undefined }));
        if (key === "email") {
            setOtpSent(false);
            setOtpInfo(null);
        }
        setServerError("");
    };
    const sendOtp = async () => {
        const nextErrors = getVisibleSignupErrors(values);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length)
            return;
        setLoading(true);
        setServerError("");
        try {
            const result = await requestSignupOtp(values.email);
            setOtpInfo(result);
            setOtpSent(true);
            setValues((current) => ({ ...current, otp: "" }));
        }
        catch (reason) {
            setServerError(reason instanceof Error
                ? reason.message
                : "Unable to send OTP. Try again.");
        }
        finally {
            setLoading(false);
        }
    };
    const submit = async (event) => {
        event.preventDefault();
        if (!otpSent) {
            await sendOtp();
            return;
        }
        const nextErrors = getVisibleSignupErrors(values, { requireOtp: true });
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length)
            return;
        setLoading(true);
        setServerError("");
        try {
            const account = await registerStudent({
                fullName: values.fullName,
                email: values.email,
                phone: normalizeIndianPhone(values.phone),
                password: values.password,
                otp: values.otp,
            });
            setRegisteredName(account.name);
        }
        catch (reason) {
            setServerError(reason instanceof Error
                ? reason.message
                : "Unable to create your account. Try again.");
        }
        finally {
            setLoading(false);
        }
    };
    if (registeredName) {
        return (<main className="simple-auth signup-page">
        <Brand />
        <section className="auth-card signup-card auth-success" aria-live="polite">
          <span>
            <CheckCircle2 />
          </span>
          <h1>Student account created</h1>
          <p>
            Welcome, {registeredName}. Your account is ready. Sign in with your
            university email to open the student dashboard.
          </p>
          <Link className="button button--primary" to="/login" state={{
                registeredEmail: values.email.trim().toLowerCase(),
                registeredName,
            }}>
            Continue to sign in
          </Link>
          <Link className="auth-back signup-home-link" to="/">
            Return to homepage
          </Link>
        </section>
      </main>);
    }
    return (<main className="simple-auth signup-page">
      <BrandLogo className="auth-page-logo"/>
      <form className="auth-card signup-card" onSubmit={submit} noValidate>
        <div className="auth-heading">
          <span className="auth-lock">
            <UserPlus />
          </span>
          <h1>Create your student account</h1>
          <p>
            Register with your verified institute email to access live transport
            services.
          </p>
        </div>

        {serverError && (<div className="form-alert form-alert--error" role="alert">
            <AlertCircle />
            <span>
              <strong>Account not created</strong>
              {serverError}
            </span>
          </div>)}

        {otpSent && (<div className="form-alert form-alert--success" role="status">
            <CheckCircle2 />
            <span>
              <strong>OTP verification started</strong>
              Check {values.email.trim().toLowerCase()} and enter the 6-digit
              code. The code expires in{" "}
              {otpInfo?.expiresInMinutes ?? 10} minutes.
            </span>
          </div>)}

        <div className="signup-form-grid">
          <div className="field">
            <label htmlFor="signup-name">Full name</label>
            <div className={`input-wrap ${errors.fullName ? "input-wrap--error" : ""}`}>
              <UserRound />
              <input id="signup-name" autoComplete="name" value={values.fullName} onChange={(event) => update("fullName", event.target.value)} aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? "signup-name-error" : undefined} placeholder="Aarav Shah"/>
            </div>
            {errors.fullName && <small id="signup-name-error" className="field-error">{errors.fullName}</small>}
          </div>

          <div className="field">
            <label htmlFor="signup-email">Institute email</label>
            <div className={`input-wrap ${errors.email ? "input-wrap--error" : ""}`}>
              <Mail />
              <input id="signup-email" type="email" autoComplete="email" value={values.email} onChange={(event) => update("email", event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "signup-email-error" : undefined} placeholder="you@indusuni.ac.in"/>
            </div>
            {errors.email && <small id="signup-email-error" className="field-error">{errors.email}</small>}
          </div>

          <div className="field">
            <label htmlFor="signup-phone">Mobile number</label>
            <div className={`input-wrap ${errors.phone ? "input-wrap--error" : ""}`}>
              <Phone />
              <input id="signup-phone" type="tel" inputMode="tel" autoComplete="tel" value={values.phone} onChange={(event) => update("phone", event.target.value)} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "signup-phone-error" : undefined} placeholder="98765 43210"/>
            </div>
            {errors.phone && <small id="signup-phone-error" className="field-error">{errors.phone}</small>}
          </div>

          <PasswordField id="signup-password" label="Create password" value={values.password} error={errors.password} autoComplete="new-password" onChange={(value) => update("password", value)}/>
          <PasswordField id="signup-confirm-password" label="Confirm password" value={values.confirmPassword} error={errors.confirmPassword} autoComplete="new-password" onChange={(value) => update("confirmPassword", value)}/>

          {otpSent && (<div className="field">
            <label htmlFor="signup-otp">Email OTP</label>
            <div className={`input-wrap ${errors.otp ? "input-wrap--error" : ""}`}>
              <KeyRound />
              <input id="signup-otp" inputMode="numeric" autoComplete="one-time-code" value={values.otp} onChange={(event) => update("otp", event.target.value.replace(/\D/g, "").slice(0, 6))} aria-invalid={Boolean(errors.otp)} aria-describedby={errors.otp ? "signup-otp-error" : undefined} placeholder="6-digit code" maxLength={6}/>
            </div>
            {errors.otp && <small id="signup-otp-error" className="field-error">{errors.otp}</small>}
          </div>)}
        </div>

        <div className={`signup-consent ${errors.acceptedTerms ? "signup-consent--error" : ""}`}>
          <input id="signup-terms" type="checkbox" checked={values.acceptedTerms} onChange={(event) => update("acceptedTerms", event.target.checked)} aria-invalid={Boolean(errors.acceptedTerms)} aria-describedby={errors.acceptedTerms ? "signup-terms-error" : undefined}/>
          <div>
            <label htmlFor="signup-terms">I understand how SmartTransit uses my transport data.</label>{" "}
            <Link to="/privacy">Read the privacy information.</Link>
          </div>
        </div>
        {errors.acceptedTerms && <small id="signup-terms-error" className="field-error signup-consent-error">{errors.acceptedTerms}</small>}

        <button className="button button--primary auth-submit" type="submit" disabled={loading}>
          {loading
            ? <><LoaderCircle className="spin"/> {otpSent ? "Creating account…" : "Sending OTP…"}</>
            : otpSent
                ? <><UserPlus /> Verify OTP & create account</>
                : <><Mail /> Send OTP</>}
        </button>

        {otpSent && (<button className="auth-link-button" type="button" onClick={sendOtp} disabled={loading}>
          Send a new OTP
        </button>)}

        <p className="auth-signup-prompt">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
        <div className="signup-staff-note">
          <ShieldCheck />
          <span><strong>Driver, conductor or operator?</strong> Staff accounts are issued by the transport office.</span>
        </div>
      </form>
      <Link className="auth-back" to="/">← Back to public website</Link>
    </main>);
}
function PasswordField({ id, label, value, error, autoComplete, onChange }) {
    const [visible, setVisible] = useState(false);
    const errorId = `${id}-error`;
    return (<div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`input-wrap ${error ? "input-wrap--error" : ""}`}>
        <LockKeyhole />
        <input id={id} type={visible ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}/>
        <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
          {visible ? <EyeOff /> : <Eye />}
        </button>
      </div>
      {error && <small id={errorId} className="field-error">{error}</small>}
    </div>);
}
