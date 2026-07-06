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

/** Normalized origin for `new URL(path, base)` (no trailing slash). */
export function getApiBaseUrl(): string {
  return (process.env.API_BASE_URL ?? "http://localhost:8000").replace(
    /\/$/,
    "",
  );
}

// ─── Types ─────────────────────────────────────────────────

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

// ─── Client Factory ────────────────────────────────────────

/**
 * Extract the App Bridge JWT from an incoming request's Authorization header.
 * Falls back to the Shopify OAuth access token when the header is absent
 * (e.g. during an initial document request that App Bridge hasn't intercepted yet).
 *
 * The Witylogix API verifies App Bridge JWTs with SHOPIFY_API_SECRET.
 * `session.accessToken` is an opaque OAuth token that cannot be verified this way,
 * so always prefer the header value when present.
 */
export function createApiClientFromRequest(
  request: Request,
  session: { accessToken?: string | null },
) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : (session.accessToken ?? "");
  return createApiClient(token);
}

export function createApiClient(sessionToken: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionToken}`,
  };

  async function request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string | number | boolean | undefined>;
    },
  ): Promise<T> {
    const url = new URL(path, getApiBaseUrl());

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
      const error: ApiError = await response.json().catch(() => ({
        statusCode: response.status,
        error: response.statusText,
        message: `API request failed: ${method} ${path}`,
      }));
      throw new ApiRequestError(error);
    }

    const json = (await response.json()) as any;
    // The API uses `pagination` for list endpoints; normalise to `meta`
    // so all callers can use the PaginatedResponse<T> shape consistently.
    if (
      json &&
      typeof json === "object" &&
      "pagination" in json &&
      !("meta" in json)
    ) {
      json.meta = json.pagination;
    }
    return json as T;
  }

  return {
    get<T>(
      path: string,
      params?: Record<string, string | number | boolean | undefined>,
    ) {
      return request<T>("GET", path, { params });
    },

    post<T>(path: string, body?: unknown) {
      return request<T>("POST", path, { body });
    },

    patch<T>(path: string, body?: unknown) {
      return request<T>("PATCH", path, { body });
    },

    delete<T>(path: string) {
      return request<T>("DELETE", path);
    },

    put<T>(path: string, body?: unknown) {
      return request<T>("PUT", path, { body });
    },
  };
}

// ─── Error Class ───────────────────────────────────────────

export class ApiRequestError extends Error {
  public statusCode: number;
  public errorType: string;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiRequestError";
    this.statusCode = error.statusCode;
    this.errorType = error.error;
  }
}
