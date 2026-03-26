/**
 * POS Integration — point of sale system configuration and order management.
 *
 * Routes:
 *   GET    /configs                 List POS configurations
 *   POST   /configs                 Create POS config
 *   PUT    /configs/:id             Update POS config
 *   DELETE /configs/:id             Delete POS config
 *   GET    /orders                  List POS orders (with filters)
 *   POST   /orders                  Create POS order
 *   GET    /orders/:id              Get POS order detail
 *   PUT    /orders/:id/status       Update POS order status
 *   POST   /orders/:id/cancel       Cancel POS order
 *   GET    /stats                   Get POS statistics
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

const posSystemEnum = z.enum([
  "SHOPIFY",
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

const createPosConfigSchema = z.object({
  name: z.string().min(1).max(100),
  posSystem: posSystemEnum,
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1).optional(),
  webhookUrl: z.string().url().optional(),
  locationId: z.string().min(1).optional(),
  enabled: z.boolean().default(true),
  syncOrders: z.boolean().default(true),
  syncInventory: z.boolean().default(false),
  autoCreateOrders: z.boolean().default(true),
  orderPrefix: z.string().max(10).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const updatePosConfigSchema = createPosConfigSchema.partial();

const createPosOrderSchema = z.object({
  posOrderId: z.string().min(1),
  posConfigId: z.string().uuid(),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        sku: z.string().optional(),
        quantity: z.number().int().positive(),
        price: z.number().nonnegative(),
        notes: z.string().optional(),
      }),
    )
    .min(1),
  totalAmount: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative().default(0),
  fees: z.number().nonnegative().default(0),
  deliveryAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  orderType: z.enum(["PICKUP", "DELIVERY", "DINE_IN"]).default("PICKUP"),
  prepTime: z.number().int().nonnegative().optional(), // minutes
  notes: z.string().optional(),
});

const updatePosOrderStatusSchema = z.object({
  status: orderStatusEnum,
  notes: z.string().optional(),
  readyTime: z.string().datetime().optional(),
});

const listPosOrdersQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: orderStatusEnum.optional(),
  posConfigId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// ─── Route Plugin ────────────────────────────────────────────────

async function posRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET /configs (List configurations) ──────────────────────────

  fastify.get("/configs", async (request: FastifyRequest, reply: FastifyReply) => {
    const configs = await (request.tenantDb as any).posConfig.findMany({
      where: { shopId: request.shopId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        posSystem: true,
        enabled: true,
        locationId: true,
        syncOrders: true,
        syncInventory: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { orders: true },
        },
      },
    });

    return {
      data: configs,
      total: configs.length,
    };
  });

  // ── POST /configs (Create configuration) ────────────────────────

  fastify.post("/configs", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const body = createPosConfigSchema.parse(request.body);

    // Check if config with same name exists
    const existing = await (request.tenantDb as any).posConfig.findFirst({
      where: {
        shopId: request.shopId,
        name: body.name,
      },
    });

    if (existing) {
      throw new ConflictError(
        `POS configuration with name '${body.name}' already exists`,
      );
    }

    const config = await (request.tenantDb as any).posConfig.create({
      data: {
        shopId: request.shopId,
        ...body,
      },
    });

    fastify.log.info(
      {
        shopId: request.shopId,
        configId: config.id,
        posSystem: body.posSystem,
      },
      "POS configuration created",
    );

    reply.status(201);
    return { data: config };
  });

  // ── PUT /configs/:id (Update configuration) ────────────────────

  fastify.put(
    "/configs/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const { id } = request.params as { id: string };
      const body = updatePosConfigSchema.parse(request.body);

      const config = await (request.tenantDb as any).posConfig.findUnique({
        where: { id },
      });

      if (!config) {
        throw new NotFoundError("POS configuration", id);
      }

      if (config.shopId !== request.shopId) {
        throw new ForbiddenError(
          "Cannot update POS configuration from another shop",
        );
      }

      const updated = await (request.tenantDb as any).posConfig.update({
        where: { id },
        data: body,
      });

      fastify.log.info(
        { shopId: request.shopId, configId: id },
        "POS configuration updated",
      );

      return { data: updated };
    },
  );

  // ── DELETE /configs/:id (Delete configuration) ──────────────────

  fastify.delete(
    "/configs/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const { id } = request.params as { id: string };

      const config = await (request.tenantDb as any).posConfig.findUnique({
        where: { id },
      });

      if (!config) {
        throw new NotFoundError("POS configuration", id);
      }

      if (config.shopId !== request.shopId) {
        throw new ForbiddenError(
          "Cannot delete POS configuration from another shop",
        );
      }

      // Delete associated orders first
      await (request.tenantDb as any).posOrder.deleteMany({
        where: { posConfigId: id },
      });

      const deleted = await (request.tenantDb as any).posConfig.delete({
        where: { id },
      });

      fastify.log.info(
        { shopId: request.shopId, configId: id },
        "POS configuration deleted",
      );

      reply.status(204);
      return;
    },
  );

  // ── GET /orders (List POS orders) ───────────────────────────────

  fastify.get("/orders", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listPosOrdersQuery.parse(request.query);
    const { page, limit, status, posConfigId, startDate, endDate } = query;

    const where: any = {
      posConfig: { shopId: request.shopId },
    };

    if (status) where.status = status;
    if (posConfigId) where.posConfigId = posConfigId;
    if (startDate) {
      where.createdAt = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.createdAt = where.createdAt || {};
      (where.createdAt as any).lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      (request.tenantDb as any).posOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          posConfig: { select: { id: true, name: true, posSystem: true } },
        },
      }),
      (request.tenantDb as any).posOrder.count({ where }),
    ]);

    return {
      data: orders,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── POST /orders (Create POS order) ─────────────────────────────

  fastify.post("/orders", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createPosOrderSchema.parse(request.body);
    const { posConfigId, posOrderId, items, ...orderData } = body;

    const config = await (request.tenantDb as any).posConfig.findUnique({
      where: { id: posConfigId },
    });

    if (!config) {
      throw new NotFoundError("POS configuration", posConfigId);
    }

    if (config.shopId !== request.shopId) {
      throw new ForbiddenError(
        "Cannot create order for POS config from another shop",
      );
    }

    // Check if order already exists
    const existing = await (request.tenantDb as any).posOrder.findFirst({
      where: {
        posConfigId,
        posOrderId,
      },
    });

    if (existing) {
      throw new ConflictError(
        `POS order with ID '${posOrderId}' already exists`,
      );
    }

    const order = await (request.tenantDb as any).posOrder.create({
      data: {
        posConfigId,
        posOrderId,
        status: "PENDING",
        ...orderData,
        items: {
          create: items,
        },
      },
      include: { items: true },
    });

    fastify.log.info(
      {
        shopId: request.shopId,
        orderId: order.id,
        posOrderId,
      },
      "POS order created",
    );

    reply.status(201);
    return { data: order };
  });

  // ── GET /orders/:id (Get POS order detail) ──────────────────────

  fastify.get("/orders/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const order = await (request.tenantDb as any).posOrder.findUnique({
      where: { id },
      include: {
        posConfig: { select: { id: true, name: true, posSystem: true } },
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundError("POS order", id);
    }

    if (order.posConfig.shopId !== request.shopId) {
      throw new ForbiddenError("Cannot access POS order from another shop");
    }

    return { data: order };
  });

  // ── PUT /orders/:id/status (Update order status) ─────────────────

  fastify.put(
    "/orders/:id/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, reply);

      const { id } = request.params as { id: string };
      const body = updatePosOrderStatusSchema.parse(request.body);

      const order = await (request.tenantDb as any).posOrder.findUnique({
        where: { id },
        include: { posConfig: true },
      });

      if (!order) {
        throw new NotFoundError("POS order", id);
      }

      if (order.posConfig.shopId !== request.shopId) {
        throw new ForbiddenError(
          "Cannot update POS order from another shop",
        );
      }

      // Validate status transition
      const validTransitions: Record<string, string[]> = {
        PENDING: ["CONFIRMED", "CANCELLED"],
        CONFIRMED: ["PREPARING", "CANCELLED"],
        PREPARING: ["READY", "CANCELLED"],
        READY: ["PICKED_UP", "CANCELLED"],
        PICKED_UP: ["COMPLETED"],
        COMPLETED: [],
        CANCELLED: [],
      };

      if (!validTransitions[order.status].includes(body.status)) {
        throw new ValidationError(
          `Cannot transition from ${order.status} to ${body.status}`,
        );
      }

      const updated = await (request.tenantDb as any).posOrder.update({
        where: { id },
        data: {
          status: body.status,
          notes: body.notes,
          readyTime: body.readyTime ? new Date(body.readyTime) : undefined,
          updatedAt: new Date(),
        },
      });

      fastify.log.info(
        {
          shopId: request.shopId,
          orderId: id,
          newStatus: body.status,
        },
        "POS order status updated",
      );

      return { data: updated };
    },
  );

  // ── POST /orders/:id/cancel (Cancel order) ──────────────────────

  fastify.post(
    "/orders/:id/cancel",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, reply);

      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason?: string };

      const order = await (request.tenantDb as any).posOrder.findUnique({
        where: { id },
        include: { posConfig: true },
      });

      if (!order) {
        throw new NotFoundError("POS order", id);
      }

      if (order.posConfig.shopId !== request.shopId) {
        throw new ForbiddenError(
          "Cannot cancel POS order from another shop",
        );
      }

      if (order.status === "COMPLETED") {
        throw new ValidationError(
          "Cannot cancel a completed order",
        );
      }

      if (order.status === "CANCELLED") {
        throw new ValidationError(
          "Order is already cancelled",
        );
      }

      const cancelled = await (request.tenantDb as any).posOrder.update({
        where: { id },
        data: {
          status: "CANCELLED",
          notes: reason ? `Cancelled: ${reason}` : order.notes,
          updatedAt: new Date(),
        },
      });

      fastify.log.info(
        {
          shopId: request.shopId,
          orderId: id,
          reason,
        },
        "POS order cancelled",
      );

      return { data: cancelled };
    },
  );

  // ── GET /stats (POS statistics) ─────────────────────────────────

  fastify.get("/stats", async (request: FastifyRequest, reply: FastifyReply) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalOrders, completedOrders, cancelledOrders, revenue, ordersByStatus] =
      await Promise.all([
        (request.tenantDb as any).posOrder.count({
          where: {
            posConfig: { shopId: request.shopId },
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        (request.tenantDb as any).posOrder.count({
          where: {
            posConfig: { shopId: request.shopId },
            status: "COMPLETED",
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        (request.tenantDb as any).posOrder.count({
          where: {
            posConfig: { shopId: request.shopId },
            status: "CANCELLED",
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        (request.tenantDb as any).posOrder.aggregate({
          where: {
            posConfig: { shopId: request.shopId },
            status: "COMPLETED",
            createdAt: { gte: thirtyDaysAgo },
          },
          _sum: {
            totalAmount: true,
          },
        }),
        (request.tenantDb as any).posOrder.groupBy({
          by: ["status"],
          where: {
            posConfig: { shopId: request.shopId },
            createdAt: { gte: thirtyDaysAgo },
          },
          _count: true,
        }),
      ]);

    const successRate =
      totalOrders > 0
        ? Math.round((completedOrders / totalOrders) * 100)
        : 0;

    return {
      data: {
        period: "30days",
        totalOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue: revenue._sum.totalAmount || 0,
        successRate,
        ordersByStatus: ordersByStatus.reduce(
          (acc: any, item: any) => {
            acc[item.status] = item._count;
            return acc;
          },
          {},
        ),
      },
    };
  });
}

export default posRoutes;
