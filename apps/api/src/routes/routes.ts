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
 *   POST   /:id/stops/hot-add  Hot-add a stop mid-route and re-optimise remaining
 *   DELETE /:id           Cancel route
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z, ZodError } from "zod";
import { paginationSchema, optimizeRouteSchema } from "@witylogix/validators";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { getOptimizationQueue } from "../lib/queue.js";
import { emitToShop, emitToDriver, type RouteUpdatedEvent } from "../lib/socket.js";

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
    timeWindowStart: z.string().datetime().optional(),
    timeWindowEnd: z.string().datetime().optional(),
  }).refine(
    (s) => !(s.timeWindowStart && s.timeWindowEnd) || new Date(s.timeWindowStart) < new Date(s.timeWindowEnd),
    { message: "timeWindowStart must be before timeWindowEnd" }
  )).min(1),
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
    try {
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

      // Map to the shape expected by the dashboard RouteItem interface
      const mapped = routes.map((r) => ({
        id: r.id,
        name: r.name ?? `Route ${r.date.toISOString().slice(0, 10)}`,
        stopsCount: r._count.stops,
        totalDistance: r.totalDistance ? Number(r.totalDistance) : 0,
        totalDuration: r.totalDuration ?? 0,
        assignedDriver: r.driver?.name ?? null,
        driverId: r.driverId ?? null,
        // Map DB RouteStatus to the dashboard display statuses
        status: ((): "draft" | "scheduled" | "active" | "completed" | "cancelled" => {
          switch (r.status) {
            case "DRAFT": return "draft";
            case "OPTIMIZED": return "draft";
            case "ASSIGNED": return "scheduled";
            case "IN_PROGRESS": return "active";
            case "COMPLETED": return "completed";
            case "CANCELLED": return "cancelled";
            default: return "draft";
          }
        })(),
        rawStatus: r.status,
        lastUsed: r.updatedAt.toISOString(),
        isTemplate: false,
        createdAt: r.createdAt.toISOString(),
        date: r.date.toISOString(),
      }));

      return {
        data: mapped,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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

  // ── GET ROUTE ─────────────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      const route = await request.tenantDb.route.findUnique({
        where: { id },
        include: {
          driver: {
            select: {
              id: true,
              name: true,
              phone: true,
              vehicleType: true,
              vehiclePlate: true,
              status: true,
              currentLocation: true,
            },
          },
          stops: {
            orderBy: { sequence: "asc" },
            include: {
              driver: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (!route) throw new NotFoundError("Route", id);

      // Fetch orders associated with stops to get lat/lng coordinates.
      // Orders store their delivery coordinates in the deliveryLocation JSON field.
      const orderIds = route.stops
        .map((s) => s.orderId)
        .filter((oid): oid is string => oid !== null);

      const orders =
        orderIds.length > 0
          ? await request.tenantDb.order.findMany({
              where: { id: { in: orderIds } },
              select: {
                id: true,
                customerName: true,
                addressLine1: true,
                city: true,
                deliveryLocation: true,
                externalOrderNumber: true,
              },
            })
          : [];

      const orderById = new Map(orders.map((o) => [o.id, o]));

      // Enrich stops with coordinates and customer info from their linked order
      const enrichedStops = route.stops.map((stop) => {
        const order = stop.orderId ? orderById.get(stop.orderId) : undefined;
        const loc = order?.deliveryLocation as
          | { lat?: number; latitude?: number; lng?: number; longitude?: number }
          | null
          | undefined;

        const lat = loc?.lat ?? loc?.latitude ?? null;
        const lng = loc?.lng ?? loc?.longitude ?? null;
        const address = order
          ? [order.addressLine1, order.city].filter(Boolean).join(", ")
          : null;

        return {
          ...stop,
          latitude: lat,
          longitude: lng,
          address,
          customerName: order?.customerName ?? null,
          orderNumber: order?.externalOrderNumber ?? null,
        };
      });

      return {
        data: {
          ...route,
          stops: enrichedStops,
        },
      };
    } catch (err) {
      throw err;
    }
  });

  // ── CREATE ROUTE ──────────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
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

  // ── UPDATE ROUTE ──────────────────────────────────────────

  const updateRouteSchema = z.object({
    name: z.string().optional(),
    driverId: z.string().uuid().nullable().optional(),
    startAddress: z.string().optional(),
  });

  fastify.patch("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
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

  // ── ASSIGN DRIVER ─────────────────────────────────────────
  //  POST /:id/assign — assign or re-assign a driver to a route, update all
  //  existing stops to the same driverId, and transition the route status to
  //  ASSIGNED when a driver is set.

  const assignDriverSchema = z.object({
    driverId: z.string().uuid(),
  });

  fastify.post("/:id/assign", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, reply);

      const { id } = request.params as { id: string };
      const { driverId } = assignDriverSchema.parse(request.body);

      const route = await request.tenantDb.route.findUnique({
        where: { id },
        include: { driver: { select: { id: true, name: true } } },
      });
      if (!route) throw new NotFoundError("Route", id);

      // Verify driver exists in this tenant
      const driver = await request.tenantDb.driver.findFirst({
        where: {
          id: driverId,
          OR: [{ shopId: request.shopId }, { orgId: request.shopId }],
        },
        select: { id: true, name: true, vehicleType: true },
      });
      if (!driver) throw new NotFoundError("Driver", driverId);

      const [updated] = await request.tenantDb.$transaction([
        request.tenantDb.route.update({
          where: { id },
          data: {
            driverId,
            status: route.status === "DRAFT" || route.status === "OPTIMIZED" ? "ASSIGNED" : route.status,
          },
          include: {
            driver: { select: { id: true, name: true, vehicleType: true } },
            _count: { select: { stops: true } },
          },
        }),
        request.tenantDb.routeStop.updateMany({
          where: { routeId: id, status: { in: ["PENDING", "EN_ROUTE"] } },
          data: { driverId },
        }),
      ]);

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

  // ── UPDATE ROUTE STATUS ───────────────────────────────────

  const routeStatusSchema = z.object({
    status: z.enum(["DRAFT", "OPTIMIZED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  });

  fastify.patch("/:id/status", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
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

  // ── ADD STOPS ─────────────────────────────────────────────

  fastify.post("/:id/stops", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, reply);

      const { id } = request.params as { id: string };
      const { stops } = addStopsSchema.parse(request.body);

      const route = await request.tenantDb.route.findUnique({ where: { id } });
      if (!route) throw new NotFoundError("Route", id);

      const created = await request.tenantDb.routeStop.createMany({
        data: stops.map((stop) => ({
          routeId: id,
          orderId: stop.orderId,
          sequence: stop.sequence,
          stopType: stop.stopType,
          driverId: route.driverId,
          timeWindowStart: stop.timeWindowStart ? new Date(stop.timeWindowStart) : undefined,
          timeWindowEnd: stop.timeWindowEnd ? new Date(stop.timeWindowEnd) : undefined,
        })),
      });

      reply.status(201);
      return { data: { count: created.count } };
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

  // ── UPDATE STOP STATUS ────────────────────────────────────

  fastify.patch("/:id/stops/:stopId", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
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

  // ── OPTIMIZE ROUTE (stub — dispatches to solver) ──────────

  fastify.post("/:id/optimize", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
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
    } catch (err) {
      throw err;
    }
  });

  // ── HOT-ADD STOP (mid-route re-optimisation) ──────────────

  /**
   * Hot-add a new stop into an active (IN_PROGRESS) route.
   *
   * Inserts the stop, re-sequences all remaining PENDING/EN_ROUTE stops
   * around it using nearest-neighbour with a traffic factor, persists the
   * new sequences and ETAs, then pushes a WebSocket event to the driver
   * room and the shop dashboard.
   *
   * The caller must supply the stop's geographic coordinates so the
   * endpoint can re-optimise without an extra DB round-trip to PostGIS.
   * Coordinates for existing remaining stops are read from the route's
   * `optimizedOrder` JSON field that is kept in sync by the optimisation
   * worker.
   */

  const hotAddStopSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().optional(),
    orderId: z.string().uuid().optional(),
    stopType: z.enum(["PICKUP", "DELIVERY", "RETURN", "DEPOT"]).default("DELIVERY"),
    serviceDuration: z.number().int().nonnegative().default(5), // minutes
    priority: z.number().int().min(1).max(10).default(5),
    notes: z.string().optional(),
    /**
     * Multiplier applied to raw travel durations for traffic modelling.
     * 1.0 = free-flow, 1.2 = typical urban congestion (default),
     * 2.0 = heavy congestion.
     */
    trafficFactor: z.number().positive().max(10).default(1.2),
    /** Optional current driver position for more accurate re-sequencing. */
    currentLatitude: z.number().min(-90).max(90).optional(),
    currentLongitude: z.number().min(-180).max(180).optional(),
  });

  fastify.post("/:id/stops/hot-add", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await requireRole("SUPER_ADMIN", "ADMIN", "DISPATCHER")(request, reply);

      const { id } = request.params as { id: string };
      const body = hotAddStopSchema.parse(request.body);

      // ── 1. Load route + stops ──────────────────────────────
      const route = await request.tenantDb.route.findUnique({
        where: { id },
        include: { stops: { orderBy: { sequence: "asc" } } },
      });
      if (!route) throw new NotFoundError("Route", id);

      if (route.status !== "IN_PROGRESS") {
        return reply.status(422).send({
          success: false,
          error: {
            code: "INVALID_STATE",
            message: `Route must be IN_PROGRESS to hot-add stops (current: ${route.status})`,
          },
        });
      }

      // ── 2. Separate terminal stops from remaining ─────────
      const TERMINAL = new Set(["COMPLETED", "SKIPPED", "FAILED"]);
      const completedStops = route.stops.filter((s) => TERMINAL.has(s.status));
      const remainingStops = route.stops.filter((s) => !TERMINAL.has(s.status));

      // ── 3. Build lat/lng map from optimizedOrder JSON ─────
      type OptimizedEntry = {
        sequence: number;
        orderId: string;
        lat: number;
        lng: number;
        eta: string;
        type: string;
      };
      const optimizedOrder = (route.optimizedOrder ?? []) as OptimizedEntry[];
      const locByOrderId = new Map(optimizedOrder.map((o) => [o.orderId, { lat: o.lat, lng: o.lng }]));

      // Keep only remaining stops that have known coordinates
      const remainingWithLoc = remainingStops
        .filter((s) => s.orderId !== null && locByOrderId.has(s.orderId!))
        .map((s) => ({
          stopId: s.id,
          orderId: s.orderId!,
          lat: locByOrderId.get(s.orderId!)!.lat,
          lng: locByOrderId.get(s.orderId!)!.lng,
        }));

      // ── 4. Determine re-optimisation starting point ───────
      // Use caller-supplied driver position, falling back to the last
      // completed stop's position so the nearest-neighbour starts from
      // where the driver actually is.
      let depotLat: number;
      let depotLng: number;

      if (body.currentLatitude !== undefined && body.currentLongitude !== undefined) {
        depotLat = body.currentLatitude;
        depotLng = body.currentLongitude;
      } else {
        const lastCompleted = optimizedOrder
          .filter((o) => completedStops.some((s) => s.orderId === o.orderId))
          .sort((a, b) => b.sequence - a.sequence)[0];
        depotLat = lastCompleted?.lat ?? body.latitude;
        depotLng = lastCompleted?.lng ?? body.longitude;
      }

      // ── 5. Build points array for matrix computation ──────
      // Index 0 = current driver position (depot)
      // Index 1..remaining = remaining stop locations
      // Index remaining+1 = new stop
      type Point = { lat: number; lng: number };
      const points: Point[] = [
        { lat: depotLat, lng: depotLng },
        ...remainingWithLoc.map((s) => ({ lat: s.lat, lng: s.lng })),
        { lat: body.latitude, lng: body.longitude },
      ];

      // ── 6. Haversine distance matrix with traffic factor ──
      const matrix = buildHaversineMatrix(points, body.trafficFactor);

      // ── 7. Nearest-neighbour from depot ───────────────────
      const optimizedIndices = nearestNeighborTSP(matrix, 0);

      // Strip the depot (index 0); map back to allStops indices (0-based)
      const stopSequence = optimizedIndices
        .filter((i) => i > 0)
        .map((i) => i - 1);

      // allStops: remaining stops followed by the new stop
      const allStops: Array<{
        existing: boolean;
        stopId: string | null; // null for the new stop before creation
        orderId: string | null;
        lat: number;
        lng: number;
      }> = [
        ...remainingWithLoc.map((s) => ({
          existing: true,
          stopId: s.stopId,
          orderId: s.orderId,
          lat: s.lat,
          lng: s.lng,
        })),
        {
          existing: false,
          stopId: null,
          orderId: body.orderId ?? null,
          lat: body.latitude,
          lng: body.longitude,
        },
      ];

      // ── 8. Persist changes in a transaction ───────────────
      const serviceTimeSeconds = body.serviceDuration * 60;
      const baseSequence = completedStops.length;
      const now = new Date();

      const updatedSequence: RouteUpdatedEvent["updatedSequence"] = [];

      const newStop = await request.tenantDb.$transaction(async (tx) => {
        // Create the new RouteStop with a placeholder sequence
        const created = await tx.routeStop.create({
          data: {
            routeId: id,
            orderId: body.orderId ?? null,
            driverId: route.driverId,
            sequence: 9999,
            stopType: body.stopType,
            status: "PENDING",
            notes: body.notes ?? null,
          },
        });

        // Assign real stop id to the new entry in allStops
        allStops[allStops.length - 1].stopId = created.id;

        // Re-sequence all stops in optimised order
        let cumulative = 0;
        for (let i = 0; i < stopSequence.length; i++) {
          const stopIdx = stopSequence[i];
          const stopInfo = allStops[stopIdx];

          const prevIdx = i === 0 ? 0 : stopSequence[i - 1] + 1;
          const currentIdx = stopIdx + 1;
          cumulative += matrix[prevIdx][currentIdx] + serviceTimeSeconds;

          const eta = new Date(now.getTime() + cumulative * 1000);
          const newSeq = baseSequence + i;

          await tx.routeStop.update({
            where: { id: stopInfo.stopId! },
            data: { sequence: newSeq, estimatedArrival: eta },
          });

          updatedSequence.push({
            stopId: stopInfo.stopId!,
            orderId: stopInfo.orderId,
            sequence: newSeq,
            estimatedArrival: eta.toISOString(),
          });
        }

        // Rebuild optimizedOrder: keep completed entries, append re-optimised
        const completedEntries = optimizedOrder.filter((o) =>
          completedStops.some((s) => s.orderId === o.orderId),
        );
        const newEntries = updatedSequence
          .filter((s) => s.orderId !== null)
          .map((s) => {
            const pt = allStops.find((a) => a.stopId === s.stopId)!;
            return {
              sequence: s.sequence,
              orderId: s.orderId!,
              lat: pt.lat,
              lng: pt.lng,
              eta: s.estimatedArrival,
              type: body.stopType,
            };
          });

        await tx.route.update({
          where: { id },
          data: { optimizedOrder: [...completedEntries, ...newEntries] },
        });

        return created;
      });

      // ── 9. Push real-time notifications ───────────────────
      const wsPayload: RouteUpdatedEvent = {
        routeId: id,
        shopId: route.shopId,
        driverId: route.driverId ?? null,
        addedStopId: newStop.id,
        updatedSequence,
        trafficFactor: body.trafficFactor,
        updatedAt: new Date().toISOString(),
      };

      // Notify the shop dashboard
      emitToShop(route.shopId, "route:updated", wsPayload);

      // Notify the driver app (if a driver is assigned)
      if (route.driverId) {
        emitToDriver(route.driverId, "route:updated", wsPayload);
      }

      // ── 10. Return updated route ───────────────────────────
      const updatedRoute = await request.tenantDb.route.findUnique({
        where: { id },
        include: {
          driver: { select: { id: true, name: true, phone: true } },
          stops: { orderBy: { sequence: "asc" } },
        },
      });

      reply.status(201);
      return {
        data: {
          route: updatedRoute,
          addedStopId: newStop.id,
          updatedSequence,
        },
      };
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

  // ── CANCEL ROUTE ──────────────────────────────────────────

  fastify.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
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
    } catch (err) {
      throw err;
    }
  });
}

export default routesRoutes;

// ─── Helpers for hot-add re-optimisation ────────────────────

/**
 * Build an N×N matrix of travel durations (seconds) using the Haversine
 * formula, scaled by the supplied traffic factor.
 *
 * Average urban delivery speed is assumed to be 30 km/h.
 */
function buildHaversineMatrix(
  points: Array<{ lat: number; lng: number }>,
  trafficFactor: number,
): number[][] {
  const n = points.length;
  const matrix: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0),
  );
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const distKm = haversineKm(points[i], points[j]);
        matrix[i][j] = (distKm / 30) * 3600 * trafficFactor;
      }
    }
  }
  return matrix;
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const x =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Nearest-neighbour TSP heuristic — returns stop indices in visit order. */
function nearestNeighborTSP(matrix: number[][], startIndex: number): number[] {
  const n = matrix.length;
  const visited = new Set<number>([startIndex]);
  const tour = [startIndex];
  let current = startIndex;

  while (visited.size < n) {
    let nearest = -1;
    let nearestDist = Infinity;
    for (let i = 0; i < n; i++) {
      if (!visited.has(i) && matrix[current][i] < nearestDist) {
        nearest = i;
        nearestDist = matrix[current][i];
      }
    }
    if (nearest === -1) break;
    visited.add(nearest);
    tour.push(nearest);
    current = nearest;
  }

  return tour;
}
