/**
 * Authentication middleware — four auth flows converge here:
 *
 * 1. Shopify Embedded App: Session token from App Bridge (Bearer token)
 * 2. Dashboard User: JWT from email/password login
 * 3. Driver App: JWT from phone/password login
 * 4. Org Dashboard: JWT with orgId for cross-shop access
 *
 * All flows extract shop_id (and optionally org_id) to set the RLS context.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@witylogix/db";
import { UnauthorizedError, ForbiddenError } from "../lib/errors.js";
import { getConfig } from "../lib/config.js";
import { getRedis, IMPERSONATION_SESSION_PREFIX } from "../lib/redis.js";
import type { AuthContext } from "../types/fastify.js";

// Export AuthContext for external use
export type { AuthContext };

function base64UrlToBuffer(segment: string): Buffer {
  const pad =
    segment.length % 4 === 0 ? "" : "=".repeat(4 - (segment.length % 4));
  return Buffer.from(
    segment.replace(/-/g, "+").replace(/_/g, "/") + pad,
    "base64",
  );
}

/**
 * Shopify embedded admin sends an App Bridge session token (JWT, HS256, secret = SHOPIFY_API_SECRET).
 * The Shopify app forwards it as Bearer when calling this API. Dashboard/driver JWTs use JWT_SECRET instead.
 */
async function tryAuthFromShopifySessionToken(
  token: string,
): Promise<AuthContext | null> {
  const config = getConfig();
  if (!config.SHOPIFY_API_SECRET || config.SHOPIFY_API_SECRET.length < 8) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [headerB64, payloadB64, sigB64] = parts;
  let header: { alg?: string };
  try {
    header = JSON.parse(base64UrlToBuffer(headerB64).toString("utf8")) as {
      alg?: string;
    };
  } catch {
    return null;
  }
  if (header.alg !== "HS256") {
    return null;
  }

  const expectedSig = createHmac("sha256", config.SHOPIFY_API_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  let sigBuf: Buffer;
  try {
    sigBuf = base64UrlToBuffer(sigB64);
  } catch {
    return null;
  }
  if (
    sigBuf.length !== expectedSig.length ||
    !timingSafeEqual(sigBuf, expectedSig)
  ) {
    return null;
  }

  let payload: {
    dest?: string;
    aud?: string;
    exp?: number;
    nbf?: number;
    sub?: string;
  };
  try {
    payload = JSON.parse(
      base64UrlToBuffer(payloadB64).toString("utf8"),
    ) as typeof payload;
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now - 10) {
    return null;
  }
  if (typeof payload.nbf === "number" && payload.nbf > now + 10) {
    return null;
  }

  if (
    config.SHOPIFY_API_KEY &&
    payload.aud &&
    payload.aud !== config.SHOPIFY_API_KEY
  ) {
    return null;
  }

  const dest = payload.dest;
  if (!dest || typeof dest !== "string") {
    return null;
  }

  let shopDomain: string;
  try {
    shopDomain = new URL(dest).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (!shopDomain.endsWith(".myshopify.com")) {
    return null;
  }

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: shopDomain },
    select: { id: true, orgId: true, isActive: true },
  });

  if (!shop || !shop.isActive) {
    return null;
  }

  return {
    shopId: shop.id,
    orgId: shop.orgId || undefined,
    userId: typeof payload.sub === "string" ? payload.sub : undefined,
    role: "SUPER_ADMIN",
    shopDomain,
  };
}

// ─── JWT Auth (Dashboard + Driver) ──────────────────────────

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Extract Bearer token from Authorization header
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid Authorization header");
  }

  const token = authHeader.slice(7);

  type JwtPayload = {
    sub: string;
    shopId: string;
    orgId?: string;
    role: string;
    orgRole?: string;
    type: "user" | "driver";
    shopDomain?: string;
    impersonatedBy?: string;
    jti?: string;
  };
  let jwtPayload: JwtPayload | null = null;

  try {
    // Verify JWT signature using env var JWT_SECRET
    jwtPayload = await request.jwtVerify<JwtPayload>();
  } catch {
    // Not a Witylogix JWT — try Shopify embedded session token
  }

  if (jwtPayload) {
    // If this is an impersonation token, verify the session hasn't been revoked
    if (jwtPayload.impersonatedBy && jwtPayload.jti) {
      const redis = getRedis();
      const sessionExists = await redis.exists(
        `${IMPERSONATION_SESSION_PREFIX}${jwtPayload.jti}`,
      );
      if (!sessionExists) {
        throw new UnauthorizedError(
          "Impersonation session has been revoked or expired",
        );
      }
    }

    // Attach auth context to request for downstream middleware/routes
    request.auth = {
      shopId: jwtPayload.shopId,
      orgId: jwtPayload.orgId,
      userId: jwtPayload.type === "user" ? jwtPayload.sub : undefined,
      driverId: jwtPayload.type === "driver" ? jwtPayload.sub : undefined,
      role: jwtPayload.role as AuthContext["role"],
      orgRole: jwtPayload.orgRole as AuthContext["orgRole"],
      shopDomain: jwtPayload.shopDomain,
    };
    return;
  }

  const shopifyAuth = await tryAuthFromShopifySessionToken(token);
  if (shopifyAuth) {
    request.auth = shopifyAuth;
    return;
  }

  throw new UnauthorizedError("Invalid or expired token");
}

// ─── Role-Based Access ──────────────────────────────────────

export function requireRole(...allowedRoles: AuthContext["role"][]) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.auth) {
      throw new UnauthorizedError("Authentication required");
    }

    if (!allowedRoles.includes(request.auth.role)) {
      throw new ForbiddenError(
        `Role '${request.auth.role}' does not have access. Required: ${allowedRoles.join(", ")}`,
      );
    }
  };
}

// ─── Org Role Check ─────────────────────────────────────────

export function requireOrgRole(
  ...allowedOrgRoles: NonNullable<AuthContext["orgRole"]>[]
) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.auth?.orgId) {
      throw new ForbiddenError("Organization context required");
    }

    if (
      !request.auth.orgRole ||
      !allowedOrgRoles.includes(request.auth.orgRole)
    ) {
      throw new ForbiddenError(
        `Org role '${request.auth.orgRole || "none"}' does not have access. Required: ${allowedOrgRoles.join(", ")}`,
      );
    }
  };
}

// ─── Scope-Based Access (ADR-010 claims-based auth) ─────────
// Used by routes that can be reached either by a first-party user/session or by
// a third-party OAuth app installation access token. First-party auth carries no
// `scopes` (full access, gated by role); OAuth tokens must hold every required
// scope. Supports hierarchical scopes via a trailing wildcard, e.g. a token with
// `orders` (or `orders:*`) satisfies a required `orders:read`.
export function requireScopes(...requiredScopes: string[]) {
  return async function (
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    if (!request.auth) {
      throw new UnauthorizedError("Authentication required");
    }

    // First-party user/session auth has no scope restriction.
    const granted = request.auth.scopes;
    if (!granted) {
      return;
    }

    const grantedSet = new Set(granted);
    const isGranted = (required: string): boolean => {
      if (grantedSet.has(required) || grantedSet.has("*")) {
        return true;
      }
      // Hierarchical match: `orders` or `orders:*` covers `orders:read`.
      const [resource] = required.split(":");
      return grantedSet.has(resource) || grantedSet.has(`${resource}:*`);
    };

    const missing = requiredScopes.filter((scope) => !isGranted(scope));
    if (missing.length > 0) {
      throw new ForbiddenError(
        `Missing required scope(s): ${missing.join(", ")}`,
      );
    }
  };
}

// ─── Shopify Webhook HMAC Verification ──────────────────────
// NOTE: This flow is completely unchanged by the org layer.
// Shopify webhooks always identify a single shop via domain.

export async function verifyShopifyWebhook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const config = getConfig();
  const hmacHeader = request.headers["x-shopify-hmac-sha256"] as string;

  if (!hmacHeader) {
    throw new UnauthorizedError("Missing X-Shopify-Hmac-SHA256 header");
  }

  const rawBody = (request as any).rawBody;
  if (!rawBody) {
    throw new UnauthorizedError("Raw body not available for HMAC verification");
  }

  const computedHmac = createHmac("sha256", config.SHOPIFY_API_SECRET)
    .update(rawBody)
    .digest("base64");

  const isValid = timingSafeEqual(
    Buffer.from(hmacHeader, "base64"),
    Buffer.from(computedHmac, "base64"),
  );

  if (!isValid) {
    throw new UnauthorizedError("Invalid Shopify webhook HMAC signature");
  }

  // Extract shop domain from webhook headers
  const shopDomain = request.headers["x-shopify-shop-domain"] as string;
  if (!shopDomain) {
    throw new UnauthorizedError("Missing X-Shopify-Shop-Domain header");
  }

  // Look up shop by domain (include orgId for context)
  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: shopDomain },
    select: { id: true, orgId: true, isActive: true },
  });

  if (!shop || !shop.isActive) {
    throw new UnauthorizedError(`Shop not found or inactive: ${shopDomain}`);
  }

  // Set auth context for webhook processing
  // orgId is included so that shared drivers/zones are visible
  request.auth = {
    shopId: shop.id,
    orgId: shop.orgId || undefined,
    role: "SUPER_ADMIN", // Webhooks have full access to the tenant
    shopDomain,
  };
}

// ─── Shopify Carrier Service Verification ───────────────────

export async function verifyCarrierRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const config = getConfig();
  const hmacHeader = request.headers["x-shopify-hmac-sha256"] as string;

  if (hmacHeader) {
    await verifyShopifyWebhook(request, reply);
    return;
  }

  const body = request.body as any;
  if (!body?.rate?.origin) {
    throw new UnauthorizedError("Invalid carrier service request format");
  }

  const shopDomain = (request.query as any)?.shop;
  if (!shopDomain) {
    throw new UnauthorizedError(
      "Missing shop parameter in carrier service request",
    );
  }

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: shopDomain },
    select: { id: true, orgId: true, isActive: true },
  });

  if (!shop || !shop.isActive) {
    throw new UnauthorizedError(`Shop not found: ${shopDomain}`);
  }

  request.auth = {
    shopId: shop.id,
    orgId: shop.orgId || undefined,
    role: "SUPER_ADMIN",
    shopDomain,
  };
}
