/**
 * Orders CRUD — full lifecycle management.
 *
 * Routes:
 *   GET    /              List orders (paginated, filterable)
 *   GET    /:id           Get single order
 *   POST   /              Create order
 *   PATCH  /:id           Update order fields
 *   PATCH  /:id/status    Update order status (with state machine)
 *   PATCH  /:id/assign    Assign order to driver
 *   DELETE /:id           Soft-cancel order
 *   GET    /:id/timeline  Get order status history (via notification logs)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@witylogix/db";
import { ZodError } from "zod";
import {
  createOrderSchema,
  updateOrderStatusSchema,
  paginationSchema,
} from "@witylogix/validators";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError, ValidationError, ConflictError } from "../lib/errors.js";
import {
  emitOrderCreated,
  emitOrderStatusChanged,
} from "../lib/events.js";
import { getNotificationQueue } from "../lib/queue.js";

// ─── Valid Status Transitions ───────────────────────────────

const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["ARRIVED", "FAILED"],
  ARRIVED: ["DELIVERED", "FAILED"],
  DELIVERED: [],
  FAILED: ["RETURNED", "OUT_FOR_DELIVERY"], // retry or return
  RETURNED: [],
  CANCELLED: [],
};

// ─── Query Params Schema ────────────────────────────────────

const listOrdersQuery = paginationSchema.extend({
  status: z.string().optional(),
  driverId: z.string().uuid().optional(),
  deliveryDate: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "deliveryDate", "status", "customerName"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ─── Route Plugin ───────────────────────────────────────────

async function ordersRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require auth + tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── LIST ORDERS ─────────────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = listOrdersQuery.parse(request.query);
      const { page, limit, status, driverId, deliveryDate, search, sortBy, sortOrder } = query;

    const where: Prisma.OrderWhereInput = {};

    if (status) {
      where.status = status as any;
    }
    if (driverId) {
      where.driverId = driverId;
    }
    if (deliveryDate) {
      const date = new Date(deliveryDate);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      where.deliveryDate = { gte: date, lt: nextDay };
    }
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { externalOrderNumber: { contains: search, mode: "insensitive" } },
        { addressLine1: { contains: search, mode: "insensitive" } },
      ];
    }

    const [orders, total] = await Promise.all([
      request.tenantDb.order.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          driver: { select: { id: true, name: true, phone: true } },
          timeSlot: { select: { id: true, name: true, startTime: true, endTime: true } },
          proofOfDelivery: { select: { id: true, photoUrls: true, deliveredAt: true } },
        },
      }),
      request.tenantDb.order.count({ where }),
    ]);

      return {
        data: orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(422).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid query parameters", details: err.errors },
        });
      }
      throw err;
    }
  });

  // ── GET ORDER STATS ─────────────────────────────────────────

  fastify.get("/stats", async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = await request.tenantDb.order.groupBy({
      by: ["status"],
      _count: { id: true },
      where: { shopId: request.shopId },
    });

    const totalOrders = stats.reduce((sum, s) => sum + s._count.id, 0);
    const statusCounts: Record<string, number> = {};
    for (const s of stats) {
      statusCounts[s.status] = s._count.id;
    }

    return reply.send({
      data: {
        total: totalOrders,
        byStatus: statusCounts,
        pending: statusCounts["PENDING"] || 0,
        processing: statusCounts["PROCESSING"] || 0,
        shipped: statusCounts["SHIPPED"] || 0,
        delivered: statusCounts["DELIVERED"] || 0,
        cancelled: statusCounts["CANCELLED"] || 0,
      },
    });
  });

  // ── GET ORDER ───────────────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const order = await request.tenantDb.order.findUnique({
        where: { id },
        include: {
          driver: { select: { id: true, name: true, phone: true, vehicleType: true } },
          timeSlot: true,
          proofOfDelivery: true,
          notificationLogs: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });

      if (!order) {
        throw new NotFoundError("Order", id);
      }

      return { data: order };
    } catch (err) {
      throw err;
    }
  });

  // ── CREATE ORDER ────────────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, reply);

      const body = createOrderSchema.parse(request.body);
    const { latitude, longitude, ...orderData } = body;

    // Generate tracking token
    const trackingToken = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

    // Build delivery location point if coordinates provided
    let locationSql: Prisma.Sql | undefined;
    if (latitude !== undefined && longitude !== undefined) {
      locationSql = Prisma.sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)`;
    }

    // Create with raw SQL for PostGIS geometry
    const order = await request.tenantDb.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          shopId: request.shopId,
          ...orderData,
          deliveryDate: orderData.deliveryDate ? new Date(orderData.deliveryDate) : undefined,
          totalPrice: orderData.totalPrice,
          totalWeight: orderData.totalWeight,
          trackingToken,
        },
      });

      // Set PostGIS point if coordinates were provided
      if (locationSql) {
        await tx.$executeRaw`
          UPDATE orders
          SET delivery_location = ${locationSql}
          WHERE id = ${created.id}::uuid
        `;
      }

      return created;
    });

    // Invalidate order list cache
    await request.tenantRedis.invalidateGroup("orders");

    // Emit real-time event
    emitOrderCreated({
      id: order.id,
      shopId: request.shopId,
      status: order.status,
      orderId: order.externalOrderNumber,
      customerId: (order as any).customerId,
      totalAmount: order.totalPrice,
      createdAt: order.createdAt.toISOString(),
    } as any);

    // Enqueue notification job
    try {
      const notificationQueue = getNotificationQueue();
      await notificationQueue.add(
        "order-created",
        {
          type: "order.created",
          tenantId: request.shopId,
          orderId: order.id,
          orderNumber: order.externalOrderNumber,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          channel: "EMAIL",
          totalPrice: order.totalPrice,
          deliveryDate: order.deliveryDate?.toISOString(),
        },
        {
          jobId: `order-created-${order.id}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
        },
      );
    } catch (err) {
      request.log.warn(
        { orderId: order.id, error: err },
        "Failed to enqueue order creation notification",
      );
      // Continue anyway - order was created successfully
    }

      reply.status(201);
      return { data: order };
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(422).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: err.errors },
        });
      }
      throw err;
    }
  });

  // ── UPDATE ORDER ────────────────────────────────────────────

  const updateOrderSchema = z.object({
    customerName: z.string().optional(),
    customerEmail: z.string().email().optional(),
    customerPhone: z.string().optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    province: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    deliveryDate: z.string().datetime().optional(),
    timeSlotId: z.string().uuid().nullable().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
  });

  fastify.patch("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, reply);

      const { id } = request.params as { id: string };
      const body = updateOrderSchema.parse(request.body);
    const { latitude, longitude, ...updateData } = body;

    const existing = await request.tenantDb.order.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Order", id);
    }

    const order = await request.tenantDb.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: {
          ...updateData,
          deliveryDate: updateData.deliveryDate ? new Date(updateData.deliveryDate) : undefined,
        },
      });

      if (latitude !== undefined && longitude !== undefined) {
        await tx.$executeRaw`
          UPDATE orders
          SET delivery_location = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
          WHERE id = ${id}::uuid
        `;
      }

      return updated;
    });

      await request.tenantRedis.invalidateGroup("orders");
      return { data: order };
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(422).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: err.errors },
        });
      }
      throw err;
    }
  });

  // ── UPDATE ORDER STATUS ─────────────────────────────────────

  fastify.patch("/:id/status", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER", "DRIVER")(request, reply);

      const { id } = request.params as { id: string };
      const { status: newStatus, notes } = updateOrderStatusSchema.parse(request.body);

    const order = await request.tenantDb.order.findUnique({
      where: { id },
      select: { id: true, status: true, shopId: true },
    });

    if (!order) {
      throw new NotFoundError("Order", id);
    }

    // Validate status transition
    const allowedNext = STATUS_TRANSITIONS[order.status] || [];
    if (!allowedNext.includes(newStatus)) {
      throw new ValidationError(
        `Cannot transition from '${order.status}' to '${newStatus}'. Allowed: ${allowedNext.join(", ") || "none"}`,
      );
    }

    const updatePayload: any = { status: newStatus };

    // Set timestamps based on status
    if (newStatus === "DELIVERED") {
      updatePayload.actualDelivery = new Date();
    }
    if (notes) {
      updatePayload.notes = notes;
    }

    const updated = await request.tenantDb.order.update({
      where: { id },
      data: updatePayload,
    });

    await request.tenantRedis.invalidateGroup("orders");

    // Emit real-time event
    emitOrderStatusChanged({
      id: updated.id,
      shopId: request.shopId,
      status: updated.status,
      orderId: updated.externalOrderNumber,
      customerId: (updated as any).customerId,
      totalAmount: updated.totalPrice,
      createdAt: updated.createdAt.toISOString(),
      previousStatus: order.status,
      changedAt: new Date().toISOString(),
    } as any);

    // Enqueue notification job for status change
    try {
      const notificationQueue = getNotificationQueue();
      await notificationQueue.add(
        "order-status-changed",
        {
          type: "order.status_changed",
          tenantId: request.shopId,
          orderId: id,
          orderNumber: updated.externalOrderNumber,
          customerName: updated.customerName,
          customerEmail: updated.customerEmail,
          customerPhone: updated.customerPhone,
          previousStatus: order.status,
          newStatus: newStatus,
          channel: "EMAIL",
          notes: notes || undefined,
        },
        {
          jobId: `order-status-${id}-${newStatus}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
        },
      );
    } catch (err) {
      request.log.warn(
        { orderId: id, status: newStatus, error: err },
        "Failed to enqueue order status change notification",
      );
      // Continue anyway - status was updated successfully
    }

      return { data: updated };
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(422).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: err.errors },
        });
      }
      throw err;
    }
  });

  // ── ASSIGN ORDER TO DRIVER ──────────────────────────────────

  const assignOrderSchema = z.object({
    driverId: z.string().uuid(),
  });

  fastify.patch("/:id/assign", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, reply);

      const { id } = request.params as { id: string };
      const { driverId } = assignOrderSchema.parse(request.body);

    const [order, driver] = await Promise.all([
      request.tenantDb.order.findUnique({ where: { id } }),
      request.tenantDb.driver.findUnique({ where: { id: driverId } }),
    ]);

    if (!order) throw new NotFoundError("Order", id);
    if (!driver) throw new NotFoundError("Driver", driverId);
    if (!driver.isActive) throw new ValidationError("Driver is not active");

    const updated = await request.tenantDb.order.update({
      where: { id },
      data: {
        driverId,
        status: order.status === "ACCEPTED" || order.status === "PENDING" ? "ASSIGNED" : undefined,
      },
    });

    await request.tenantRedis.invalidateGroup("orders");

    // Enqueue notification job for driver assignment
    try {
      const notificationQueue = getNotificationQueue();

      // Notify driver
      if (driver.fcmToken) {
        await notificationQueue.add(
          "driver-assignment",
          {
            type: "driver.order_assigned",
            tenantId: request.shopId,
            driverId,
            driverName: driver.name,
            fcmToken: driver.fcmToken,
            orderId: id,
            orderNumber: updated.externalOrderNumber,
            customerName: updated.customerName,
            customerPhone: updated.customerPhone,
            deliveryAddress: `${updated.addressLine1}${updated.addressLine2 ? ", " + updated.addressLine2 : ""}`,
            city: updated.city,
            channel: "PUSH",
          },
          {
            jobId: `order-driver-assignment-${id}-${driverId}`,
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
          },
        );
      }

      // Notify customer that driver is assigned
      if (updated.customerEmail) {
        await notificationQueue.add(
          "customer-driver-assigned",
          {
            type: "customer.driver_assigned",
            tenantId: request.shopId,
            orderId: id,
            orderNumber: updated.externalOrderNumber,
            customerName: updated.customerName,
            customerEmail: updated.customerEmail,
            customerPhone: updated.customerPhone,
            driverName: driver.name,
            driverPhone: driver.phone,
            estimatedArrival: updated.estimatedArrival?.toISOString(),
            channel: "EMAIL",
          },
          {
            jobId: `customer-driver-assigned-${id}`,
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
          },
        );
      }
    } catch (err) {
      request.log.warn(
        { orderId: id, driverId, error: err },
        "Failed to enqueue driver assignment notification",
      );
      // Continue anyway - assignment was successful
    }

      return { data: updated };
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(422).send({
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: err.errors },
        });
      }
      throw err;
    }
  });

  // ── CANCEL ORDER ────────────────────────────────────────────

  fastify.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const { id } = request.params as { id: string };

      const order = await request.tenantDb.order.findUnique({ where: { id } });
      if (!order) throw new NotFoundError("Order", id);

      if (order.status === "DELIVERED" || order.status === "CANCELLED") {
        throw new ConflictError(`Cannot cancel order in '${order.status}' status`);
      }

      const cancelled = await request.tenantDb.order.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      await request.tenantRedis.invalidateGroup("orders");
      return { data: cancelled };
    } catch (err) {
      throw err;
    }
  });

  // ── ORDER RATING ─────────────────────────────────────────────
  // POST /api/v4/orders/:id/rating
  // Stores customer delivery rating in the order's metadata JSON field.
  // No dedicated table required — metadata holds the rating object.

  const orderRatingSchema = z.object({
    driverRating: z.number().int().min(1).max(5),
    experienceRating: z.number().int().min(1).max(5),
    categories: z.object({
      driver: z.number().int().min(1).max(5),
      timeliness: z.number().int().min(1).max(5),
      condition: z.number().int().min(1).max(5),
    }).optional(),
    feedback: z.string().max(2000).optional(),
    wouldOrderAgain: z.boolean().optional(),
  });

  fastify.post("/:id/rating", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const order = await request.tenantDb.order.findUnique({ where: { id } });
      if (!order) throw new NotFoundError("Order", id);
      if (order.shopId !== request.shopId) throw new NotFoundError("Order", id);

      if (order.status !== "DELIVERED") {
        throw new ValidationError("Rating can only be submitted for delivered orders");
      }

      let body: z.infer<typeof orderRatingSchema>;
      try {
        body = orderRatingSchema.parse(request.body);
      } catch (err) {
        throw new ValidationError(err instanceof Error ? err.message : "Invalid rating data");
      }

      const existingMeta = (order.metadata as Record<string, unknown>) ?? {};
      if (existingMeta.customerRating) {
        // Allow re-rating by overwriting
      }

      const updatedOrder = await request.tenantDb.order.update({
        where: { id },
        data: {
          metadata: {
            ...existingMeta,
            customerRating: {
              ...body,
              ratedAt: new Date().toISOString(),
            },
          },
        },
        select: { id: true, metadata: true },
      });

      return reply.status(201).send({ data: updatedOrder });
    } catch (err) {
      throw err;
    }
  });

  // ── ORDER TIMELINE ──────────────────────────────────────────

  fastify.get("/:id/timeline", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const order = await request.tenantDb.order.findUnique({ where: { id } });
      if (!order) throw new NotFoundError("Order", id);

      const logs = await request.tenantDb.notificationLog.findMany({
        where: { orderId: id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          channel: true,
          eventType: true,
          status: true,
          createdAt: true,
          sentAt: true,
        },
      });

      return { data: logs };
    } catch (err) {
      throw err;
    }
  });
}

export default ordersRoutes;
