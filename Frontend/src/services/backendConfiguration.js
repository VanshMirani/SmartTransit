export function resolveBackendConfiguration(env = {}) {
    const required = env.PROD === true || env.VITE_USE_BACKEND === 'true';
    const baseUrl = String(env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
    let configurationError = '';
    if (required) {
        try {
            const url = new URL(baseUrl);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
                throw new Error();
            if (env.PROD && url.protocol !== 'https:')
                throw new Error();
        }
        catch {
            configurationError = 'The transport service is not configured. Ask the administrator to check VITE_API_BASE_URL (HTTPS is required in production).';
        }
    }
    return { enabled: required, baseUrl, configurationError };
}
