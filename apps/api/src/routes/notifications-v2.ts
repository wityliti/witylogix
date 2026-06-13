/**
 * Notifications API v2 — real-time notification inbox using NotificationLog model
 *
 * Routes:
 *   GET    /                     Paginated notification list (read/unread)
 *   PATCH  /:id/read             Mark notification as read
 *   PATCH  /:id/unread           Mark notification as unread
 *   DELETE /:id                  Delete a notification
 *   POST   /mark-all-read        Mark all as read
 *   POST   /delete-bulk          Delete multiple notifications
 *   GET    /delivery-log         Delivery log (same data, different shape)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import { ValidationError, NotFoundError } from '../lib/errors.js';

const listQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['UNREAD', 'READ', 'ARCHIVED', 'DISMISSED']).optional(),
  category: z.enum(['ORDERS', 'DELIVERIES', 'DRIVERS', 'PAYMENTS', 'SYSTEM', 'ALERTS']).optional(),
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'WEBHOOK', 'SLACK']).optional(),
});

// Map NotificationLog eventType → dashboard category
function deriveCategory(
  eventType: string,
  channel: string
): 'ORDERS' | 'DELIVERIES' | 'DRIVERS' | 'PAYMENTS' | 'SYSTEM' | 'ALERTS' {
  const et = eventType.toLowerCase();
  if (et.includes('order')) return 'ORDERS';
  if (et.includes('deliver') || et.includes('shipment')) return 'DELIVERIES';
  if (et.includes('driver')) return 'DRIVERS';
  if (et.includes('payment') || et.includes('invoice') || et.includes('cod')) return 'PAYMENTS';
  if (et.includes('alert') || et.includes('warning') || et.includes('error')) return 'ALERTS';
  return 'SYSTEM';
}

// Map Prisma channel enum → dashboard channel (PUSH/WEBHOOK/SLACK not in Prisma, fallback)
function mapChannel(
  ch: string
): 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'WEBHOOK' | 'SLACK' {
  if (ch === 'EMAIL') return 'EMAIL';
  if (ch === 'SMS') return 'SMS';
  if (ch === 'WHATSAPP') return 'WHATSAPP';
  return 'PUSH';
}

// Map Prisma NotificationStatus → dashboard read status
function mapStatus(prismaStatus: string): 'UNREAD' | 'READ' | 'ARCHIVED' | 'DISMISSED' {
  if (prismaStatus === 'DELIVERED' || prismaStatus === 'SENT') return 'READ';
  if (prismaStatus === 'QUEUED') return 'UNREAD';
  if (prismaStatus === 'FAILED' || prismaStatus === 'BOUNCED') return 'ARCHIVED';
  return 'UNREAD';
}

// Normalize a NotificationLog record to the dashboard Notification shape
function toNotification(log: any) {
  const category = deriveCategory(log.eventType, log.channel);
  const channel = mapChannel(log.channel);
  const status = mapStatus(log.status);
  const title = log.eventType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
  const message = log.errorMessage
    ? `Delivery failed: ${log.errorMessage}`
    : `Notification sent via ${channel.toLowerCase()} to ${log.recipient}`;

  return {
    id: log.id,
    title,
    message,
    category,
    channel,
    iconChannel: channel,
    status,
    timestamp: (log.sentAt ?? log.createdAt).toISOString(),
    actionUrl: log.orderId ? `/orders/${log.orderId}` : undefined,
    metadata: {
      recipient: log.recipient,
      providerMsgId: log.providerMsgId,
      deliveredAt: log.deliveredAt?.toISOString() ?? null,
      error: log.errorMessage ?? null,
      retryCount: 0,
    },
  };
}

export default async function notificationsV2Routes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', tenantContext);

  // ── LIST ──────────────────────────────────────────────────────

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = listQuery.parse(request.query);
      const { page, limit, status, category, channel } = query;

      const where: any = { shopId: request.shopId };

      // Filter by Prisma status based on dashboard read status
      if (status === 'READ') where.status = { in: ['DELIVERED', 'SENT'] };
      else if (status === 'UNREAD') where.status = 'QUEUED';
      else if (status === 'ARCHIVED') where.status = { in: ['FAILED', 'BOUNCED'] };

      // Channel filter (Prisma enum only has EMAIL, SMS, WHATSAPP, PUSH)
      if (channel && ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'].includes(channel)) {
        where.channel = channel;
      }

      const [logs, total] = await Promise.all([
        (request as any).tenantDb.notificationLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            order: { select: { id: true, externalOrderNumber: true } },
          },
        }),
        (request as any).tenantDb.notificationLog.count({ where }),
      ]);

      let notifications = logs.map(toNotification);

      // Category filter is client-side (derived field not in DB)
      if (category) {
        notifications = notifications.filter((n: any) => n.category === category);
      }

      return reply.send({
        data: notifications,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      if (err instanceof z.ZodError) throw new ValidationError('Invalid query', err.errors);
      throw err;
    }
  });

  // ── MARK AS READ ──────────────────────────────────────────────

  app.patch('/:id/read', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const log = await (request as any).tenantDb.notificationLog.findFirst({
      where: { id: request.params.id, shopId: request.shopId },
    });
    if (!log) throw new NotFoundError('Notification not found');
    const updated = await (request as any).tenantDb.notificationLog.update({
      where: { id: request.params.id },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });
    return reply.send({ data: toNotification(updated) });
  });

  // ── MARK AS UNREAD ────────────────────────────────────────────

  app.patch('/:id/unread', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const log = await (request as any).tenantDb.notificationLog.findFirst({
      where: { id: request.params.id, shopId: request.shopId },
    });
    if (!log) throw new NotFoundError('Notification not found');
    const updated = await (request as any).tenantDb.notificationLog.update({
      where: { id: request.params.id },
      data: { status: 'QUEUED', deliveredAt: null },
    });
    return reply.send({ data: toNotification(updated) });
  });

  // ── DELETE ────────────────────────────────────────────────────

  app.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const log = await (request as any).tenantDb.notificationLog.findFirst({
      where: { id: request.params.id, shopId: request.shopId },
    });
    if (!log) throw new NotFoundError('Notification not found');
    await (request as any).tenantDb.notificationLog.delete({ where: { id: request.params.id } });
    return reply.status(204).send();
  });

  // ── MARK ALL READ ─────────────────────────────────────────────

  app.post('/mark-all-read', async (request: FastifyRequest, reply: FastifyReply) => {
    await (request as any).tenantDb.notificationLog.updateMany({
      where: { shopId: request.shopId, status: 'QUEUED' },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });
    return reply.send({ data: { success: true } });
  });

  // ── BULK DELETE ───────────────────────────────────────────────

  app.post('/delete-bulk', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({ ids: z.array(z.string()).min(1).max(100) }).parse(request.body);
    await (request as any).tenantDb.notificationLog.deleteMany({
      where: { id: { in: body.ids }, shopId: request.shopId },
    });
    return reply.send({ data: { success: true, deleted: body.ids.length } });
  });

  // ── DELIVERY LOG ──────────────────────────────────────────────

  app.get('/delivery-log', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listQuery.parse(request.query);
    const { page, limit } = query;

    const [logs, total] = await Promise.all([
      (request as any).tenantDb.notificationLog.findMany({
        where: { shopId: request.shopId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (request as any).tenantDb.notificationLog.count({ where: { shopId: request.shopId } }),
    ]);

    const entries = logs.map((log: any) => ({
      id: log.id,
      message: `${log.eventType.replace(/_/g, ' ')} notification`,
      channel: mapChannel(log.channel),
      recipient: log.recipient,
      status: log.status,
      timestamp: log.createdAt.toISOString(),
      deliveredAt: log.deliveredAt?.toISOString() ?? null,
      readAt: log.deliveredAt?.toISOString() ?? null,
      error: log.errorMessage ?? null,
      retryCount: 0,
    }));

    return reply.send({
      data: entries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // ── STATUS CHECK ───────────────────────────────────────────────

  app.get('/status', async (_req, reply) => {
    return reply.send({ status: 'ok', message: 'Notifications v2 routes — live' });
  });
}
