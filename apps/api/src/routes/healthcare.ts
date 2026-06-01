/**
 * Healthcare Records API
 *
 * Routes:
 *   GET /records   List clinical records (orders tagged healthcare, enriched with record metadata)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";

const listRecordsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  type: z.string().optional(),
  signed: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

function mapOrderToRecord(order: any) {
  const meta: Record<string, any> =
    order.metadata && typeof order.metadata === "object"
      ? (order.metadata as Record<string, any>)
      : {};

  return {
    id: order.id,
    type: (meta.recordType as string) ?? "PROGRESS_NOTE",
    title: (meta.recordTitle as string) ?? order.externalOrderNumber ?? order.id,
    patientName: order.customerName ?? order.customerEmail ?? "Unknown",
    author: (meta.authorName as string) ?? "Unknown",
    date: (meta.recordDate as string) ?? order.createdAt,
    summary: (meta.recordSummary as string) ?? order.notes ?? "",
    isSigned: Boolean(meta.isSigned),
    orderId: order.id,
    createdAt: order.createdAt,
  };
}

export default async function healthcareRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  fastify.get(
    "/records",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const query = listRecordsQuery.parse(request.query);
      const { page, limit, type, signed, search } = query;
      const shopId = request.shopId;

      const where: Record<string, unknown> = {
        shopId,
        tags: { has: "healthcare" },
      };

      if (search) {
        where.OR = [
          { customerName: { contains: search, mode: "insensitive" } },
          { externalOrderNumber: { contains: search, mode: "insensitive" } },
        ];
      }

      const [orders, total] = await Promise.all([
        request.tenantDb.order.findMany({
          where: where as any,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" as const },
          select: {
            id: true,
            externalOrderNumber: true,
            customerName: true,
            customerEmail: true,
            notes: true,
            metadata: true,
            tags: true,
            createdAt: true,
          },
        }),
        request.tenantDb.order.count({ where: where as any }),
      ]);

      let records = orders.map(mapOrderToRecord);

      if (type) {
        records = records.filter((r) => r.type === type);
      }
      if (signed !== undefined) {
        records = records.filter((r) => r.isSigned === signed);
      }

      return {
        data: records,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    },
  );
}
