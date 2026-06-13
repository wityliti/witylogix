/**
 * Notifications API v2 — Admin inbox + delivery log + preferences
 *
 * Routes:
 *   GET    /                   List tenant notifications (inbox)
 *   POST   /mark-all-read      Mark all notifications read
 *   PATCH  /:id/read           Mark notification read
 *   PATCH  /:id/unread         Mark notification unread
 *   DELETE /:id                Delete notification
 *   GET    /delivery-log       List outbound delivery log (NotificationLog)
 *   POST   /delivery-log/export Export delivery log CSV (stub, returns signed URL placeholder)
 *   GET    /preferences        Get notification preferences (stored in shop settings)
 *   PATCH  /preferences        Update notification preferences
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError } from "../lib/errors.js";

// ─── Schemas ──────────────────────────────────────────────

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["UNREAD", "READ", "ARCHIVED", "DISMISSED"]).optional(),
  category: z.enum(["ORDERS", "DELIVERIES", "DRIVERS", "PAYMENTS", "SYSTEM", "ALERTS"]).optional(),
});

const deliveryLogQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  channel: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

// ─── Route Plugin ─────────────────────────────────────────

export default async function notificationsV2Routes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", tenantContext);

  // ── LIST NOTIFICATIONS (INBOX) ──────────────────────────

  app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const { page, limit, status, category } = listQuery.parse(request.query);
    const db = (request as any).tenantDb;

    const where: Record<string, any> = {};
    if (status) where.status = status;
    if (category) where.category = category;

    const [items, total, unreadCount] = await Promise.all([
      db.tenantNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.tenantNotification.count({ where }),
      db.tenantNotification.count({ where: { status: "UNREAD" } }),
    ]);

    const normalized = items.map((n: any) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      category: n.category,
      channel: n.channel,
      status: n.status,
      iconChannel: n.channel,
      timestamp: n.createdAt,
      actionUrl: n.actionUrl,
      metadata: n.metadata,
    }));

    return reply.send({
      data: normalized,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // ── MARK ALL READ ────────────────────────────────────────

  app.post("/mark-all-read", async (request: FastifyRequest, reply: FastifyReply) => {
    const db = (request as any).tenantDb;
    await db.tenantNotification.updateMany({
      where: { status: "UNREAD" },
      data: { status: "READ", readAt: new Date() },
    });
    return reply.send({ success: true });
  });

  // ── MARK READ ────────────────────────────────────────────

  app.patch("/:id/read", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = (request as any).tenantDb;

    const existing = await db.tenantNotification.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Notification", id);

    const updated = await db.tenantNotification.update({
      where: { id },
      data: { status: "READ", readAt: new Date() },
    });
    return reply.send({ id: updated.id, status: updated.status });
  });

  // ── MARK UNREAD ──────────────────────────────────────────

  app.patch("/:id/unread", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = (request as any).tenantDb;

    const existing = await db.tenantNotification.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Notification", id);

    const updated = await db.tenantNotification.update({
      where: { id },
      data: { status: "UNREAD", readAt: null },
    });
    return reply.send({ id: updated.id, status: updated.status });
  });

  // ── DELETE ───────────────────────────────────────────────

  app.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = (request as any).tenantDb;

    const existing = await db.tenantNotification.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Notification", id);

    await db.tenantNotification.delete({ where: { id } });
    return reply.code(204).send();
  });

  // ── BULK DELETE ──────────────────────────────────────────

  app.post("/delete-bulk", async (request: FastifyRequest, reply: FastifyReply) => {
    const { ids } = request.body as { ids: string[] };
    const db = (request as any).tenantDb;
    await db.tenantNotification.deleteMany({ where: { id: { in: ids } } });
    return reply.send({ deleted: ids.length });
  });

  // ── DELIVERY LOG ─────────────────────────────────────────

  app.get("/delivery-log", async (request: FastifyRequest, reply: FastifyReply) => {
    const { page, limit, channel, status, search, dateFrom, dateTo } = deliveryLogQuery.parse(request.query);
    const db = (request as any).tenantDb;

    const where: Record<string, any> = {};
    if (channel) where.channel = channel.toUpperCase();
    if (status) where.status = status.toUpperCase();
    if (search) where.recipient = { contains: search, mode: "insensitive" };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const [logs, total] = await Promise.all([
      db.notificationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { order: { select: { externalOrderNumber: true, customerName: true } } },
      }),
      db.notificationLog.count({ where }),
    ]);

    const normalized = logs.map((l: any) => ({
      id: l.id,
      message: `${l.eventType} to ${l.recipient}`,
      channel: l.channel,
      recipient: l.recipient,
      status: l.status,
      timestamp: l.createdAt,
      deliveredAt: l.deliveredAt,
      readAt: null,
      error: l.errorMessage,
      retryCount: 0,
      orderId: l.orderId,
      orderNumber: l.order?.externalOrderNumber ?? null,
    }));

    return reply.send({
      data: normalized,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  // ── EXPORT DELIVERY LOG (stub, returns signed URL placeholder) ─

  app.post("/delivery-log/export", async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ url: null, message: "Export not yet configured" });
  });

  // ── STATUS ───────────────────────────────────────────────

  app.get("/status", async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ status: "ok", version: "v2" });
  });
}
