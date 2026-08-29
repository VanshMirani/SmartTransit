const instituteEmailPattern = /^[^\s@]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*indusuni\.ac\.in$/i;

export function normalizeIndianPhone(phone) {
    const digits = phone.replace(/\D/g, "");
    return digits.length === 12 && digits.startsWith("91")
        ? digits.slice(2)
        : digits;
}

export function normalizeEmail(email) {
    return email.trim().toLowerCase();
}

export function isInstituteEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    return instituteEmailPattern.test(normalizedEmail);
}

export function signupEmailHelpText() {
    return "Use your Indus University email ending with indusuni.ac.in.";
}

export function isValidOtp(otp) {
    return /^\d{6}$/.test(String(otp ?? "").trim());
}

export function validatePassword(password) {
    if (password.length < 8) {
        return "Password must contain at least 8 characters.";
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        return "Include an uppercase letter, a lowercase letter and a number.";
    }
    if (!/[^\w\s]/.test(password)) {
        return "Include at least one special character, such as @, # or !.";
    }
    return "";
}

export function validateStudentRegistration(values, options = {}) {
    const errors = {};
    const name = values.fullName.trim();
    const email = values.email.trim();
    const phone = normalizeIndianPhone(values.phone);
    if (name.length < 3) {
        errors.fullName = "Enter your full name (at least 3 characters).";
    }
    if (!isInstituteEmail(email)) {
        errors.email = signupEmailHelpText();
    }
    if (!/^\d{10}$/.test(phone)) {
        errors.phone = "Enter a valid 10-digit mobile number.";
    }
    const passwordError = validatePassword(values.password);
    if (passwordError)
        errors.password = passwordError;
    if (!values.confirmPassword) {
        errors.confirmPassword = "Confirm your password.";
    }
    else if (values.confirmPassword !== values.password) {
        errors.confirmPassword = "Passwords do not match.";
    }
    if (!values.acceptedTerms) {
        errors.acceptedTerms = "Accept the privacy information to continue.";
    }
    if (options.requireOtp && !isValidOtp(values.otp)) {
        errors.otp = "Enter the 6-digit OTP sent to your email.";
    }
    return errors;
}
