/**
 * Live Tracking API Routes — Real-time delivery tracking endpoints
 *
 * Routes (all require AUTH):
 *   GET    /:orderId/live          Get live tracking data for an order
 *   POST   /:orderId/location      Update driver location for an order
 *   GET    /:orderId/history       Get location history for an order
 *   POST   /:orderId/geofence-check Check if location is within delivery geofence
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@witylogix/db";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

// ─── VALIDATION SCHEMAS ─────────────────────────────────────────

const orderIdSchema = z.object({
  orderId: z.string().uuid(),
});

const locationUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
  accuracy: z.number().min(0).optional(),
  altitude: z.number().optional(),
  batteryLevel: z.number().min(0).max(100).optional(),
  timestamp: z.string().datetime().optional(),
});

const geofenceCheckSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().min(0).default(100),
});

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// ─── ROUTE PLUGIN ───────────────────────────────────────────────

async function liveTrackingRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require auth and tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET LIVE TRACKING DATA ──────────────────────────────────

  fastify.get<{ Params: { orderId: string } }>(
    "/:orderId/live",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { orderId } = orderIdSchema.parse(request.params);

      const order = await request.tenantDb.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          estimatedArrival: true,
          driverId: true,
          deliveryDate: true,
          driver: {
            select: {
              id: true,
              name: true,
              vehicleType: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundError("Order", orderId);
      }

      // Fetch current driver location from GPS tracking
      let driverLocation = null;
      if (order.driverId && ["OUT_FOR_DELIVERY", "ARRIVED"].includes(order.status)) {
        const [loc] = await prisma.$queryRaw<
          Array<{
            lat: number;
            lng: number;
            heading: number | null;
            speed: number | null;
            last_at: Date | null;
          }>
        >`
          SELECT
            ST_Y(current_location) as lat,
            ST_X(current_location) as lng,
            heading,
            speed,
            last_location_at as last_at
          FROM drivers
          WHERE id = ${order.driverId}::uuid
            AND current_location IS NOT NULL
        `;

        if (loc) {
          driverLocation = {
            latitude: loc.lat,
            longitude: loc.lng,
            heading: loc.heading,
            speed: loc.speed,
            updatedAt: loc.last_at,
          };
        }
      }

      return {
        data: {
          orderId: order.id,
          status: order.status,
          estimatedArrival: order.estimatedArrival,
          deliveryDate: order.deliveryDate,
          driver: order.driver,
          currentLocation: driverLocation,
          trackingUrl: `https://track.witylogix.com/orders/${orderId}`,
        },
      };
    }
  );

  // ── UPDATE DRIVER LOCATION ──────────────────────────────────

  fastify.post<{ Params: { orderId: string } }>(
    "/:orderId/location",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { orderId } = orderIdSchema.parse(request.params);
      const payload = locationUpdateSchema.parse(request.body);

      const order = await request.tenantDb.order.findUnique({
        where: { id: orderId },
        select: { id: true, driverId: true, status: true },
      });

      if (!order) {
        throw new NotFoundError("Order", orderId);
      }

      if (!order.driverId) {
        throw new ValidationError("Order has no assigned driver");
      }

      // Update driver location in GPS service
      const timestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();

      const result = await prisma.driver.update({
        where: { id: order.driverId },
        data: {
          currentLocation: prisma.$queryRawUnsafe(
            `ST_GeomFromText('POINT(${payload.longitude} ${payload.latitude})')`
          ),
          heading: payload.heading,
          speed: payload.speed,
          lastLocationAt: timestamp,
        },
        select: { id: true, name: true, currentLocation: true },
      });

      return {
        data: {
          driverId: result.id,
          orderId,
          location: {
            latitude: payload.latitude,
            longitude: payload.longitude,
            heading: payload.heading,
            speed: payload.speed,
            accuracy: payload.accuracy,
            altitude: payload.altitude,
            batteryLevel: payload.batteryLevel,
          },
          updatedAt: timestamp,
        },
      };
    }
  );

  // ── GET LOCATION HISTORY ────────────────────────────────────

  fastify.get<{ Params: { orderId: string }; Querystring: { page: number; limit: number } }>(
    "/:orderId/history",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { orderId } = orderIdSchema.parse(request.params);
      const query = paginationSchema.parse(request.query);

      const order = await request.tenantDb.order.findUnique({
        where: { id: orderId },
        select: { id: true, driverId: true },
      });

      if (!order) {
        throw new NotFoundError("Order", orderId);
      }

      if (!order.driverId) {
        throw new ValidationError("Order has no assigned driver");
      }

      // Query location history from location_events table
      const [locations, total] = await Promise.all([
        prisma.$queryRaw<
          Array<{
            id: string;
            lat: number;
            lng: number;
            heading: number | null;
            speed: number | null;
            accuracy: number | null;
            recorded_at: Date;
          }>
        >`
          SELECT
            id,
            ST_Y(location) as lat,
            ST_X(location) as lng,
            heading,
            speed,
            accuracy,
            recorded_at
          FROM location_events
          WHERE driver_id = ${order.driverId}::uuid
            AND order_id = ${orderId}::uuid
          ORDER BY recorded_at DESC
          LIMIT ${query.limit}
          OFFSET ${(query.page - 1) * query.limit}
        `,
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count
          FROM location_events
          WHERE driver_id = ${order.driverId}::uuid
            AND order_id = ${orderId}::uuid
        `,
      ]);

      const totalCount = Number(total[0].count);

      return {
        data: locations.map((loc) => ({
          id: loc.id,
          latitude: loc.lat,
          longitude: loc.lng,
          heading: loc.heading,
          speed: loc.speed,
          accuracy: loc.accuracy,
          recordedAt: loc.recorded_at,
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / query.limit),
        },
      };
    }
  );

  // ── CHECK GEOFENCE STATUS ───────────────────────────────────

  fastify.post<{ Params: { orderId: string } }>(
    "/:orderId/geofence-check",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { orderId } = orderIdSchema.parse(request.params);
      const payload = geofenceCheckSchema.parse(request.body);

      const order = await request.tenantDb.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          addressLine1: true,
          city: true,
          postalCode: true,
          driverId: true,
        },
      });

      if (!order) {
        throw new NotFoundError("Order", orderId);
      }

      // Check if the provided location is within geofence radius of delivery address
      // Using ST_DWithin for circular geofence check
      const [result] = await prisma.$queryRaw<
        Array<{
          within_geofence: boolean;
          distance_meters: number;
        }>
      >`
        SELECT
          ST_DWithin(
            ST_GeomFromText('POINT(${payload.longitude} ${payload.latitude})', 4326),
            (
              SELECT current_location
              FROM addresses
              WHERE id = (SELECT address_id FROM orders WHERE id = ${orderId}::uuid)
            ),
            ${payload.radius}
          ) as within_geofence,
          ST_Distance(
            ST_GeomFromText('POINT(${payload.longitude} ${payload.latitude})', 4326),
            (
              SELECT current_location
              FROM addresses
              WHERE id = (SELECT address_id FROM orders WHERE id = ${orderId}::uuid)
            )
          ) as distance_meters
      `;

      return {
        data: {
          orderId,
          withinGeofence: result?.within_geofence ?? false,
          distanceMeters: result?.distance_meters ?? null,
          geofenceRadius: payload.radius,
          address: {
            addressLine1: order.addressLine1,
            city: order.city,
            postalCode: order.postalCode,
          },
        },
      };
    }
  );
}

export default liveTrackingRoutes;
