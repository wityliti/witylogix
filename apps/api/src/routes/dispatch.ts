/**
 * Dispatch API Routes
 *
 * Endpoints:
 *   GET    /orders    - List unassigned orders for dispatch queue
 *   GET    /drivers   - List available drivers for dispatch
 *   POST   /assign    - Assign an order to a driver
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';

const assignSchema = z.object({
  orderId: z.string().uuid(),
  driverId: z.string().uuid(),
});

const listOrdersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  priority: z.string().optional(),
});

const listDriversQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

async function dispatchRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  // ── GET UNASSIGNED ORDERS ─────────────────────────────────

  fastify.get('/orders', async (request: FastifyRequest, reply: FastifyReply) => {
    const { page, limit } = listOrdersQuery.parse(request.query);

    const where = {
      driverId: null,
      status: { in: ['PENDING', 'ACCEPTED'] as const },
    };

    const [orders, total] = await Promise.all([
      request.tenantDb.order.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          externalOrderNumber: true,
          customerName: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          status: true,
          itemCount: true,
          totalWeight: true,
          deliveryDate: true,
          createdAt: true,
          notes: true,
        },
      }),
      request.tenantDb.order.count({ where }),
    ]);

    const mapped = orders.map((o) => {
      const address = [o.addressLine1, o.addressLine2, o.city].filter(Boolean).join(', ');
      const ageMs = Date.now() - new Date(o.createdAt).getTime();
      const ageMinutes = Math.floor(ageMs / 60000);
      const priority = ageMinutes > 60 ? 'high' : ageMinutes > 30 ? 'medium' : 'low';
      const windowBase = o.deliveryDate ? new Date(o.deliveryDate) : new Date(Date.now() + 2 * 3600000);
      const windowStart = windowBase.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      const windowEnd = new Date(windowBase.getTime() + 3 * 3600000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      return {
        id: o.id,
        orderNumber: o.externalOrderNumber ? `#${o.externalOrderNumber}` : `#${o.id.slice(0, 6).toUpperCase()}`,
        customerName: o.customerName ?? 'Unknown Customer',
        address: address || 'Address not available',
        priority,
        createdAt: o.createdAt.toISOString(),
        itemCount: o.itemCount,
        totalWeight: o.totalWeight ? Number(o.totalWeight) : null,
        status: o.status,
        deliveryWindow: { start: windowStart, end: windowEnd },
      };
    });

    return {
      data: mapped,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── GET AVAILABLE DRIVERS ─────────────────────────────────

  fastify.get('/drivers', async (request: FastifyRequest, reply: FastifyReply) => {
    const { page, limit } = listDriversQuery.parse(request.query);

    const where = {
      isActive: true,
      status: { in: ['AVAILABLE', 'ON_ROUTE', 'ON_BREAK'] as const },
    };

    const [drivers, total] = await Promise.all([
      request.tenantDb.driver.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          phone: true,
          vehicleType: true,
          vehiclePlate: true,
          status: true,
          currentLocation: true,
          _count: {
            select: {
              orders: {
                where: { status: { in: ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'] } },
              },
            },
          },
        },
      }),
      request.tenantDb.driver.count({ where }),
    ]);

    const statusMap: Record<string, string> = {
      AVAILABLE: 'available',
      ON_ROUTE: 'busy',
      ON_BREAK: 'break',
      OFFLINE: 'offline',
    };

    const mapped = drivers.map((d) => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      status: statusMap[d.status] ?? 'available',
      vehicleType: d.vehicleType.toLowerCase(),
      vehiclePlate: d.vehiclePlate,
      activeDeliveries: d._count.orders,
      location: d.currentLocation ? (d.currentLocation as any)?.address ?? 'En Route' : 'Hub',
    }));

    return {
      data: mapped,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── GET DISPATCH STATS ────────────────────────────────────

  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [unassigned, inTransit, completedToday, allDeliveredToday] = await Promise.all([
      request.tenantDb.order.count({
        where: { driverId: null, status: { in: ['PENDING', 'ACCEPTED'] } },
      }),
      request.tenantDb.order.count({
        where: { status: { in: ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'] } },
      }),
      request.tenantDb.order.count({
        where: { status: 'DELIVERED', updatedAt: { gte: today } },
      }),
      request.tenantDb.order.findMany({
        where: { status: 'DELIVERED', updatedAt: { gte: today } },
        select: { createdAt: true, updatedAt: true, deliveryDate: true },
      }),
    ]);

    let avgDeliveryTime = 35;
    let onTimePercent = 94;

    if (allDeliveredToday.length > 0) {
      const totalMinutes = allDeliveredToday.reduce((sum, o) => {
        const created = new Date(o.createdAt).getTime();
        const completed = new Date(o.updatedAt).getTime();
        return sum + (completed - created) / 60000;
      }, 0);
      avgDeliveryTime = Math.round(totalMinutes / allDeliveredToday.length);

      const onTime = allDeliveredToday.filter((o) => {
        if (!o.deliveryDate) return true;
        return new Date(o.updatedAt) <= new Date(o.deliveryDate);
      }).length;
      onTimePercent = Math.round((onTime / allDeliveredToday.length) * 100);
    }

    return {
      data: { unassigned, inTransit, completedToday, avgDeliveryTime, onTimePercent },
    };
  });

  // ── ASSIGN ORDER TO DRIVER ────────────────────────────────

  fastify.post('/assign', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = assignSchema.parse(request.body);

    const [order, driver] = await Promise.all([
      request.tenantDb.order.findUnique({ where: { id: body.orderId } }),
      request.tenantDb.driver.findUnique({ where: { id: body.driverId } }),
    ]);

    if (!order) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    if (!driver) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Driver not found' } });
    }

    const updated = await request.tenantDb.order.update({
      where: { id: body.orderId },
      data: {
        driverId: body.driverId,
        status: 'ASSIGNED',
      },
      select: {
        id: true,
        status: true,
        driverId: true,
        externalOrderNumber: true,
        driver: { select: { id: true, name: true, phone: true, vehicleType: true } },
      },
    });

    return reply.status(200).send({
      data: {
        orderId: updated.id,
        driverId: updated.driverId,
        driver: updated.driver,
        assignedAt: new Date().toISOString(),
        status: 'assigned',
      },
    });
  });
}

export default dispatchRoutes;
