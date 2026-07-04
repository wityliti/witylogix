/**
 * Typed fetch wrapper for the /internal/bench/* admin API.
 *
 * All calls run from the server (Next.js Route Handlers / RSC). Tokens are
 * read from env in the server process only — never shipped to the client.
 */

export interface HealthResponse {
  apiVersion: string;
  witylogixVersion: string;
  prismaMigrations: { applied: number; pending: number };
  drained: boolean;
  drainMode: "read-only" | "offline" | null;
  uptimeSec: number;
}

export interface CreateTenantInput {
  slug: string;
  ownerEmail: string;
  ownerName: string;
  plan?: "starter" | "pro" | "enterprise";
}

export interface CreateTenantResult {
  tenantId: string;
  orgId: string;
  subdomain: string;
  ownerEmail: string;
}

export class BenchApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BenchApiError";
  }
}

function baseUrl(): string {
  return (process.env.BENCH_API_BASE_URL ?? "http://localhost:8000").replace(
    /\/$/,
    "",
  );
}

function token(): string {
  const t = process.env.BENCH_SERVICE_TOKEN;
  if (!t) {
    throw new Error(
      "BENCH_SERVICE_TOKEN not set — the bench-web app cannot reach the admin API.",
    );
  }
  return t;
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      "X-Bench-Initiator": "cloud",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
    };
    throw new BenchApiError(
      res.status,
      data.code ?? "unknown",
      data.message ?? res.statusText,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const benchApi = {
  health: () => request<HealthResponse>("GET", "/internal/bench/health"),
  drain: (mode: "read-only" | "offline", reason?: string) =>
    request<{ state: string; mode: string; drainedAt: string }>(
      "POST",
      "/internal/bench/drain",
      { mode, reason },
    ),
  undrain: () => request<{ state: string }>("POST", "/internal/bench/undrain"),
  createTenant: (input: CreateTenantInput) =>
    request<CreateTenantResult>("POST", "/internal/bench/tenants", input),
};
