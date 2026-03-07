/**
 * Drivers CRUD + spatial operations.
 *
 * Routes:
 *   GET    /              List drivers (paginated, filterable by status)
 *   GET    /:id           Get single driver with current orders
 *   POST   /              Create driver
 *   PATCH  /:id           Update driver profile
 *   PATCH  /:id/status    Update driver availability status
 *   POST   /:id/location  Update driver GPS location (from mobile app)
 *   GET    /nearby        Find nearby available drivers (PostGIS + Redis GEO)
 *   DELETE /:id           Deactivate driver (soft delete)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Prisma } from "@prisma/client";
import {
  createDriverSchema,
  updateDriverLocationSchema,
  paginationSchema,
} from "@witylogix/validators";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { updateDriverGeo, findNearbyDriversGeo, removeDriverGeo } from "../lib/redis.js";

// ─── Query Schemas ──────────────────────────────────────────

const listDriversQuery = paginationSchema.extend({
  status: z.enum(["OFFLINE", "AVAILABLE", "ON_ROUTE", "ON_BREAK"]).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  search: z.string().optional(),
});

const nearbyDriversQuery = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.1).max(100).default(10),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ─── Route Plugin ───────────────────────────────────────────

async function driversRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── LIST DRIVERS ──────────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listDriversQuery.parse(request.query);
    const { page, limit, status, isActive, search } = query;

    const where: Prisma.DriverWhereInput = {};

    if (status) where.status = status;
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    const [drivers, total] = await Promise.all([
      request.tenantDb.driver.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          vehicleType: true,
          vehiclePlate: true,
          maxCapacity: true,
          status: true,
          isActive: true,
          lastLocationAt: true,
          heading: true,
          createdAt: true,
          _count: { select: { orders: { where: { status: { in: ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"] } } } } },
        },
      }),
      request.tenantDb.driver.count({ where }),
    ]);

    return {
      data: drivers,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── GET DRIVER ────────────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const driver = await request.tenantDb.driver.findUnique({
      where: { id },
      include: {
        orders: {
          where: { status: { in: ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED"] } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            shopifyOrderNumber: true,
            status: true,
            customerName: true,
            addressLine1: true,
            city: true,
            estimatedArrival: true,
          },
        },
        routes: {
          where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
          take: 1,
          orderBy: { date: "desc" },
          include: {
            stops: { orderBy: { sequence: "asc" } },
          },
        },
      },
    });

    if (!driver) throw new NotFoundError("Driver", id);
    return { data: driver };
  });

  // ── CREATE DRIVER ─────────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const body = createDriverSchema.parse(request.body);

    const driver = await request.tenantDb.driver.create({
      data: {
        shopId: request.shopId,
        ...body,
      },
    });

    reply.status(201);
    return { data: driver };
  });

  // ── UPDATE DRIVER ─────────────────────────────────────────

  const updateDriverSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(5).max(20).optional(),
    vehicleType: z.enum(["BICYCLE", "MOTORCYCLE", "CAR", "VAN", "TRUCK"]).optional(),
    vehiclePlate: z.string().nullable().optional(),
    maxCapacity: z.number().int().positive().optional(),
    maxWeight: z.number().nonnegative().nullable().optional(),
    fcmToken: z.string().nullable().optional(),
  });

  fastify.patch("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const { id } = request.params as { id: string };
    const body = updateDriverSchema.parse(request.body);

    const existing = await request.tenantDb.driver.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Driver", id);

    const driver = await request.tenantDb.driver.update({
      where: { id },
      data: body,
    });

    return { data: driver };
  });

  // ── UPDATE DRIVER STATUS ──────────────────────────────────

  const driverStatusSchema = z.object({
    status: z.enum(["OFFLINE", "AVAILABLE", "ON_ROUTE", "ON_BREAK"]),
  });

  fastify.patch("/:id/status", async (request: FastifyRequest, reply: FastifyReply) => {
    // Drivers can update their own status, admins can update anyone
    const { id } = request.params as { id: string };
    const { status } = driverStatusSchema.parse(request.body);

    // If caller is a driver, they can only change their own status
    if (request.auth.role === "DRIVER" && request.auth.driverId !== id) {
      throw new ValidationError("Drivers can only update their own status");
    }

    const driver = await request.tenantDb.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundError("Driver", id);

    const updated = await request.tenantDb.driver.update({
      where: { id },
      data: { status },
    });

    // Update Redis GEO tracking
    if (status === "OFFLINE") {
      await removeDriverGeo(id);
    }

    return { data: updated };
  });

  // ── UPDATE DRIVER LOCATION (GPS from mobile) ──────────────

  fastify.post("/:id/location", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const location = updateDriverLocationSchema.parse(request.body);

    // Only the driver themselves or admins can update location
    if (request.auth.role === "DRIVER" && request.auth.driverId !== id) {
      throw new ValidationError("Drivers can only update their own location");
    }

    // Update PostGIS location and Redis GEO in parallel
    await Promise.all([
      // PostGIS (persistent, queryable)
      request.tenantDb.$executeRaw`
        UPDATE drivers
        SET current_location = ST_SetSRID(ST_MakePoint(${location.longitude}, ${location.latitude}), 4326),
            last_location_at = NOW(),
            heading = ${location.heading ?? null}
        WHERE id = ${id}::uuid
      `,
      // Redis GEO (ephemeral, fast proximity search)
      updateDriverGeo(id, location.longitude, location.latitude),
    ]);

    // TODO: Publish to Socket.io for real-time tracking
    // fastify.io.to(`shop:${request.shopId}`).emit('driver:location', { driverId: id, ...location });

    return { status: "ok" };
  });

  // ── FIND NEARBY DRIVERS ───────────────────────────────────

  fastify.get("/nearby", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, reply);

    const query = nearbyDriversQuery.parse(request.query);

    // Fast lookup via Redis GEO
    const nearbyFromRedis = await findNearbyDriversGeo(
      query.longitude,
      query.latitude,
      query.radiusKm,
      query.limit,
    );

    if (nearbyFromRedis.length === 0) {
      return { data: [] };
    }

    // Enrich with driver details from database
    const driverIds = nearbyFromRedis.map((d) => d.driverId);
    const drivers = await request.tenantDb.driver.findMany({
      where: {
        id: { in: driverIds },
        isActive: true,
        status: "AVAILABLE",
      },
      select: {
        id: true,
        name: true,
        phone: true,
        vehicleType: true,
        maxCapacity: true,
        status: true,
        _count: { select: { orders: { where: { status: "ASSIGNED" } } } },
      },
    });

    // Merge with distance info
    const driverMap = new Map(drivers.map((d) => [d.id, d]));
    const results = nearbyFromRedis
      .filter((r) => driverMap.has(r.driverId))
      .map((r) => ({
        ...driverMap.get(r.driverId)!,
        distanceKm: Math.round(r.distance * 100) / 100,
      }));

    return { data: results };
  });

  // ── DEACTIVATE DRIVER ─────────────────────────────────────

  fastify.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const { id } = request.params as { id: string };

    const driver = await request.tenantDb.driver.findUnique({ where: { id } });
    if (!driver) throw new NotFoundError("Driver", id);

    const deactivated = await request.tenantDb.driver.update({
      where: { id },
      data: { isActive: false, status: "OFFLINE" },
    });

    await removeDriverGeo(id);
    return { data: deactivated };
  });
}

export default driversRoutes;
