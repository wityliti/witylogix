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
  if (typeof document === 'undefined') return null;

  const token = document.cookie
    .split('; ')
    .find(c => c.startsWith('auth-token='))
    ?.split('=')[1];

  return token || null;
}

/**
 * Handle 401 responses by redirecting to login
 */
function handleUnauthorized(): void {
  if (typeof window !== 'undefined') {
    // Clear auth state
    localStorage.removeItem('authUser');
    document.cookie = 'auth-token=; path=/; max-age=0; samesite=lax; secure';

    // Redirect to login with return URL
    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Attach JWT token from httpOnly cookie
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies in request
  });

  if (res.status === 401) {
    // Token is invalid or expired
    handleUnauthorized();
    throw new ApiError(401, 'Unauthorized. Please log in again.');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, `API ${res.status}: ${res.statusText}`, body);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string, options?: RequestInit) => request<T>(path, options),
  post: <T>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined, ...options }),
  patch: <T>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined, ...options }),
  delete: <T>(path: string, options?: RequestInit) => request<T>(path, { method: "DELETE", ...options }),
};
