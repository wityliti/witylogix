/**
 * Customer-facing tracking endpoint — public (no auth required).
 *
 * Accessed via tracking token (not order ID) for security.
 * Powers the customer tracking page with delivery status + driver location.
 *
 * Routes:
 *   GET  /token/:trackingToken                Get delivery status by tracking token
 *   GET  /token/:trackingToken/preferences    Get customer delivery preferences
 *   PATCH /token/:trackingToken/preferences   Update customer delivery preferences
 *   GET  /token/:trackingToken/slots          List available reschedule time slots
 *   GET  /track/:trackingCode/eta             ML ETA prediction (public, rate-limited, Redis cached)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@witylogix/db";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { createRateLimiter } from "../middleware/rate-limit-routes.js";
import { etaEngine } from "@witylogix/core/ai-eta";
import { getRedis } from "../lib/redis.js";

// ─── ETA Cache (5-minute TTL per shipment) ──────────────────

interface CachedETA {
  estimatedArrival: string;
  confidenceLow: string;
  confidenceHigh: string;
  isAIPredicted: boolean;
  lastUpdated: string;
}

const etaCache = new Map<string, { data: CachedETA; expiresAt: number }>();

// ─── ETA Rate Limiter (60 req/min per IP) ───────────────────

function extractIp(req: FastifyRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : fwd) || req.ip;
}

const trackingEtaRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyGenerator: (req) => `ratelimit:tracking-eta:${extractIp(req)}`,
});

// ─── Haversine distance helper ──────────────────────────────

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Route Plugin ───────────────────────────────────────────

async function trackingRoutes(fastify: FastifyInstance): Promise<void> {
  // NO auth hooks — tracking is public (secured by token obscurity)

  // ── GET TRACKING INFO ─────────────────────────────────────

  fastify.get(
    "/token/:trackingToken",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { trackingToken } = request.params as { trackingToken: string };

      const order = await prisma.order.findUnique({
        where: { trackingToken },
        select: {
          id: true,
          status: true,
          customerName: true,
          addressLine1: true,
          city: true,
          province: true,
          postalCode: true,
          deliveryDate: true,
          estimatedArrival: true,
          actualDelivery: true,
          externalOrderNumber: true,
          timeSlot: {
            select: { name: true, startTime: true, endTime: true },
          },
          driver: {
            select: {
              id: true,
              name: true,
              vehicleType: true,
              // Do NOT expose phone, email, or other PII
            },
          },
          proofOfDelivery: {
            select: {
              photoUrls: true,
              recipientName: true,
              deliveredAt: true,
            },
          },
          shop: {
            select: {
              name: true,
              settings: true, // branding info for tracking page
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundError("Tracking", trackingToken);
      }

      // Get driver location if delivery is in progress
      let driverLocation = null;
      if (
        order.driver &&
        ["OUT_FOR_DELIVERY", "ARRIVED"].includes(order.status)
      ) {
        const [loc] = await prisma.$queryRaw<
          Array<{
            lat: number;
            lng: number;
            heading: number | null;
            last_at: Date | null;
          }>
        >`
        SELECT
          ST_Y(current_location) as lat,
          ST_X(current_location) as lng,
          heading,
          last_location_at as last_at
        FROM drivers
        WHERE id = ${order.driver.id}::uuid
          AND current_location IS NOT NULL
      `;

        if (loc) {
          driverLocation = {
            latitude: loc.lat,
            longitude: loc.lng,
            heading: loc.heading,
            updatedAt: loc.last_at,
          };
        }
      }

      // Build status timeline
      const timeline = buildTimeline(order.status);

      return {
        data: {
          orderNumber: order.externalOrderNumber,
          status: order.status,
          customerName: order.customerName,
          deliveryAddress: {
            line1: order.addressLine1,
            city: order.city,
            province: order.province,
            postalCode: order.postalCode,
          },
          deliveryDate: order.deliveryDate,
          estimatedArrival: order.estimatedArrival,
          actualDelivery: order.actualDelivery,
          timeSlot: order.timeSlot,
          driver: order.driver
            ? {
                name: order.driver.name,
                vehicleType: order.driver.vehicleType,
              }
            : null,
          driverLocation,
          proofOfDelivery: order.proofOfDelivery,
          shop: {
            name: order.shop.name,
            branding: (order.shop.settings as any)?.branding || {},
          },
          timeline,
        },
      };
    },
  );

  // ── GET CUSTOMER DELIVERY PREFERENCES ────────────────────

  fastify.get(
    "/token/:trackingToken/preferences",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { trackingToken } = request.params as { trackingToken: string };
      const order = await resolveOrderByToken(trackingToken);

      const prefs = await prisma.customerDeliveryPreferences.findUnique({
        where: { orderId: order.id },
      });

      return { data: prefs ?? null };
    },
  );

  // ── PATCH CUSTOMER DELIVERY PREFERENCES ──────────────────

  const patchPrefsSchema = z.object({
    instructions: z.string().max(500).optional(),
    dropoffNote: z.string().max(500).optional(),
    dropoffLat: z.number().min(-90).max(90).optional(),
    dropoffLng: z.number().min(-180).max(180).optional(),
    contactPref: z.enum(["call", "sms", "whatsapp"]).optional(),
    rescheduledTo: z.string().datetime().optional(),
    timeSlotId: z.string().uuid().optional(),
  });

  fastify.patch(
    "/token/:trackingToken/preferences",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { trackingToken } = request.params as { trackingToken: string };

      const parsed = patchPrefsSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.errors.map((e) => e.message).join("; "),
        );
      }

      const order = await resolveOrderByToken(trackingToken);

      // Lock-out: instructions cannot change after driver has arrived
      if (["ARRIVED", "DELIVERED"].includes(order.status)) {
        throw new ValidationError(
          "Delivery preferences cannot be updated after the driver has arrived",
        );
      }

      // Reschedule lock-out: cannot reschedule once driver is en route
      if (
        parsed.data.rescheduledTo &&
        ["OUT_FOR_DELIVERY", "ARRIVED", "DELIVERED"].includes(order.status)
      ) {
        throw new ValidationError(
          "Reschedule is not available once the driver is on the way",
        );
      }

      // Validate timeSlotId belongs to the same shop and is active
      if (parsed.data.timeSlotId) {
        const slot = await prisma.timeSlot.findFirst({
          where: {
            id: parsed.data.timeSlotId,
            shopId: order.shopId,
            isActive: true,
          },
        });
        if (!slot) {
          throw new ValidationError("Selected time slot is not available");
        }
      }

      const data = {
        shopId: order.shopId,
        ...(parsed.data.instructions !== undefined && {
          instructions: parsed.data.instructions,
        }),
        ...(parsed.data.dropoffNote !== undefined && {
          dropoffNote: parsed.data.dropoffNote,
        }),
        ...(parsed.data.dropoffLat !== undefined && {
          dropoffLat: parsed.data.dropoffLat,
        }),
        ...(parsed.data.dropoffLng !== undefined && {
          dropoffLng: parsed.data.dropoffLng,
        }),
        ...(parsed.data.contactPref !== undefined && {
          contactPref: parsed.data.contactPref,
        }),
        ...(parsed.data.rescheduledTo !== undefined && {
          rescheduledTo: new Date(parsed.data.rescheduledTo),
        }),
        ...(parsed.data.timeSlotId !== undefined && {
          timeSlotId: parsed.data.timeSlotId,
        }),
      };

      const prefs = await prisma.customerDeliveryPreferences.upsert({
        where: { orderId: order.id },
        create: { orderId: order.id, ...data },
        update: data,
      });

      return { data: prefs };
    },
  );

  // ── GET AVAILABLE RESCHEDULE SLOTS ────────────────────────

  fastify.get(
    "/token/:trackingToken/slots",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { trackingToken } = request.params as { trackingToken: string };
      const order = await resolveOrderByToken(trackingToken);

      if (["OUT_FOR_DELIVERY", "ARRIVED", "DELIVERED"].includes(order.status)) {
        return { data: [], locked: true };
      }

      const slots = await prisma.timeSlot.findMany({
        where: { shopId: order.shopId, isActive: true },
        select: {
          id: true,
          name: true,
          startTime: true,
          endTime: true,
          daysOfWeek: true,
          maxCapacity: true,
        },
        orderBy: [{ startTime: "asc" }],
      });

      return { data: slots, locked: false };
    },
  );

  // ── GET AI-PREDICTED ETA ───────────────────────────────────

  fastify.get(
    "/token/:trackingToken/eta",
    { preHandler: [trackingEtaRateLimiter] },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { trackingToken } = request.params as { trackingToken: string };

      // Check cache first
      const cached = etaCache.get(trackingToken);
      if (cached && cached.expiresAt > Date.now()) {
        return { data: cached.data };
      }

      // Fetch order with location data
      const order = await prisma.order.findUnique({
        where: { trackingToken },
        select: {
          id: true,
          estimatedArrival: true,
          deliveryLocation: true,
          driver: {
            select: { currentLocation: true },
          },
        },
      });

      if (!order) {
        throw new NotFoundError("Tracking", trackingToken);
      }

      let eta: CachedETA;

      try {
        const driverLoc = order.driver?.currentLocation as {
          lat?: number;
          lng?: number;
        } | null;
        const destLoc = order.deliveryLocation as {
          lat?: number;
          lng?: number;
        } | null;

        if (
          driverLoc?.lat != null &&
          driverLoc?.lng != null &&
          destLoc?.lat != null &&
          destLoc?.lng != null
        ) {
          const distKm = haversineKm(
            driverLoc.lat,
            driverLoc.lng,
            destLoc.lat,
            destLoc.lng,
          );

          const prediction = etaEngine.predictETA({
            origin: { lat: driverLoc.lat, lng: driverLoc.lng },
            destination: { lat: destLoc.lat, lng: destLoc.lng },
            distanceKm: distKm,
            departureTime: new Date(),
          });

          eta = {
            estimatedArrival: prediction.prediction.expected.toISOString(),
            confidenceLow: prediction.prediction.low.toISOString(),
            confidenceHigh: prediction.prediction.high.toISOString(),
            isAIPredicted: true,
            lastUpdated: new Date().toISOString(),
          };
        } else {
          throw new Error("Insufficient location data for AI prediction");
        }
      } catch {
        // Fallback to static estimate from DB
        const fallback =
          order.estimatedArrival ?? new Date(Date.now() + 2 * 60 * 60 * 1000);
        const fallbackMs =
          fallback instanceof Date
            ? fallback.getTime()
            : new Date(fallback).getTime();

        eta = {
          estimatedArrival: new Date(fallbackMs).toISOString(),
          confidenceLow: new Date(fallbackMs - 30 * 60 * 1000).toISOString(),
          confidenceHigh: new Date(fallbackMs + 30 * 60 * 1000).toISOString(),
          isAIPredicted: false,
          lastUpdated: new Date().toISOString(),
        };
      }

      // Cache for 5 minutes
      etaCache.set(trackingToken, {
        data: eta,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      return { data: eta };
    },
  );

  // ── GET AI ETA — PUBLIC (WIT-310) ─────────────────────────
  //
  // GET /track/:trackingCode/eta
  // Returns: { estimatedArrival, confidenceScore, distanceKm, trafficStatus }
  // Rate-limited 60 req/min per IP; cached in Redis for 60 s.
  // "trackingCode" maps to the order's trackingToken field.

  const ETA_REDIS_TTL = 60; // seconds
  const ETA_REDIS_PREFIX = "eta:public:";

  fastify.get(
    "/track/:trackingCode/eta",
    { preHandler: [trackingEtaRateLimiter] },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { trackingCode } = request.params as { trackingCode: string };

      // 1. Check Redis cache
      const redis = getRedis();
      const cacheKey = `${ETA_REDIS_PREFIX}${trackingCode}`;
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return { data: JSON.parse(cached) };
        }
      } catch {
        // Redis unavailable — continue without cache
      }

      // 2. Fetch order
      const order = await prisma.order.findUnique({
        where: { trackingToken: trackingCode },
        select: {
          id: true,
          estimatedArrival: true,
          deliveryLocation: true,
          driver: {
            select: { currentLocation: true },
          },
        },
      });

      if (!order) {
        throw new NotFoundError("Tracking", trackingCode);
      }

      // 3. Compute ETA via ML engine
      const driverLoc = order.driver?.currentLocation as {
        lat?: number;
        lng?: number;
      } | null;
      const destLoc = order.deliveryLocation as {
        lat?: number;
        lng?: number;
      } | null;

      let result: {
        estimatedArrival: string;
        confidenceScore: number;
        distanceKm: number;
        trafficStatus: string;
      };

      if (
        driverLoc?.lat != null &&
        driverLoc?.lng != null &&
        destLoc?.lat != null &&
        destLoc?.lng != null
      ) {
        const distKm = haversineKm(
          driverLoc.lat,
          driverLoc.lng,
          destLoc.lat,
          destLoc.lng,
        );
        const prediction = etaEngine.predictETA({
          origin: { lat: driverLoc.lat, lng: driverLoc.lng },
          destination: { lat: destLoc.lat, lng: destLoc.lng },
          distanceKm: distKm,
          departureTime: new Date(),
        });

        result = {
          estimatedArrival: prediction.prediction.expected.toISOString(),
          confidenceScore: prediction.confidence,
          distanceKm: Math.round(distKm * 10) / 10,
          trafficStatus: prediction.trafficCondition,
        };
      } else {
        // No driver location — return static DB estimate with low confidence
        const fallback = order.estimatedArrival
          ? new Date(order.estimatedArrival)
          : new Date(Date.now() + 2 * 60 * 60 * 1000);

        result = {
          estimatedArrival: fallback.toISOString(),
          confidenceScore: 0,
          distanceKm: 0,
          trafficStatus: "unknown",
        };
      }

      // 4. Store in Redis (fire-and-forget; never block the response)
      redis
        .set(cacheKey, JSON.stringify(result), "EX", ETA_REDIS_TTL)
        .catch(() => {});

      return { data: result };
    },
  );
}

// ─── Helpers ────────────────────────────────────────────────

async function resolveOrderByToken(trackingToken: string) {
  const order = await prisma.order.findUnique({
    where: { trackingToken },
    select: { id: true, shopId: true, status: true },
  });
  if (!order) {
    throw new NotFoundError("Tracking", trackingToken);
  }
  return order;
}

const STATUS_ORDER = [
  "PENDING",
  "ACCEPTED",
  "ASSIGNED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "ARRIVED",
  "DELIVERED",
] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Order received",
  ACCEPTED: "Order confirmed",
  ASSIGNED: "Driver assigned",
  PICKED_UP: "Picked up",
  OUT_FOR_DELIVERY: "On the way",
  ARRIVED: "Driver arrived",
  DELIVERED: "Delivered",
  FAILED: "Delivery failed",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

function buildTimeline(currentStatus: string) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus as any);

  return STATUS_ORDER.map((status, index) => ({
    status,
    label: STATUS_LABELS[status],
    completed: index <= currentIndex,
    current: status === currentStatus,
  }));
}

export default trackingRoutes;
