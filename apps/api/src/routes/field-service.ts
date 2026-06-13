/**
 * Field Service API Routes
 *
 * Endpoints:
 *   GET /stats     - Aggregate KPIs from orders + drivers (active jobs, completion rate, SLA)
 *   GET /schedule  - Today's jobs with assigned driver details (for schedule timeline)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';

async function fieldServiceRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAuth);
  fastify.addHook('preHandler', tenantContext);

  // ── STATS ──────────────────────────────────────────────────

  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole('SUPER_ADMIN', 'ADMIN', 'DISPATCHER')(request, reply);

    const db = request.tenantDb;
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const [
      activeJobCount,
      completedToday,
      completedYesterday,
      inFieldDrivers,
      totalDrivers,
      overdueJobs,
      recentCompleted,
    ] = await Promise.all([
      // Jobs currently in progress (assigned/out for delivery)
      db.order.count({
        where: {
          status: { in: ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED'] },
        },
      }),
      // Completed today
      db.order.count({
        where: {
          status: 'DELIVERED',
          actualDelivery: { gte: startOfToday },
        },
      }),
      // Completed yesterday (for delta)
      db.order.count({
        where: {
          status: 'DELIVERED',
          actualDelivery: { gte: startOfYesterday, lt: startOfToday },
        },
      }),
      // Drivers currently on route
      db.driver.count({ where: { status: 'ON_ROUTE', isActive: true } }),
      // Total active drivers
      db.driver.count({ where: { isActive: true } }),
      // Jobs past delivery date not yet delivered (overdue SLA)
      db.order.count({
        where: {
          status: { notIn: ['DELIVERED', 'CANCELLED', 'RETURNED'] },
          deliveryDate: { lt: now },
        },
      }),
      // Average response time: completed jobs with estimatedArrival + actualDelivery
      db.order.findMany({
        where: {
          status: 'DELIVERED',
          actualDelivery: { gte: startOfToday },
          estimatedArrival: { not: null },
        },
        select: { estimatedArrival: true, actualDelivery: true },
        take: 100,
      }),
    ]);

    // Compute completion rate (delivered / (delivered + failed) in past 7 days)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [deliveredWeek, failedWeek] = await Promise.all([
      db.order.count({ where: { status: 'DELIVERED', actualDelivery: { gte: weekAgo } } }),
      db.order.count({ where: { status: 'FAILED', updatedAt: { gte: weekAgo } } }),
    ]);
    const totalWeek = deliveredWeek + failedWeek;
    const completionRate = totalWeek > 0 ? Math.round((deliveredWeek / totalWeek) * 100) : 0;

    // Avg response time in minutes (diff between estimatedArrival and actualDelivery)
    let avgResponseMinutes = 0;
    if (recentCompleted.length > 0) {
      const diffs = recentCompleted
        .filter((o) => o.estimatedArrival && o.actualDelivery)
        .map((o) => {
          const diffMs = Math.abs(
            new Date(o.actualDelivery!).getTime() - new Date(o.estimatedArrival!).getTime()
          );
          return diffMs / 60000;
        });
      avgResponseMinutes =
        diffs.length > 0 ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length) : 0;
    }

    // SLA on-time: delivered within deliveryDate window
    const [onTimeCount, totalScheduledToday] = await Promise.all([
      db.order.count({
        where: {
          status: 'DELIVERED',
          actualDelivery: { gte: startOfToday },
          estimatedArrival: { not: null },
        },
      }),
      db.order.count({
        where: {
          deliveryDate: { gte: startOfToday, lt: now },
        },
      }),
    ]);
    const slaOnTimePercentage =
      totalScheduledToday > 0 ? Math.round((onTimeCount / totalScheduledToday) * 100) : 100;

    // Active jobs delta vs yesterday
    const activeJobsYesterday = await db.order.count({
      where: {
        status: { in: ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED'] },
        updatedAt: { gte: startOfYesterday, lt: startOfToday },
      },
    });

    const completedDelta =
      completedYesterday > 0
        ? Math.round(((completedToday - completedYesterday) / completedYesterday) * 100)
        : 0;

    return {
      data: {
        activeJobs: activeJobCount,
        completedToday,
        inFieldCount: inFieldDrivers,
        totalDrivers,
        completionRate,
        avgResponseMinutes,
        slaOnTimePercentage,
        overdueJobCount: overdueJobs,
        totalScheduledToday,
        completedDelta,
        activeJobsYesterday,
      },
    };
  });

  // ── SCHEDULE ──────────────────────────────────────────────

  fastify.get('/schedule', async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole('SUPER_ADMIN', 'ADMIN', 'DISPATCHER')(request, reply);

    const db = request.tenantDb;
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const jobs = await db.order.findMany({
      where: {
        deliveryDate: { gte: startOfToday, lt: endOfToday },
        status: { notIn: ['CANCELLED'] },
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
        estimatedArrival: true,
        driverId: true,
        driver: {
          select: { id: true, name: true },
        },
      },
    });

    const mapped = jobs.map((j) => {
      const startTime = j.deliveryDate
        ? new Date(j.deliveryDate).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
        : '—';
      const endTime = j.estimatedArrival
        ? new Date(j.estimatedArrival).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })
        : startTime;
      const location = [j.addressLine1, j.city].filter(Boolean).join(', ') || 'Address not set';

      return {
        jobId: j.id,
        jobNumber: j.externalOrderNumber ? `#${j.externalOrderNumber}` : `#${j.id.slice(0, 6).toUpperCase()}`,
        customerName: j.customerName ?? 'Unknown Customer',
        location,
        startTime,
        endTime,
        status: mapOrderStatus(j.status),
        technicianId: j.driverId ?? null,
        technicianName: j.driver?.name ?? null,
      };
    });

    return { data: mapped };
  });
}

function mapOrderStatus(
  status: string
): 'created' | 'scheduled' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled' {
  const map: Record<string, 'created' | 'scheduled' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled'> = {
    PENDING: 'created',
    ACCEPTED: 'scheduled',
    ASSIGNED: 'dispatched',
    PICKED_UP: 'dispatched',
    OUT_FOR_DELIVERY: 'in_progress',
    ARRIVED: 'in_progress',
    DELIVERED: 'completed',
    FAILED: 'cancelled',
    RETURNED: 'cancelled',
    CANCELLED: 'cancelled',
  };
  return map[status] ?? 'created';
}

export default fieldServiceRoutes;
