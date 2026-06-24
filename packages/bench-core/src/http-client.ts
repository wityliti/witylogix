/**
 * Thin typed fetch wrapper for the `/internal/bench/*` admin API.
 *
 * Resolution order for the token:
 *  1. `process.env.BENCH_SERVICE_TOKEN` (lets CI/overrides skip file I/O)
 *  2. `<cwd>/secrets/bench-service-token` (file written by `bench init`)
 *
 * Base URL:
 *  1. `process.env.BENCH_API_BASE_URL` (set by cycle scripts, tests)
 *  2. `http://localhost:8000` (default when `api` is reachable locally)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Context } from "./types.js";

export interface BenchApiError {
  status: number;
  code: string;
  message: string;
  fields?: Record<string, string[]>;
}

export class BenchApiRequestError extends Error {
  constructor(public readonly data: BenchApiError) {
    super(`${data.status} ${data.code}: ${data.message}`);
    this.name = "BenchApiRequestError";
  }
}

function serviceBaseUrl(): string {
  const fromEnv = process.env.BENCH_API_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost:8000";
}

function readToken(ctx: Context): string {
  const fromEnv = process.env.BENCH_SERVICE_TOKEN;
  if (fromEnv) return fromEnv.trim();
  const path = resolve(ctx.cwd, "secrets", "bench-service-token");
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    throw new Error(
      `BENCH_SERVICE_TOKEN not found. Checked env var and ${path}. Run \`bench init\` or set BENCH_SERVICE_TOKEN env.`,
    );
  }
}

export async function benchApi<T>(
  ctx: Context,
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const token = readToken(ctx);
  const res = await fetch(`${serviceBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Bench-Initiator": "cli",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as Partial<BenchApiError>;
    throw new BenchApiRequestError({
      status: res.status,
      code: data.code ?? "unknown",
      message: data.message ?? res.statusText,
      fields: data.fields,
    });
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
