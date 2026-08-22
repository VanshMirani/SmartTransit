const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";

export const backendConfig = {
    baseUrl: rawBaseUrl.replace(/\/$/, ""),
    enabled: import.meta.env.VITE_USE_BACKEND === "true" && Boolean(rawBaseUrl),
};

const TOKEN_KEY = "smarttransit.authToken";

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
        return text;
    }
}

export async function apiRequest(path, { method = "GET", body, headers = {}, signal } = {}) {
    if (!backendConfig.enabled) {
        throw new ApiError("Backend API is not enabled.", 0);
    }

    const token = getBackendToken();
    const response = await fetch(endpoint(path), {
        method,
        signal,
        headers: {
            Accept: "application/json",
            ...(body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await parseResponse(response);

    if (!response.ok) {
        const message = typeof data === "object" && data?.message
            ? data.message
            : `Request failed with status ${response.status}.`;
        throw new ApiError(message, response.status, data);
    }

    return data;
}
