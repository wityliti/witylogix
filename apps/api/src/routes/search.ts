/**
 * Global Search Routes
 *
 * Routes:
 *   GET /search             — Full-text search across orders, drivers, customers
 *   GET /search/suggestions — Autocomplete suggestions
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';

const searchSchema = z.object({
  q: z.string().min(1).max(200),
  type: z.enum(['orders', 'drivers', 'deliveries', 'integrations', 'customers']).optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

const suggestionsSchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().positive().max(10).default(5),
});

export async function registerSearchRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/search',
    { onRequest: [requireAuth, tenantContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { q, type, limit } = searchSchema.parse(request.query);
      const shopId = request.shopId;
      const db = request.tenantDb;
      const term = `%${q}%`;

      const results: Array<{
        id: string;
        entity: string;
        title: string;
        description?: string;
        rank: number;
        createdAt: string;
        updatedAt: string;
      }> = [];

      if (!type || type === 'orders') {
        const orders = await db.order.findMany({
          where: {
            shopId,
            OR: [
              { orderNumber: { contains: q, mode: 'insensitive' } },
              { recipientName: { contains: q, mode: 'insensitive' } },
              { recipientPhone: { contains: q, mode: 'insensitive' } },
              { externalOrderId: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            orderNumber: true,
            recipientName: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
          take: Math.ceil(limit / 3),
          orderBy: { createdAt: 'desc' },
        });

        for (const o of orders) {
          results.push({
            id: o.id,
            entity: 'orders',
            title: `Order #${o.orderNumber}`,
            description: o.recipientName ?? undefined,
            rank: 1,
            createdAt: o.createdAt.toISOString(),
            updatedAt: o.updatedAt.toISOString(),
          });
        }
      }

      if (!type || type === 'drivers') {
        const drivers = await db.driver.findMany({
          where: {
            shopId,
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
          take: Math.ceil(limit / 3),
          orderBy: { createdAt: 'desc' },
        });

        for (const d of drivers) {
          results.push({
            id: d.id,
            entity: 'drivers',
            title: d.name,
            description: d.email ?? undefined,
            rank: 1,
            createdAt: d.createdAt.toISOString(),
            updatedAt: d.updatedAt.toISOString(),
          });
        }
      }

      if (!type || type === 'customers') {
        const customers = await db.customer.findMany({
          where: {
            shopId,
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            updatedAt: true,
          },
          take: Math.ceil(limit / 3),
          orderBy: { createdAt: 'desc' },
        });

        for (const c of customers) {
          results.push({
            id: c.id,
            entity: 'customers',
            title: c.name,
            description: c.email ?? undefined,
            rank: 1,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
          });
        }
      }

      return { results: results.slice(0, limit) };
    }
  );

  fastify.get(
    '/search/suggestions',
    { onRequest: [requireAuth, tenantContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { q, limit } = suggestionsSchema.parse(request.query);
      const shopId = request.shopId;
      const db = request.tenantDb;

      const [orders, drivers] = await Promise.all([
        db.order.findMany({
          where: {
            shopId,
            orderNumber: { contains: q, mode: 'insensitive' },
          },
          select: { orderNumber: true },
          take: Math.ceil(limit / 2),
          orderBy: { createdAt: 'desc' },
        }),
        db.driver.findMany({
          where: {
            shopId,
            name: { contains: q, mode: 'insensitive' },
          },
          select: { name: true },
          take: Math.ceil(limit / 2),
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const suggestions = [
        ...orders.map((o) => `Order #${o.orderNumber}`),
        ...drivers.map((d) => d.name),
      ].slice(0, limit);

      return { suggestions };
    }
  );
}

export default registerSearchRoutes;
