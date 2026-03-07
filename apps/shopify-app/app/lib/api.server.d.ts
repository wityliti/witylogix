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
export interface ApiError {
    statusCode: number;
    error: string;
    message: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}
export interface SingleResponse<T> {
    data: T;
}
export declare function createApiClient(sessionToken: string): {
    get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T>;
    post<T>(path: string, body?: unknown): Promise<T>;
    patch<T>(path: string, body?: unknown): Promise<T>;
    delete<T>(path: string): Promise<T>;
    put<T>(path: string, body?: unknown): Promise<T>;
};
export declare class ApiRequestError extends Error {
    statusCode: number;
    errorType: string;
    constructor(error: ApiError);
}
//# sourceMappingURL=api.server.d.ts.map