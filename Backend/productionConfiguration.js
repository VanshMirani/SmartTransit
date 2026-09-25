export function productionBackendErrors(env) {
    const errors = [];
    if (!env.SMARTTRANSIT_OTP_SECRET || env.SMARTTRANSIT_OTP_SECRET.trim().length < 32 || env.SMARTTRANSIT_OTP_SECRET === 'smarttransit-development-otp-secret')
        errors.push('SMARTTRANSIT_OTP_SECRET must contain at least 32 characters and must not use the development value');
    try {
        const origin = new URL(env.SMARTTRANSIT_ALLOWED_ORIGIN);
        if (origin.protocol !== 'https:' || origin.origin !== env.SMARTTRANSIT_ALLOWED_ORIGIN || origin.username || origin.password) throw new Error();
    } catch {
        errors.push('SMARTTRANSIT_ALLOWED_ORIGIN must be one HTTPS frontend origin without a path or wildcard');
    }
    return errors;
}
