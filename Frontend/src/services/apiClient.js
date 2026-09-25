import { resolveBackendConfiguration } from './backendConfiguration.js';
export const backendConfig = resolveBackendConfiguration(import.meta.env);

const TOKEN_KEY = "smarttransit.authToken";
let mutationVersion = 0;
let sessionVersion = 0;
let readSequence = 0;
const acceptedReads = new Map();

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
    sessionVersion += 1;
    acceptedReads.clear();
    sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearBackendToken() {
    sessionVersion += 1;
    acceptedReads.clear();
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
    const session = sessionVersion;
    try {
        const data = await request(path, options);
        if (session === sessionVersion)
            window.dispatchEvent(new CustomEvent('smarttransit:connection', { detail: { path, failed: false } }));
        return data;
    } catch (error) {
        if (session === sessionVersion && (!options.method || options.method === 'GET') && !options.signal?.aborted && (!error.status || error.status >= 500))
            window.dispatchEvent(new CustomEvent('smarttransit:connection', { detail: { path, failed: true } }));
        throw error;
    }
}

async function request(path, { method = "GET", body, headers = {}, signal } = {}, retries = 1) {
    if (!backendConfig.enabled) {
        throw new ApiError("Backend API is not enabled.", 0);
    }
    if (backendConfig.configurationError)
        throw new ApiError(backendConfig.configurationError, 0);

    const token = getBackendToken();
    const session = sessionVersion;
    if (method !== 'GET') mutationVersion += 1;
    const version = mutationVersion;
    const sequence = method === 'GET' ? ++readSequence : 0;
    const networkFailure = (error) => {
        if (signal?.aborted || error instanceof ApiError) throw error;
        const message = error.name === 'TimeoutError'
            ? 'The transport service is taking too long to respond. Please retry shortly.'
            : 'Unable to reach the transport service. Check your internet connection and try again.';
        throw new ApiError(message, 0);
    };
    // AbortController is supported on older mobile browsers without AbortSignal.any/timeout.
    const controller = new AbortController();
    const cancel = () => controller.abort(signal.reason);
    if (signal?.aborted) cancel();
    else signal?.addEventListener('abort', cancel, { once: true });
    const timeout = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 15000);
    let response, data;
    try {
        response = await fetch(endpoint(path), {
            method,
            signal: controller.signal,
            headers: {
                Accept: "application/json",
                ...(body ? { "Content-Type": "application/json" } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...headers,
            },
            body: body ? JSON.stringify(body) : undefined,
        }).catch(networkFailure);
        data = await parseResponse(response).catch(networkFailure);
    } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', cancel);
    }
    if (path !== '/auth/logout' && (session !== sessionVersion || token !== getBackendToken()))
        throw new ApiError('Session changed during the request.', 409);
    if (method === 'GET' && (version !== mutationVersion || sequence < (acceptedReads.get(path) ?? 0))) {
        if (retries > 0) return request(path, { method, body, headers, signal }, retries - 1);
        throw new ApiError('Transport data changed while loading. Please retry the refresh.', 503);
    }

    if (!response.ok) {
        const message = typeof data === "object" && data?.message
            ? data.message
            : `Request failed with status ${response.status}.`;
        throw new ApiError(message, response.status, data);
    }

    if (method !== 'GET') mutationVersion += 1;
    else acceptedReads.set(path, sequence);
    return data;
}
