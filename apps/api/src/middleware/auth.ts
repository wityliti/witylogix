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
import jwt from "@fastify/jwt";
import { prisma } from "@witylogix/db";
import { UnauthorizedError, ForbiddenError } from "../lib/errors.js";
import { getConfig } from "../lib/config.js";

// ─── Types ──────────────────────────────────────────────────

export interface AuthContext {
  shopId: string;
  orgId?: string;       // Set when user belongs to an org
  userId?: string;
  driverId?: string;
  role: "SUPER_ADMIN" | "ADMIN" | "DISPATCHER" | "VIEWER" | "DRIVER";
  orgRole?: "OWNER" | "ADMIN" | "MEMBER"; // Org-level role (if in org context)
  shopDomain?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
  }
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

  try {
    // Verify JWT signature using env var JWT_SECRET
    const payload = await request.jwtVerify<{
      sub: string;
      shopId: string;
      orgId?: string;
      role: string;
      orgRole?: string;
      type: "user" | "driver";
      shopDomain?: string;
    }>();

    // Attach auth context to request for downstream middleware/routes
    request.auth = {
      shopId: payload.shopId,
      orgId: payload.orgId,
      userId: payload.type === "user" ? payload.sub : undefined,
      driverId: payload.type === "driver" ? payload.sub : undefined,
      role: payload.role as AuthContext["role"],
      orgRole: payload.orgRole as AuthContext["orgRole"],
      shopDomain: payload.shopDomain,
    };
  } catch (err) {
    // Return 401 for any token verification failure (expired, invalid signature, etc.)
    throw new UnauthorizedError("Invalid or expired token");
  }
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

export function requireOrgRole(...allowedOrgRoles: NonNullable<AuthContext["orgRole"]>[]) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.auth?.orgId) {
      throw new ForbiddenError("Organization context required");
    }

    if (!request.auth.orgRole || !allowedOrgRoles.includes(request.auth.orgRole)) {
      throw new ForbiddenError(
        `Org role '${request.auth.orgRole || "none"}' does not have access. Required: ${allowedOrgRoles.join(", ")}`,
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
    throw new UnauthorizedError("Missing shop parameter in carrier service request");
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
