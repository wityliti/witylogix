/**
 * Carrier Service — Shopify Carrier Service API endpoint + carrier coverage matrix.
 *
 * This is the performance-critical endpoint that Shopify calls during checkout
 * to get shipping rates. Target: p95 < 500ms response time.
 *
 * Routes:
 *   POST /rates         Calculate shipping rates (called by Shopify)
 *   GET  /services      List carrier services for the tenant
 *   POST /services      Register a new carrier service
 *   GET  /adapters      List registered native carrier adapters (coverage matrix)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { carrierRateRequestSchema } from "@witylogix/validators";
import { verifyCarrierRequest, requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { getCachedRate, setCachedRate } from "../lib/redis.js";
import { ValidationError } from "../lib/errors.js";

// ─── Route Plugin ───────────────────────────────────────────

async function carriersRoutes(fastify: FastifyInstance): Promise<void> {
  // ── CALCULATE RATES (Shopify callback — no JWT, uses HMAC) ─

  fastify.post(
    "/rates",
    { preHandler: [verifyCarrierRequest, tenantContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const startTime = Date.now();
      const body = carrierRateRequestSchema.parse(request.body);
      const { origin, destination, items, currency } = body.rate;

      // Calculate total weight in grams
      const totalGrams = items.reduce(
        (sum, item) => sum + item.grams * item.quantity,
        0,
      );
      const totalWeightKg = totalGrams / 1000;

      // Weight bucket for cache key (round to nearest 0.5kg)
      const weightBucket = Math.ceil(totalWeightKg * 2) / 2;

      // ── Check Redis cache first ───────────────────────────
      const cached = await getCachedRate(
        request.shopId,
        origin.postal_code,
        destination.postal_code,
        weightBucket,
      );

      if (cached) {
        request.log.debug({ cacheHit: true }, "Carrier rate cache hit");
        return { rates: JSON.parse(cached) };
      }

      // ── Find matching delivery zone ───────────────────────
      // Geocode destination to find zone (if we have coordinates)
      // For now, use postal-code-based zone matching as a fallback
      const zones = await request.tenantDb.$queryRaw<
        Array<{
          id: string;
          name: string;
          base_rate: number;
          per_km_rate: number;
          min_order: number;
          free_above: number | null;
        }>
      >`
        SELECT id::text, name, base_rate, per_km_rate, min_order, free_above
        FROM delivery_zones
        WHERE shop_id = ${request.shopId}::uuid
          AND is_active = true
        ORDER BY priority DESC
      `;

      if (zones.length === 0) {
        // No zones configured — return empty rates (Shopify will fall back)
        return { rates: [] };
      }

      // ── Calculate rates per zone ──────────────────────────
      const totalPrice = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      const rates = zones.map((zone) => {
        const baseRate = Number(zone.base_rate);
        const freeAbove = zone.free_above ? Number(zone.free_above) : null;

        // Free shipping if order above threshold
        if (freeAbove && totalPrice >= freeAbove * 100) {
          return {
            service_name: `${zone.name} (Free)`,
            service_code: `witylogix_${zone.id}`,
            total_price: 0,
            description: `Free delivery for orders over ${currency} ${freeAbove}`,
            currency,
            min_delivery_date: getDeliveryDate(1),
            max_delivery_date: getDeliveryDate(3),
          };
        }

        // Base rate + weight surcharge
        const weightSurcharge = totalWeightKg > 5 ? Math.ceil((totalWeightKg - 5) / 5) * 200 : 0;
        const rateInCents = Math.round(baseRate * 100) + weightSurcharge;

        return {
          service_name: zone.name,
          service_code: `witylogix_${zone.id}`,
          total_price: rateInCents,
          description: `Delivery by Witylogix`,
          currency,
          min_delivery_date: getDeliveryDate(1),
          max_delivery_date: getDeliveryDate(3),
        };
      });

      // ── Cache the result ──────────────────────────────────
      await setCachedRate(
        request.shopId,
        origin.postal_code,
        destination.postal_code,
        weightBucket,
        JSON.stringify(rates),
      );

      const elapsed = Date.now() - startTime;
      request.log.info({ elapsed, rateCount: rates.length }, "Carrier rates calculated");

      return { rates };
    },
  );

  // ── LIST CARRIER SERVICES ─────────────────────────────────

  fastify.get(
    "/services",
    { preHandler: [requireAuth, tenantContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const services = await request.tenantDb.carrierService.findMany({
        orderBy: { createdAt: "desc" },
      });

      return { data: services };
    },
  );

  // ── REGISTER CARRIER SERVICE ──────────────────────────────

  const createServiceSchema = z.object({
    name: z.string().min(1).max(100),
    callbackUrl: z.string().url(),
  });

  fastify.post(
    "/services",
    { preHandler: [requireAuth, tenantContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const body = createServiceSchema.parse(request.body);

      const service = await request.tenantDb.carrierService.create({
        data: {
          shopId: request.shopId,
          ...body,
        },
      });

      reply.status(201);
      return { data: service };
    },
  );

  // ── LIST NATIVE CARRIER ADAPTERS (coverage matrix) ───────────

  fastify.get(
    "/adapters",
    { preHandler: [requireAuth, tenantContext] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      // Lazy-import to avoid hard dep when carriers not configured
      let entries: Array<{ name: string; label: string; enabled: boolean; configSource: string }> = [];
      try {
        const { carrierRegistry } = await import("@witylogix/core/integrations/shipping");
        entries = carrierRegistry.list().map(({ name, label, enabled, configSource }) => ({
          name,
          label,
          enabled,
          configSource,
        }));
      } catch {
        // core not available or no adapters bootstrapped — return empty
      }

      return {
        data: entries,
        total: entries.length,
      };
    },
  );
}

// ─── Helpers ────────────────────────────────────────────────

function getDeliveryDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split("T")[0];
}

export default carriersRoutes;
