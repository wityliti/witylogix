/**
 * Shipments CRUD — full lifecycle management.
 *
 * Routes:
 *   GET    /              List shipments (paginated, filterable)
 *   GET    /:id           Get single shipment
 *   POST   /              Create shipment
 *   PATCH  /:id           Update shipment fields
 *   PATCH  /:id/status    Update shipment status (with state machine)
 *   PATCH  /:id/assign    Assign shipment to driver
 *   DELETE /:id           Soft-cancel shipment
 *   GET    /:id/timeline  Get activity logs for this shipment
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@witylogix/db";
import {
  createShipmentSchema,
  updateShipmentStatusSchema,
  paginationSchema,
} from "@witylogix/validators";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError, ValidationError, ConflictError } from "../lib/errors.js";
import {
  emitShipmentCreated,
  emitShipmentStatusChanged,
  emitShipmentAssigned,
} from "../lib/events.js";
import { getNotificationQueue } from "../lib/queue.js";

// ─── Valid Status Transitions ───────────────────────────────

const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT"],
  IN_TRANSIT: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["ARRIVED", "FAILED"],
  ARRIVED: ["DELIVERED", "FAILED"],
  DELIVERED: [],
  FAILED: ["RETURNED", "OUT_FOR_DELIVERY"],
  RETURNED: [],
  CANCELLED: [],
};

// ─── Query Params Schema ────────────────────────────────────

const listShipmentsQuery = paginationSchema.extend({
  status: z.string().optional(),
  driverId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  deliveryDate: z.string().optional(),
  deliveryMethod: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "deliveryDate", "status", "shipmentNumber"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ─── Route Plugin ───────────────────────────────────────────

async function shipmentsRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require auth + tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── LIST SHIPMENTS ──────────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listShipmentsQuery.parse(request.query);
    const {
      page,
      limit,
      status,
      driverId,
      orderId,
      deliveryDate,
      deliveryMethod,
      search,
      sortBy,
      sortOrder,
    } = query;

    const where: Prisma.ShipmentWhereInput = {};

    if (status) {
      where.status = status as any;
    }
    if (driverId) {
      where.driverId = driverId;
    }
    if (orderId) {
      where.orderId = orderId;
    }
    if (deliveryDate) {
      const date = new Date(deliveryDate);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      where.deliveryDate = { gte: date, lt: nextDay };
    }
    if (deliveryMethod) {
      where.deliveryMethod = deliveryMethod as any;
    }
    if (search) {
      where.OR = [
        { shipmentNumber: { contains: search, mode: "insensitive" } },
        { recipientName: { contains: search, mode: "insensitive" } },
        { recipientPhone: { contains: search, mode: "insensitive" } },
        { addressLine1: { contains: search, mode: "insensitive" } },
      ];
    }

    const [shipments, total] = await Promise.all([
      request.tenantDb.shipment.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          order: { select: { id: true, externalOrderNumber: true, customerName: true } },
          driver: { select: { id: true, name: true, phone: true } },
          location: { select: { id: true, name: true, city: true } },
          timeSlot: { select: { id: true, name: true, startTime: true, endTime: true } },
        },
      }),
      request.tenantDb.shipment.count({ where }),
    ]);

    const data = shipments.map((s) => {
      const loc = s.deliveryLocation as { lat?: number; lng?: number } | null;
      return {
        ...s,
        deliveryLat: loc?.lat ?? null,
        deliveryLng: loc?.lng ?? null,
      };
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

  // ── GET SHIPMENT ────────────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const shipment = await request.tenantDb.shipment.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, externalOrderNumber: true, customerName: true } },
        driver: { select: { id: true, name: true, phone: true, vehicleType: true } },
        location: { select: { id: true, name: true, city: true } },
        timeSlot: true,
        proofOfDelivery: true,
        activityLogs: {
          orderBy: { timestamp: "desc" },
          take: 20,
        },
      },
    });

    if (!shipment) {
      throw new NotFoundError("Shipment", id);
    }

    return { data: shipment };
  });

  // ── CREATE SHIPMENT ─────────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, reply);

    const body = createShipmentSchema.parse(request.body);
    const { latitude, longitude, ...shipmentData } = body;

    // Verify order exists
    const order = await request.tenantDb.order.findUnique({
      where: { id: body.orderId },
      select: { id: true, shopId: true },
    });

    if (!order) {
      throw new NotFoundError("Order", body.orderId);
    }

    // Generate shipment number
    const shipmentNumber = `SHP-${Date.now().toString(36).toUpperCase()}`;

    // Build delivery location point if coordinates provided
    let locationSql: Prisma.Sql | undefined;
    if (latitude !== undefined && longitude !== undefined) {
      locationSql = Prisma.sql`ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)`;
    }

    // Create with raw SQL for PostGIS geometry
    const shipment = await request.tenantDb.$transaction(async (tx) => {
      const created = await tx.shipment.create({
        data: {
          shopId: request.shopId,
          shipmentNumber,
          ...shipmentData,
          status: "PENDING",
          deliveryDate: shipmentData.deliveryDate ? new Date(shipmentData.deliveryDate) : undefined,
        },
      });

      // Set PostGIS point if coordinates were provided
      if (locationSql) {
        await tx.$executeRaw`
          UPDATE shipments
          SET delivery_location = ${locationSql}
          WHERE id = ${created.id}::uuid
        `;
      }

      return created;
    });

    // Invalidate shipment list cache
    await request.tenantRedis.invalidateGroup("shipments");

    // Emit real-time event
    emitShipmentCreated({
      id: shipment.id,
      shopId: request.shopId,
      status: shipment.status,
      orderId: shipment.orderId,
      trackingNumber: shipment.shipmentNumber,
      driverId: shipment.driverId || undefined,
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
    });

    // Enqueue notification job for shipment creation
    try {
      const notificationQueue = getNotificationQueue();
      await notificationQueue.add(
        "shipment-created",
        {
          type: "shipment.created",
          tenantId: request.shopId,
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          orderId: shipment.orderId,
          recipientName: shipment.recipientName,
          recipientEmail: shipment.recipientEmail,
          recipientPhone: shipment.recipientPhone,
          channel: "EMAIL",
          deliveryDate: shipment.deliveryDate?.toISOString(),
        },
        {
          jobId: `shipment-created-${shipment.id}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
        },
      );
    } catch (err) {
      request.log.warn(
        { shipmentId: shipment.id, error: err },
        "Failed to enqueue shipment creation notification",
      );
      // Continue anyway - shipment was created successfully
    }

    reply.status(201);
    return { data: shipment };
  });

  // ── UPDATE SHIPMENT ─────────────────────────────────────────

  const updateShipmentSchema = z.object({
    recipientName: z.string().optional(),
    recipientPhone: z.string().optional(),
    recipientEmail: z.string().email().optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    province: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    deliveryDate: z.string().datetime().optional(),
    deliveryMethod: z.enum(["LOCAL_DELIVERY", "STORE_PICKUP", "STANDARD_SHIPPING", "EXPRESS_SHIPPING", "SAME_DAY"]).optional(),
    timeSlotId: z.string().uuid().nullable().optional(),
    weight: z.number().nonnegative().optional(),
    shippingCost: z.number().nonnegative().optional(),
    codAmount: z.number().nonnegative().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
  });

  fastify.patch("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, reply);

    const { id } = request.params as { id: string };
    const body = updateShipmentSchema.parse(request.body);
    const { latitude, longitude, ...updateData } = body;

    const existing = await request.tenantDb.shipment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Shipment", id);
    }

    const shipment = await request.tenantDb.$transaction(async (tx) => {
      const updated = await tx.shipment.update({
        where: { id },
        data: {
          ...updateData,
          deliveryDate: updateData.deliveryDate ? new Date(updateData.deliveryDate) : undefined,
        },
      });

      if (latitude !== undefined && longitude !== undefined) {
        await tx.$executeRaw`
          UPDATE shipments
          SET delivery_location = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
          WHERE id = ${id}::uuid
        `;
      }

      return updated;
    });

    await request.tenantRedis.invalidateGroup("shipments");
    return { data: shipment };
  });

  // ── UPDATE SHIPMENT STATUS ──────────────────────────────────

  fastify.patch("/:id/status", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER", "DRIVER")(request, reply);

    const { id } = request.params as { id: string };
    const { status: newStatus, notes, failureReason } = updateShipmentStatusSchema.parse(request.body);

    const shipment = await request.tenantDb.shipment.findUnique({
      where: { id },
      select: { id: true, status: true, shopId: true },
    });

    if (!shipment) {
      throw new NotFoundError("Shipment", id);
    }

    // Validate status transition
    const allowedNext = STATUS_TRANSITIONS[shipment.status] || [];
    if (!allowedNext.includes(newStatus)) {
      throw new ValidationError(
        `Cannot transition from '${shipment.status}' to '${newStatus}'. Allowed: ${allowedNext.join(", ") || "none"}`,
      );
    }

    const updatePayload: any = { status: newStatus };

    // Set timestamps based on status
    if (newStatus === "PICKED_UP") {
      updatePayload.pickedUpAt = new Date();
    }
    if (newStatus === "DELIVERED") {
      updatePayload.actualDelivery = new Date();
    }
    if (notes) {
      updatePayload.notes = notes;
    }
    if (failureReason && newStatus === "FAILED") {
      updatePayload.failureReason = failureReason;
    }

    const updated = await request.tenantDb.shipment.update({
      where: { id },
      data: updatePayload,
    });

    await request.tenantRedis.invalidateGroup("shipments");

    // Emit real-time event
    emitShipmentStatusChanged({
      id: updated.id,
      shopId: request.shopId,
      status: updated.status,
      orderId: updated.orderId,
      trackingNumber: updated.shipmentNumber,
      driverId: updated.driverId || undefined,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      previousStatus: shipment.status,
      changedAt: new Date().toISOString(),
      reason: failureReason,
    });

    // Enqueue notification job for shipment status change
    try {
      const notificationQueue = getNotificationQueue();
      await notificationQueue.add(
        "shipment-status-changed",
        {
          type: "shipment.status_changed",
          tenantId: request.shopId,
          shipmentId: id,
          shipmentNumber: updated.shipmentNumber,
          orderId: updated.orderId,
          recipientName: updated.recipientName,
          recipientEmail: updated.recipientEmail,
          recipientPhone: updated.recipientPhone,
          previousStatus: shipment.status,
          newStatus: newStatus,
          channel: "EMAIL",
          failureReason: failureReason || undefined,
          notes: notes || undefined,
        },
        {
          jobId: `shipment-status-${id}-${newStatus}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
        },
      );
    } catch (err) {
      request.log.warn(
        { shipmentId: id, status: newStatus, error: err },
        "Failed to enqueue shipment status change notification",
      );
      // Continue anyway - status was updated successfully
    }

    return { data: updated };
  });

  // ── ASSIGN SHIPMENT TO DRIVER ───────────────────────────────

  const assignShipmentSchema = z.object({
    driverId: z.string().uuid(),
  });

  fastify.patch("/:id/assign", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, reply);

    const { id } = request.params as { id: string };
    const { driverId } = assignShipmentSchema.parse(request.body);

    const [shipment, driver] = await Promise.all([
      request.tenantDb.shipment.findUnique({ where: { id } }),
      request.tenantDb.driver.findUnique({ where: { id: driverId } }),
    ]);

    if (!shipment) throw new NotFoundError("Shipment", id);
    if (!driver) throw new NotFoundError("Driver", driverId);
    if (!driver.isActive) throw new ValidationError("Driver is not active");

    const updated = await request.tenantDb.shipment.update({
      where: { id },
      data: {
        driverId,
        status: shipment.status === "READY_FOR_PICKUP" || shipment.status === "PENDING" ? "PROCESSING" : undefined,
      },
    });

    await request.tenantRedis.invalidateGroup("shipments");

    // Emit real-time event
    emitShipmentAssigned({
      id: updated.id,
      shopId: request.shopId,
      status: updated.status,
      orderId: updated.orderId,
      trackingNumber: updated.shipmentNumber,
      driverId,
      driverName: driver.name,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      assignedAt: new Date().toISOString(),
    });

    // Enqueue notification job for driver assignment
    try {
      const notificationQueue = getNotificationQueue();

      // Notify driver
      if (driver.fcmToken) {
        await notificationQueue.add(
          "driver-assignment",
          {
            type: "driver.shipment_assigned",
            tenantId: request.shopId,
            driverId,
            driverName: driver.name,
            fcmToken: driver.fcmToken,
            shipmentId: id,
            shipmentNumber: updated.shipmentNumber,
            orderId: updated.orderId,
            recipientName: updated.recipientName,
            recipientPhone: updated.recipientPhone,
            deliveryAddress: `${updated.addressLine1}${updated.addressLine2 ? ", " + updated.addressLine2 : ""}`,
            city: updated.city,
            channel: "PUSH",
          },
          {
            jobId: `driver-assignment-${id}-${driverId}`,
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
          },
        );
      }
    } catch (err) {
      request.log.warn(
        { shipmentId: id, driverId, error: err },
        "Failed to enqueue driver assignment notification",
      );
      // Continue anyway - assignment was successful
    }

    return { data: updated };
  });

  // ── CANCEL SHIPMENT ─────────────────────────────────────────

  fastify.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const { id } = request.params as { id: string };

    const shipment = await request.tenantDb.shipment.findUnique({ where: { id } });
    if (!shipment) throw new NotFoundError("Shipment", id);

    if (shipment.status === "DELIVERED" || shipment.status === "CANCELLED") {
      throw new ConflictError(`Cannot cancel shipment in '${shipment.status}' status`);
    }

    const cancelled = await request.tenantDb.shipment.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    await request.tenantRedis.invalidateGroup("shipments");
    return { data: cancelled };
  });

  // ── SHIPMENT TIMELINE ───────────────────────────────────────

  fastify.get("/:id/timeline", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const shipment = await request.tenantDb.shipment.findUnique({ where: { id } });
    if (!shipment) throw new NotFoundError("Shipment", id);

    const logs = await request.tenantDb.activityLog.findMany({
      where: { shipmentId: id },
      orderBy: { timestamp: "asc" },
      select: {
        id: true,
        action: true,
        timestamp: true,
        metadata: true,
      },
    });

    return { data: logs };
  });

  // ── DRIVER LOCATION FOR SHIPMENT ────────────────────────────
  // Returns the current driver GPS position for a shipment.
  // The driver.currentLocation column stores { lat, lng } as JSON
  // (PostGIS migration is tracked separately).

  fastify.get("/:id/driver-location", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const shipment = await request.tenantDb.shipment.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        driverId: true,
        driver: {
          select: {
            id: true,
            name: true,
            currentLocation: true,
            lastLocationAt: true,
            heading: true,
          },
        },
      },
    });

    if (!shipment) throw new NotFoundError("Shipment", id);

    if (!shipment.driverId || !shipment.driver) {
      return { data: null };
    }

    const rawLocation = shipment.driver.currentLocation as
      | { lat: number; lng: number }
      | null;

    if (
      !rawLocation ||
      typeof rawLocation.lat !== "number" ||
      typeof rawLocation.lng !== "number"
    ) {
      return { data: null };
    }

    return {
      data: {
        driverId: shipment.driver.id,
        driverName: shipment.driver.name,
        latitude: rawLocation.lat,
        longitude: rawLocation.lng,
        heading: shipment.driver.heading ?? null,
        updatedAt: shipment.driver.lastLocationAt ?? null,
        shipmentStatus: shipment.status,
      },
    };
  });
}

export default shipmentsRoutes;
