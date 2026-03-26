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

import { PrismaClient, Prisma } from "./generated/prisma";

// Singleton Prisma client
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Alias for `import { db } from '@witylogix/db'` convention
export const db = prisma;

// Re-export Prisma types and enums
export { PrismaClient, Prisma };
export type { PlanTier } from "./generated/prisma";

/**
 * Shop-scoped Prisma client — sets `app.current_shop_id`.
 * Used by Shopify webhooks, carrier service, and all per-shop operations.
 */
export function forTenant(shopId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_shop_id', ${shopId}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

/**
 * Org-scoped Prisma client — sets `app.current_org_id`.
 * Used for cross-shop queries: org drivers, org zones, org members.
 * Shop-specific tables (orders, routes) are NOT accessible here.
 */
export function forOrg(orgId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

/**
 * Dual-scoped Prisma client — sets BOTH shop_id and org_id.
 * Used when a user needs shop data AND org-shared resources in one query
 * (e.g., assigning an org-level driver to a shop-specific order).
 */
export function forTenantInOrg(shopId: string, orgId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [,, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_shop_id', ${shopId}, TRUE)`,
            prisma.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}
