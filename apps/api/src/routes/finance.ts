/**
 * Finance Routes
 *
 * Routes:
 *   GET  /revenue-by-zone   — order revenue grouped by delivery zone (30 days)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { Prisma } from "@witylogix/db";

const rangeQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

interface ZoneRevenueRow {
  zone_id: string;
  zone_name: string;
  order_count: bigint;
  revenue: number | null;
}

export default async function financeRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  /**
   * GET /revenue-by-zone
   * Returns per-zone revenue aggregated from orders linked via time_slots.
   * Only zones that have at least one order in the requested period are returned.
   */
  fastify.get(
    "/revenue-by-zone",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { days } = rangeQuery.parse(request.query);
      const shopId: string = (request as any).shopId;
      const db = (request as any).tenantDb;

      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);

      const rows = await db.$queryRaw<ZoneRevenueRow[]>`
        SELECT
          dz.id::text           AS zone_id,
          dz.name               AS zone_name,
          COUNT(o.id)           AS order_count,
          SUM(o.total_price)    AS revenue
        FROM delivery_zones dz
        INNER JOIN time_slots  ts ON ts.delivery_zone_id = dz.id
        INNER JOIN orders      o  ON o.time_slot_id = ts.id
        WHERE dz.shop_id      = ${shopId}::uuid
          AND o.shop_id       = ${shopId}::uuid
          AND o.created_at   >= ${dateFrom}
          AND dz.is_active    = true
        GROUP BY dz.id, dz.name
        HAVING COUNT(o.id) > 0
        ORDER BY revenue DESC NULLS LAST
      `;

      const zones = rows.map((r) => ({
        zoneId: r.zone_id,
        zoneName: r.zone_name,
        orderCount: Number(r.order_count),
        revenue: r.revenue !== null ? Number(r.revenue) : 0,
        avgOrderValue:
          Number(r.order_count) > 0
            ? (r.revenue !== null ? Number(r.revenue) : 0) /
              Number(r.order_count)
            : 0,
      }));

      const totalRevenue = zones.reduce((s, z) => s + z.revenue, 0);
      const totalOrders = zones.reduce((s, z) => s + z.orderCount, 0);

      return reply.send({
        data: {
          zones,
          total: {
            revenue: totalRevenue,
            orderCount: totalOrders,
            zonesWithOrders: zones.length,
          },
          dateFrom: dateFrom.toISOString(),
          days,
        },
      });
    },
  );
}
