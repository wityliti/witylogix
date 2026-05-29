// @ts-nocheck
import { describe, it, expect, afterEach } from "vitest";
import Fastify from "fastify";
import { benchAuth, cidrMatch } from "../middleware/bench-auth.js";

function buildApp(token: string | undefined, cidrs?: string) {
  if (token) process.env.BENCH_SERVICE_TOKEN = token;
  else delete process.env.BENCH_SERVICE_TOKEN;
  if (cidrs) process.env.BENCH_ALLOWED_CIDRS = cidrs;
  else delete process.env.BENCH_ALLOWED_CIDRS;

  const app = Fastify();
  app.get("/x", { preHandler: benchAuth() }, async () => ({ ok: true }));
  return app;
}

afterEach(() => {
  delete process.env.BENCH_SERVICE_TOKEN;
  delete process.env.BENCH_ALLOWED_CIDRS;
});

describe("benchAuth middleware", () => {
  it("returns 503 when BENCH_SERVICE_TOKEN is not configured", async () => {
    const app = buildApp(undefined);
    const r = await app.inject({ method: "GET", url: "/x" });
    expect(r.statusCode).toBe(503);
    expect(r.json().code).toBe("bench_disabled");
  });

  it("returns 401 when bearer token missing", async () => {
    const app = buildApp("secret-token-value");
    const r = await app.inject({
      method: "GET",
      url: "/x",
      remoteAddress: "127.0.0.1",
    });
    expect(r.statusCode).toBe(401);
    expect(r.json().code).toBe("missing_token");
  });

  it("returns 401 when bearer token wrong", async () => {
    const app = buildApp("secret-token-value");
    const r = await app.inject({
      method: "GET",
      url: "/x",
      headers: { authorization: "Bearer nope" },
      remoteAddress: "127.0.0.1",
    });
    expect(r.statusCode).toBe(401);
    expect(r.json().code).toBe("invalid_token");
  });

  it("returns 401 when token is correct prefix but wrong length", async () => {
    const app = buildApp("secret-token-value");
    const r = await app.inject({
      method: "GET",
      url: "/x",
      headers: { authorization: "Bearer secret-token" },
      remoteAddress: "127.0.0.1",
    });
    expect(r.statusCode).toBe(401);
  });

  it("returns 200 when token correct and caller in default CIDR", async () => {
    const app = buildApp("secret-token-value");
    const r = await app.inject({
      method: "GET",
      url: "/x",
      headers: { authorization: "Bearer secret-token-value" },
      remoteAddress: "127.0.0.1",
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ ok: true });
  });

  it("returns 403 when caller IP outside configured CIDR", async () => {
    const app = buildApp("secret-token-value", "10.0.0.0/8");
    const r = await app.inject({
      method: "GET",
      url: "/x",
      headers: { authorization: "Bearer secret-token-value" },
      remoteAddress: "192.168.1.1",
    });
    expect(r.statusCode).toBe(403);
    expect(r.json().code).toBe("forbidden_cidr");
  });

  it("accepts explicit CIDR that matches", async () => {
    const app = buildApp("secret-token-value", "10.0.0.0/8,127.0.0.1/32");
    const r = await app.inject({
      method: "GET",
      url: "/x",
      headers: { authorization: "Bearer secret-token-value" },
      remoteAddress: "10.5.6.7",
    });
    expect(r.statusCode).toBe(200);
  });
});

describe("cidrMatch", () => {
  it("matches /32 host exactly", () => {
    expect(cidrMatch("127.0.0.1", "127.0.0.1/32")).toBe(true);
    expect(cidrMatch("127.0.0.2", "127.0.0.1/32")).toBe(false);
  });

  it("matches /8 and /12 ranges", () => {
    expect(cidrMatch("10.5.6.7", "10.0.0.0/8")).toBe(true);
    expect(cidrMatch("11.5.6.7", "10.0.0.0/8")).toBe(false);
    expect(cidrMatch("172.17.0.5", "172.16.0.0/12")).toBe(true);
    expect(cidrMatch("172.32.0.5", "172.16.0.0/12")).toBe(false);
  });

  it("handles IPv4-mapped IPv6 ::ffff: prefix", () => {
    expect(cidrMatch("::ffff:127.0.0.1", "127.0.0.1/32")).toBe(true);
  });

  it("rejects malformed IPs safely", () => {
    expect(cidrMatch("not-an-ip", "10.0.0.0/8")).toBe(false);
  });
});
