/**
 * Checkout API — Delivery Slots
 *
 * Routes:
 *   GET    /api/checkout/slots?date=&zone=&location= — Get available slots
 *   GET    /api/checkout/slots/range?start=&end=&zone= — Slots for date range
 *   POST   /api/checkout/slots/reserve — Reserve a slot for an order
 *   DELETE /api/checkout/slots/reserve/:id — Release a reservation
 *   GET    /api/checkout/slots/capacity?date=&location= — Get capacity info
 *   GET    /api/checkout/slots/deadline?slotId=&date= — Get order deadline
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { SlotEngine } from "@witylogix/core/slots";
import { CapacityManager } from "@witylogix/core/slots";
import { DeadlineEngine } from "@witylogix/core/slots";
import { BlackoutManager } from "@witylogix/core/slots";
import {
  SlotNotFoundError,
  SlotFullError,
  BlackoutDateError,
} from "@witylogix/core/slots";
import { NotFoundError, ValidationError } from "../../lib/errors.js";

// ─── SCHEMAS ────────────────────────────────────────────────────

const getAvailableSlotsSchema = z.object({
  date: z.string().date(), // YYYY-MM-DD
  zoneId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
});

const getSlotsByRangeSchema = z.object({
  start: z.string().date(), // YYYY-MM-DD
  end: z.string().date(),
  zoneId: z.string().uuid().optional(),
});

const reserveSlotSchema = z.object({
  slotId: z.string().uuid(),
  orderId: z.string().min(1),
  expiresInMinutes: z.number().int().positive().default(30),
});

const releaseReservationSchema = z.object({
  reservationId: z.string().uuid(),
});

const getCapacitySchema = z.object({
  date: z.string().date(),
  locationId: z.string().uuid(),
});

const getDeadlineSchema = z.object({
  slotId: z.string().uuid(),
  date: z.string().date(),
});

// ─── RATE LIMITING MIDDLEWARE ───────────────────────────────────

async function rateLimitCheckout(req: FastifyRequest, reply: FastifyReply) {
  // Implement rate limiting for checkout endpoints
  // Use Redis or in-memory cache for rate limiting
  const key = `checkout:${req.ip}`;
  // Rate limit: 100 requests per minute
  // TODO: Implement with Redis connection
}

// ─── ROUTE PLUGIN ───────────────────────────────────────────────

async function checkoutSlotsRoutes(fastify: FastifyInstance): Promise<void> {
  // Initialize slot engines
  let slotEngine: SlotEngine | null = null;
  let capacityManager: CapacityManager | null = null;
  let deadlineEngine: DeadlineEngine | null = null;
  let blackoutManager: BlackoutManager | null = null;

  // Initialize engines on first request (lazy load)
  const initializeEngines = async () => {
    if (!slotEngine) {
      slotEngine = new SlotEngine((fastify as any).prisma);
      capacityManager = new CapacityManager((fastify as any).prisma);
      deadlineEngine = new DeadlineEngine((fastify as any).prisma);
      blackoutManager = new BlackoutManager((fastify as any).prisma);
    }
  };

  // ── GET AVAILABLE SLOTS ────────────────────────────────────────

  fastify.get(
    "/api/checkout/slots",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await initializeEngines();

        const { date, zoneId, locationId } = getAvailableSlotsSchema.parse(
          request.query,
        );

        const slotDate = new Date(date);

        // Check for blackouts
        if (locationId) {
          const isBlackedOut = await blackoutManager!.isBlackedOut(
            locationId,
            slotDate,
          );
          if (isBlackedOut) {
            const blackouts = await blackoutManager!.getBlackouts(
              locationId,
              slotDate,
              slotDate,
            );
            return reply.status(200).send({
              data: [],
              message: `Location is closed: ${blackouts[0]?.reason || "Unavailable"}`,
            });
          }
        }

        const slots = await slotEngine!.getAvailableSlots(
          slotDate,
          zoneId,
          locationId,
        );

        return {
          data: slots,
          count: slots.length,
          date: date,
        };
      } catch (error: any) {
        if (error instanceof ValidationError) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  // ── GET SLOTS FOR DATE RANGE ───────────────────────────────────

  fastify.get(
    "/api/checkout/slots/range",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await initializeEngines();

        const { start, end, zoneId } = getSlotsByRangeSchema.parse(
          request.query,
        );

        const startDate = new Date(start);
        const endDate = new Date(end);

        if (startDate > endDate) {
          return reply.status(400).send({
            error: "start date must be before end date",
          });
        }

        // Limit range to 90 days
        const daysDiff = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysDiff > 90) {
          return reply.status(400).send({
            error: "Date range cannot exceed 90 days",
          });
        }

        const slots = await slotEngine!.getSlotsByDateRange(
          startDate,
          endDate,
          zoneId,
        );

        const result: Record<string, any[]> = {};
        slots.forEach((value, key) => {
          result[key] = value;
        });

        return {
          data: result,
          startDate: start,
          endDate: end,
          dayCount: Object.keys(result).length,
        };
      } catch (error: any) {
        if (error instanceof ValidationError) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  // ── RESERVE SLOT ───────────────────────────────────────────────

  fastify.post(
    "/api/checkout/slots/reserve",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await initializeEngines();

        const { slotId, orderId, expiresInMinutes } = reserveSlotSchema.parse(
          request.body,
        );

        const result = await slotEngine!.reserveSlot(
          slotId,
          orderId,
          expiresInMinutes,
        );

        if (!result.success) {
          return reply.status(409).send({
            error: result.error || "Unable to reserve slot",
            slotId,
            orderId,
          });
        }

        reply.status(201);
        return {
          data: {
            slotId: result.slotId,
            orderId: result.orderId,
            expiresAt: result.expiresAt,
            status: "PENDING",
          },
          message: result.message,
        };
      } catch (error: any) {
        if (error instanceof SlotNotFoundError) {
          return reply.status(404).send({ error: error.message });
        }
        if (error instanceof SlotFullError) {
          return reply.status(409).send({ error: error.message });
        }
        if (error instanceof BlackoutDateError) {
          return reply.status(400).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  // ── RELEASE RESERVATION ────────────────────────────────────────

  fastify.delete(
    "/api/checkout/slots/reserve/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await initializeEngines();

        const { id: reservationId } = request.params as { id: string };
        const { orderId } = request.body as { orderId: string };

        if (!orderId) {
          return reply.status(400).send({
            error: "orderId is required in request body",
          });
        }

        // Get reservation to extract slotId
        const reservation = await (
          fastify as any
        ).prisma.slotReservation.findUnique({
          where: { id: reservationId },
        });

        if (!reservation) {
          return reply.status(404).send({
            error: `Reservation ${reservationId} not found`,
          });
        }

        await slotEngine!.releaseSlot(reservation.slotId, orderId);

        return {
          message: "Reservation released successfully",
          reservationId,
        };
      } catch (error: any) {
        if (error instanceof NotFoundError) {
          return reply.status(404).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  // ── GET CAPACITY INFO ──────────────────────────────────────────

  fastify.get(
    "/api/checkout/slots/capacity",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await initializeEngines();

        const { date, locationId } = getCapacitySchema.parse(request.query);

        const capacityDate = new Date(date);
        const report = await capacityManager!.getCapacityUtilization(
          locationId,
          capacityDate,
        );

        return {
          data: {
            locationId: report.locationId,
            date: report.date,
            totalCapacity: report.totalCapacity,
            currentUsage: report.currentUsage,
            availableSlots: report.availableSlots,
            percentUtilized: Math.round(report.percentUtilized * 100) / 100,
            status: report.status,
            peakHours: report.peakHours,
            recommendations: report.recommendations,
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

  // ── GET ORDER DEADLINE ─────────────────────────────────────────

  fastify.get(
    "/api/checkout/slots/deadline",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await initializeEngines();

        const { slotId, date } = getDeadlineSchema.parse(request.query);

        const slotDate = new Date(date);
        const deadline = await deadlineEngine!.getOrderDeadline(
          slotDate,
          slotId,
        );

        if (!deadline) {
          return reply.status(404).send({
            error: "Unable to determine deadline for slot",
          });
        }

        const compliance = await deadlineEngine!.checkDeadlineCompliance(
          "", // orderId not needed for this check
          slotId,
          slotDate,
        );

        return {
          data: {
            deadline: deadline.deadline,
            cutoffHours: deadline.cutoffHours,
            prepTime: deadline.prepTime,
            isPastDeadline: deadline.isPastDeadline,
            hoursRemaining: compliance.hoursRemaining,
            message: compliance.message,
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

  // ── HEALTH CHECK ───────────────────────────────────────────────

  fastify.get(
    "/api/checkout/slots/health",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return {
        status: "ok",
        service: "checkout-slots",
        timestamp: new Date().toISOString(),
      };
    },
  );
}

export default checkoutSlotsRoutes;
