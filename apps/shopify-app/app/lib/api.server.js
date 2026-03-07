/**
 * Server-side API client for the Witylogix backend.
 *
 * All data fetching in the Shopify app happens server-side via
 * React Router v7 loaders and actions. This module provides a
 * typed fetch wrapper that:
 *   1. Reads the API base URL from environment
 *   2. Attaches the Shopify session token as Authorization header
 *   3. Handles errors uniformly
 *   4. Returns typed JSON responses
 *
 * Usage in loaders:
 * ```ts
 * const api = createApiClient(shopifySessionToken);
 * const orders = await api.get<PaginatedResponse<Order>>("/api/v4/orders", { page: 1 });
 * ```
 */
const API_BASE = process.env.API_BASE_URL ?? "http://localhost:8000";
// ─── Client Factory ────────────────────────────────────────
export function createApiClient(sessionToken) {
    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
    };
    async function request(method, path, options) {
        const url = new URL(path, API_BASE);
        // Append query params, filtering out undefined values
        if (options?.params) {
            for (const [key, value] of Object.entries(options.params)) {
                if (value !== undefined) {
                    url.searchParams.set(key, String(value));
                }
            }
        }
        const response = await fetch(url.toString(), {
            method,
            headers,
            body: options?.body ? JSON.stringify(options.body) : undefined,
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({
                statusCode: response.status,
                error: response.statusText,
                message: `API request failed: ${method} ${path}`,
            }));
            throw new ApiRequestError(error);
        }
        return response.json();
    }
    return {
        get(path, params) {
            return request("GET", path, { params });
        },
        post(path, body) {
            return request("POST", path, { body });
        },
        patch(path, body) {
            return request("PATCH", path, { body });
        },
        delete(path) {
            return request("DELETE", path);
        },
        put(path, body) {
            return request("PUT", path, { body });
        },
    };
}
// ─── Error Class ───────────────────────────────────────────
export class ApiRequestError extends Error {
    statusCode;
    errorType;
    constructor(error) {
        super(error.message);
        this.name = "ApiRequestError";
        this.statusCode = error.statusCode;
        this.errorType = error.error;
    }
}
//# sourceMappingURL=api.server.js.map