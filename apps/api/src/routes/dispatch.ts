/**
 * Dispatch API Routes
 *
 * Endpoints:
 *   GET    /orders                   - List unassigned orders for dispatch queue
 *   GET    /drivers                  - List available drivers for dispatch
 *   GET    /ai-suggest/:orderId      - AI driver suggestion for an order
 *   POST   /assign                   - Assign an order to a driver
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import { SmartDriverAssignment } from '@witylogix/core/ai/smart-driver-assignment';

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
          deliveryLocation: true,
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
      const delivLoc = o.deliveryLocation as { latitude?: number; longitude?: number } | null;
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
        lat: delivLoc?.latitude ?? null,
        lng: delivLoc?.longitude ?? null,
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

    const mapped = drivers.map((d) => {
      const loc = d.currentLocation as { latitude?: number; longitude?: number; address?: string } | null;
      return {
        id: d.id,
        name: d.name,
        phone: d.phone,
        status: statusMap[d.status] ?? 'available',
        vehicleType: d.vehicleType.toLowerCase(),
        vehiclePlate: d.vehiclePlate,
        activeDeliveries: d._count.orders,
        location: loc?.address ?? (loc?.latitude != null ? 'En Route' : 'Hub'),
        lat: loc?.latitude ?? null,
        lng: loc?.longitude ?? null,
      };
    });

    return {
      data: mapped,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── GET ACTIVE / IN-TRANSIT ORDERS (with delivery coords) ─

  fastify.get('/active-orders', async (request: FastifyRequest, _reply: FastifyReply) => {
    const orders = await request.tenantDb.order.findMany({
      where: {
        status: { in: ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'] as const },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        externalOrderNumber: true,
        customerName: true,
        addressLine1: true,
        city: true,
        status: true,
        deliveryLocation: true,
        driverId: true,
        estimatedArrival: true,
        driver: { select: { id: true, name: true } },
      },
    });

    const mapped = orders.map((o) => {
      const loc = o.deliveryLocation as { latitude?: number; longitude?: number } | null;
      const address = [o.addressLine1, o.city].filter(Boolean).join(', ');
      return {
        id: o.id,
        orderNumber: o.externalOrderNumber ? `#${o.externalOrderNumber}` : `#${o.id.slice(0, 6).toUpperCase()}`,
        customerName: o.customerName ?? 'Unknown Customer',
        address: address || 'Address not available',
        status: o.status,
        driverId: o.driverId,
        driverName: o.driver?.name ?? null,
        estimatedArrival: o.estimatedArrival?.toISOString() ?? null,
        lat: loc?.latitude ?? null,
        lng: loc?.longitude ?? null,
      };
    });

    return { data: mapped };
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

  // ── AI DRIVER SUGGESTION ─────────────────────────────────

  fastify.get('/ai-suggest/:orderId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { orderId } = request.params as { orderId: string };

    const order = await request.tenantDb.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        deliveryLocation: true,
        totalWeight: true,
        itemCount: true,
        status: true,
      },
    });

    if (!order) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    const drivers = await request.tenantDb.driver.findMany({
      where: { isActive: true, status: { in: ['AVAILABLE', 'ON_ROUTE', 'ON_BREAK'] as const } },
      select: {
        id: true,
        currentLocation: true,
        maxCapacity: true,
        maxWeight: true,
        status: true,
        _count: { select: { orders: { where: { status: { in: ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'] } } } } },
      },
    });

    if (drivers.length === 0) {
      return reply.status(200).send({
        data: { suggestedDriverId: null, confidence: 0, reasoning: 'No available drivers' },
      });
    }

    const DEFAULT_LOCATION = { latitude: 0, longitude: 0 };
    const orderDeliveryLoc = (order.deliveryLocation as { latitude?: number; longitude?: number } | null);
    const deliveryCoord = orderDeliveryLoc?.latitude != null && orderDeliveryLoc?.longitude != null
      ? { latitude: orderDeliveryLoc.latitude, longitude: orderDeliveryLoc.longitude }
      : DEFAULT_LOCATION;

    const engine = new SmartDriverAssignment();

    engine.addDrivers(
      drivers.map((d) => {
        const loc = d.currentLocation as { latitude?: number; longitude?: number } | null;
        const maxWeightNum = d.maxWeight ? Number(d.maxWeight) : 100;
        const usedWeight = 0; // not tracked per-driver in DB; conservative default
        return {
          id: d.id,
          currentLocation: loc?.latitude != null && loc?.longitude != null
            ? { latitude: loc.latitude, longitude: loc.longitude }
            : DEFAULT_LOCATION,
          shiftStartTime: new Date(Date.now() - 4 * 3600000),
          shiftEndTime: new Date(Date.now() + 4 * 3600000),
          capacity: { weight: maxWeightNum, volume: d.maxCapacity },
          usedCapacity: { weight: usedWeight, volume: d._count.orders },
          completedDeliveries: d._count.orders,
          maxDeliveriesPerShift: d.maxCapacity,
          workingHoursRemaining: 240, // 4h default
        };
      })
    );

    engine.addOrders([{
      id: order.id,
      pickupLocation: DEFAULT_LOCATION,
      deliveryLocation: deliveryCoord,
      weight: order.totalWeight ? Number(order.totalWeight) : 0,
      estimatedDuration: 30,
    }]);

    const result = engine.assignOrder({
      id: order.id,
      pickupLocation: DEFAULT_LOCATION,
      deliveryLocation: deliveryCoord,
      weight: order.totalWeight ? Number(order.totalWeight) : 0,
      estimatedDuration: 30,
    });

    if (!result) {
      return reply.status(200).send({
        data: { suggestedDriverId: null, confidence: 0, reasoning: 'No available drivers' },
      });
    }

    const confidence = Math.round(result.score) / 100;
    const reasoning = `Driver assigned with ${result.score}% score. ETA pickup: ${result.estimatedPickupTime.toISOString()}, delivery: ${result.estimatedDeliveryTime.toISOString()}.`;

    return reply.status(200).send({
      data: { suggestedDriverId: result.driverId, confidence, reasoning },
    });
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
