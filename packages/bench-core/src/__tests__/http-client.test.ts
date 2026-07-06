import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { benchApi, BenchApiRequestError } from "../http-client.js";
import type { Context } from "../types.js";

let tmp: string;
const makeCtx = (): Context => ({
  cwd: tmp,
  config: {} as Context["config"],
  logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  dryRun: false,
  json: false,
});

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "bench-http-"));
  mkdirSync(join(tmp, "secrets"), { recursive: true });
  writeFileSync(join(tmp, "secrets", "bench-service-token"), "file-token\n");
  process.env.BENCH_API_BASE_URL = "http://api.test";
  delete process.env.BENCH_SERVICE_TOKEN;
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
  delete process.env.BENCH_API_BASE_URL;
  delete process.env.BENCH_SERVICE_TOKEN;
  vi.restoreAllMocks();
});

describe("benchApi", () => {
  it("sends Bearer token from file and parses JSON on 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ apiVersion: "1.0.0" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await benchApi<{ apiVersion: string }>(
      makeCtx(),
      "GET",
      "/internal/bench/health",
    );
    expect(r.apiVersion).toBe("1.0.0");

    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("http://api.test/internal/bench/health");
    expect(call[1].headers.Authorization).toBe("Bearer file-token");
    expect(call[1].headers["X-Bench-Initiator"]).toBe("cli");
  });

  it("prefers BENCH_SERVICE_TOKEN env over file", async () => {
    process.env.BENCH_SERVICE_TOKEN = "env-token";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await benchApi(makeCtx(), "GET", "/x");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer env-token",
    );
  });

  it("throws BenchApiRequestError on 4xx with code+message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        statusText: "Conflict",
        json: async () => ({ code: "slug_taken", message: "slug in use" }),
      }),
    );
    try {
      await benchApi(makeCtx(), "POST", "/internal/bench/tenants", {
        slug: "a",
      });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(BenchApiRequestError);
      expect((err as BenchApiRequestError).data.status).toBe(409);
      expect((err as BenchApiRequestError).data.code).toBe("slug_taken");
    }
  });

  it("throws when token missing both in env and file", async () => {
    delete process.env.BENCH_SERVICE_TOKEN;
    rmSync(join(tmp, "secrets", "bench-service-token"));
    await expect(benchApi(makeCtx(), "GET", "/health")).rejects.toThrow(
      /BENCH_SERVICE_TOKEN not found/,
    );
  });

  it("sends JSON body on POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: "t-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await benchApi(makeCtx(), "POST", "/internal/bench/tenants", {
      slug: "acme",
    });
    expect(fetchMock.mock.calls[0][1].body).toBe(
      JSON.stringify({ slug: "acme" }),
    );
  });

  it("returns undefined on 204 No Content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 204 }),
    );
    const r = await benchApi(makeCtx(), "DELETE", "/internal/bench/x");
    expect(r).toBeUndefined();
  });
});
