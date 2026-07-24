/**
 * Customer Portal API client — typed fetch wrapper around the Fastify backend.
 * Mirrors the pattern in apps/dashboard/src/lib/api.ts.
 *
 * Base URL comes from NEXT_PUBLIC_API_URL (set in .env / Railway).
 * The Next.js rewrite in next.config.mjs proxies /api/* → API_URL/api/* for SSR,
 * but client-side calls go direct via NEXT_PUBLIC_API_URL.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

// ─── Response envelope types ─────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Error class ─────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Token helpers ───────────────────────────────────────────

function getAuthToken(): string | null {
  if (typeof document === "undefined") return null;
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("portal-auth-token="))
      ?.split("=")[1] ?? null
  );
}

export function setAuthToken(
  token: string,
  maxAgeSeconds = 60 * 60 * 24 * 7,
): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `portal-auth-token=${token}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

export function clearAuthToken(): void {
  if (typeof document === "undefined") return;
  document.cookie = "portal-auth-token=; path=/; max-age=0; SameSite=Lax";
}

// ─── Core fetch wrapper ──────────────────────────────────────

let onUnauthorized: (() => void) | null = null;

/** Register a callback that fires when the API returns 401 */
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = !options.signal ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), 30_000)
    : null;

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
    signal: options.signal ?? controller?.signal,
  });

  if (timeoutId) clearTimeout(timeoutId);

  if (res.status === 401) {
    onUnauthorized?.();
    throw new ApiError(401, "Session expired. Please log in again.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      (body as { message?: string } | null)?.message ??
      `API ${res.status}: ${res.statusText}`;
    throw new ApiError(res.status, message, body);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ─── Public API surface ──────────────────────────────────────

export const api = {
  get: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { method: "GET", ...options }),
  post: <T>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),
  patch: <T>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),
  put: <T>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),
  delete: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { method: "DELETE", ...options }),
};
