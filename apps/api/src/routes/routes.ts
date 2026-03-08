/**
 * Routes & Route Stops — route planning and execution.
 *
 * Routes:
 *   GET    /              List routes (paginated, filterable by date/driver/status)
 *   GET    /:id           Get route with stops and orders
 *   POST   /              Create route (draft)
 *   PATCH  /:id           Update route metadata
 *   PATCH  /:id/status    Update route status
 *   POST   /:id/stops     Add stops to a route
 *   PATCH  /:id/stops/:stopId  Update stop status
 *   POST   /:id/optimize  Trigger route optimization
 *   DELETE /:id           Cancel route
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { paginationSchema, optimizeRouteSchema } from "@witylogix/validators";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { getOptimizationQueue } from "../lib/queue.js";

// ─── Schemas ────────────────────────────────────────────────

const listRoutesQuery = paginationSchema.extend({
  date: z.string().optional(),
  driverId: z.string().uuid().optional(),
  status: z.enum(["DRAFT", "OPTIMIZED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
});

const createRouteSchema = z.object({
  name: z.string().optional(),
  date: z.string(), // YYYY-MM-DD
  driverId: z.string().uuid().optional(),
  startAddress: z.string().optional(),
  orderIds: z.array(z.string().uuid()).optional(),
});

const addStopsSchema = z.object({
  stops: z.array(z.object({
    orderId: z.string().uuid().optional(),
    sequence: z.number().int().nonnegative(),
    stopType: z.enum(["PICKUP", "DELIVERY", "RETURN", "DEPOT"]).default("DELIVERY"),
  })).min(1),
});

const updateStopSchema = z.object({
  status: z.enum(["PENDING", "EN_ROUTE", "ARRIVED", "COMPLETED", "SKIPPED", "FAILED"]),
  notes: z.string().optional(),
});

// ─── Route Plugin ───────────────────────────────────────────

async function routesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── LIST ROUTES ───────────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listRoutesQuery.parse(request.query);
    const { page, limit, date, driverId, status } = query;

    const where: any = {};
    if (status) where.status = status;
    if (driverId) where.driverId = driverId;
    if (date) where.date = new Date(date);

    const [routes, total] = await Promise.all([
      request.tenantDb.route.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          driver: { select: { id: true, name: true, phone: true } },
          _count: { select: { stops: true } },
        },
      }),
      request.tenantDb.route.count({ where }),
    ]);

    return {
      data: routes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── GET ROUTE ─────────────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const route = await request.tenantDb.route.findUnique({
      where: { id },
      include: {
        driver: { select: { id: true, name: true, phone: true, vehicleType: true } },
        stops: {
          orderBy: { sequence: "asc" },
          include: {
            driver: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!route) throw new NotFoundError("Route", id);
    return { data: route };
  });

  // ── CREATE ROUTE ──────────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, reply);

    const body = createRouteSchema.parse(request.body);
    const { orderIds, ...routeData } = body;

    const route = await request.tenantDb.$transaction(async (tx) => {
      const created = await tx.route.create({
        data: {
          shopId: request.shopId,
          ...routeData,
          date: new Date(routeData.date),
        },
      });

      // Auto-create stops from order IDs if provided
      if (orderIds && orderIds.length > 0) {
        const stopsData = orderIds.map((orderId, index) => ({
          routeId: created.id,
          orderId,
          driverId: routeData.driverId,
          sequence: index,
          stopType: "DELIVERY" as const,
        }));

        await tx.routeStop.createMany({ data: stopsData });
      }

      return created;
    });

    reply.status(201);
    return { data: route };
  });

  // ── UPDATE ROUTE ──────────────────────────────────────────

  const updateRouteSchema = z.object({
    name: z.string().optional(),
    driverId: z.string().uuid().nullable().optional(),
    startAddress: z.string().optional(),
  });

  fastify.patch("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, reply);

    const { id } = request.params as { id: string };
    const body = updateRouteSchema.parse(request.body);

    const route = await request.tenantDb.route.findUnique({ where: { id } });
    if (!route) throw new NotFoundError("Route", id);

    const updated = await request.tenantDb.route.update({
      where: { id },
      data: body,
    });

    return { data: updated };
  });

  // ── UPDATE ROUTE STATUS ───────────────────────────────────

  const routeStatusSchema = z.object({
    status: z.enum(["DRAFT", "OPTIMIZED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  });

  fastify.patch("/:id/status", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER", "DRIVER")(request, reply);

    const { id } = request.params as { id: string };
    const { status } = routeStatusSchema.parse(request.body);

    const route = await request.tenantDb.route.findUnique({ where: { id } });
    if (!route) throw new NotFoundError("Route", id);

    const updatePayload: any = { status };
    if (status === "IN_PROGRESS" && !route.startedAt) {
      updatePayload.startedAt = new Date();
    }
    if (status === "COMPLETED") {
      updatePayload.completedAt = new Date();
    }

    const updated = await request.tenantDb.route.update({
      where: { id },
      data: updatePayload,
    });

    return { data: updated };
  });

  // ── ADD STOPS ─────────────────────────────────────────────

  fastify.post("/:id/stops", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, reply);

    const { id } = request.params as { id: string };
    const { stops } = addStopsSchema.parse(request.body);

    const route = await request.tenantDb.route.findUnique({ where: { id } });
    if (!route) throw new NotFoundError("Route", id);

    const created = await request.tenantDb.routeStop.createMany({
      data: stops.map((stop) => ({
        routeId: id,
        ...stop,
        driverId: route.driverId,
      })),
    });

    reply.status(201);
    return { data: { count: created.count } };
  });

  // ── UPDATE STOP STATUS ────────────────────────────────────

  fastify.patch("/:id/stops/:stopId", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER", "DRIVER")(request, reply);

    const { id, stopId } = request.params as { id: string; stopId: string };
    const body = updateStopSchema.parse(request.body);

    const stop = await request.tenantDb.routeStop.findFirst({
      where: { id: stopId, routeId: id },
    });
    if (!stop) throw new NotFoundError("RouteStop", stopId);

    const updatePayload: any = { status: body.status, notes: body.notes };
    if (body.status === "ARRIVED") {
      updatePayload.actualArrival = new Date();
    }
    if (body.status === "COMPLETED" || body.status === "SKIPPED" || body.status === "FAILED") {
      updatePayload.departedAt = new Date();
    }

    const updated = await request.tenantDb.routeStop.update({
      where: { id: stopId },
      data: updatePayload,
    });

    return { data: updated };
  });

  // ── OPTIMIZE ROUTE (stub — dispatches to solver) ──────────

  fastify.post("/:id/optimize", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, reply);

    const { id } = request.params as { id: string };

    const route = await request.tenantDb.route.findUnique({
      where: { id },
      include: { stops: true },
    });
    if (!route) throw new NotFoundError("Route", id);

    if (route.stops.length < 2) {
      throw new ValidationError("Route must have at least 2 stops to optimize");
    }

    // Dispatch to BullMQ optimization queue
    const queue = getOptimizationQueue();
    await queue.add(
      "optimize",
      {
        shopId: request.shopId,
        routeId: id,
        depot: { lat: 0, lng: 0 }, // Default depot — should come from shop settings
        orderIds: route.stops.map((s) => s.orderId).filter(Boolean) as string[],
        vehicleIds: route.driverId ? [route.driverId] : [],
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    );

    // Mark as optimized (the worker will update with actual results)
    await request.tenantDb.route.update({
      where: { id },
      data: { status: "OPTIMIZED" },
    });

    return { data: { message: "Route optimization queued", routeId: id } };
  });

  // ── CANCEL ROUTE ──────────────────────────────────────────

  fastify.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const { id } = request.params as { id: string };

    const route = await request.tenantDb.route.findUnique({ where: { id } });
    if (!route) throw new NotFoundError("Route", id);

    if (route.status === "COMPLETED") {
      throw new ValidationError("Cannot cancel a completed route");
    }

    const cancelled = await request.tenantDb.route.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return { data: cancelled };
  });
}

export default routesRoutes;
