/**
 * Notification API Routes v2 — Multi-channel notifications
 */

import type { FastifyInstance } from 'fastify';
import { prisma } from '@witylogix/db';
import { requireAuth } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';

export default async function notificationsV2Routes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', tenantContext);

  app.get('/', async (request, reply) => {
    const shopId = request.auth.shopId;
    const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };
    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where: { shopId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.notificationLog.count({ where: { shopId } }),
    ]);

    return reply.send({
      data: items,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  });

  app.get('/stats', async (request, reply) => {
    const shopId = request.auth.shopId;
    const { days = 7 } = request.query as { days?: number };
    const dayCount = Math.min(Math.max(Number(days) || 7, 1), 90);

    const since = new Date();
    since.setDate(since.getDate() - dayCount);

    const logs = await prisma.notificationLog.findMany({
      where: { shopId, createdAt: { gte: since } },
      select: { channel: true, status: true, createdAt: true, eventType: true },
    });

    // Daily stats
    const dayMap = new Map<string, number>();
    for (let i = 0; i < dayCount; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (dayCount - 1 - i));
      dayMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const log of logs) {
      const key = log.createdAt.toISOString().slice(0, 10);
      if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
    }
    const dailyStats = Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }));

    // Channel breakdown
    const channelTotals: Record<string, number> = { EMAIL: 0, SMS: 0, WHATSAPP: 0, PUSH: 0 };
    for (const log of logs) channelTotals[log.channel] = (channelTotals[log.channel] ?? 0) + 1;
    const total = logs.length;
    const channelBreakdown: Record<string, { count: number; percentage: number }> = {};
    for (const [ch, count] of Object.entries(channelTotals)) {
      channelBreakdown[ch.toLowerCase()] = {
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    }

    // Failed templates by eventType
    const failedByType = new Map<string, number>();
    const sentByType = new Map<string, number>();
    for (const log of logs) {
      sentByType.set(log.eventType, (sentByType.get(log.eventType) ?? 0) + 1);
      if (log.status === 'FAILED' || log.status === 'BOUNCED') {
        failedByType.set(log.eventType, (failedByType.get(log.eventType) ?? 0) + 1);
      }
    }
    const failedTemplates = Array.from(failedByType.entries())
      .map(([name, failureCount]) => ({
        name,
        failureCount,
        failureRate: sentByType.get(name)
          ? Number(((failureCount / (sentByType.get(name) ?? 1)) * 100).toFixed(1))
          : 0,
      }))
      .sort((a, b) => b.failureCount - a.failureCount)
      .slice(0, 5);

    return reply.send({
      data: { dailyStats, channelBreakdown, failedTemplates, total },
    });
  });

  // ── GET /stats — daily counts + channel breakdown + failed templates ──────
  app.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = (request as any).tenantDb;
      const query = request.query as { days?: string };
      const days = Math.min(30, Math.max(1, parseInt(query.days ?? '7', 10)));
      const since = new Date(Date.now() - days * 86_400_000);

      const logs: Array<{ createdAt: Date; channel: string; status: string }> =
        await db.notificationLog.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true, channel: true, status: true },
          orderBy: { createdAt: 'asc' },
        });

      const dailyMap = new Map<string, number>();
      for (const l of logs) {
        const key = l.createdAt.toISOString().slice(0, 10);
        dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1);
      }
      const dailyStats = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count }));

      const channelMap = new Map<string, number>();
      for (const l of logs) {
        channelMap.set(l.channel, (channelMap.get(l.channel) ?? 0) + 1);
      }
      const channelBreakdown: Record<string, number> = {};
      for (const [ch, cnt] of channelMap) channelBreakdown[ch.toLowerCase()] = cnt;

      const failedMap = new Map<string, number>();
      for (const l of logs) {
        if (l.status === 'FAILED' || l.status === 'BOUNCED') {
          const key = (l as any).eventType ?? 'unknown';
          failedMap.set(key, (failedMap.get(key) ?? 0) + 1);
        }
      }
      const failedTemplates = Array.from(failedMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([template, count]) => ({ template, count }));

      return reply.send({ data: { dailyStats, channelBreakdown, failedTemplates } });
    } catch (err) {
      request.log.error(err, 'Failed to fetch notification stats');
      reply.status(500);
      return { error: 'Failed to fetch notification stats' };
    }
  });

  // ── GET /log — paginated NotificationLog with header stats ────────────────
  app.get('/log', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = (request as any).tenantDb;
      const q = request.query as {
        page?: string;
        limit?: string;
        channel?: string;
        status?: string;
        dateFrom?: string;
        dateTo?: string;
      };

      const page = Math.max(1, parseInt(q.page ?? '1', 10));
      const limit = Math.min(100, parseInt(q.limit ?? '50', 10));
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (q.channel) where.channel = q.channel.toUpperCase();
      if (q.status) where.status = q.status.toUpperCase();
      if (q.dateFrom || q.dateTo) {
        const createdAt: Record<string, Date> = {};
        if (q.dateFrom) createdAt.gte = new Date(q.dateFrom);
        if (q.dateTo) {
          const end = new Date(q.dateTo);
          end.setHours(23, 59, 59, 999);
          createdAt.lte = end;
        }
        where.createdAt = createdAt;
      }

      const [logs, total, statsCounts] = await Promise.all([
        db.notificationLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: { order: { select: { id: true, externalOrderNumber: true } } },
        }),
        db.notificationLog.count({ where }),
        // aggregate counts for header stats (scoped to same date filter but no channel/status filter)
        db.notificationLog.groupBy({
          by: ['status'],
          where: (() => {
            const sw: Record<string, unknown> = {};
            if (q.dateFrom || q.dateTo) sw.createdAt = where.createdAt;
            return sw;
          })(),
          _count: { status: true },
        }),
      ]);

      const statusTotals = statsCounts.reduce(
        (acc: Record<string, number>, row: any) => {
          acc[row.status] = row._count.status;
          return acc;
        },
        {} as Record<string, number>,
      );
      const grandTotal = Object.values(statusTotals as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
      const delivered = (statusTotals['DELIVERED'] ?? 0) + (statusTotals['SENT'] ?? 0);
      const failed = statusTotals['FAILED'] ?? 0;
      const bounced = statusTotals['BOUNCED'] ?? 0;
      const pending = statusTotals['QUEUED'] ?? 0;

      const data = logs.map((l: any) => ({
        id: l.id,
        channel: l.channel,
        eventType: l.eventType,
        recipient: l.recipient,
        status: l.status === 'QUEUED' ? 'PENDING' : l.status,
        providerMsgId: l.providerMsgId ?? null,
        errorMessage: l.errorMessage ?? null,
        sentAt: l.sentAt ?? null,
        deliveredAt: l.deliveredAt ?? null,
        createdAt: l.createdAt,
        orderId: l.orderId ?? null,
        orderNumber: l.order?.externalOrderNumber ?? null,
      }));

      return reply.send({
        data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        stats: { total: grandTotal, delivered, failed, bounced, pending },
      });
    } catch (err) {
      request.log.error(err, 'Failed to fetch notification log');
      reply.status(500);
      return { error: 'Failed to fetch notification log' };
    }
  });

  // ── GET /delivery-log — DeliveryLogEntry shape for delivery-log page ──────
  app.get('/delivery-log', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = (request as any).tenantDb;
      const q = request.query as {
        page?: string;
        limit?: string;
        channel?: string;
        status?: string;
        search?: string;
        startDate?: string;
        endDate?: string;
      };

      const page = Math.max(1, parseInt(q.page ?? '1', 10));
      const limit = Math.min(100, parseInt(q.limit ?? '50', 10));
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (q.channel) where.channel = q.channel.toUpperCase();
      if (q.status) {
        const mapped = q.status.toUpperCase() === 'PENDING' ? 'QUEUED' : q.status.toUpperCase();
        where.status = mapped;
      }
      if (q.startDate || q.endDate) {
        const dateFilter: Record<string, Date> = {};
        if (q.startDate) dateFilter.gte = new Date(q.startDate);
        if (q.endDate) {
          const end = new Date(q.endDate);
          end.setHours(23, 59, 59, 999);
          dateFilter.lte = end;
        }
        where.createdAt = dateFilter;
      }
      if (q.search) {
        where.OR = [
          { recipient: { contains: q.search, mode: 'insensitive' } },
          { eventType: { contains: q.search, mode: 'insensitive' } },
        ];
      }

      const [logs, total] = await Promise.all([
        db.notificationLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        db.notificationLog.count({ where }),
      ]);

      const data = logs.map((l: any) => ({
        id: l.id,
        message: l.eventType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        channel: l.channel,
        recipient: l.recipient,
        status: l.status === 'QUEUED' ? 'PENDING' : l.status,
        timestamp: l.createdAt,
        deliveredAt: l.deliveredAt ?? undefined,
        readAt: undefined,
        error: l.errorMessage ?? undefined,
        retryCount: 0,
      }));

      return reply.send({
        data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      request.log.error(err, 'Failed to fetch delivery log');
      reply.status(500);
      return { error: 'Failed to fetch delivery log' };
    }
  });

  // ── POST /delivery-log/export — stub (client-side CSV handles the real work) ──
  app.post('/delivery-log/export', async (_req, reply) => {
    return reply.send({ url: '' });
  });

  // ── GET /status — health check ────────────────────────────────────────────
  app.get('/status', async (_req, reply) => {
    return reply.send({ status: 'ok' });
  });
}
