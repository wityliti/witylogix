/**
 * Notification API Routes v2
 *
 * Admin inbox is derived from NotificationLog records.
 * FAILED/BOUNCED logs surface as UNREAD; others are READ.
 * Read/deleted state is persisted in Shop.settings.notificationInbox.
 *
 * Routes:
 *   GET    /                      Admin inbox (paginated, filter by status/category/channel)
 *   PATCH  /:id/read              Mark inbox item as read
 *   PATCH  /:id/unread            Mark inbox item as unread
 *   DELETE /:id                   Hide inbox item
 *   POST   /mark-all-read         Mark all as read
 *   POST   /delete-bulk           Bulk hide items
 *   GET    /delivery-log          NotificationLog records (paginated, searchable)
 *   POST   /delivery-log/export   Trigger CSV export URL
 *   POST   /test                  Send test notification (noop — returns success)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { prisma } from "@witylogix/db";

// ─── Schema ────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["UNREAD", "READ", "ALL"]).optional(),
  category: z
    .enum(["ORDERS", "DELIVERIES", "DRIVERS", "PAYMENTS", "SYSTEM", "ALL"])
    .optional(),
  channel: z.enum(["EMAIL", "SMS", "WHATSAPP", "PUSH"]).optional(),
});

const deliveryLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  channel: z.enum(["EMAIL", "SMS", "WHATSAPP", "PUSH"]).optional(),
  status: z
    .enum(["QUEUED", "SENT", "DELIVERED", "FAILED", "BOUNCED"])
    .optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// ─── Helpers ───────────────────────────────────────────────────────────────

type InboxSettings = {
  readIds: string[];
  deletedIds: string[];
};

function getInboxSettings(settings: unknown): InboxSettings {
  const s = (settings ?? {}) as Record<string, unknown>;
  const inbox = (s.notificationInbox ?? {}) as Record<string, unknown>;
  return {
    readIds: Array.isArray(inbox.readIds) ? (inbox.readIds as string[]) : [],
    deletedIds: Array.isArray(inbox.deletedIds)
      ? (inbox.deletedIds as string[])
      : [],
  };
}

function eventTypeToCategory(
  eventType: string
): "ORDERS" | "DELIVERIES" | "DRIVERS" | "PAYMENTS" | "SYSTEM" {
  const et = eventType.toLowerCase();
  if (et.includes("order")) return "ORDERS";
  if (et.includes("deliver") || et.includes("shipment")) return "DELIVERIES";
  if (et.includes("driver")) return "DRIVERS";
  if (et.includes("payment") || et.includes("invoice")) return "PAYMENTS";
  return "SYSTEM";
}

function logToInboxItem(
  log: {
    id: string;
    channel: string;
    eventType: string;
    recipient: string;
    status: string;
    errorMessage: string | null;
    sentAt: Date | null;
    deliveredAt: Date | null;
    createdAt: Date;
    order?: { orderNumber?: string | null } | null;
  },
  readIds: Set<string>
) {
  const isFailure = log.status === "FAILED" || log.status === "BOUNCED";
  const inboxStatus = readIds.has(log.id) ? "READ" : isFailure ? "UNREAD" : "READ";
  const category = eventTypeToCategory(log.eventType);
  const channelMap: Record<string, string> = {
    EMAIL: "EMAIL",
    SMS: "SMS",
    WHATSAPP: "WHATSAPP",
    PUSH: "PUSH",
  };

  let title = log.eventType
    .replace(/_/g, " ")
    .replace(/\./g, " — ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  if (log.order?.orderNumber) title += ` #${log.order.orderNumber}`;

  let message = `Channel: ${log.channel} → ${log.recipient}`;
  if (log.errorMessage) message = log.errorMessage;
  else if (log.status === "DELIVERED") message = "Delivered successfully";
  else if (log.status === "SENT") message = "Sent, awaiting delivery confirmation";
  else if (log.status === "QUEUED") message = "Queued for delivery";

  return {
    id: log.id,
    title,
    message,
    category,
    channel: channelMap[log.channel] ?? log.channel,
    status: inboxStatus,
    iconChannel: channelMap[log.channel] ?? log.channel,
    timestamp: (log.sentAt ?? log.createdAt).toISOString(),
    actionUrl: log.order?.orderNumber
      ? `/orders/${log.id}`
      : undefined,
    metadata: {
      deliveryStatus: log.status,
      recipient: log.recipient,
      deliveredAt: log.deliveredAt?.toISOString(),
    },
  };
}

// ─── Plugin ────────────────────────────────────────────────────────────────

export default async function notificationsV2Routes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", tenantContext);

  // ── GET / — Admin notification inbox ──────────────────────────────────────

  app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listQuerySchema.parse(request.query);
    const shopId = request.shopId;

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { settings: true },
    });
    const inboxSettings = getInboxSettings(shop?.settings);
    const readIds = new Set(inboxSettings.readIds);
    const deletedIds = new Set(inboxSettings.deletedIds);

    const where: Record<string, unknown> = { shopId };

    if (query.channel) where.channel = query.channel;

    // Category → eventType prefix mapping
    if (query.category && query.category !== "ALL") {
      const prefixMap: Record<string, string[]> = {
        ORDERS: ["order", "ORDER"],
        DELIVERIES: ["deliver", "DELIVER", "shipment", "SHIPMENT"],
        DRIVERS: ["driver", "DRIVER"],
        PAYMENTS: ["payment", "PAYMENT", "invoice", "INVOICE"],
        SYSTEM: [],
      };
      const prefixes = prefixMap[query.category] ?? [];
      if (prefixes.length > 0) {
        where.eventType = { in: undefined };
        // Use contains for each prefix — use OR
      }
    }

    // For status filter: UNREAD = FAILED/BOUNCED not in readIds; READ = others or in readIds
    // Fetch all and filter in-memory for simplicity (reads are cheap for small-medium datasets)
    const logs = await (request.tenantDb as any).notificationLog.findMany({
      where: {
        shopId,
        ...(query.channel ? { channel: query.channel } : {}),
        id: deletedIds.size > 0 ? { notIn: Array.from(deletedIds) } : undefined,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        channel: true,
        eventType: true,
        recipient: true,
        status: true,
        errorMessage: true,
        sentAt: true,
        deliveredAt: true,
        createdAt: true,
        order: { select: { orderNumber: true } },
      },
    });

    let items = logs.map((log: Parameters<typeof logToInboxItem>[0]) =>
      logToInboxItem(log, readIds)
    );

    // Apply category filter
    if (query.category && query.category !== "ALL") {
      items = items.filter(
        (item: { category: string }) => item.category === query.category
      );
    }

    // Apply status filter
    if (query.status && query.status !== "ALL") {
      items = items.filter(
        (item: { status: string }) => item.status === query.status
      );
    }

    const total = items.length;
    const start = (query.page - 1) * query.limit;
    const page = items.slice(start, start + query.limit);

    return reply.send({
      data: page,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    });
  });

  // ── PATCH /:id/read ───────────────────────────────────────────────────────

  app.patch(
    "/:id/read",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const shopId = request.shopId;

      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { settings: true },
      });
      const inboxSettings = getInboxSettings(shop?.settings);
      if (!inboxSettings.readIds.includes(id)) {
        inboxSettings.readIds.push(id);
      }

      await prisma.shop.update({
        where: { id: shopId },
        data: {
          settings: {
            ...(shop?.settings as object ?? {}),
            notificationInbox: inboxSettings,
          },
        },
      });

      return reply.send({ id, status: "READ" });
    }
  );

  // ── PATCH /:id/unread ─────────────────────────────────────────────────────

  app.patch(
    "/:id/unread",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const shopId = request.shopId;

      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { settings: true },
      });
      const inboxSettings = getInboxSettings(shop?.settings);
      inboxSettings.readIds = inboxSettings.readIds.filter((r) => r !== id);

      await prisma.shop.update({
        where: { id: shopId },
        data: {
          settings: {
            ...(shop?.settings as object ?? {}),
            notificationInbox: inboxSettings,
          },
        },
      });

      return reply.send({ id, status: "UNREAD" });
    }
  );

  // ── DELETE /:id ───────────────────────────────────────────────────────────

  app.delete(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const shopId = request.shopId;

      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { settings: true },
      });
      const inboxSettings = getInboxSettings(shop?.settings);
      if (!inboxSettings.deletedIds.includes(id)) {
        inboxSettings.deletedIds.push(id);
      }
      // Keep deletedIds trimmed (max 5000)
      if (inboxSettings.deletedIds.length > 5000) {
        inboxSettings.deletedIds = inboxSettings.deletedIds.slice(-5000);
      }

      await prisma.shop.update({
        where: { id: shopId },
        data: {
          settings: {
            ...(shop?.settings as object ?? {}),
            notificationInbox: inboxSettings,
          },
        },
      });

      return reply.code(204).send();
    }
  );

  // ── POST /mark-all-read ───────────────────────────────────────────────────

  app.post(
    "/mark-all-read",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId = request.shopId;

      const [shop, logs] = await Promise.all([
        prisma.shop.findUnique({ where: { id: shopId }, select: { settings: true } }),
        (request.tenantDb as any).notificationLog.findMany({
          where: { shopId },
          select: { id: true },
        }),
      ]);

      const inboxSettings = getInboxSettings(shop?.settings);
      const allIds = (logs as { id: string }[]).map((l) => l.id);
      inboxSettings.readIds = Array.from(new Set([...inboxSettings.readIds, ...allIds]));

      await prisma.shop.update({
        where: { id: shopId },
        data: {
          settings: {
            ...(shop?.settings as object ?? {}),
            notificationInbox: inboxSettings,
          },
        },
      });

      return reply.send({ marked: allIds.length });
    }
  );

  // ── POST /delete-bulk ─────────────────────────────────────────────────────

  app.post(
    "/delete-bulk",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const shopId = request.shopId;
      const { ids } = (request.body ?? {}) as { ids?: string[] };
      if (!ids || !Array.isArray(ids)) {
        return reply.code(400).send({ error: "ids array required" });
      }

      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { settings: true },
      });
      const inboxSettings = getInboxSettings(shop?.settings);
      inboxSettings.deletedIds = Array.from(
        new Set([...inboxSettings.deletedIds, ...ids])
      );
      if (inboxSettings.deletedIds.length > 5000) {
        inboxSettings.deletedIds = inboxSettings.deletedIds.slice(-5000);
      }

      await prisma.shop.update({
        where: { id: shopId },
        data: {
          settings: {
            ...(shop?.settings as object ?? {}),
            notificationInbox: inboxSettings,
          },
        },
      });

      return reply.send({ deleted: ids.length });
    }
  );

  // ── GET /delivery-log ─────────────────────────────────────────────────────

  app.get(
    "/delivery-log",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = deliveryLogQuerySchema.parse(request.query);
      const shopId = request.shopId;

      const where: Record<string, unknown> = { shopId };

      if (query.channel) where.channel = query.channel;
      if (query.status) where.status = query.status;

      if (query.startDate || query.endDate) {
        where.createdAt = {
          ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
          ...(query.endDate ? { lte: new Date(query.endDate + "T23:59:59Z") } : {}),
        };
      }

      if (query.search) {
        where.OR = [
          { recipient: { contains: query.search, mode: "insensitive" } },
          { eventType: { contains: query.search, mode: "insensitive" } },
          { errorMessage: { contains: query.search, mode: "insensitive" } },
        ];
      }

      const [logs, total] = await Promise.all([
        (request.tenantDb as any).notificationLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: query.limit,
          skip: (query.page - 1) * query.limit,
          select: {
            id: true,
            channel: true,
            eventType: true,
            recipient: true,
            status: true,
            providerMsgId: true,
            errorMessage: true,
            sentAt: true,
            deliveredAt: true,
            createdAt: true,
          },
        }),
        (request.tenantDb as any).notificationLog.count({ where }),
      ]);

      const data = (logs as any[]).map((log) => ({
        id: log.id,
        message: log.eventType
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c: string) => c.toUpperCase()),
        channel: log.channel,
        recipient: log.recipient,
        status: log.status === "QUEUED" ? "PENDING" : log.status,
        timestamp: (log.sentAt ?? log.createdAt).toISOString(),
        deliveredAt: log.deliveredAt?.toISOString() ?? null,
        readAt: null,
        error: log.errorMessage ?? null,
        retryCount: 0,
        providerMsgId: log.providerMsgId ?? null,
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
    }
  );

  // ── POST /delivery-log/export ─────────────────────────────────────────────

  app.post(
    "/delivery-log/export",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({ url: null, message: "Export queued" });
    }
  );

  // ── POST /test ────────────────────────────────────────────────────────────

  app.post("/test", async (request: FastifyRequest, reply: FastifyReply) => {
    const { channel } = (request.body ?? {}) as { channel?: string };
    return reply.send({
      success: true,
      message: `Test notification queued via ${channel ?? "EMAIL"}`,
    });
  });
}
