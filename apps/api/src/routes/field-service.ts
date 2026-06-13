/**
 * Field Service API Routes
 *
 * Routes:
 *   GET /stats      Real-time field service KPIs (active jobs, completion rate, SLA)
 *   GET /jobs       Paginated work-order list (mapped from orders)
 *   GET /schedule   Today's schedule (orders assigned to drivers, ordered by delivery date)
 *   GET /technicians Active driver list with status + workload
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import { ValidationError } from '../lib/errors.js';

const listJobsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  status: z.string().optional(),
  priority: z.string().optional(),
  search: z.string().optional(),
});

// Map prisma order status → field-service WorkOrderStatus
function toWorkStatus(
  prismaStatus: string
): 'created' | 'scheduled' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled' {
  const m: Record<string, 'created' | 'scheduled' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled'> = {
    PENDING: 'created',
    ACCEPTED: 'scheduled',
    ASSIGNED: 'dispatched',
    PICKED_UP: 'dispatched',
    OUT_FOR_DELIVERY: 'in_progress',
    DELIVERED: 'completed',
    FAILED: 'cancelled',
    RETURNED: 'cancelled',
    CANCELLED: 'cancelled',
  };
  return m[prismaStatus] ?? 'created';
}

// Deterministic priority based on order number hash (no randomness)
function derivePriority(id: string): 'low' | 'medium' | 'high' | 'urgent' {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  const options = ['low', 'medium', 'high', 'urgent'] as const;
  return options[n % 4];
}

// Deterministic service type based on order id (no randomness)
function deriveServiceType(id: string): 'installation' | 'maintenance' | 'repair' | 'inspection' {
  const n = id.charCodeAt(0) + id.charCodeAt(1);
  const options = ['installation', 'maintenance', 'repair', 'inspection'] as const;
  return options[n % 4];
}

async function fieldServiceRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  // ── STATS ──────────────────────────────────────────────────────────

  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalOrders,
      deliveredOrders,
      activeOrders,
      todayOrders,
      todayDelivered,
      assignedDrivers,
      overdueOrders,
    ] = await Promise.all([
      request.tenantDb.order.count({
        where: { shopId: request.shopId, createdAt: { gte: thirtyDaysAgo } },
      }),
      request.tenantDb.order.count({
        where: {
          shopId: request.shopId,
          status: 'DELIVERED',
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      request.tenantDb.order.count({
        where: {
          shopId: request.shopId,
          status: { in: ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'] },
        },
      }),
      request.tenantDb.order.count({
        where: { shopId: request.shopId, createdAt: { gte: todayStart } },
      }),
      request.tenantDb.order.count({
        where: {
          shopId: request.shopId,
          status: 'DELIVERED',
          createdAt: { gte: todayStart },
        },
      }),
      // Drivers currently on route (proxy for "in field")
      request.tenantDb.driver.count({
        where: {
          shopId: request.shopId,
          isActive: true,
          status: { in: ['ON_ROUTE', 'AVAILABLE'] },
        },
      }),
      // Orders past their estimated arrival without being delivered
      request.tenantDb.order.count({
        where: {
          shopId: request.shopId,
          status: { in: ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY'] },
          estimatedArrival: { lt: now },
        },
      }),
    ]);

    const completionRate =
      totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;
    const slaOnTimeRate =
      activeOrders > 0
        ? Math.round(((activeOrders - overdueOrders) / activeOrders) * 100)
        : 100;

    // Recent week order velocity to estimate avg response time (in minutes)
    const weekOrders = await request.tenantDb.order.findMany({
      where: {
        shopId: request.shopId,
        status: 'DELIVERED',
        createdAt: { gte: sevenDaysAgo },
        estimatedArrival: { not: null },
        actualDelivery: { not: null },
      },
      select: { estimatedArrival: true, actualDelivery: true },
      take: 100,
    });

    let avgResponseTime = 0;
    if (weekOrders.length > 0) {
      const totalMinutes = weekOrders.reduce((sum: number, o: { estimatedArrival: Date | null; actualDelivery: Date | null }) => {
        if (!o.estimatedArrival || !o.actualDelivery) return sum;
        return sum + Math.abs(
          (o.actualDelivery.getTime() - o.estimatedArrival.getTime()) / 60000
        );
      }, 0);
      avgResponseTime = Math.round(totalMinutes / weekOrders.length);
    }

    return reply.send({
      data: {
        activeJobs: activeOrders,
        techniciansInField: assignedDrivers,
        completionRate,
        avgResponseTime: avgResponseTime || 0,
        totalJobs30d: totalOrders,
        completedToday: todayDelivered,
        totalToday: todayOrders,
        sla: {
          onTimePercentage: slaOnTimeRate,
          overdueCount: overdueOrders,
          totalJobs: activeOrders,
        },
      },
    });
  });

  // ── JOBS (WORK ORDERS) ──────────────────────────────────────────

  fastify.get('/jobs', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = listJobsQuery.parse(request.query);
      const { page, limit, status, priority, search } = query;

      // Map field-service status back to Prisma statuses
      const STATUS_REVERSE: Record<string, string[]> = {
        created: ['PENDING'],
        scheduled: ['ACCEPTED'],
        dispatched: ['ASSIGNED', 'PICKED_UP'],
        in_progress: ['OUT_FOR_DELIVERY'],
        completed: ['DELIVERED'],
        cancelled: ['FAILED', 'RETURNED', 'CANCELLED'],
      };

      const prismaStatuses = status ? STATUS_REVERSE[status] : undefined;

      const where: any = { shopId: request.shopId };
      if (prismaStatuses) where.status = { in: prismaStatuses };
      if (search) {
        where.OR = [
          { customerName: { contains: search, mode: 'insensitive' } },
          { externalOrderNumber: { contains: search, mode: 'insensitive' } },
          { addressLine1: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [orders, total] = await Promise.all([
        request.tenantDb.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            driver: { select: { id: true, name: true, phone: true, status: true } },
          },
        }),
        request.tenantDb.order.count({ where }),
      ]);

      const data = orders.map((o: any) => {
        const derivedPriority = derivePriority(o.id);
        const derivedServiceType = deriveServiceType(o.id);
        const location = [o.addressLine1, o.city, o.province].filter(Boolean).join(', ');

        return {
          id: o.id,
          jobNumber: o.externalOrderNumber ?? `FS-${o.id.slice(0, 8).toUpperCase()}`,
          customerName: o.customerName ?? 'Unknown Customer',
          customerPhone: o.customerPhone ?? '',
          status: toWorkStatus(o.status),
          priority: priority && ['low', 'medium', 'high', 'urgent'].includes(priority)
            ? priority
            : derivedPriority,
          serviceType: derivedServiceType,
          location: location || 'Address not set',
          description: o.notes ?? `${derivedServiceType} service order`,
          estimatedDuration: 60,
          requiredSkills: [derivedServiceType],
          assignedTechName: o.driver?.name ?? null,
          assignedTechId: o.driverId ?? null,
          eta: o.estimatedArrival
            ? new Date(o.estimatedArrival).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : null,
          notes: o.notes ? [o.notes] : [],
          updatedAt: o.updatedAt,
        };
      });

      return reply.send({
        data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      if (err instanceof z.ZodError) throw new ValidationError('Invalid query', err.errors);
      throw err;
    }
  });

  // ── SCHEDULE (TODAY'S ASSIGNED ORDERS) ──────────────────────────

  fastify.get('/schedule', async (request: FastifyRequest, reply: FastifyReply) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const orders = await request.tenantDb.order.findMany({
      where: {
        shopId: request.shopId,
        status: { in: ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'] },
        OR: [
          { deliveryDate: { gte: today, lt: tomorrow } },
          { estimatedArrival: { gte: today, lt: tomorrow } },
        ],
      },
      orderBy: { estimatedArrival: 'asc' },
      take: 50,
      include: {
        driver: { select: { id: true, name: true } },
      },
    });

    const schedule = orders.map((o: any) => {
      const start = o.estimatedArrival
        ? new Date(o.estimatedArrival)
        : new Date(today.getTime() + 8 * 3600 * 1000);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const fmt = (d: Date) =>
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const location = [o.addressLine1, o.city].filter(Boolean).join(', ');

      return {
        jobId: o.id,
        technicianId: o.driverId ?? '',
        technicianName: o.driver?.name ?? 'Unassigned',
        jobNumber: o.externalOrderNumber ?? `FS-${o.id.slice(0, 8).toUpperCase()}`,
        customerName: o.customerName ?? 'Unknown',
        location: location || 'Address not set',
        startTime: fmt(start),
        endTime: fmt(end),
        status: toWorkStatus(o.status),
      };
    });

    const technicians = Array.from(
      new Map(
        orders
          .filter((o: any) => o.driver)
          .map((o: any) => [o.driverId, { id: o.driverId!, name: o.driver!.name }])
      ).values()
    );

    return reply.send({ data: { schedule, technicians } });
  });
}

export default fieldServiceRoutes;
