/**
 * Healthcare API — clinical records view for healthcare logistics tenants.
 *
 * Routes:
 *   GET /records    List clinical records (derived from orders with healthcare metadata)
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  type: z.string().optional(),
});

async function healthcareRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  fastify.get('/records', async (request: FastifyRequest) => {
    const { page, limit, type } = listQuerySchema.parse(request.query);

    const where = {
      notes: { contains: 'healthcare' },
      ...(type ? { status: type } : {}),
    };

    const [orders, total] = await Promise.all([
      request.tenantDb.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          externalOrderNumber: true,
          customerName: true,
          notes: true,
          status: true,
          createdAt: true,
        },
      }),
      request.tenantDb.order.count({ where }),
    ]);

    const records = orders.map((o) => ({
      id: o.id,
      type: 'PROGRESS_NOTE',
      title: o.externalOrderNumber ? `Record #${o.externalOrderNumber}` : `Record ${o.id.slice(0, 6).toUpperCase()}`,
      patientName: o.customerName ?? 'Unknown',
      author: 'System',
      date: o.createdAt.toISOString(),
      summary: o.notes ?? '',
      isSigned: o.status === 'DELIVERED',
    }));

    return {
      data: records,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

export default healthcareRoutes;
