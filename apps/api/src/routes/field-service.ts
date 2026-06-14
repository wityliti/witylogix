/**
 * Field Service API Routes
 *
 * Routes:
 *   GET /stats     Real-time KPIs (activeJobs, completionRate, techniciansInField, avgResponseMinutes, slaOnTimePercentage, overdueJobCount)
 *   GET /schedule  Today's scheduled orders assigned to drivers (with driver name)
 *   GET /jobs      Paginated work-order list mapped from real orders
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';

const listJobsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  status: z.string().optional(),
  priority: z.string().optional(),
  search: z.string().optional(),
});

// Map Prisma order status → field-service work-order status
function toWorkStatus(
  s: string
): 'created' | 'scheduled' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled' {
  const m: Record<string, 'created' | 'scheduled' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled'> = {
    PENDING:          'created',
    ACCEPTED:         'scheduled',
    ASSIGNED:         'dispatched',
    PICKED_UP:        'dispatched',
    OUT_FOR_DELIVERY: 'in_progress',
    ARRIVED:          'in_progress',
    DELIVERED:        'completed',
    FAILED:           'cancelled',
    RETURNED:         'cancelled',
    CANCELLED:        'cancelled',
  };
  return m[s] ?? 'created';
}

// Deterministic (no Math.random) priority derived from order id chars
function derivePriority(id: string): 'low' | 'medium' | 'high' | 'urgent' {
  const n = (id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % 4;
  return (['low', 'medium', 'high', 'urgent'] as const)[n];
}

// Deterministic service type derived from order id chars
function deriveServiceType(id: string): 'installation' | 'maintenance' | 'repair' | 'inspection' {
  const n = (id.charCodeAt(0) + id.charCodeAt(1)) % 4;
  return (['installation', 'maintenance', 'repair', 'inspection'] as const)[n];
}

async function fieldServiceRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  // ── STATS ──────────────────────────────────────────────────────────────────

  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      activeOrders,
      deliveredOrders,
      totalOrders,
      todayDelivered,
      overdueOrders,
      techniciansInField,
    ] = await Promise.all([
      request.tenantDb.order.count({
        where: {
          shopId: request.shopId,
          status: { in: ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED'] },
        },
      }),
      request.tenantDb.order.count({
        where: {
          shopId: request.shopId,
          status: 'DELIVERED',
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      request.tenantDb.order.count({
        where: { shopId: request.shopId, createdAt: { gte: thirtyDaysAgo } },
      }),
      request.tenantDb.order.count({
        where: {
          shopId: request.shopId,
          status: 'DELIVERED',
          actualDelivery: { gte: todayStart },
        },
      }),
      // Overdue = not delivered/cancelled, created > 7 days ago
      request.tenantDb.order.count({
        where: {
          shopId: request.shopId,
          status: { notIn: ['DELIVERED', 'CANCELLED', 'RETURNED'] },
          createdAt: { lte: sevenDaysAgo },
        },
      }),
      request.tenantDb.driver.count({
        where: {
          shopId: request.shopId,
          isActive: true,
          status: { in: ['ON_ROUTE', 'ON_BREAK'] },
        },
      }),
    ]);

    const completionRate = totalOrders > 0
      ? Math.round((deliveredOrders / totalOrders) * 100)
      : 0;
    const slaOnTimePercentage = totalOrders > 0
      ? Math.max(0, 100 - Math.round((overdueOrders / totalOrders) * 100))
      : 100;

    return {
      data: {
        activeJobs: activeOrders,
        completionRate,
        techniciansInField,
        avgResponseMinutes: 0, // requires timestamp tracking not yet in schema
        slaOnTimePercentage,
        overdueJobCount: overdueOrders,
        completedToday: todayDelivered,
      },
    };
  });

  // ── SCHEDULE ────────────────────────────────────────────────────────────────

  fastify.get('/schedule', async (request: FastifyRequest, reply: FastifyReply) => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const orders = await request.tenantDb.order.findMany({
      where: {
        shopId: request.shopId,
        driverId: { not: null },
        OR: [
          { deliveryDate: { gte: todayStart, lt: todayEnd } },
          {
            deliveryDate: null,
            status: { in: ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED'] },
          },
        ],
      },
      orderBy: { deliveryDate: 'asc' },
      take: 50,
      select: {
        id: true,
        externalOrderNumber: true,
        customerName: true,
        addressLine1: true,
        city: true,
        status: true,
        deliveryDate: true,
        driverId: true,
        driver: { select: { id: true, name: true } },
      },
    });

    const formatted = orders.map((o) => {
      const base = o.deliveryDate ?? now;
      const startTime = base.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      const endDate = new Date(base.getTime() + 2 * 60 * 60 * 1000);
      const endTime = endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      return {
        jobId: o.id,
        jobNumber: o.externalOrderNumber ? `#${o.externalOrderNumber}` : `#${o.id.slice(0, 6).toUpperCase()}`,
        customerName: o.customerName ?? 'Unknown',
        location: [o.addressLine1, o.city].filter(Boolean).join(', ') || 'Address unknown',
        startTime,
        endTime,
        status: toWorkStatus(o.status),
        technicianId: o.driverId ?? '',
        technicianName: o.driver?.name ?? 'Unassigned',
      };
    });

    return { data: formatted };
  });

  // ── JOBS LIST ───────────────────────────────────────────────────────────────

  fastify.get('/jobs', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listJobsQuery.parse(request.query);
    const { page, limit, status, search } = query;

    // Map field-service status back to Prisma enum values
    const reverseStatusMap: Record<string, string[]> = {
      created:     ['PENDING'],
      scheduled:   ['ACCEPTED'],
      dispatched:  ['ASSIGNED', 'PICKED_UP'],
      in_progress: ['OUT_FOR_DELIVERY', 'ARRIVED'],
      completed:   ['DELIVERED'],
      cancelled:   ['FAILED', 'RETURNED', 'CANCELLED'],
    };

    const prismaStatuses =
      status && status !== 'all' ? reverseStatusMap[status] : null;

    const where = {
      shopId: request.shopId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(prismaStatuses ? { status: { in: prismaStatuses as any[] } } : {}),
      ...(search
        ? {
            OR: [
              { customerName: { contains: search, mode: 'insensitive' as const } },
              { externalOrderNumber: { contains: search, mode: 'insensitive' as const } },
              { notes: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
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
          customerPhone: true,
          status: true,
          addressLine1: true,
          city: true,
          notes: true,
          deliveryDate: true,
          driverId: true,
          estimatedArrival: true,
          driver: { select: { id: true, name: true } },
        },
      }),
      request.tenantDb.order.count({ where }),
    ]);

    const mapped = orders.map((o) => ({
      id: o.id,
      jobNumber: o.externalOrderNumber ? `#${o.externalOrderNumber}` : `#${o.id.slice(0, 6).toUpperCase()}`,
      customerName: o.customerName ?? 'Unknown Customer',
      customerPhone: o.customerPhone ?? '',
      status: toWorkStatus(o.status),
      priority: derivePriority(o.id),
      serviceType: deriveServiceType(o.id),
      location: [o.addressLine1, o.city].filter(Boolean).join(', ') || 'Address unknown',
      description: o.notes ?? 'Standard service job',
      estimatedDuration: 60,
      requiredSkills: [],
      assignedTechId: o.driverId,
      assignedTechName: o.driver?.name ?? null,
      eta: o.estimatedArrival
        ? new Date(o.estimatedArrival).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        : null,
      notes: [],
    }));

    return {
      data: mapped,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });
}

export default fieldServiceRoutes;
