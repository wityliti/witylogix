/**
 * Checkout API — Delivery Rates
 *
 * Routes:
 *   GET    /api/checkout/rates?zipcode= — Get rate by zipcode
 *   POST   /api/checkout/rates/calculate — Calculate delivery rate
 *   GET    /api/checkout/zones — List delivery zones
 *   PATCH  /api/checkout/zones/:id/rates — Update zone rates (admin)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { ZoneRateCalculator } from "@witylogix/core/slots";
import { ValidationError } from "../../lib/errors.js";

// ─── SCHEMAS ────────────────────────────────────────────────────

const getRateByZipcodeSchema = z.object({
  zipcode: z.string().min(3).max(10),
});

const calculateRateSchema = z.object({
  zipcode: z.string().min(3).max(10),
  cartValue: z.number().nonnegative().default(0),
  weight: z.number().nonnegative().default(0), // kg
  productTypes: z.array(z.string()).optional(),
  originLatitude: z.number().min(-90).max(90).optional(),
  originLongitude: z.number().min(-180).max(180).optional(),
  destinationLatitude: z.number().min(-90).max(90).optional(),
  destinationLongitude: z.number().min(-180).max(180).optional(),
});

const getZonesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z.coerce.boolean().default(true).optional(),
});

const updateZoneRatesSchema = z.object({
  baseRate: z.number().nonnegative().optional(),
  perKmRate: z.number().nonnegative().optional(),
  perMileRate: z.number().nonnegative().optional(),
  freeThreshold: z.number().nonnegative().optional(),
  minimumCharge: z.number().nonnegative().optional(),
  weightRates: z
    .array(
      z.object({
        minWeight: z.number().nonnegative(),
        maxWeight: z.number().nonnegative(),
        ratePerUnit: z.number().nonnegative(),
      }),
    )
    .optional(),
  cartValueTiers: z
    .array(
      z.object({
        minValue: z.number().nonnegative(),
        maxValue: z.number().nonnegative().optional(),
        rate: z.number().nonnegative(),
        rateName: z.string(),
      }),
    )
    .optional(),
});

// ─── ROUTE PLUGIN ───────────────────────────────────────────────

async function checkoutRatesRoutes(fastify: FastifyInstance): Promise<void> {
  let rateCalculator: ZoneRateCalculator | null = null;

  const initializeCalculator = async () => {
    if (!rateCalculator) {
      rateCalculator = new ZoneRateCalculator((fastify as any).prisma);
    }
  };

  // ── GET RATE BY ZIPCODE ────────────────────────────────────────

  fastify.get(
    "/api/checkout/rates",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await initializeCalculator();

        const { zipcode } = getRateByZipcodeSchema.parse(request.query);

        const zoneRate = await rateCalculator!.getRateByZipcode(zipcode);

        if (!zoneRate) {
          return reply.status(404).send({
            error: `No delivery zone found for zipcode ${zipcode}`,
          });
        }

        return {
          data: {
            zoneId: zoneRate.zoneId,
            zoneName: zoneRate.zoneName,
            baseRate: parseFloat(zoneRate.baseRate.toString()),
            perKmRate: parseFloat(zoneRate.perKmRate.toString()),
            freeThreshold: parseFloat(zoneRate.freeThreshold.toString()),
            minimumCharge: parseFloat(zoneRate.minimumCharge.toString()),
          },
        };
      } catch (error: any) {
        if (error instanceof ValidationError) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  // ── CALCULATE DELIVERY RATE ────────────────────────────────────

  fastify.post(
    "/api/checkout/rates/calculate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await initializeCalculator();

        const input = calculateRateSchema.parse(request.body);

        const breakdown = await rateCalculator!.calculateRate({
          address: {
            zipcode: input.zipcode,
          },
          cartValue: input.cartValue,
          weight: input.weight,
          productTypes: input.productTypes,
          ...(input.originLatitude &&
            input.originLongitude && {
            origin: {
              latitude: input.originLatitude,
              longitude: input.originLongitude,
            },
          }),
          ...(input.destinationLatitude &&
            input.destinationLongitude && {
            destination: {
              latitude: input.destinationLatitude,
              longitude: input.destinationLongitude,
            },
          }),
        });

        return {
          data: {
            baseFee: parseFloat(breakdown.baseFee.toString()),
            distanceFee: parseFloat(breakdown.distanceFee.toString()),
            weightFee: parseFloat(breakdown.weightFee.toString()),
            cartValueFee: parseFloat(breakdown.cartValueFee.toString()),
            discounts: parseFloat(breakdown.discounts.toString()),
            subtotal: parseFloat(breakdown.subtotal.toString()),
            total: parseFloat(breakdown.total.toString()),
            currency: breakdown.currency,
            breakdown: breakdown.breakdown.map((b) => ({
              label: b.label,
              amount: parseFloat(b.amount.toString()),
              method: b.method,
            })),
          },
        };
      } catch (error: any) {
        if (error instanceof ValidationError) {
          return reply.status(400).send({ error: error.message });
        }
        if (error.message.includes("No delivery zone found")) {
          return reply.status(404).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  // ── GET DELIVERY ZONES ─────────────────────────────────────────

  fastify.get(
    "/api/checkout/zones",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { page, limit, isActive } = getZonesSchema.parse(request.query);

        const where: any = {};
        if (isActive !== undefined) {
          where.isActive = isActive;
        }

        const [zones, total] = await Promise.all([
          (fastify as any).prisma.deliveryZone.findMany({
            where,
            orderBy: { priority: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            select: {
              id: true,
              name: true,
              baseRate: true,
              perKmRate: true,
              minOrder: true,
              freeAbove: true,
              isActive: true,
              priority: true,
            },
          }),
          (fastify as any).prisma.deliveryZone.count({ where }),
        ]);

        return {
          data: zones.map((z: any) => ({
            id: z.id,
            name: z.name,
            baseRate: parseFloat(z.baseRate),
            perKmRate: parseFloat(z.perKmRate),
            minimumOrder: parseFloat(z.minOrder),
            freeAbove: z.freeAbove ? parseFloat(z.freeAbove) : null,
            isActive: z.isActive,
            priority: z.priority,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      } catch (error: any) {
        if (error instanceof ValidationError) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  // ── GET ZONE DETAILS ───────────────────────────────────────────

  fastify.get(
    "/api/checkout/zones/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await initializeCalculator();

        const { id: zoneId } = request.params as { id: string };

        const zone = await (fastify as any).prisma.deliveryZone.findUnique({
          where: { id: zoneId },
        });

        if (!zone) {
          return reply.status(404).send({
            error: `Zone ${zoneId} not found`,
          });
        }

        const rates = await rateCalculator!.getZoneRates(zoneId);

        return {
          data: {
            id: zone.id,
            name: zone.name,
            baseRate: parseFloat(zone.baseRate),
            perKmRate: parseFloat(zone.perKmRate),
            minimumOrder: parseFloat(zone.minOrder),
            freeAbove: zone.freeAbove ? parseFloat(zone.freeAbove) : null,
            isActive: zone.isActive,
            priority: zone.priority,
            metadata: zone.metadata,
            weightRates: rates.weightRates || [],
            cartValueTiers: rates.cartValueTiers || [],
          },
        };
      } catch (error: any) {
        if (error instanceof ValidationError) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  // ── UPDATE ZONE RATES (ADMIN) ──────────────────────────────────

  fastify.patch(
    "/api/checkout/zones/:id/rates",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Add auth check for admin
        // await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

        await initializeCalculator();

        const { id: zoneId } = request.params as { id: string };
        const updates = updateZoneRatesSchema.parse(request.body);

        const updated = await rateCalculator!.updateZoneRates(zoneId, updates);

        return {
          data: {
            id: updated.zoneId,
            baseRate: parseFloat(updated.baseRate.toString()),
            perKmRate: parseFloat(updated.perKmRate.toString()),
            freeThreshold: parseFloat(updated.freeThreshold.toString()),
            minimumCharge: parseFloat(updated.minimumCharge.toString()),
            message: "Zone rates updated successfully",
          },
        };
      } catch (error: any) {
        if (error instanceof ValidationError) {
          return reply.status(400).send({ error: error.message });
        }
        if (error.message.includes("not found")) {
          return reply.status(404).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  // ── HEALTH CHECK ───────────────────────────────────────────────

  fastify.get(
    "/api/checkout/rates/health",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return {
        status: "ok",
        service: "checkout-rates",
        timestamp: new Date().toISOString(),
      };
    },
  );
}

export default checkoutRatesRoutes;
