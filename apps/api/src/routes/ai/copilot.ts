/**
 * NL Co-pilot API Route
 *
 * Routes:
 *   POST /api/v4/ai/copilot/query  — Parse natural language query and return matched entities
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { tenantContext } from "../../middleware/tenant.js";
import {
  nlFilterParser,
  type StructuredFilter,
} from "@witylogix/core/natural-language-filter";

// ─── Zod Schema ─────────────────────────────────────────────

const queryBodySchema = z.object({
  query: z.string().min(1).max(500),
  entityType: z.enum(["delivery", "order", "driver"]),
});

// ─── Filter → Prisma where clause ───────────────────────────

function buildDateWhere(filter: StructuredFilter): Record<string, unknown> {
  if (!filter.dateRange) return {};
  const { startDate, endDate } = filter.dateRange;
  if (startDate && endDate) {
    return { gte: startDate, lte: endDate };
  }
  if (startDate) {
    return { gte: startDate };
  }
  return {};
}

function buildDeliveryWhere(
  filter: StructuredFilter,
  shopId: string,
): Record<string, unknown> {
  const where: Record<string, unknown> = { shopId };

  if (filter.status) {
    where["status"] = filter.status.toUpperCase();
  }

  const dateWhere = buildDateWhere(filter);
  if (Object.keys(dateWhere).length > 0) {
    where["createdAt"] = dateWhere;
  }

  if (filter.location?.keyword) {
    where["city"] = { contains: filter.location.keyword, mode: "insensitive" };
  }

  if (filter.fullTextFallback && filter.rawQuery) {
    where["OR"] = [
      { recipientName: { contains: filter.rawQuery, mode: "insensitive" } },
      { city: { contains: filter.rawQuery, mode: "insensitive" } },
    ];
  }

  return where;
}

function buildOrderWhere(
  filter: StructuredFilter,
  shopId: string,
): Record<string, unknown> {
  const where: Record<string, unknown> = { shopId };

  if (filter.status) {
    where["status"] = filter.status.toUpperCase();
  }

  const dateWhere = buildDateWhere(filter);
  if (Object.keys(dateWhere).length > 0) {
    where["createdAt"] = dateWhere;
  }

  if (filter.location?.keyword) {
    where["city"] = { contains: filter.location.keyword, mode: "insensitive" };
  }

  if (filter.amount) {
    const amountWhere: Record<string, unknown> = {};
    if (filter.amount.gt !== undefined) amountWhere["gt"] = filter.amount.gt;
    if (filter.amount.gte !== undefined) amountWhere["gte"] = filter.amount.gte;
    if (filter.amount.lt !== undefined) amountWhere["lt"] = filter.amount.lt;
    if (filter.amount.lte !== undefined) amountWhere["lte"] = filter.amount.lte;
    if (filter.amount.eq !== undefined)
      amountWhere["equals"] = filter.amount.eq;
    if (Object.keys(amountWhere).length > 0) {
      where["totalPrice"] = amountWhere;
    }
  }

  if (filter.fullTextFallback && filter.rawQuery) {
    where["OR"] = [
      { customerName: { contains: filter.rawQuery, mode: "insensitive" } },
      {
        externalOrderNumber: { contains: filter.rawQuery, mode: "insensitive" },
      },
      { city: { contains: filter.rawQuery, mode: "insensitive" } },
    ];
  }

  return where;
}

function buildDriverWhere(
  filter: StructuredFilter,
  shopId: string,
): Record<string, unknown> {
  const where: Record<string, unknown> = { shopId };

  if (filter.status) {
    where["status"] = filter.status.toUpperCase();
  }

  if (filter.fullTextFallback && filter.rawQuery) {
    where["OR"] = [
      { name: { contains: filter.rawQuery, mode: "insensitive" } },
      { email: { contains: filter.rawQuery, mode: "insensitive" } },
    ];
  }

  return where;
}

// ─── Route Handler ───────────────────────────────────────────

async function copilotRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    "/query",
    {
      preHandler: [requireAuth, tenantContext],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = queryBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: "Invalid request", details: parsed.error.flatten() });
      }

      const { query, entityType } = parsed.data;
      const tenantDb = (request as any).tenantDb;
      const shopId = (request as any).shopId as string;

      const filters = nlFilterParser.parse(query);

      let results: unknown[] = [];
      let total = 0;

      if (entityType === "delivery") {
        const where = buildDeliveryWhere(filters, shopId);
        [results, total] = await Promise.all([
          tenantDb.shipment.findMany({
            where,
            take: 50,
            orderBy: { createdAt: "desc" },
          }),
          tenantDb.shipment.count({ where }),
        ]);
      } else if (entityType === "order") {
        const where = buildOrderWhere(filters, shopId);
        [results, total] = await Promise.all([
          tenantDb.order.findMany({
            where,
            take: 50,
            orderBy: { createdAt: "desc" },
          }),
          tenantDb.order.count({ where }),
        ]);
      } else if (entityType === "driver") {
        const where = buildDriverWhere(filters, shopId);
        [results, total] = await Promise.all([
          tenantDb.driver.findMany({
            where,
            take: 50,
            orderBy: { name: "asc" },
          }),
          tenantDb.driver.count({ where }),
        ]);
      }

      return reply.send({ filters, results, total });
    },
  );
}

export default copilotRoutes;
