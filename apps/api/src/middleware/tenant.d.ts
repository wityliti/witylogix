/**
 * Tenant middleware — sets the Prisma RLS context for the current request.
 *
 * This is the bridge between authentication (which identifies the tenant)
 * and data access (which must be scoped to that tenant via RLS).
 *
 * Three modes:
 *   1. Shop-only (no org):  request.tenantDb → forTenant(shopId)
 *   2. Shop-in-org:         request.tenantDb → forTenantInOrg(shopId, orgId)
 *      - Sees shop-specific data AND org-shared drivers/zones
 *   3. Org-wide:            request.orgDb → forOrg(orgId)
 *      - Set via orgContext() middleware for org dashboard routes
 *
 * After this middleware runs:
 *   request.tenantDb    — always available (shop-scoped or dual-scoped)
 *   request.tenantRedis — always available (shop-prefixed cache)
 *   request.shopId      — always available
 *   request.orgId       — set if user belongs to an org
 *   request.orgDb       — only available after orgContext() middleware
 */
import type { FastifyRequest, FastifyReply } from "fastify";
import { forTenant, forOrg } from "@witylogix/db";
import { TenantRedis } from "../lib/redis.js";
declare module "fastify" {
  interface FastifyRequest {
    tenantDb: ReturnType<typeof forTenant>;
    orgDb?: ReturnType<typeof forOrg>;
    tenantRedis: TenantRedis;
    shopId: string;
    orgId?: string;
  }
}
/**
 * Standard tenant context — used by all shop-scoped routes.
 * If the shop belongs to an org, uses dual-scoped client so that
 * org-shared drivers and zones are also visible via RLS.
 *
 * Shopify webhooks, carrier service, orders, routes — all use this.
 */
export declare function tenantContext(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void>;
/**
 * Org-level context — used by org management routes.
 * Provides request.orgDb for cross-shop queries (drivers, zones, members).
 *
 * Must run AFTER requireAuth + tenantContext.
 * Only users with an orgId in their JWT can use this.
 */
export declare function orgContext(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void>;
//# sourceMappingURL=tenant.d.ts.map
