/**
 * POS Integration — point of sale system configuration and order management.
 *
 * Routes:
 *   GET    /configs                 List POS configurations (terminals)
 *   POST   /configs                 Create POS config
 *   PUT    /configs/:id             Update POS config
 *   DELETE /configs/:id             Delete POS config
 *   GET    /overview                Dashboard KPIs (todaysSales, transactionCount, avgTicket, paymentBreakdown)
 *   GET    /terminals               POS configs shaped as terminals (with order counts)
 *   GET    /terminal-locations      Terminals with lat/lng from Location model (for map view)
 *   GET    /transactions            POS orders shaped as transactions
 *   POST   /transactions/:id/refund Refund / cancel a transaction
 *   GET    /sales-trends            Daily sales trend (last 7 days)
 *   GET    /top-items               Top-selling items (last 30 days)
 *   GET    /orders                  List POS orders (raw)
 *   POST   /orders                  Create POS order
 *   GET    /orders/:id              Get POS order detail
 *   PUT    /orders/:id/status       Update POS order status
 *   POST   /orders/:id/cancel       Cancel POS order
 *   GET    /stats                   POS statistics (30-day)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from "../lib/errors.js";

// ─── Schemas ────────────────────────────────────────────────────

const posProviderEnum = z.enum([
  "SHOPIFY_POS",
  "SQUARE",
  "TOAST",
  "LIGHTSPEED",
  "CLOVER",
  "CUSTOM",
]);

const orderStatusEnum = z.enum([
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "PICKED_UP",
  "COMPLETED",
  "CANCELLED",
]);

// PosConfig model: id, shopId, terminalId, provider, apiKey, enabled, settings Json, organizationId
const createPosConfigSchema = z.object({
  name: z.string().min(1).max(100),                       // stored in settings.name
  provider: posProviderEnum.default("CUSTOM"),             // maps to model.provider
  apiKey: z.string().optional(),
  terminalId: z.string().optional(),                       // physical terminal identifier
  locationId: z.string().optional(),                       // Location model FK (for map)
  enabled: z.boolean().default(true),
  syncOrders: z.boolean().default(true),
  syncInventory: z.boolean().default(false),
  autoCreateOrders: z.boolean().default(true),
});

const updatePosConfigSchema = createPosConfigSchema.partial();

// PosOrder model: id, shopId, posConfigId, externalId, customerName, customerPhone,
//                 items Json, total Float, status, deliveryType, address Json, notes,
//                 scheduledAt, completedAt, createdAt, updatedAt
const createPosOrderSchema = z.object({
  externalId: z.string().min(1),                           // maps to model.externalId
  posConfigId: z.string(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        sku: z.string().optional(),
        quantity: z.number().int().positive(),
        price: z.number().nonnegative(),
        category: z.string().optional(),
      }),
    )
    .min(1),
  total: z.number().nonnegative(),                         // maps to model.total
  deliveryType: z
    .enum(["LOCAL_DELIVERY", "IN_STORE_PICKUP", "CURBSIDE"])
    .default("IN_STORE_PICKUP"),
  address: z
    .object({
      line1: z.string().optional(),
      city: z.string().optional(),
      province: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
      paymentMethod: z.string().optional(),                // stash payment method here
      tax: z.number().optional(),
      subtotal: z.number().optional(),
    })
    .optional(),
  notes: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
});

const updatePosOrderStatusSchema = z.object({
  status: orderStatusEnum,
  notes: z.string().optional(),
});

const listPosOrdersQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: orderStatusEnum.optional(),
  posConfigId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// ─── Helpers ────────────────────────────────────────────────────

function configsToMap(configs: any[]): Map<string, any> {
  const m = new Map<string, any>();
  for (const c of configs) m.set(c.id, c);
  return m;
}

function orderToTransaction(order: any, configName: string) {
  const addr = (order.address ?? {}) as any;
  const paymentMethod = addr.paymentMethod || "other";
  const items = (order.items ?? []) as any[];
  const statusMap: Record<string, string> = {
    COMPLETED: "completed",
    PICKED_UP: "completed",
    CANCELLED: "cancelled",
    PENDING: "pending",
    CONFIRMED: "pending",
    PREPARING: "pending",
    READY: "pending",
  };
  return {
    id: order.id,
    transactionId: order.externalId || order.id,
    terminalId: order.posConfigId,
    terminalName: configName,
    timestamp: order.createdAt,
    status: statusMap[order.status] ?? "pending",
    paymentMethod,
    amount: Number(order.total),
    tax: Number(addr.tax ?? 0),
    discount: 0,
    subtotal: Number(addr.subtotal ?? order.total),
    items: items.map((item: any, i: number) => ({
      id: `${order.id}-item-${i}`,
      name: item.name,
      sku: item.sku ?? "",
      quantity: Number(item.quantity),
      unitPrice: Number(item.price),
      totalPrice: Number(item.price) * Number(item.quantity),
      category: item.category ?? "",
    })),
    customerName: order.customerName ?? null,
    customerEmail: null,
    receiptNumber: order.externalId ?? order.id,
    notes: order.notes ?? null,
    refundedAmount: order.status === "CANCELLED" ? Number(order.total) : null,
    refundReason:
      order.status === "CANCELLED" && order.notes?.startsWith("Refunded:")
        ? order.notes.replace("Refunded: ", "")
        : null,
  };
}

// ─── Route Plugin ────────────────────────────────────────────────

async function posRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET /configs ─────────────────────────────────────────────────

  fastify.get("/configs", async (request: FastifyRequest) => {
    const configs = await (request.tenantDb as any).posConfig.findMany({
      where: { shopId: request.shopId },
      orderBy: { createdAt: "desc" },
    });

    // Count orders per config separately (no Prisma relation defined)
    const orderCounts = await (request.tenantDb as any).posOrder.groupBy({
      by: ["posConfigId"],
      where: { shopId: request.shopId },
      _count: true,
    });
    const countMap = new Map<string, number>(
      orderCounts.map((r: any) => [r.posConfigId, r._count]),
    );

    return {
      data: configs.map((cfg: any) => ({
        id: cfg.id,
        name: (cfg.settings as any)?.name ?? cfg.provider,
        provider: cfg.provider,
        terminalId: cfg.terminalId,
        locationId: (cfg.settings as any)?.locationId ?? null,
        enabled: cfg.enabled,
        syncOrders: (cfg.settings as any)?.syncOrders ?? true,
        syncInventory: (cfg.settings as any)?.syncInventory ?? false,
        autoCreateOrders: (cfg.settings as any)?.autoCreateOrders ?? true,
        orderCount: countMap.get(cfg.id) ?? 0,
        createdAt: cfg.createdAt,
        updatedAt: cfg.updatedAt,
      })),
      total: configs.length,
    };
  });

  // ── POST /configs ────────────────────────────────────────────────

  fastify.post("/configs", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);
    const body = createPosConfigSchema.parse(request.body);

    const existing = await (request.tenantDb as any).posConfig.findFirst({
      where: { shopId: request.shopId, terminalId: body.terminalId ?? null },
    });
    if (existing && body.terminalId) {
      throw new ConflictError(`POS config with terminalId '${body.terminalId}' already exists`);
    }

    const config = await (request.tenantDb as any).posConfig.create({
      data: {
        shopId: request.shopId,
        provider: body.provider,
        apiKey: body.apiKey,
        terminalId: body.terminalId,
        enabled: body.enabled,
        settings: {
          name: body.name,
          locationId: body.locationId,
          syncOrders: body.syncOrders,
          syncInventory: body.syncInventory,
          autoCreateOrders: body.autoCreateOrders,
        },
      },
    });

    reply.status(201);
    return { data: config };
  });

  // ── PUT /configs/:id ─────────────────────────────────────────────

  fastify.put("/configs/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);
    const { id } = request.params as { id: string };
    const body = updatePosConfigSchema.parse(request.body);

    const config = await (request.tenantDb as any).posConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundError("POS configuration", id);
    if (config.shopId !== request.shopId) throw new ForbiddenError("Cannot update config from another shop");

    const existing = (config.settings ?? {}) as any;
    const updated = await (request.tenantDb as any).posConfig.update({
      where: { id },
      data: {
        provider: body.provider ?? config.provider,
        apiKey: body.apiKey ?? config.apiKey,
        terminalId: body.terminalId ?? config.terminalId,
        enabled: body.enabled ?? config.enabled,
        settings: {
          ...existing,
          ...(body.name !== undefined && { name: body.name }),
          ...(body.locationId !== undefined && { locationId: body.locationId }),
          ...(body.syncOrders !== undefined && { syncOrders: body.syncOrders }),
          ...(body.syncInventory !== undefined && { syncInventory: body.syncInventory }),
          ...(body.autoCreateOrders !== undefined && { autoCreateOrders: body.autoCreateOrders }),
        },
      },
    });

    return { data: updated };
  });

  // ── DELETE /configs/:id ──────────────────────────────────────────

  fastify.delete("/configs/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);
    const { id } = request.params as { id: string };

    const config = await (request.tenantDb as any).posConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundError("POS configuration", id);
    if (config.shopId !== request.shopId) throw new ForbiddenError("Cannot delete config from another shop");

    await (request.tenantDb as any).posConfig.delete({ where: { id } });
    reply.status(204);
    return;
  });

  // ── GET /overview ─────────────────────────────────────────────────

  fastify.get("/overview", async (request: FastifyRequest) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayCount, todayRevResult, allTodayOrders] = await Promise.all([
      (request.tenantDb as any).posOrder.count({
        where: { shopId: request.shopId, status: "COMPLETED", createdAt: { gte: today } },
      }),
      (request.tenantDb as any).posOrder.aggregate({
        where: { shopId: request.shopId, status: "COMPLETED", createdAt: { gte: today } },
        _sum: { total: true },
      }),
      (request.tenantDb as any).posOrder.findMany({
        where: { shopId: request.shopId, status: "COMPLETED", createdAt: { gte: today } },
        select: { total: true, address: true },
      }),
    ]);

    const todaysSales = Number(todayRevResult._sum.total ?? 0);
    const transactionCount = todayCount as number;
    const avgTicket = transactionCount > 0 ? todaysSales / transactionCount : 0;

    const breakdown = { cash: 0, card: 0, mobile: 0, other: 0 };
    for (const o of allTodayOrders) {
      const method = ((o.address as any)?.paymentMethod ?? "other") as string;
      const amt = Number(o.total);
      if (method === "cash") breakdown.cash += amt;
      else if (method === "card") breakdown.card += amt;
      else if (method === "mobile") breakdown.mobile += amt;
      else breakdown.other += amt;
    }

    return { data: { todaysSales, transactionCount, avgTicket, paymentBreakdown: breakdown } };
  });

  // ── GET /terminals ────────────────────────────────────────────────

  fastify.get("/terminals", async (request: FastifyRequest) => {
    const configs = await (request.tenantDb as any).posConfig.findMany({
      where: { shopId: request.shopId },
    });

    const orderCounts = await (request.tenantDb as any).posOrder.groupBy({
      by: ["posConfigId"],
      where: { shopId: request.shopId },
      _count: true,
    });
    const countMap = new Map<string, number>(
      orderCounts.map((r: any) => [r.posConfigId, r._count]),
    );

    const revenueAgg = await (request.tenantDb as any).posOrder.groupBy({
      by: ["posConfigId"],
      where: { shopId: request.shopId, status: "COMPLETED" },
      _sum: { total: true },
    });
    const revenueMap = new Map<string, number>(
      revenueAgg.map((r: any) => [r.posConfigId, Number(r._sum.total ?? 0)]),
    );

    const terminals = configs.map((cfg: any) => ({
      id: cfg.id,
      name: (cfg.settings as any)?.name ?? cfg.provider,
      location: cfg.terminalId ?? cfg.provider,
      status: cfg.enabled ? "online" : "offline",
      lastActivity: cfg.updatedAt,
      totalTransactions: countMap.get(cfg.id) ?? 0,
      totalSales: revenueMap.get(cfg.id) ?? 0,
      operatingHours: null,
      currentShift: null,
    }));

    return { data: terminals };
  });

  // ── GET /terminal-locations ───────────────────────────────────────
  // Join PosConfig with Location model to get lat/lng for map view

  fastify.get("/terminal-locations", async (request: FastifyRequest) => {
    const configs = await (request.tenantDb as any).posConfig.findMany({
      where: { shopId: request.shopId, enabled: true },
    });

    const locationIds = configs
      .map((c: any) => (c.settings as any)?.locationId)
      .filter(Boolean) as string[];

    let locationMap = new Map<string, any>();
    if (locationIds.length > 0) {
      const locations = await (request.tenantDb as any).location.findMany({
        where: { id: { in: locationIds }, shopId: request.shopId },
        select: { id: true, name: true, city: true, addressLine1: true, coordinates: true },
      });
      locationMap = new Map(locations.map((l: any) => [l.id, l]));
    }

    const result = configs
      .map((cfg: any) => {
        const settings = (cfg.settings ?? {}) as any;
        const loc = settings.locationId ? locationMap.get(settings.locationId) : null;
        const coords = loc?.coordinates as any;
        if (!coords?.lat || !coords?.lng) return null;
        return {
          id: cfg.id,
          name: settings.name ?? cfg.provider,
          provider: cfg.provider,
          lat: coords.lat,
          lng: coords.lng,
          city: loc?.city ?? null,
          address: loc?.addressLine1 ?? null,
          status: cfg.enabled ? "online" : "offline",
        };
      })
      .filter(Boolean);

    return { data: result };
  });

  // ── GET /transactions ─────────────────────────────────────────────

  fastify.get("/transactions", async (request: FastifyRequest) => {
    const query = request.query as {
      page?: string;
      limit?: string;
      status?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
    };
    const page = Math.max(1, parseInt(query.page ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "25")));
    const skip = (page - 1) * limit;

    const where: any = { shopId: request.shopId };
    if (query.status && query.status !== "all") {
      const statusMap: Record<string, string[]> = {
        completed: ["COMPLETED", "PICKED_UP"],
        pending: ["PENDING", "CONFIRMED", "PREPARING", "READY"],
        cancelled: ["CANCELLED"],
        refunded: ["CANCELLED"],
        failed: ["CANCELLED"],
      };
      where.status = { in: statusMap[query.status] ?? [query.status.toUpperCase()] };
    }
    if (query.search) {
      where.OR = [
        { customerName: { contains: query.search, mode: "insensitive" } },
        { externalId: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.startDate) where.createdAt = { gte: new Date(query.startDate) };
    if (query.endDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(query.endDate) };
    }

    const [orders, total] = await Promise.all([
      (request.tenantDb as any).posOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          externalId: true,
          posConfigId: true,
          customerName: true,
          customerPhone: true,
          items: true,
          total: true,
          status: true,
          address: true,
          notes: true,
          createdAt: true,
        },
      }),
      (request.tenantDb as any).posOrder.count({ where }),
    ]);

    // Fetch terminal names in one query
    const configIds = [...new Set(orders.map((o: any) => o.posConfigId))] as string[];
    const configs =
      configIds.length > 0
        ? await (request.tenantDb as any).posConfig.findMany({
            where: { id: { in: configIds } },
            select: { id: true, settings: true, provider: true },
          })
        : [];
    const cfgMap = configsToMap(configs);

    const transactions = orders.map((order: any) => {
      const cfg = cfgMap.get(order.posConfigId);
      const terminalName = (cfg?.settings as any)?.name ?? cfg?.provider ?? "Unknown Terminal";
      return orderToTransaction(order, terminalName);
    });

    return {
      data: transactions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── POST /transactions/:id/refund ─────────────────────────────────

  fastify.post("/transactions/:id/refund", async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    const body = request.body as { reason?: string; amount?: number };

    const order = await (request.tenantDb as any).posOrder.findFirst({
      where: { id, shopId: request.shopId },
    });
    if (!order) throw new NotFoundError("Transaction", id);

    const updated = await (request.tenantDb as any).posOrder.update({
      where: { id },
      data: {
        status: "CANCELLED",
        notes: body.reason ? `Refunded: ${body.reason}` : "Refunded",
      },
    });

    return { data: updated };
  });

  // ── GET /sales-trends ─────────────────────────────────────────────

  fastify.get("/sales-trends", async (request: FastifyRequest) => {
    const days = 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const orders = await (request.tenantDb as any).posOrder.findMany({
      where: { shopId: request.shopId, status: "COMPLETED", createdAt: { gte: since } },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: "asc" },
    });

    const byDay: Record<string, { amount: number; count: number }> = {};
    for (const o of orders) {
      const day = new Date(o.createdAt).toISOString().split("T")[0];
      if (!byDay[day]) byDay[day] = { amount: 0, count: 0 };
      byDay[day].amount += Number(o.total);
      byDay[day].count += 1;
    }

    const trends = Object.entries(byDay).map(([date, v]) => ({
      date,
      daily: v.amount,
      weekly: v.amount,
      monthly: v.amount,
      transactions: v.count,
    }));

    return { data: trends };
  });

  // ── GET /top-items ────────────────────────────────────────────────

  fastify.get("/top-items", async (request: FastifyRequest) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const orders = await (request.tenantDb as any).posOrder.findMany({
      where: { shopId: request.shopId, status: "COMPLETED", createdAt: { gte: thirtyDaysAgo } },
      select: { items: true },
    });

    const itemMap: Record<string, { name: string; sku: string; units: number; revenue: number }> = {};
    for (const order of orders) {
      const items = (order.items as any[]) ?? [];
      for (const item of items) {
        const key = item.sku || item.name;
        if (!itemMap[key]) {
          itemMap[key] = { name: item.name, sku: item.sku ?? "", units: 0, revenue: 0 };
        }
        itemMap[key].units += Number(item.quantity);
        itemMap[key].revenue += Number(item.price) * Number(item.quantity);
      }
    }

    const topItems = Object.entries(itemMap)
      .map(([key, v]) => ({
        id: key,
        name: v.name,
        sku: v.sku,
        unitsSold: v.units,
        revenue: v.revenue,
        category: "",
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20);

    return { data: topItems };
  });

  // ── GET /orders ───────────────────────────────────────────────────

  fastify.get("/orders", async (request: FastifyRequest) => {
    const query = listPosOrdersQuery.parse(request.query);
    const { page, limit, status, posConfigId, startDate, endDate } = query;

    const where: any = { shopId: request.shopId };
    if (status) where.status = status;
    if (posConfigId) where.posConfigId = posConfigId;
    if (startDate) where.createdAt = { gte: new Date(startDate) };
    if (endDate) {
      where.createdAt = { ...(where.createdAt ?? {}), lte: new Date(endDate) };
    }

    const [orders, total] = await Promise.all([
      (request.tenantDb as any).posOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (request.tenantDb as any).posOrder.count({ where }),
    ]);

    return {
      data: orders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── POST /orders ──────────────────────────────────────────────────

  fastify.post("/orders", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createPosOrderSchema.parse(request.body);

    const config = await (request.tenantDb as any).posConfig.findFirst({
      where: { id: body.posConfigId, shopId: request.shopId },
    });
    if (!config) throw new NotFoundError("POS configuration", body.posConfigId);

    if (body.externalId) {
      const existing = await (request.tenantDb as any).posOrder.findFirst({
        where: { shopId: request.shopId, posConfigId: body.posConfigId, externalId: body.externalId },
      });
      if (existing) throw new ConflictError(`POS order with externalId '${body.externalId}' already exists`);
    }

    const order = await (request.tenantDb as any).posOrder.create({
      data: {
        shopId: request.shopId,
        posConfigId: body.posConfigId,
        externalId: body.externalId,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        items: body.items,                          // Json field — store array directly
        total: body.total,
        status: "PENDING",
        deliveryType: body.deliveryType,
        address: body.address ?? null,
        notes: body.notes,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      },
    });

    fastify.log.info({ shopId: request.shopId, orderId: order.id }, "POS order created");
    reply.status(201);
    return { data: order };
  });

  // ── GET /orders/:id ───────────────────────────────────────────────

  fastify.get("/orders/:id", async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };

    const order = await (request.tenantDb as any).posOrder.findFirst({
      where: { id, shopId: request.shopId },
    });
    if (!order) throw new NotFoundError("POS order", id);

    const config = await (request.tenantDb as any).posConfig.findUnique({
      where: { id: order.posConfigId },
      select: { id: true, provider: true, settings: true },
    });

    return { data: { ...order, posConfig: config } };
  });

  // ── PUT /orders/:id/status ────────────────────────────────────────

  fastify.put("/orders/:id/status", async (request: FastifyRequest) => {
    await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, fastify as any);

    const { id } = request.params as { id: string };
    const body = updatePosOrderStatusSchema.parse(request.body);

    const order = await (request.tenantDb as any).posOrder.findFirst({
      where: { id, shopId: request.shopId },
    });
    if (!order) throw new NotFoundError("POS order", id);

    const validTransitions: Record<string, string[]> = {
      PENDING: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["PREPARING", "CANCELLED"],
      PREPARING: ["READY", "CANCELLED"],
      READY: ["PICKED_UP", "CANCELLED"],
      PICKED_UP: ["COMPLETED"],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!validTransitions[order.status]?.includes(body.status)) {
      throw new ValidationError(`Cannot transition from ${order.status} to ${body.status}`);
    }

    const updated = await (request.tenantDb as any).posOrder.update({
      where: { id },
      data: {
        status: body.status,
        notes: body.notes ?? order.notes,
        completedAt: body.status === "COMPLETED" ? new Date() : order.completedAt,
      },
    });

    return { data: updated };
  });

  // ── POST /orders/:id/cancel ───────────────────────────────────────

  fastify.post("/orders/:id/cancel", async (request: FastifyRequest) => {
    await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, fastify as any);

    const { id } = request.params as { id: string };
    const { reason } = (request.body ?? {}) as { reason?: string };

    const order = await (request.tenantDb as any).posOrder.findFirst({
      where: { id, shopId: request.shopId },
    });
    if (!order) throw new NotFoundError("POS order", id);
    if (order.status === "COMPLETED") throw new ValidationError("Cannot cancel a completed order");
    if (order.status === "CANCELLED") throw new ValidationError("Order is already cancelled");

    const cancelled = await (request.tenantDb as any).posOrder.update({
      where: { id },
      data: { status: "CANCELLED", notes: reason ? `Cancelled: ${reason}` : order.notes },
    });

    return { data: cancelled };
  });

  // ── GET /stats ────────────────────────────────────────────────────

  fastify.get("/stats", async (request: FastifyRequest) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalOrders, completedOrders, cancelledOrders, revenue, ordersByStatus] =
      await Promise.all([
        (request.tenantDb as any).posOrder.count({
          where: { shopId: request.shopId, createdAt: { gte: thirtyDaysAgo } },
        }),
        (request.tenantDb as any).posOrder.count({
          where: { shopId: request.shopId, status: "COMPLETED", createdAt: { gte: thirtyDaysAgo } },
        }),
        (request.tenantDb as any).posOrder.count({
          where: { shopId: request.shopId, status: "CANCELLED", createdAt: { gte: thirtyDaysAgo } },
        }),
        (request.tenantDb as any).posOrder.aggregate({
          where: { shopId: request.shopId, status: "COMPLETED", createdAt: { gte: thirtyDaysAgo } },
          _sum: { total: true },
        }),
        (request.tenantDb as any).posOrder.groupBy({
          by: ["status"],
          where: { shopId: request.shopId, createdAt: { gte: thirtyDaysAgo } },
          _count: true,
        }),
      ]);

    const successRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

    return {
      data: {
        period: "30days",
        totalOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue: Number(revenue._sum.total ?? 0),
        successRate,
        ordersByStatus: ordersByStatus.reduce((acc: any, item: any) => {
          acc[item.status] = item._count;
          return acc;
        }, {}),
      },
    };
  });
}

export default posRoutes;
