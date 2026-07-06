/**
 * Bench Admin API auth — gates `/internal/bench/*` routes.
 *
 * Layers of defense, in order:
 *  1. Route group only registers if `BENCH_SERVICE_TOKEN` env is present.
 *  2. Caller IP must be in `BENCH_ALLOWED_CIDRS` (default: loopback + Docker
 *     bridge + RFC1918 private ranges).
 *  3. `Authorization: Bearer <token>` with constant-time comparison.
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";

const DEFAULT_CIDRS = [
  "127.0.0.1/32",
  "::1/128",
  "172.16.0.0/12",
  "10.0.0.0/8",
];

function ipv4ToInt(ip: string): number {
  // strip leading IPv4-mapped-IPv6 prefix if present (e.g. "::ffff:127.0.0.1")
  const clean = ip.replace(/^::ffff:/, "");
  const parts = clean.split(".").map((o) => Number(o));
  if (
    parts.length !== 4 ||
    parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)
  ) {
    return NaN;
  }
  return (
    ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  );
}

export function cidrMatch(ip: string, cidr: string): boolean {
  // IPv6 — require exact host match (minimal v1 implementation)
  if (cidr.includes(":") || (ip.includes(":") && !ip.startsWith("::ffff:"))) {
    return ip === cidr.split("/")[0];
  }
  const [net, bitsStr] = cidr.split("/");
  const bits = Number.parseInt(bitsStr ?? "32", 10);
  const ipN = ipv4ToInt(ip);
  const netN = ipv4ToInt(net);
  if (Number.isNaN(ipN) || Number.isNaN(netN)) return false;
  if (bits === 0) return true;
  const mask = (~0 << (32 - bits)) >>> 0;
  return (ipN & mask) === (netN & mask);
}

function allowedCidrs(): string[] {
  const env = process.env.BENCH_ALLOWED_CIDRS;
  return env
    ? env
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_CIDRS;
}

export function benchAuth() {
  return async function benchAuthPreHandler(
    req: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const configured = process.env.BENCH_SERVICE_TOKEN;
    if (!configured) {
      reply
        .code(503)
        .send({
          code: "bench_disabled",
          message: "bench admin API not enabled",
        });
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || "";
    if (!allowedCidrs().some((c) => cidrMatch(ip, c))) {
      reply
        .code(403)
        .send({ code: "forbidden_cidr", message: "caller IP not allowed" });
      return;
    }

    const auth = req.headers["authorization"] ?? "";
    const match = /^Bearer (.+)$/.exec(Array.isArray(auth) ? auth[0] : auth);
    if (!match) {
      reply
        .code(401)
        .send({ code: "missing_token", message: "bearer token required" });
      return;
    }
    const presented = Buffer.from(match[1]);
    const expected = Buffer.from(configured);
    if (
      presented.length !== expected.length ||
      !timingSafeEqual(presented, expected)
    ) {
      reply
        .code(401)
        .send({ code: "invalid_token", message: "invalid bearer token" });
      return;
    }

    // Stamp the actor onto the request for downstream audit logging.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).benchActor = "cli";
  };
}
