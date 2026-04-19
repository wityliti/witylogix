// @ts-nocheck
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import Fastify from "fastify";

vi.mock("@witylogix/db", () => ({
  prisma: {
    $queryRawUnsafe: vi.fn().mockResolvedValue([{ applied: 42 }]),
  },
}));

async function buildApp() {
  process.env.BENCH_SERVICE_TOKEN = "tok";
  process.env.BENCH_ALLOWED_CIDRS = "127.0.0.1/32";
  const app = Fastify();
  const routesModule = await import("../routes/internal/bench.js");
  const { resetDrainState } = routesModule;
  resetDrainState();
  await app.register(routesModule.default, { prefix: "/internal/bench" });
  return app;
}

afterEach(() => {
  delete process.env.BENCH_SERVICE_TOKEN;
  delete process.env.BENCH_ALLOWED_CIDRS;
  vi.clearAllMocks();
});

const AUTH = { authorization: "Bearer tok" };

describe("GET /internal/bench/health", () => {
  it("returns migration state + drain flag", async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: "GET",
      url: "/internal/bench/health",
      headers: AUTH,
      remoteAddress: "127.0.0.1",
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      prismaMigrations: { applied: 42, pending: 0 },
      drained: false,
      drainMode: null,
    });
    expect(r.json().uptimeSec).toBeGreaterThanOrEqual(0);
  });

  it("returns applied=0 when _prisma_migrations table is missing", async () => {
    const { prisma } = await import("@witylogix/db");
    (prisma.$queryRawUnsafe as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("relation \"_prisma_migrations\" does not exist"),
    );
    const app = await buildApp();
    const r = await app.inject({
      method: "GET",
      url: "/internal/bench/health",
      headers: AUTH,
      remoteAddress: "127.0.0.1",
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().prismaMigrations.applied).toBe(0);
  });

  it("rejects 401 without bearer", async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: "GET",
      url: "/internal/bench/health",
      remoteAddress: "127.0.0.1",
    });
    expect(r.statusCode).toBe(401);
  });
});

describe("POST /internal/bench/drain", () => {
  it("transitions to drained and reflects in /health", async () => {
    const app = await buildApp();
    const d = await app.inject({
      method: "POST",
      url: "/internal/bench/drain",
      headers: { ...AUTH, "content-type": "application/json" },
      remoteAddress: "127.0.0.1",
      payload: { mode: "offline", reason: "migrate" },
    });
    expect(d.statusCode).toBe(200);
    expect(d.json()).toMatchObject({ state: "drained", mode: "offline" });
    expect(d.json().drainedAt).toBeTruthy();

    const h = await app.inject({
      method: "GET",
      url: "/internal/bench/health",
      headers: AUTH,
      remoteAddress: "127.0.0.1",
    });
    expect(h.json().drained).toBe(true);
    expect(h.json().drainMode).toBe("offline");
  });

  it("accepts read-only mode", async () => {
    const app = await buildApp();
    const d = await app.inject({
      method: "POST",
      url: "/internal/bench/drain",
      headers: { ...AUTH, "content-type": "application/json" },
      remoteAddress: "127.0.0.1",
      payload: { mode: "read-only" },
    });
    expect(d.statusCode).toBe(200);
    expect(d.json().mode).toBe("read-only");
  });

  it("returns 400 on invalid mode", async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: "POST",
      url: "/internal/bench/drain",
      headers: { ...AUTH, "content-type": "application/json" },
      remoteAddress: "127.0.0.1",
      payload: { mode: "bogus" },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().code).toBe("invalid_body");
  });

  it("returns 400 on missing mode", async () => {
    const app = await buildApp();
    const r = await app.inject({
      method: "POST",
      url: "/internal/bench/drain",
      headers: { ...AUTH, "content-type": "application/json" },
      remoteAddress: "127.0.0.1",
      payload: {},
    });
    expect(r.statusCode).toBe(400);
  });
});

describe("POST /internal/bench/undrain", () => {
  it("clears drain state", async () => {
    const app = await buildApp();
    await app.inject({
      method: "POST",
      url: "/internal/bench/drain",
      headers: { ...AUTH, "content-type": "application/json" },
      remoteAddress: "127.0.0.1",
      payload: { mode: "offline" },
    });

    const u = await app.inject({
      method: "POST",
      url: "/internal/bench/undrain",
      headers: AUTH,
      remoteAddress: "127.0.0.1",
    });
    expect(u.statusCode).toBe(200);
    expect(u.json().state).toBe("active");

    const h = await app.inject({
      method: "GET",
      url: "/internal/bench/health",
      headers: AUTH,
      remoteAddress: "127.0.0.1",
    });
    expect(h.json().drained).toBe(false);
  });
});
