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

// Import types only — erased at compile time, keeps IDE intellisense working.
// The generated Prisma client lives at ./generated/prisma after running `pnpm db:generate`.
// The stub at ./generated/prisma/index.ts satisfies TypeScript until then.
import type { PrismaClient as PrismaClientType, Prisma as PrismaType, PlanTier as PlanTierType } from "./generated/prisma";

// Use createRequire to load the CJS-generated Prisma client at runtime.
// A static `import { PrismaClient }` here causes Rollup to follow the
// ESM→CJS boundary at build time (in apps that externalize @witylogix/db)
// and fail because it cannot statically detect named exports from the
// generated CJS file. createRequire defers the resolution to Node.js.
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const _generatedPrisma = _require("./generated/prisma") as {
  PrismaClient: typeof PrismaClientType;
  // Prisma is a namespace — not a runtime value, so we don't cast its type here.
};
const PrismaClient = _generatedPrisma.PrismaClient;
// Prisma is re-exported as a type-only namespace; define a runtime placeholder.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Prisma: any = {};

// Singleton Prisma client
const globalForPrisma = globalThis as unknown as { prisma: PrismaClientType };

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
export type { PlanTierType as PlanTier };

/**
 * Shop-scoped Prisma client — sets `app.current_shop_id`.
 * Used by Shopify webhooks, carrier service, and all per-shop operations.
 */
export function forTenant(shopId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }: { args: unknown; query: (args: unknown) => Promise<unknown> }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_shop_id', ${shopId}, TRUE)`,
            query(args) as unknown as PrismaType.PrismaPromise<unknown>,
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
        async $allOperations({ args, query }: { args: unknown; query: (args: unknown) => Promise<unknown> }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, TRUE)`,
            query(args) as unknown as PrismaType.PrismaPromise<unknown>,
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
        async $allOperations({ args, query }: { args: unknown; query: (args: unknown) => Promise<unknown> }) {
          const [,, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_shop_id', ${shopId}, TRUE)`,
            prisma.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, TRUE)`,
            query(args) as unknown as PrismaType.PrismaPromise<unknown>,
          ]);
          return result;
        },
      },
    },
  });
}
