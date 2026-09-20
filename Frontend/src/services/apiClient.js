import { resolveBackendConfiguration } from './backendConfiguration.js';
export const backendConfig = resolveBackendConfiguration(import.meta.env);

const TOKEN_KEY = "smarttransit.authToken";
let mutationVersion = 0;

export class ApiError extends Error {
    constructor(message, status, details) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.details = details;
    }
}

export function saveBackendToken(token) {
    if (!token)
        return;
    sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearBackendToken() {
    sessionStorage.removeItem(TOKEN_KEY);
}

function getBackendToken() {
    return sessionStorage.getItem(TOKEN_KEY);
}

export function hasBackendToken() {
    return Boolean(getBackendToken());
}

function endpoint(path) {
    return `${backendConfig.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function parseResponse(response) {
    const text = await response.text();
    if (!text)
        return null;
    try {
        return JSON.parse(text);
    }
    catch {
        throw new ApiError('The transport service returned an invalid response. Please retry or contact the administrator.', 502);
    }
}

export async function apiRequest(path, options = {}) {
    try {
        const data = await request(path, options);
        window.dispatchEvent(new CustomEvent('smarttransit:connection', { detail: { path, failed: false } }));
        return data;
    } catch (error) {
        if ((!options.method || options.method === 'GET') && !options.signal?.aborted && (!error.status || error.status >= 500))
            window.dispatchEvent(new CustomEvent('smarttransit:connection', { detail: { path, failed: true } }));
        throw error;
    }
}

async function request(path, { method = "GET", body, headers = {}, signal } = {}) {
    if (!backendConfig.enabled) {
        throw new ApiError("Backend API is not enabled.", 0);
    }
    if (backendConfig.configurationError)
        throw new ApiError(backendConfig.configurationError, 0);

    const token = getBackendToken();
    if (method !== 'GET') mutationVersion += 1;
    const version = mutationVersion;
    const networkFailure = (error) => {
        if (signal?.aborted || error instanceof ApiError) throw error;
        const message = error.name === 'TimeoutError'
            ? 'The transport service is taking too long to respond. Please retry shortly.'
            : 'Unable to reach the transport service. Check your internet connection and try again.';
        throw new ApiError(message, 0);
    };
    const response = await fetch(endpoint(path), {
        method,
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
        headers: {
            Accept: "application/json",
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
    }).catch(networkFailure);
    const data = await parseResponse(response).catch(networkFailure);
    if (path !== '/auth/logout' && token && token !== getBackendToken())
        throw new ApiError('Session changed during the request.', 409);
    if (method === 'GET' && version !== mutationVersion)
        return apiRequest(path, { method, body, headers, signal });

    if (!response.ok) {
        const message = typeof data === "object" && data?.message
            ? data.message
            : `Request failed with status ${response.status}.`;
        throw new ApiError(message, response.status, data);
    }

    if (method !== 'GET') mutationVersion += 1;
    return data;
}
