import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { BrandLogo } from "../../components/Brand";
import { authService } from "../../services/authService";
import { isInstituteEmail, isValidOtp, normalizeEmail, validatePassword } from "../../utils/registrationValidation";

const initialValues = {
    email: "",
    otp: "",
    password: "",
    confirmPassword: "",
};

export function ForgotPasswordPage() {
    const [values, setValues] = useState(initialValues);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [serverError, setServerError] = useState("");
    const [otpInfo, setOtpInfo] = useState(null);
    const [step, setStep] = useState("request");

    const update = (key, value) => {
        setValues((current) => ({ ...current, [key]: value }));
        setErrors((current) => ({ ...current, [key]: undefined }));
        setServerError("");
    };

    const sendResetOtp = async () => {
        const email = normalizeEmail(values.email);
        if (!email) {
            setErrors({ email: "Institute email is required." });
            return;
        }
        if (!isInstituteEmail(email)) {
            setErrors({ email: "Enter your Indus University email ending with indusuni.ac.in." });
            return;
        }
        setLoading(true);
        setServerError("");
        try {
            const result = await authService.requestPasswordReset(email);
            setValues((current) => ({
                ...current,
                email,
                otp: "",
                password: "",
                confirmPassword: "",
            }));
            setOtpInfo(result);
            setStep("verify");
        }
        catch (reason) {
            setServerError(reason instanceof Error ? reason.message : "Unable to send reset OTP. Try again.");
        }
        finally {
            setLoading(false);
        }
    };

    const submitEmail = async (event) => {
        event.preventDefault();
        await sendResetOtp();
    };

    const submitReset = async (event) => {
        event.preventDefault();
        const nextErrors = {};
        if (!isValidOtp(values.otp))
            nextErrors.otp = "Enter the 6-digit OTP sent to your email.";
        const passwordError = validatePassword(values.password);
        if (passwordError)
            nextErrors.password = passwordError;
        if (!values.confirmPassword) {
            nextErrors.confirmPassword = "Confirm your new password.";
        }
        else if (values.confirmPassword !== values.password) {
            nextErrors.confirmPassword = "Passwords do not match.";
        }
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length)
            return;
        setLoading(true);
        setServerError("");
        try {
            await authService.confirmPasswordReset({
                email: values.email,
                otp: values.otp,
                password: values.password,
            });
            setStep("complete");
        }
        catch (reason) {
            setServerError(reason instanceof Error ? reason.message : "Unable to reset password. Try again.");
        }
        finally {
            setLoading(false);
        }
    };

    if (step === "complete") {
        return (<main className="simple-auth">
            <div className="simple-auth__brand"><BrandLogo className="auth-page-logo"/></div>
            <section className="auth-card auth-card--compact auth-success" aria-live="polite">
                <span><CheckCircle2 /></span>
                <h1>Password updated</h1>
                <p>Your SmartTransit password has been changed. Sign in again with your new password.</p>
                <Link className="button button--primary" to="/login" state={{ registeredEmail: values.email }}>
                    <ArrowLeft /> Return to sign in
                </Link>
            </section>
        </main>);
    }

    return (<main className="simple-auth">
        <div className="simple-auth__brand"><BrandLogo className="auth-page-logo"/></div>
        <section className="auth-card auth-card--compact">
            <div className="auth-heading">
                <span className="auth-lock"><Mail /></span>
                <h1>Reset your password</h1>
                <p>{step === "request"
                    ? "Enter your Indus University email and we will send a reset OTP."
                    : "Enter the OTP from your email and choose a new password."}</p>
            </div>

            {serverError && (<div className="form-alert form-alert--error" role="alert">
                <AlertCircle />
                <span><strong>Password reset failed</strong>{serverError}</span>
            </div>)}

            {step === "verify" && (<div className="form-alert form-alert--success" role="status">
                <CheckCircle2 />
                <span>
                    <strong>Reset OTP sent</strong>
                    If an account exists for {values.email}, the OTP will arrive shortly. It expires in {otpInfo?.expiresInMinutes ?? 10} minutes.
                </span>
            </div>)}

            {step === "request"
                ? <form onSubmit={submitEmail} noValidate>
                    <EmailField value={values.email} error={errors.email} onChange={(value) => update("email", value)} />
                    <button className="button button--primary auth-submit" type="submit" disabled={loading}>
                        {loading ? <><LoaderCircle className="spin" /> Sending OTP...</> : <><Mail /> Send reset OTP</>}
                    </button>
                </form>
                : <form onSubmit={submitReset} noValidate>
                    <EmailField value={values.email} error={errors.email} readOnly onChange={(value) => update("email", value)} />
                    <div className="field">
                        <label htmlFor="reset-otp">Email OTP</label>
                        <div className={`input-wrap ${errors.otp ? "input-wrap--error" : ""}`}>
                            <KeyRound />
                            <input id="reset-otp" inputMode="numeric" autoComplete="one-time-code" value={values.otp} onChange={(event) => update("otp", event.target.value.replace(/\D/g, "").slice(0, 6))} aria-invalid={Boolean(errors.otp)} aria-describedby={errors.otp ? "reset-otp-error" : undefined} placeholder="6-digit code" maxLength={6} />
                        </div>
                        {errors.otp && <small id="reset-otp-error" className="field-error">{errors.otp}</small>}
                    </div>
                    <PasswordField id="reset-password" label="New password" value={values.password} error={errors.password} autoComplete="new-password" onChange={(value) => update("password", value)} />
                    <PasswordField id="reset-confirm-password" label="Confirm new password" value={values.confirmPassword} error={errors.confirmPassword} autoComplete="new-password" onChange={(value) => update("confirmPassword", value)} />
                    <button className="button button--primary auth-submit" type="submit" disabled={loading}>
                        {loading ? <><LoaderCircle className="spin" /> Updating password...</> : <><LockKeyhole /> Reset password</>}
                    </button>
                    <button className="auth-link-button" type="button" onClick={sendResetOtp} disabled={loading}>
                        Send a new OTP
                    </button>
                    <button className="auth-link-button" type="button" onClick={() => {
                        setStep("request");
                        setErrors({});
                        setServerError("");
                    }} disabled={loading}>
                        Use a different email
                    </button>
                </form>}

            <Link className="auth-back" to="/login"><ArrowLeft /> Back to sign in</Link>
            <p className="auth-security"><ShieldCheck /> Your password is never shared with SmartTransit staff.</p>
        </section>
    </main>);
}

function EmailField({ value, error, readOnly = false, onChange }) {
    return (<div className="field">
        <label htmlFor="reset-email">Institute email</label>
        <div className={`input-wrap ${error ? "input-wrap--error" : ""}`}>
            <Mail />
            <input id="reset-email" type="email" autoComplete="email" value={value} onChange={(event) => onChange(event.target.value)} readOnly={readOnly} aria-invalid={Boolean(error)} aria-describedby={error ? "reset-email-error" : undefined} placeholder="name@indusuni.ac.in" />
        </div>
        {error && <small id="reset-email-error" className="field-error" role="alert">{error}</small>}
    </div>);
}

function PasswordField({ id, label, value, error, autoComplete, onChange }) {
    const [visible, setVisible] = useState(false);
    const errorId = `${id}-error`;
    return (<div className="field">
        <label htmlFor={id}>{label}</label>
        <div className={`input-wrap ${error ? "input-wrap--error" : ""}`}>
            <LockKeyhole />
            <input id={id} type={visible ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />
            <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>
                {visible ? <EyeOff /> : <Eye />}
            </button>
        </div>
        {error && <small id={errorId} className="field-error">{error}</small>}
    </div>);
}
