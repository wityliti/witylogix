import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerProvider, type Provider } from "../provider.js";
import { run as runMigrate, APP_SERVICES } from "../ops/migrate.js";
import type { Context } from "../types.js";

let tmp: string;

const stopMock = vi.fn().mockResolvedValue(undefined);
const startMock = vi.fn().mockResolvedValue(undefined);
const runOneShotMock = vi.fn();

const fakeProvider: Provider = {
  id: "fake",
  preflight: async () => ({ ok: true, checks: [] }),
  provision: async () => ({ ok: true, operationsApplied: 0 }),
  deploy: async () => ({ ok: true, version: "0", rolledBack: false }),
  start: startMock,
  stop: stopMock,
  restart: async () => {},
  async *logs() {},
  status: async () => ({ services: [] }),
  backup: async () => {
    throw new Error();
  },
  restore: async () => {
    throw new Error();
  },
  rotateSecret: async () => {},
  destroy: async () => {},
  execInService: vi
    .fn()
    .mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 }),
  runOneShot: runOneShotMock,
};
registerProvider("migrate-test-provider", async () => fakeProvider);

function ctxOf(
  services: Record<string, unknown> = {
    api: {},
    dashboard: {},
    "customer-portal": {},
    "tracking-page": {},
    docs: {},
  },
): Context {
  return {
    cwd: tmp,
    config: {
      metadata: { name: "demo" },
      provider: { type: "migrate-test-provider" as never, config: {} },
      witylogix: { version: "4.0.0", channel: "stable" },
      services,
    } as unknown as Context["config"],
    logger: {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    dryRun: false,
    json: false,
  };
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "bench-migrate-"));
  mkdirSync(join(tmp, ".bench"), { recursive: true });
  writeFileSync(join(tmp, "bench.config.yaml"), "name: demo\n");
  process.env.BENCH_SERVICE_TOKEN = "t";
  process.env.BENCH_API_BASE_URL = "http://api.test";
  stopMock.mockClear();
  startMock.mockClear();
  runOneShotMock.mockReset();
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
  delete process.env.BENCH_SERVICE_TOKEN;
  delete process.env.BENCH_API_BASE_URL;
  vi.unstubAllGlobals();
});

describe("ops/migrate.run — windowed", () => {
  it("happy path: drains, stops N services, migrates, restarts", async () => {
    runOneShotMock.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        // 1. preflight /health
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            prismaMigrations: { applied: 10, pending: 2 },
            drained: false,
          }),
        })
        // 2. POST /drain
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
        // 3. post-migrate poll /health
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            prismaMigrations: { applied: 12, pending: 0 },
            drained: true,
          }),
        }),
    );

    const r = await runMigrate(ctxOf(), { skipBackup: true });
    expect(r.ok).toBe(true);
    expect(r.migrationsApplied).toBe(2);
    expect(stopMock).toHaveBeenCalledTimes(APP_SERVICES.length);
    expect(startMock).toHaveBeenCalledTimes(APP_SERVICES.length);
    expect(runOneShotMock).toHaveBeenCalledWith(expect.anything(), "api", [
      "pnpm",
      "prisma",
      "migrate",
      "deploy",
    ]);
  });

  it("short-circuits when no pending migrations and --force not set", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          prismaMigrations: { applied: 10, pending: 0 },
          drained: false,
        }),
      }),
    );
    const r = await runMigrate(ctxOf(), { skipBackup: true });
    expect(r.migrationsApplied).toBe(0);
    expect(stopMock).not.toHaveBeenCalled();
    expect(runOneShotMock).not.toHaveBeenCalled();
  });

  it("throws with rollback guidance when migration exits non-zero", async () => {
    runOneShotMock.mockResolvedValueOnce({
      stdout: "",
      stderr: "P3009: migration failed",
      exitCode: 1,
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            prismaMigrations: { applied: 10, pending: 1 },
            drained: false,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        }),
    );

    await expect(runMigrate(ctxOf(), { skipBackup: true })).rejects.toThrow(
      /Rollback options/,
    );
    // stopped but NOT restarted when migration fails
    expect(stopMock).toHaveBeenCalledTimes(APP_SERVICES.length);
    expect(startMock).not.toHaveBeenCalled();
  });

  it("emits bench.migrate.completed audit event on success", async () => {
    runOneShotMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            prismaMigrations: { applied: 5, pending: 1 },
            drained: false,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            prismaMigrations: { applied: 6, pending: 0 },
            drained: true,
          }),
        }),
    );

    await runMigrate(ctxOf(), { skipBackup: true });

    const { readFileSync } = await import("node:fs");
    const auditLog = readFileSync(join(tmp, "bench.audit.log"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const completed = auditLog.find(
      (e) => e.event === "bench.migrate.completed",
    );
    expect(completed).toBeDefined();
    expect(completed.data).toMatchObject({
      before: 5,
      after: 6,
      migrationsApplied: 1,
    });
  });

  it("only stops services declared in config (handles disabled docs)", async () => {
    runOneShotMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            prismaMigrations: { applied: 0, pending: 1 },
            drained: false,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            prismaMigrations: { applied: 1, pending: 0 },
            drained: true,
          }),
        }),
    );

    // Only api + dashboard declared — docs/customer-portal/tracking-page absent
    await runMigrate(ctxOf({ api: {}, dashboard: {} }), { skipBackup: true });
    expect(stopMock).toHaveBeenCalledTimes(2);
    const stoppedServices = stopMock.mock.calls.map((c) => c[1]);
    expect(stoppedServices).toEqual(["api", "dashboard"]);
  });

  it("returns degraded=true when post-migrate /health never recovers", async () => {
    runOneShotMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        // Preflight succeeds, drain succeeds, post-check (all attempts) fail
        const isPreflight = stopMock.mock.calls.length === 0;
        const isDrain = url.endsWith("/drain");
        if (isPreflight) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              prismaMigrations: { applied: 10, pending: 1 },
              drained: false,
            }),
          });
        }
        if (isDrain) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({}),
          });
        }
        // post-check /health always fails
        return Promise.reject(new Error("ECONNREFUSED"));
      }),
    );

    // Speed up the 15 × 2s polling loop by stubbing setTimeout to immediate
    const origSetTimeout = globalThis.setTimeout;
    vi.stubGlobal("setTimeout", (cb: (...args: unknown[]) => unknown) =>
      origSetTimeout(cb, 0),
    );

    const r = await runMigrate(ctxOf(), { skipBackup: true });
    expect(r.ok).toBe(true);
    expect(r.degraded).toBe(true);
  }, 15000);

  it("runs migration when pending=0 but --force is set", async () => {
    runOneShotMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            prismaMigrations: { applied: 10, pending: 0 },
            drained: false,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            prismaMigrations: { applied: 10, pending: 0 },
            drained: true,
          }),
        }),
    );
    const r = await runMigrate(ctxOf(), { skipBackup: true, force: true });
    expect(r.ok).toBe(true);
    expect(runOneShotMock).toHaveBeenCalled();
  });

  it("emits bench.migrate.failed audit event on migration failure", async () => {
    runOneShotMock.mockResolvedValueOnce({
      stdout: "",
      stderr: "boom",
      exitCode: 2,
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            prismaMigrations: { applied: 1, pending: 1 },
            drained: false,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({}),
        }),
    );
    await expect(runMigrate(ctxOf(), { skipBackup: true })).rejects.toThrow();

    const { readFileSync } = await import("node:fs");
    const auditLog = readFileSync(join(tmp, "bench.audit.log"), "utf8");
    expect(auditLog).toContain("bench.migrate.failed");
  });
});
