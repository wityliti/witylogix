/**
 * @witylogix/db — Prisma client with tenant-aware RLS extension
 *
 * Usage:
 *   import { prisma, forTenant, forOrg, forTenantInOrg } from "@witylogix/db";
 *
 *   // Global queries (admin/system operations — bypasses RLS)
 *   const shops = await prisma.shop.findMany();
 *
 *   // Shop-scoped queries (RLS enforced via app.current_shop_id)
 *   const tenantDb = forTenant(shopId);
 *   const orders = await tenantDb.order.findMany();
 *
 *   // Org-scoped queries (RLS enforced via app.current_org_id)
 *   const orgDb = forOrg(orgId);
 *   const drivers = await orgDb.driver.findMany(); // all drivers across org
 *
 *   // Dual-scoped: shop + org (for assigning org drivers to shop orders)
 *   const dualDb = forTenantInOrg(shopId, orgId);
 */
import { PrismaClient } from "./generated/prisma";
export declare const prisma: PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
/**
 * Shop-scoped Prisma client — sets `app.current_shop_id`.
 * Used by Shopify webhooks, carrier service, and all per-shop operations.
 */
export declare function forTenant(shopId: string): import("@prisma/client/runtime/library").DynamicClientExtensionThis<import("@prisma/client").Prisma.TypeMap<import("@prisma/client/runtime/library").InternalArgs & {
    result: {};
    model: {};
    query: {};
    client: {};
}, {}>, import("@prisma/client").Prisma.TypeMapCb<import("@prisma/client").Prisma.PrismaClientOptions>, {
    result: {};
    model: {};
    query: {};
    client: {};
}>;
/**
 * Org-scoped Prisma client — sets `app.current_org_id`.
 * Used for cross-shop queries: org drivers, org zones, org members.
 * Shop-specific tables (orders, routes) are NOT accessible here.
 */
export declare function forOrg(orgId: string): import("@prisma/client/runtime/library").DynamicClientExtensionThis<import("@prisma/client").Prisma.TypeMap<import("@prisma/client/runtime/library").InternalArgs & {
    result: {};
    model: {};
    query: {};
    client: {};
}, {}>, import("@prisma/client").Prisma.TypeMapCb<import("@prisma/client").Prisma.PrismaClientOptions>, {
    result: {};
    model: {};
    query: {};
    client: {};
}>;
/**
 * Dual-scoped Prisma client — sets BOTH shop_id and org_id.
 * Used when a user needs shop data AND org-shared resources in one query
 * (e.g., assigning an org-level driver to a shop-specific order).
 */
export declare function forTenantInOrg(shopId: string, orgId: string): import("@prisma/client/runtime/library").DynamicClientExtensionThis<import("@prisma/client").Prisma.TypeMap<import("@prisma/client/runtime/library").InternalArgs & {
    result: {};
    model: {};
    query: {};
    client: {};
}, {}>, import("@prisma/client").Prisma.TypeMapCb<import("@prisma/client").Prisma.PrismaClientOptions>, {
    result: {};
    model: {};
    query: {};
    client: {};
}>;
export * from "./generated/prisma";
//# sourceMappingURL=index.d.ts.map