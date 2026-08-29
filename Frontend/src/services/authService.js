import { apiRequest, backendConfig, clearBackendToken, hasBackendToken, saveBackendToken } from "./apiClient";
import { isInstituteEmail, normalizeEmail } from "../utils/registrationValidation";

export const demoAccounts = {
    student: { id: 'stu-2023', name: 'Aarav Shah', email: 'student@iite.indusuni.ac.in', password: 'Student@123', role: 'student', initials: 'AS' },
    driver: { id: 'drv-101', name: 'Imran Hussain', email: 'driver@transport.indusuni.ac.in', password: 'Driver@123', role: 'driver', initials: 'IH' },
    conductor: { id: 'con-101', name: 'Rahul Patel', email: 'conductor@transport.indusuni.ac.in', password: 'Conductor@123', role: 'conductor', initials: 'RP' },
    admin: { id: 'adm-001', name: 'Admin Operator', email: 'admin@transport.indusuni.ac.in', password: 'Admin@123', role: 'admin', initials: 'AO' },
};
const SESSION_KEY = 'smarttransit.session';
const REGISTERED_STUDENTS_KEY = 'smarttransit.registeredStudents';
export const roleHome = {
    student: '/student',
    driver: '/driver',
    conductor: '/conductor',
    admin: '/admin',
};
const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
function getRegisteredStudents() {
    try {
        const stored = localStorage.getItem(REGISTERED_STUDENTS_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function publicUser(account) {
    return { id: account.id, name: account.name, email: account.email, role: account.role, initials: account.initials };
}
function publicBackendUser(payload, fallbackRole = "student") {
    const account = payload?.user ?? payload;
    return {
        id: account.id,
        name: account.name ?? account.fullName,
        email: account.email,
        role: account.role ?? fallbackRole,
        initials: account.initials ?? initialsFor(account.name ?? account.fullName ?? account.email),
        enrollment: account.enrollment,
        phone: account.phone,
        routeCode: account.routeCode,
    };
}
function initialsFor(name) {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}
export const authService = {
    async login(email, password) {
        if (backendConfig.enabled) {
            const payload = await apiRequest("/auth/login", {
                method: "POST",
                body: { email: normalizeEmail(email), password },
            });
            saveBackendToken(payload?.token ?? payload?.accessToken);
            const user = publicBackendUser(payload);
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
            return user;
        }

        await wait(650);
        const normalizedEmail = normalizeEmail(email);
        const account = [
            ...getRegisteredStudents(),
            ...Object.values(demoAccounts),
        ].find((item) => item.email.toLowerCase() === normalizedEmail);
        if (!account || account.password !== password) {
            throw new Error('The email or password is incorrect.');
        }
        const user = publicUser(account);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
        return user;
    },
    async requestSignupOtp(email) {
        const normalizedEmail = normalizeEmail(email);
        if (backendConfig.enabled) {
            return apiRequest("/auth/signup-otp", {
                method: "POST",
                body: { email: normalizedEmail },
            });
        }

        await wait(500);
        if (!isInstituteEmail(normalizedEmail)) {
            throw new Error("Use your Indus University email ending with indusuni.ac.in.");
        }
        throw new Error("Student signup requires the backend email service. Start the full app with SMTP settings enabled.");
    },
    async registerStudent(input) {
        if (backendConfig.enabled) {
            const payload = await apiRequest("/auth/register/student", {
                method: "POST",
                body: {
                    fullName: input.fullName.trim(),
                    email: normalizeEmail(input.email),
                    phone: input.phone,
                    password: input.password,
                    otp: input.otp,
                },
            });
            saveBackendToken(payload?.token ?? payload?.accessToken);
            return publicBackendUser(payload, "student");
        }

        await wait(700);
        throw new Error("Student signup requires backend OTP verification.");
    },
    logout() {
        clearBackendToken();
        sessionStorage.removeItem(SESSION_KEY);
    },
    getSession() {
        if (backendConfig.enabled && !hasBackendToken()) {
            sessionStorage.removeItem(SESSION_KEY);
            return null;
        }
        try {
            const session = sessionStorage.getItem(SESSION_KEY);
            return session ? JSON.parse(session) : null;
        }
        catch {
            return null;
        }
    },
    async validateSession() {
        if (!backendConfig.enabled)
            return this.getSession();
        if (!this.getSession())
            return null;
        try {
            const payload = await apiRequest("/auth/session");
            const user = publicBackendUser(payload);
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
            return user;
        }
        catch {
            this.logout();
            return null;
        }
    },
    async requestPasswordReset(email) {
        const normalizedEmail = normalizeEmail(email);
        if (backendConfig.enabled) {
            return apiRequest("/auth/password-reset", {
                method: "POST",
                body: { email: normalizedEmail },
            });
        }

        await wait(700);
        if (!isInstituteEmail(normalizedEmail))
            throw new Error('Enter your Indus University email ending with indusuni.ac.in.');
        throw new Error("Password reset requires the backend email service.");
    },
    async confirmPasswordReset({ email, otp, password }) {
        const normalizedEmail = normalizeEmail(email);
        if (backendConfig.enabled) {
            return apiRequest("/auth/password-reset/confirm", {
                method: "POST",
                body: {
                    email: normalizedEmail,
                    otp,
                    password,
                },
            });
        }

        await wait(700);
        if (!isInstituteEmail(normalizedEmail))
            throw new Error('Enter your Indus University email ending with indusuni.ac.in.');
        throw new Error("Password reset requires the backend email service.");
    },
};
