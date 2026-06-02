/**
 * Notifications API — Admin inbox + delivery log + stats
 *
 * Inbox (/):          Derived from ActivityLog — real system events as admin notifications
 * Delivery log (/delivery-log): NotificationLog — outbound customer notification records
 * Stats (/stats):     Aggregated from NotificationLog
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';

// ─── Schemas ─────────────────────────────────────────────────

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['UNREAD', 'READ', 'ARCHIVED', 'DISMISSED']).optional(),
  category: z.enum(['ORDERS', 'DELIVERIES', 'DRIVERS', 'PAYMENTS', 'SYSTEM', 'ALERTS']).optional(),
});

const deliveryLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH']).optional(),
  status: z.enum(['QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const statsQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(90).default(7),
});

// ─── Helpers ─────────────────────────────────────────────────

function activityToNotification(log: {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorType: string;
  metadata: any;
  changes: any;
  timestamp: Date;
}): object {
  const entityType = log.entityType.toLowerCase();
  let category: string;
  let channel = 'WEBHOOK';
  let title: string;
  let message: string;
  let actionUrl: string | undefined;

  switch (entityType) {
    case 'order':
      category = 'ORDERS';
      channel = 'EMAIL';
      if (log.action === 'created') {
        title = 'New Order Created';
        message = `Order ${log.entityId.slice(0, 8)}… was created`;
        actionUrl = `/orders/${log.entityId}`;
      } else if (log.action === 'delivered') {
        title = 'Order Delivered';
        message = `Order ${log.entityId.slice(0, 8)}… has been delivered`;
        actionUrl = `/orders/${log.entityId}`;
      } else if (log.action === 'status_changed') {
        const changes = log.changes as Record<string, { from: string; to: string }> | null;
        const to = changes?.status?.to ?? 'updated';
        title = 'Order Status Updated';
        message = `Order status changed to ${to}`;
        actionUrl = `/orders/${log.entityId}`;
      } else {
        title = 'Order Updated';
        message = `Order ${log.entityId.slice(0, 8)}… was ${log.action}`;
        actionUrl = `/orders/${log.entityId}`;
      }
      break;
    case 'driver':
      category = 'DRIVERS';
      channel = 'PUSH';
      title = 'Driver Update';
      message = `Driver ${log.entityId.slice(0, 8)}… ${log.action}`;
      actionUrl = `/drivers/${log.entityId}`;
      break;
    case 'shipment':
      category = 'DELIVERIES';
      channel = 'SMS';
      if (log.action === 'delivered') {
        title = 'Shipment Delivered';
        message = `Shipment ${log.entityId.slice(0, 8)}… was delivered`;
      } else if (log.action === 'status_changed') {
        const changes = log.changes as Record<string, { from: string; to: string }> | null;
        const to = changes?.status?.to ?? 'updated';
        title = 'Shipment Status Changed';
        message = `Shipment status → ${to}`;
      } else {
        title = 'Shipment Update';
        message = `Shipment ${log.entityId.slice(0, 8)}… ${log.action}`;
      }
      actionUrl = `/shipments/${log.entityId}`;
      break;
    case 'payment':
    case 'paymenttransaction':
      category = 'PAYMENTS';
      channel = 'EMAIL';
      title = 'Payment Event';
      message = `Payment ${log.action}`;
      break;
    case 'route':
      category = 'DELIVERIES';
      channel = 'PUSH';
      title = 'Route Update';
      message = `Route ${log.entityId.slice(0, 8)}… ${log.action}`;
      actionUrl = `/routes/${log.entityId}`;
      break;
    default:
      category = 'SYSTEM';
      channel = 'WEBHOOK';
      title = `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} ${log.action}`;
      message = `System event: ${log.entityType} ${log.action}`;
  }

  return {
    id: log.id,
    title,
    message,
    category,
    channel,
    iconChannel: channel,
    status: 'UNREAD',
    timestamp: log.timestamp.toISOString(),
    actionUrl,
    metadata: {
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      actorType: log.actorType,
    },
  };
}

function getCategoryFromEntityType(entityType: string): string {
  const et = entityType.toLowerCase();
  if (et === 'order') return 'ORDERS';
  if (et === 'driver') return 'DRIVERS';
  if (et === 'shipment' || et === 'route') return 'DELIVERIES';
  if (et === 'payment' || et === 'paymenttransaction') return 'PAYMENTS';
  return 'SYSTEM';
}

// ─── Route Plugin ─────────────────────────────────────────────

export default async function notificationsV2Routes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', tenantContext);

  // ── GET / — Inbox (ActivityLog as admin notifications) ──────

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listQuerySchema.parse(request.query);
    const db = (request as any).tenantDb;
    const shopId = (request as any).shopId as string;

    const where: any = { shopId };

    if (query.category) {
      const entityMap: Record<string, string[]> = {
        ORDERS: ['order'],
        DELIVERIES: ['shipment', 'route'],
        DRIVERS: ['driver'],
        PAYMENTS: ['payment', 'paymenttransaction'],
        SYSTEM: ['integration', 'shop', 'zone'],
        ALERTS: ['alert'],
      };
      where.entityType = { in: entityMap[query.category] ?? [] };
    }

    const skip = (query.page - 1) * query.limit;
    const [logs, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: query.limit,
      }),
      db.activityLog.count({ where }),
    ]);

    const data = logs.map(activityToNotification);

    return reply.send({
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    });
  });

  // ── GET /stats — Aggregate NotificationLog ───────────────────

  app.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = statsQuerySchema.parse(request.query);
    const db = (request as any).tenantDb;
    const shopId = (request as any).shopId as string;

    const fromDate = new Date(Date.now() - query.days * 24 * 60 * 60 * 1000);

    const logs: Array<{
      channel: string;
      status: string;
      createdAt: Date;
      eventType: string | null;
    }> = await db.notificationLog.findMany({
      where: {
        shopId,
        createdAt: { gte: fromDate },
      },
      select: {
        channel: true,
        status: true,
        createdAt: true,
        eventType: true,
      },
    });

    // Daily counts
    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < query.days; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      dailyMap[d.toISOString().split('T')[0]] = 0;
    }
    for (const l of logs) {
      const day = l.createdAt.toISOString().split('T')[0];
      if (day in dailyMap) dailyMap[day] = (dailyMap[day] ?? 0) + 1;
    }
    const dailyStats = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ timestamp: new Date(date).toISOString(), count }));

    // Channel breakdown
    const channelMap: Record<string, number> = {};
    for (const l of logs) {
      channelMap[l.channel] = (channelMap[l.channel] ?? 0) + 1;
    }
    const totalLogs = logs.length;
    const channelBreakdown = Object.fromEntries(
      Object.entries(channelMap).map(([ch, count]) => [
        ch.toLowerCase(),
        {
          count,
          percentage: totalLogs > 0 ? Math.round((count / totalLogs) * 1000) / 10 : 0,
        },
      ]),
    );

    // Failed template stats
    const failedLogs = logs.filter((l) => l.status === 'FAILED' || l.status === 'BOUNCED');
    const templateFailMap: Record<string, { failureCount: number; total: number }> = {};
    for (const l of failedLogs) {
      const key = l.eventType ?? 'unknown';
      if (!templateFailMap[key]) templateFailMap[key] = { failureCount: 0, total: 0 };
      templateFailMap[key].failureCount += 1;
    }
    for (const l of logs) {
      const key = l.eventType ?? 'unknown';
      if (!templateFailMap[key]) templateFailMap[key] = { failureCount: 0, total: 0 };
      templateFailMap[key].total += 1;
    }
    const failedTemplates = Object.entries(templateFailMap)
      .filter(([, v]) => v.failureCount > 0)
      .sort(([, a], [, b]) => b.failureCount - a.failureCount)
      .slice(0, 5)
      .map(([name, v]) => ({
        name: name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        failureCount: v.failureCount,
        failureRate: v.total > 0 ? Math.round((v.failureCount / v.total) * 1000) / 10 : 0,
      }));

    return reply.send({
      dailyStats,
      channelBreakdown,
      failedTemplates,
      totals: {
        sent: logs.filter((l) => l.status === 'SENT' || l.status === 'DELIVERED').length,
        delivered: logs.filter((l) => l.status === 'DELIVERED').length,
        failed: failedLogs.length,
        total: totalLogs,
      },
    });
  });

  // ── GET /delivery-log — NotificationLog entries ──────────────

  app.get('/delivery-log', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = deliveryLogQuerySchema.parse(request.query);
    const db = (request as any).tenantDb;
    const shopId = (request as any).shopId as string;

    const where: any = { shopId };

    if (query.channel) where.channel = query.channel;
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }
    if (query.search) {
      where.OR = [
        { recipient: { contains: query.search, mode: 'insensitive' } },
        { eventType: { contains: query.search, mode: 'insensitive' } },
        { providerMsgId: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const [logs, total] = await Promise.all([
      db.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
        include: {
          order: { select: { id: true, shopifyOrderNumber: true } },
        },
      }),
      db.notificationLog.count({ where }),
    ]);

    const data = logs.map((l: any) => ({
      id: l.id,
      message: l.eventType ? l.eventType.replace(/_/g, ' ') : 'Notification',
      channel: l.channel,
      recipient: l.recipient,
      status: l.status,
      timestamp: l.createdAt.toISOString(),
      deliveredAt: l.deliveredAt?.toISOString() ?? null,
      readAt: null,
      error: l.errorMessage ?? null,
      retryCount: 0,
      messageId: l.providerMsgId ?? null,
      orderId: l.orderId ?? null,
      orderNumber: l.order?.shopifyOrderNumber ?? null,
    }));

    return reply.send({
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    });
  });

  // ── POST /delivery-log/export — CSV export ───────────────────

  app.post('/delivery-log/export', async (request: FastifyRequest, reply: FastifyReply) => {
    const db = (request as any).tenantDb;
    const shopId = (request as any).shopId as string;

    const logs: Array<{
      channel: string;
      status: string;
      recipient: string;
      eventType: string | null;
      createdAt: Date;
      deliveredAt: Date | null;
      errorMessage: string | null;
      providerMsgId: string | null;
    }> = await db.notificationLog.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const lines = [
      'channel,recipient,eventType,status,sentAt,deliveredAt,messageId,error',
      ...logs.map(
        (l) =>
          `${l.channel},${l.recipient},${l.eventType ?? ''},${l.status},${l.createdAt.toISOString()},${l.deliveredAt?.toISOString() ?? ''},${l.providerMsgId ?? ''},${l.errorMessage ?? ''}`,
      ),
    ].join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="delivery-log.csv"');
    return reply.send(lines);
  });

  // ── PATCH /:id/read — Mark notification read ─────────────────
  // ActivityLog is immutable; read state is client-managed.

  app.patch('/:id/read', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true });
  });

  // ── PATCH /:id/unread ────────────────────────────────────────

  app.patch('/:id/unread', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true });
  });

  // ── DELETE /:id ───────────────────────────────────────────────

  app.delete('/:id', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true });
  });

  // ── POST /mark-all-read ───────────────────────────────────────

  app.post('/mark-all-read', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true });
  });

  // ── POST /delete-bulk ─────────────────────────────────────────

  app.post('/delete-bulk', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true });
  });
}
