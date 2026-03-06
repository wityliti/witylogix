/**
 * @witylogix/db — Prisma client with tenant-aware RLS extension
 *
 * Usage:
 *   import { prisma, forTenant } from "@witylogix/db";
 *
 *   // Global queries (admin/system operations)
 *   const shops = await prisma.shop.findMany();
 *
 *   // Tenant-scoped queries (RLS enforced)
 *   const tenantDb = forTenant(shopId);
 *   const orders = await tenantDb.order.findMany();
 */

import { PrismaClient } from "@prisma/client";

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

/**
 * Creates a tenant-scoped Prisma client that sets RLS context
 * via `SET LOCAL app.current_shop_id` within each transaction.
 *
 * This ensures PostgreSQL RLS policies filter all queries
 * to the specified tenant, regardless of application code.
 */
export function forTenant(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.current_shop_id', ${tenantId}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

// Re-export Prisma types for consumers
export * from "@prisma/client";
