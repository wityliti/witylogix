/**
 * Dashboard API client — talks to the Fastify backend via /api proxy.
 * In production, configure NEXT_PUBLIC_API_URL for direct calls.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
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

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Get JWT token from cookie
 */
function getAuthToken(): string | null {
  if (typeof document === "undefined") return null;

  const token = document.cookie
    .split("; ")
    .find((c) => c.startsWith("auth-token="))
    ?.split("=")[1];

  return token || null;
}

/**
 * Handle 401 responses — throw error but don't aggressively clear auth state.
 * The auth-context manages token lifecycle; the API client just reports the error.
 */
function handleUnauthorized(): void {
  // Don't clear cookies or redirect here — let the auth context handle it.
  // Aggressive clearing causes cascading auth failures across concurrent requests.
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Attach JWT token from httpOnly cookie
  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Add timeout if no signal provided
  const controller = !options.signal ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), 30000)
    : null;

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
    signal: options.signal ?? controller?.signal,
  });

  if (timeoutId) clearTimeout(timeoutId);

  if (res.status === 401) {
    // Token is invalid or expired
    handleUnauthorized();
    throw new ApiError(401, "Unauthorized. Please log in again.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      `API ${res.status}: ${res.statusText}`,
      body,
    );
  }

  return res.json();
}

async function requestBlob(
  path: string,
  options: RequestInit = {},
): Promise<Blob> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers, credentials: "include" });
  if (res.status === 401) {
    handleUnauthorized();
    throw new ApiError(401, "Unauthorized. Please log in again.");
  }
  if (!res.ok)
    throw new ApiError(res.status, `API ${res.status}: ${res.statusText}`);
  return res.blob();
}

export const api = {
  get: <T>(path: string, options?: RequestInit) => request<T>(path, options),
  post: <T>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),
  put: <T>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),
  patch: <T>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),
  delete: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { method: "DELETE", ...options }),
  download: (path: string, options?: RequestInit) => requestBlob(path, options),
};
