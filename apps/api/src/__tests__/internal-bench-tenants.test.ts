// @ts-nocheck
import { describe, it, expect, afterEach, vi } from "vitest";
import Fastify from "fastify";

vi.mock("@witylogix/db", () => ({
  prisma: {
    $queryRawUnsafe: vi.fn().mockResolvedValue([{ applied: 0 }]),
  },
}));

const createTenantMock = vi.fn();
class TenantAlreadyExistsError extends Error {
  constructor(public readonly field: "slug" | "email") {
    super(`tenant ${field} already in use`);
    this.name = "TenantAlreadyExistsError";
  }
}
vi.mock("@witylogix/core/onboarding", () => ({
  tenantProvisioner: { createTenant: createTenantMock },
  TenantAlreadyExistsError,
}));

async function buildApp() {
  process.env.BENCH_SERVICE_TOKEN = "tok";
  process.env.BENCH_ALLOWED_CIDRS = "127.0.0.1/32";
  const app = Fastify();
  const routesModule = await import("../routes/internal/bench.js");
  await app.register(routesModule.default, { prefix: "/internal/bench" });
  return app;
}

afterEach(() => {
  delete process.env.BENCH_SERVICE_TOKEN;
  delete process.env.BENCH_ALLOWED_CIDRS;
  createTenantMock.mockReset();
});

const AUTH = {
  authorization: "Bearer tok",
  "content-type": "application/json",
};

async function postTenant(app: any, body: unknown) {
  return app.inject({
    method: "POST",
    url: "/internal/bench/tenants",
    headers: AUTH,
    remoteAddress: "127.0.0.1",
    payload: body,
  });
}

describe("POST /internal/bench/tenants", () => {
  it("returns 201 on happy path", async () => {
    createTenantMock.mockResolvedValueOnce({
      tenantId: "tc-1",
      orgId: "org-1",
      subdomain: "acme",
      ownerEmail: "ops@acme.co",
    });
    const app = await buildApp();
    const r = await postTenant(app, {
      slug: "acme",
      ownerEmail: "ops@acme.co",
      ownerName: "Ada",
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().subdomain).toBe("acme");
    expect(createTenantMock).toHaveBeenCalledWith({
      slug: "acme",
      ownerEmail: "ops@acme.co",
      ownerName: "Ada",
    });
  });

  it("returns 409 when slug taken", async () => {
    createTenantMock.mockRejectedValueOnce(
      new TenantAlreadyExistsError("slug"),
    );
    const app = await buildApp();
    const r = await postTenant(app, {
      slug: "acme",
      ownerEmail: "a@b.co",
      ownerName: "A",
    });
    expect(r.statusCode).toBe(409);
    expect(r.json().code).toBe("slug_taken");
  });

  it("returns 400 on invalid slug format", async () => {
    const app = await buildApp();
    const r = await postTenant(app, {
      slug: "Not-Valid",
      ownerEmail: "a@b.co",
      ownerName: "A",
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().message).toContain("slug");
  });

  it("returns 400 on malformed email", async () => {
    const app = await buildApp();
    const r = await postTenant(app, {
      slug: "acme",
      ownerEmail: "not-an-email",
      ownerName: "A",
    });
    expect(r.statusCode).toBe(400);
  });

  it("returns 400 when required field missing", async () => {
    const app = await buildApp();
    const r = await postTenant(app, { slug: "acme" });
    expect(r.statusCode).toBe(400);
  });

  it("passes plan + features + limits through to provisioner", async () => {
    createTenantMock.mockResolvedValueOnce({
      tenantId: "t",
      orgId: "o",
      subdomain: "acme",
      ownerEmail: "a@b.co",
    });
    const app = await buildApp();
    await postTenant(app, {
      slug: "acme",
      ownerEmail: "a@b.co",
      ownerName: "A",
      plan: "pro",
      features: { branding: true },
      limits: { orders_per_day: 1000 },
    });
    expect(createTenantMock.mock.calls[0][0]).toMatchObject({
      plan: "pro",
      features: { branding: true },
      limits: { orders_per_day: 1000 },
    });
  });
});
