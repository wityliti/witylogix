/**
 * Delivery Zones — PostGIS polygon management.
 *
 * Routes:
 *   GET    /              List all zones for the tenant
 *   GET    /:id           Get zone details
 *   POST   /              Create zone with polygon boundary
 *   PATCH  /:id           Update zone (name, rates, boundary)
 *   DELETE /:id           Deactivate zone
 *   GET    /check         Check which zone covers a point (lat/lng)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createDeliveryZoneSchema, paginationSchema } from "@witylogix/validators";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError } from "../lib/errors.js";

// ─── Route Plugin ───────────────────────────────────────────

async function zonesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── LIST ZONES ────────────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const { page, limit } = paginationSchema.parse(request.query);

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
          timeSlots: {
            where: { isActive: true },
            select: { id: true, name: true, startTime: true, endTime: true },
          },
          _count: { select: { timeSlots: true } },
        },
      }),
      request.tenantDb.deliveryZone.count(),
    ]);

    // Enrich with PostGIS centroid + GeoJSON boundary for map rendering
    let geoRows: Array<{
      id: string;
      center_lat: number | null;
      center_lng: number | null;
      boundary_geojson: string | null;
    }> = [];

    if (zones.length > 0) {
      const ids = zones.map((z) => z.id);
      geoRows = await request.tenantDb.$queryRaw<typeof geoRows>`
        SELECT
          id::text,
          CASE WHEN boundary IS NOT NULL THEN ST_Y(ST_Centroid(boundary)) ELSE NULL END AS center_lat,
          CASE WHEN boundary IS NOT NULL THEN ST_X(ST_Centroid(boundary)) ELSE NULL END AS center_lng,
          CASE WHEN boundary IS NOT NULL THEN ST_AsGeoJSON(boundary) ELSE NULL END AS boundary_geojson
        FROM delivery_zones
        WHERE id = ANY(${ids}::uuid[])
      `;
    }

    const geoMap = new Map(geoRows.map((r) => [r.id, r]));

    const data = zones.map((zone) => {
      const geo = geoMap.get(zone.id);
      return {
        ...zone,
        centerLat: geo?.center_lat ?? null,
        centerLng: geo?.center_lng ?? null,
        boundaryGeoJson: geo?.boundary_geojson ? JSON.parse(geo.boundary_geojson) : null,
      };
    });

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

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

    // Convert coordinate array to WKT polygon
    // Close the ring if not already closed
    const points = [...boundaryPoints];
    const first = points[0];
    const last = points[points.length - 1];
    if (first.longitude !== last.longitude || first.latitude !== last.latitude) {
      points.push(first);
    }
    const wktRing = points.map((p) => `${p.longitude} ${p.latitude}`).join(", ");
    const wkt = `POLYGON((${wktRing}))`;

    // Create zone with PostGIS boundary
    const zone = await request.tenantDb.$transaction(async (tx) => {
      const created = await tx.deliveryZone.create({
        data: {
          shopId: request.shopId,
          ...zoneData,
        },
      });

      await tx.$executeRaw`
        UPDATE delivery_zones
        SET boundary = ST_GeomFromText(${wkt}, 4326)
        WHERE id = ${created.id}::uuid
      `;

      return created;
    });

    await request.tenantRedis.invalidateGroup("zones");
    reply.status(201);
    return { data: zone };
  });

  // ── UPDATE ZONE ───────────────────────────────────────────

  const updateZoneSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    boundary: z.array(z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })).min(3).optional(),
    baseRate: z.number().nonnegative().optional(),
    perKmRate: z.number().nonnegative().optional(),
    minOrder: z.number().nonnegative().optional(),
    freeAbove: z.number().nonnegative().nullable().optional(),
    priority: z.number().int().optional(),
    isActive: z.boolean().optional(),
  });

  fastify.patch("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const { id } = request.params as { id: string };
    const body = updateZoneSchema.parse(request.body);
    const { boundary: boundaryPoints, ...updateData } = body;

    const existing = await request.tenantDb.deliveryZone.findUnique({ where: { id } });
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
        if (first.longitude !== last.longitude || first.latitude !== last.latitude) {
          points.push(first);
        }
        const wktRing = points.map((p) => `${p.longitude} ${p.latitude}`).join(", ");
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
  });

  // ── DEACTIVATE ZONE ───────────────────────────────────────

  fastify.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const { id } = request.params as { id: string };

    const zone = await request.tenantDb.deliveryZone.findUnique({ where: { id } });
    if (!zone) throw new NotFoundError("DeliveryZone", id);

    const deactivated = await request.tenantDb.deliveryZone.update({
      where: { id },
      data: { isActive: false },
    });

    await request.tenantRedis.invalidateGroup("zones");
    return { data: deactivated };
  });

  // ── CHECK ZONE FOR POINT ──────────────────────────────────

  const checkQuery = z.object({
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
  });

  fastify.get("/check", async (request: FastifyRequest, reply: FastifyReply) => {
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
  });
}

export default zonesRoutes;
