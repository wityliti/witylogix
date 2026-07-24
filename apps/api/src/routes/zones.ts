/**
 * Delivery Zones — PostGIS polygon management.
 *
 * Routes:
 *   GET    /              List all zones for the tenant; add ?format=geojson for FeatureCollection
 *   GET    /overlays      Zone-level stats + heatmap + hub markers (for map overlays)
 *   GET    /:id           Get zone details
 *   POST   /              Create zone with polygon boundary
 *   PATCH  /:id           Update zone (name, rates, boundary)
 *   DELETE /:id           Deactivate zone
 *   GET    /check         Check which zone covers a point (lat/lng)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  createDeliveryZoneSchema,
  paginationSchema,
} from "@witylogix/validators";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError } from "../lib/errors.js";

// ─── Route Plugin ───────────────────────────────────────────

async function zonesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── LIST ZONES ────────────────────────────────────────────

  const listQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(200).default(50),
    format: z.enum(["json", "geojson"]).default("json"),
  });

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const { page, limit, format } = listQuerySchema.parse(request.query);

    const [zones, total] = await Promise.all([
      request.tenantDb.deliveryZone.findMany({
        orderBy: [{ priority: "desc" }, { name: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          priority: true,
          baseRate: true,
          perKmRate: true,
          minOrder: true,
          freeAbove: true,
          isActive: true,
          boundary: true,
          timeSlots: {
            where: { isActive: true },
            select: { id: true, name: true, startTime: true, endTime: true },
          },
          _count: { select: { timeSlots: true } },
        },
      }),
      request.tenantDb.deliveryZone.count(),
    ]);

    if (format === "geojson") {
      const features = zones.map((zone) => {
        const boundary = zone.boundary as Record<string, unknown> | null;
        const geometry =
          boundary && boundary.type
            ? boundary
            : { type: "Polygon", coordinates: [] };
        return {
          type: "Feature" as const,
          geometry,
          properties: {
            id: zone.id,
            name: zone.name,
            isActive: zone.isActive,
            priority: zone.priority,
            baseRate: Number(zone.baseRate),
            perKmRate: Number(zone.perKmRate),
            minOrder: Number(zone.minOrder),
            freeAbove: zone.freeAbove ? Number(zone.freeAbove) : null,
          },
        };
      });
      return {
        type: "FeatureCollection",
        features,
      };
    }

    const data = zones.map((zone) => ({
      ...zone,
      boundary: zone.boundary || null,
    }));

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── OVERLAYS ──────────────────────────────────────────────
  // Returns per-zone live stats (openOrders, drivers, health) + heatmap + hubs.

  const overlaysQuerySchema = z.object({
    window: z.enum(["1h", "24h", "7d"]).default("24h"),
  });

  fastify.get(
    "/overlays",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { window } = overlaysQuerySchema.parse(request.query);

      const windowMs =
        window === "1h"
          ? 60 * 60 * 1000
          : window === "24h"
            ? 24 * 60 * 60 * 1000
            : 7 * 24 * 60 * 60 * 1000;
      const since = new Date(Date.now() - windowMs);

      const [zones, recentOrders, activeDrivers, shops] = await Promise.all([
        request.tenantDb.deliveryZone.findMany({
          where: { shopId: request.shopId, isActive: true },
          select: {
            id: true,
            name: true,
            timeSlots: {
              select: { id: true },
            },
          },
        }),
        request.tenantDb.order.findMany({
          where: {
            shopId: request.shopId,
            createdAt: { gte: since },
          },
          select: {
            timeSlotId: true,
            status: true,
            actualDelivery: true,
            deliveryDate: true,
            deliveryLocation: true,
          },
        }),
        request.tenantDb.driver.findMany({
          where: { shopId: request.shopId, isActive: true },
          select: { id: true, status: true },
        }),
        request.tenantDb.shop.findMany({
          where: { id: request.shopId },
          select: { id: true, name: true, metadata: true },
        }),
      ]);

      // Build a map of timeSlotId → zoneId
      const slotToZone = new Map<string, string>();
      for (const zone of zones) {
        for (const ts of zone.timeSlots) {
          slotToZone.set(ts.id, zone.id);
        }
      }

      // Per-zone order counters
      const zoneOrderCount = new Map<
        string,
        { open: number; delivered: number; onTime: number }
      >();
      for (const zone of zones) {
        zoneOrderCount.set(zone.id, { open: 0, delivered: 0, onTime: 0 });
      }

      // Heatmap points from delivery locations
      const heatmapPoints: Array<{ lng: number; lat: number; count: number }> =
        [];

      for (const order of recentOrders) {
        const zoneId = order.timeSlotId
          ? slotToZone.get(order.timeSlotId)
          : undefined;
        if (zoneId) {
          const counters = zoneOrderCount.get(zoneId);
          if (counters) {
            const isOpen = [
              "PENDING",
              "CONFIRMED",
              "ASSIGNED",
              "IN_TRANSIT",
            ].includes(order.status);
            const isDelivered = order.status === "DELIVERED";
            if (isOpen) counters.open += 1;
            if (isDelivered) {
              counters.delivered += 1;
              if (
                order.actualDelivery &&
                order.deliveryDate &&
                order.actualDelivery <= order.deliveryDate
              ) {
                counters.onTime += 1;
              }
            }
          }
        }

        // Add to heatmap if we have a location
        const loc = order.deliveryLocation as {
          lat?: number;
          lng?: number;
          coordinates?: number[];
        } | null;
        if (loc) {
          const lat = loc.lat ?? loc.coordinates?.[1];
          const lng = loc.lng ?? loc.coordinates?.[0];
          if (lat && lng) {
            heatmapPoints.push({ lat, lng, count: 1 });
          }
        }
      }

      const onlineDriverCount = activeDrivers.filter((d) =>
        ["AVAILABLE", "ON_DELIVERY", "ON_ROUTE"].includes(d.status),
      ).length;
      const driversPerZone =
        zones.length > 0 ? Math.floor(onlineDriverCount / zones.length) : 0;

      const zoneStats = zones.map((zone) => {
        const counters = zoneOrderCount.get(zone.id) ?? {
          open: 0,
          delivered: 0,
          onTime: 0,
        };
        const slaPct =
          counters.delivered > 0
            ? Math.round((counters.onTime / counters.delivered) * 100)
            : 100;
        const health: "good" | "watch" | "slipping" =
          slaPct >= 90 ? "good" : slaPct >= 75 ? "watch" : "slipping";
        return {
          id: zone.id,
          openOrders: counters.open,
          drivers: driversPerZone,
          slaPct,
          health,
        };
      });

      const hubs = shops
        .map((shop) => {
          const meta = shop.metadata as Record<string, unknown> | null;
          const lat = (meta?.lat as number) ?? 0;
          const lng = (meta?.lng as number) ?? 0;
          return {
            id: shop.id,
            name: shop.name,
            lat,
            lng,
            type: "hub" as const,
          };
        })
        .filter((h) => h.lat !== 0 && h.lng !== 0);

      return { zones: zoneStats, heatmap: heatmapPoints, hubs };
    },
  );

  // ── GET ZONE ──────────────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const zone = await request.tenantDb.deliveryZone.findUnique({
      where: { id },
      include: {
        timeSlots: { orderBy: { startTime: "asc" } },
      },
    });

    if (!zone) throw new NotFoundError("DeliveryZone", id);

    return {
      data: {
        ...zone,
        boundary: zone.boundary || null,
      },
    };
  });

  // ── CREATE ZONE ───────────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const body = createDeliveryZoneSchema.parse(request.body);
    const { boundary: boundaryPoints, ...zoneData } = body;

    // If caller supplied a polygon, convert to a WKT string; otherwise the
    // zone is created with a null boundary and can be filled in later via
    // the map picker / PATCH endpoint.
    let wkt: string | null = null;
    if (boundaryPoints && boundaryPoints.length >= 3) {
      const points = [...boundaryPoints];
      const first = points[0];
      const last = points[points.length - 1];
      if (
        first.longitude !== last.longitude ||
        first.latitude !== last.latitude
      ) {
        points.push(first);
      }
      const wktRing = points
        .map((p) => `${p.longitude} ${p.latitude}`)
        .join(", ");
      wkt = `POLYGON((${wktRing}))`;
    }

    const zone = await request.tenantDb.$transaction(async (tx) => {
      const created = await tx.deliveryZone.create({
        data: {
          shopId: request.shopId,
          ...zoneData,
        },
      });

      if (wkt) {
        await tx.$executeRaw`
          UPDATE delivery_zones
          SET boundary = ST_GeomFromText(${wkt}, 4326)
          WHERE id = ${created.id}::uuid
        `;
      }

      return created;
    });

    await request.tenantRedis.invalidateGroup("zones");
    reply.status(201);
    return { data: zone };
  });

  // ── UPDATE ZONE ───────────────────────────────────────────

  const updateZoneSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    boundary: z
      .array(
        z.object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
        }),
      )
      .min(3)
      .optional(),
    baseRate: z.number().nonnegative().optional(),
    perKmRate: z.number().nonnegative().optional(),
    minOrder: z.number().nonnegative().optional(),
    freeAbove: z.number().nonnegative().nullable().optional(),
    priority: z.number().int().optional(),
    isActive: z.boolean().optional(),
  });

  fastify.patch(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const { id } = request.params as { id: string };
      const body = updateZoneSchema.parse(request.body);
      const { boundary: boundaryPoints, ...updateData } = body;

      const existing = await request.tenantDb.deliveryZone.findUnique({
        where: { id },
      });
      if (!existing) throw new NotFoundError("DeliveryZone", id);

      const zone = await request.tenantDb.$transaction(async (tx) => {
        const updated = await tx.deliveryZone.update({
          where: { id },
          data: updateData,
        });

        if (boundaryPoints) {
          const points = [...boundaryPoints];
          const first = points[0];
          const last = points[points.length - 1];
          if (
            first.longitude !== last.longitude ||
            first.latitude !== last.latitude
          ) {
            points.push(first);
          }
          const wktRing = points
            .map((p) => `${p.longitude} ${p.latitude}`)
            .join(", ");
          const wkt = `POLYGON((${wktRing}))`;

          await tx.$executeRaw`
          UPDATE delivery_zones
          SET boundary = ST_GeomFromText(${wkt}, 4326)
          WHERE id = ${id}::uuid
        `;
        }

        return updated;
      });

      await request.tenantRedis.invalidateGroup("zones");
      return { data: zone };
    },
  );

  // ── DEACTIVATE ZONE ───────────────────────────────────────

  fastify.delete(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const { id } = request.params as { id: string };

      const zone = await request.tenantDb.deliveryZone.findUnique({
        where: { id },
      });
      if (!zone) throw new NotFoundError("DeliveryZone", id);

      const deactivated = await request.tenantDb.deliveryZone.update({
        where: { id },
        data: { isActive: false },
      });

      await request.tenantRedis.invalidateGroup("zones");
      return { data: deactivated };
    },
  );

  // ── CHECK ZONE FOR POINT ──────────────────────────────────

  const checkQuery = z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
  });

  fastify.get(
    "/check",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { latitude, longitude } = checkQuery.parse(request.query);

      // Use the find_delivery_zone SQL function
      const result = await request.tenantDb.$queryRaw<
        Array<{
          id: string;
          name: string;
          base_rate: number;
          per_km_rate: number;
          min_order: number;
          free_above: number | null;
        }>
      >`
      SELECT dz.id::text, dz.name, dz.base_rate, dz.per_km_rate, dz.min_order, dz.free_above
      FROM delivery_zones dz
      WHERE dz.shop_id = ${request.shopId}::uuid
        AND dz.is_active = true
        AND ST_Contains(dz.boundary, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326))
      ORDER BY dz.priority DESC
      LIMIT 1
    `;

      if (result.length === 0) {
        return { data: null, message: "No delivery zone covers this location" };
      }

      return { data: result[0] };
    },
  );
}

export default zonesRoutes;
