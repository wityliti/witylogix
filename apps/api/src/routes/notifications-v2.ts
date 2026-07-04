/**
 * Notification API Routes v2 — inbox + stats + log backed by real Prisma models
 *
 *   GET  /                     Notification inbox (from ActivityLog)
 *   GET  /stats                Daily counts, channel breakdown, failed templates
 *   GET  /log                  Paginated NotificationLog with filters + stats
 *   GET  /delivery-log         Same, formatted as DeliveryLogEntry for the delivery-log page
 *   POST /delivery-log/export  Stub export (returns empty URL — downstream CSV is client-side)
 *   GET  /coverage             Geographic heatmap — notifications joined to order deliveryLocation
 *   GET  /status               Health check
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export default async function notificationsV2Routes(app: FastifyInstance) {
  // ── GET / — inbox ────────────────────────────────────────────────────────
  app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = (request as any).tenantDb;
      const query = request.query as {
        page?: string;
        limit?: string;
        category?: string;
      };
      const page = Math.max(1, parseInt(query.page ?? "1", 10));
      const limit = Math.min(100, parseInt(query.limit ?? "20", 10));
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (query.category) where.entityType = query.category;

      const [logs, total] = await Promise.all([
        db.activityLog.findMany({
          where,
          orderBy: { timestamp: "desc" },
          skip,
          take: limit,
        }),
        db.activityLog.count({ where }),
      ]);

      const data = logs.map((l: any) => ({
        id: l.id,
        type: l.entityType,
        category: l.entityType,
        title: `${l.action.replace(/_/g, " ")} — ${l.entityType}`,
        message: `${l.actorType} performed ${l.action} on ${l.entityType} ${l.entityId.slice(0, 8)}`,
        read: true,
        timestamp: l.timestamp,
        actionUrl: `/${l.entityType}s/${l.entityId}`,
      }));

      return reply.send({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      request.log.error(err, "Failed to fetch notification inbox");
      reply.status(500);
      return { error: "Failed to fetch notifications" };
    }
  });

  // ── GET /stats — daily counts + channel breakdown + failed templates ──────
  app.get("/stats", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = (request as any).tenantDb;
      const query = request.query as { days?: string };
      const days = Math.min(30, Math.max(1, parseInt(query.days ?? "7", 10)));
      const since = new Date(Date.now() - days * 86_400_000);

      const logs: Array<{ createdAt: Date; channel: string; status: string }> =
        await db.notificationLog.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true, channel: true, status: true },
          orderBy: { createdAt: "asc" },
        });

      const dailyMap = new Map<string, number>();
      for (const l of logs) {
        const key = l.createdAt.toISOString().slice(0, 10);
        dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1);
      }
      const dailyStats = Array.from(dailyMap.entries()).map(
        ([date, count]) => ({ date, count }),
      );

      const channelMap = new Map<string, number>();
      for (const l of logs) {
        channelMap.set(l.channel, (channelMap.get(l.channel) ?? 0) + 1);
      }
      const channelBreakdown: Record<string, number> = {};
      for (const [ch, cnt] of channelMap)
        channelBreakdown[ch.toLowerCase()] = cnt;

      const failedMap = new Map<string, number>();
      for (const l of logs) {
        if (l.status === "FAILED" || l.status === "BOUNCED") {
          const key = (l as any).eventType ?? "unknown";
          failedMap.set(key, (failedMap.get(key) ?? 0) + 1);
        }
      }
      const failedTemplates = Array.from(failedMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([template, count]) => ({ template, count }));

      return reply.send({
        data: { dailyStats, channelBreakdown, failedTemplates },
      });
    } catch (err) {
      request.log.error(err, "Failed to fetch notification stats");
      reply.status(500);
      return { error: "Failed to fetch notification stats" };
    }
  });

  // ── GET /log — paginated NotificationLog with header stats ────────────────
  app.get("/log", async (request: FastifyRequest, reply: FastifyReply) => {
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

      const page = Math.max(1, parseInt(q.page ?? "1", 10));
      const limit = Math.min(100, parseInt(q.limit ?? "50", 10));
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
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          include: {
            order: { select: { id: true, externalOrderNumber: true } },
          },
        }),
        db.notificationLog.count({ where }),
        // aggregate counts for header stats (scoped to same date filter but no channel/status filter)
        db.notificationLog.groupBy({
          by: ["status"],
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
      const grandTotal = Object.values(
        statusTotals as Record<string, number>,
      ).reduce((a: number, b: number) => a + b, 0);
      const delivered =
        (statusTotals["DELIVERED"] ?? 0) + (statusTotals["SENT"] ?? 0);
      const failed = statusTotals["FAILED"] ?? 0;
      const bounced = statusTotals["BOUNCED"] ?? 0;
      const pending = statusTotals["QUEUED"] ?? 0;

      const data = logs.map((l: any) => ({
        id: l.id,
        channel: l.channel,
        eventType: l.eventType,
        recipient: l.recipient,
        status: l.status === "QUEUED" ? "PENDING" : l.status,
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
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats: { total: grandTotal, delivered, failed, bounced, pending },
      });
    } catch (err) {
      request.log.error(err, "Failed to fetch notification log");
      reply.status(500);
      return { error: "Failed to fetch notification log" };
    }
  });

  // ── GET /delivery-log — DeliveryLogEntry shape for delivery-log page ──────
  app.get(
    "/delivery-log",
    async (request: FastifyRequest, reply: FastifyReply) => {
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

        const page = Math.max(1, parseInt(q.page ?? "1", 10));
        const limit = Math.min(100, parseInt(q.limit ?? "50", 10));
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = {};
        if (q.channel) where.channel = q.channel.toUpperCase();
        if (q.status) {
          const mapped =
            q.status.toUpperCase() === "PENDING"
              ? "QUEUED"
              : q.status.toUpperCase();
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
            { recipient: { contains: q.search, mode: "insensitive" } },
            { eventType: { contains: q.search, mode: "insensitive" } },
          ];
        }

        const [logs, total] = await Promise.all([
          db.notificationLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          db.notificationLog.count({ where }),
        ]);

        const data = logs.map((l: any) => ({
          id: l.id,
          message: l.eventType
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c: string) => c.toUpperCase()),
          channel: l.channel,
          recipient: l.recipient,
          status: l.status === "QUEUED" ? "PENDING" : l.status,
          timestamp: l.createdAt,
          deliveredAt: l.deliveredAt ?? undefined,
          readAt: undefined,
          error: l.errorMessage ?? undefined,
          retryCount: 0,
        }));

        return reply.send({
          data,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        });
      } catch (err) {
        request.log.error(err, "Failed to fetch delivery log");
        reply.status(500);
        return { error: "Failed to fetch delivery log" };
      }
    },
  );

  // ── POST /delivery-log/export — stub (client-side CSV handles the real work) ──
  app.post("/delivery-log/export", async (_req, reply) => {
    return reply.send({ url: "" });
  });

  // ── GET /coverage — geographic heatmap of notification recipients ─────────
  app.get("/coverage", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = (request as any).tenantDb;
      const q = request.query as { days?: string; channel?: string };
      const days = Math.min(90, Math.max(1, parseInt(q.days ?? "30", 10)));
      const since = new Date(Date.now() - days * 86_400_000);

      const where: Record<string, unknown> = {
        createdAt: { gte: since },
        orderId: { not: null },
      };
      if (q.channel) where.channel = q.channel.toUpperCase();

      // Fetch notifications that have an associated order
      const logs: Array<{ orderId: string | null; channel: string }> =
        await db.notificationLog.findMany({
          where,
          select: { orderId: true, channel: true },
          take: 5000,
        });

      // Collect unique orderIds
      const orderIds = [
        ...new Set(logs.map((l) => l.orderId).filter(Boolean)),
      ] as string[];
      if (orderIds.length === 0) {
        return reply.send({ data: [] });
      }

      // Fetch orders with deliveryLocation coordinates
      const orders: Array<{ id: string; deliveryLocation: unknown }> =
        await db.order.findMany({
          where: { id: { in: orderIds }, deliveryLocation: { not: null } },
          select: { id: true, deliveryLocation: true },
        });

      // Build orderId → { lat, lng } map
      const coordMap = new Map<string, { lat: number; lng: number }>();
      for (const o of orders) {
        const loc = o.deliveryLocation as any;
        const lat = loc?.lat ?? loc?.latitude;
        const lng = loc?.lng ?? loc?.longitude;
        if (typeof lat === "number" && typeof lng === "number") {
          coordMap.set(o.id, { lat, lng });
        }
      }

      // Aggregate by ~0.05° grid cell (≈5 km) per channel
      const cellMap = new Map<
        string,
        { lat: number; lng: number; count: number; channel: string }
      >();
      for (const log of logs) {
        if (!log.orderId) continue;
        const coord = coordMap.get(log.orderId);
        if (!coord) continue;
        const gridLat = Math.round(coord.lat / 0.05) * 0.05;
        const gridLng = Math.round(coord.lng / 0.05) * 0.05;
        const key = `${gridLat}|${gridLng}|${log.channel}`;
        const cell = cellMap.get(key);
        if (cell) {
          cell.count += 1;
        } else {
          cellMap.set(key, {
            lat: gridLat,
            lng: gridLng,
            count: 1,
            channel: log.channel,
          });
        }
      }

      const data = Array.from(cellMap.values());
      return reply.send({ data });
    } catch (err) {
      request.log.error(err, "Failed to fetch notification coverage");
      reply.status(500);
      return { error: "Failed to fetch notification coverage" };
    }
  });

  // ── GET /status — health check ────────────────────────────────────────────
  app.get("/status", async (_req, reply) => {
    return reply.send({ status: "ok" });
  });
}
