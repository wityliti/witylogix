/**
 * Notification API Routes v2 — inbox + stats backed by real Prisma models
 *
 *   GET  /                  Notification inbox (from ActivityLog)
 *   GET  /stats             Daily counts, channel breakdown, failed templates
 *   GET  /status            Health check
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function notificationsV2Routes(app: FastifyInstance) {
  // ── GET / — inbox ────────────────────────────────────────────────────────
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = (request as any).tenantDb;
      const query = request.query as { page?: string; limit?: string; category?: string };
      const page = Math.max(1, parseInt(query.page ?? '1', 10));
      const limit = Math.min(100, parseInt(query.limit ?? '20', 10));
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (query.category) where.entityType = query.category;

      const [logs, total] = await Promise.all([
        db.activityLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip,
          take: limit,
        }),
        db.activityLog.count({ where }),
      ]);

      const data = logs.map((l: any) => ({
        id: l.id,
        type: l.entityType,
        category: l.entityType,
        title: `${l.action.replace(/_/g, ' ')} — ${l.entityType}`,
        message: `${l.actorType} performed ${l.action} on ${l.entityType} ${l.entityId.slice(0, 8)}`,
        read: true,
        timestamp: l.timestamp,
        actionUrl: `/${l.entityType}s/${l.entityId}`,
      }));

      return reply.send({
        data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      request.log.error(err, 'Failed to fetch notification inbox');
      reply.status(500);
      return { error: 'Failed to fetch notifications' };
    }
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

      // Daily counts
      const dailyMap = new Map<string, number>();
      for (const l of logs) {
        const key = l.createdAt.toISOString().slice(0, 10);
        dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1);
      }
      const dailyStats = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count }));

      // Channel breakdown
      const channelMap = new Map<string, number>();
      for (const l of logs) {
        channelMap.set(l.channel, (channelMap.get(l.channel) ?? 0) + 1);
      }
      const channelBreakdown: Record<string, number> = {};
      for (const [ch, cnt] of channelMap) channelBreakdown[ch.toLowerCase()] = cnt;

      // Failed templates (group by eventType where status=FAILED/BOUNCED)
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

  // ── GET /status — health check ────────────────────────────────────────────
  app.get('/status', async (_req, reply) => {
    return reply.send({ status: 'ok' });
  });
}
