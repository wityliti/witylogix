/**
 * Dashboard Stats Route — aggregated dashboard statistics
 *
 * Routes:
 *   GET /stats  Returns aggregated dashboard statistics (totalOrders, totalDrivers, totalCustomers, etc.)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";

// ─── Route Plugin ───────────────────────────────────────────

async function dashboardStatsRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require auth + tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET DASHBOARD STATS ─────────────────────────────────────

  fastify.get("/stats", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const shopId = request.shopId;

      // Fetch all stats in parallel
      const [
        totalOrdersResult,
        totalDriversResult,
        totalCustomersResult,
        pendingOrdersResult,
        activeDriversResult,
        deliveredTodayResult,
        revenueResult,
      ] = await Promise.all([
        // Total orders
        request.tenantDb.order.count({
          where: { shopId },
        }),

        // Total drivers
        request.tenantDb.driver.count({
          where: { shopId, isActive: true },
        }),

        // Total customers
        request.tenantDb.customer.count({
          where: { shopId },
        }),

        // Pending orders (PENDING, ACCEPTED, ASSIGNED, PICKED_UP, OUT_FOR_DELIVERY)
        request.tenantDb.order.count({
          where: {
            shopId,
            status: {
              in: ["PENDING", "ACCEPTED", "ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"],
            },
          },
        }),

        // Active drivers (online or on route)
        request.tenantDb.driver.count({
          where: {
            shopId,
            isActive: true,
            status: { in: ["AVAILABLE", "ON_ROUTE"] },
          },
        }),

        // Orders delivered today
        (() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          return request.tenantDb.order.count({
            where: {
              shopId,
              status: "DELIVERED",
              actualDelivery: {
                gte: today,
                lt: tomorrow,
              },
            },
          });
        })(),

        // Total revenue (sum of totalPrice from all orders)
        request.tenantDb.order.aggregate({
          where: { shopId },
          _sum: { totalPrice: true },
        }),
      ]);

      const totalRevenue = revenueResult._sum.totalPrice
        ? parseFloat(revenueResult._sum.totalPrice.toString())
        : 0;

      return reply.send({
        data: {
          totalOrders: totalOrdersResult,
          totalDrivers: totalDriversResult,
          totalCustomers: totalCustomersResult,
          pendingOrders: pendingOrdersResult,
          activeDrivers: activeDriversResult,
          deliveredToday: deliveredTodayResult,
          revenue: totalRevenue,
        },
      });
    } catch (err) {
      throw err;
    }
  });
}

export default dashboardStatsRoutes;
