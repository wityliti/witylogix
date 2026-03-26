/**
 * Time Slots — delivery window management.
 *
 * Routes:
 *   GET    /              List time slots (filterable by zone)
 *   GET    /:id           Get time slot
 *   POST   /              Create time slot
 *   PATCH  /:id           Update time slot
 *   DELETE /:id           Deactivate time slot
 *   GET    /available     Get available time slots for a date/zone (checkout API)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { paginationSchema } from "@witylogix/validators";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError } from "../lib/errors.js";

// ─── Schemas ────────────────────────────────────────────────

const createTimeSlotSchema = z.object({
  name: z.string().min(1).max(100),
  deliveryZoneId: z.string().uuid().nullable().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:mm
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  maxCapacity: z.number().int().positive().default(50),
  cutoffMinutes: z.number().int().nonnegative().default(120),
  surcharge: z.number().nonnegative().default(0),
});

const availableQuery = z.object({
  date: z.string(), // YYYY-MM-DD
  zoneId: z.string().uuid().optional(),
});

// ─── Route Plugin ───────────────────────────────────────────

async function timeSlotsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── LIST TIME SLOTS ───────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const { page, limit } = paginationSchema.parse(request.query);
    const zoneId = (request.query as any)?.zoneId;

    const where: any = {};
    if (zoneId) where.deliveryZoneId = zoneId;

    const [slots, total] = await Promise.all([
      request.tenantDb.timeSlot.findMany({
        where,
        orderBy: { startTime: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          deliveryZone: { select: { id: true, name: true } },
        },
      }),
      request.tenantDb.timeSlot.count({ where }),
    ]);

    return {
      data: slots,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── GET TIME SLOT ─────────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const slot = await request.tenantDb.timeSlot.findUnique({
      where: { id },
      include: { deliveryZone: true },
    });

    if (!slot) throw new NotFoundError("TimeSlot", id);
    return { data: slot };
  });

  // ── CREATE TIME SLOT ──────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const body = createTimeSlotSchema.parse(request.body);

    const slot = await request.tenantDb.timeSlot.create({
      data: {
        shopId: request.shopId,
        ...body,
      },
    });

    reply.status(201);
    return { data: slot };
  });

  // ── UPDATE TIME SLOT ──────────────────────────────────────

  const updateTimeSlotSchema = createTimeSlotSchema.partial();

  fastify.patch("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const { id } = request.params as { id: string };
    const body = updateTimeSlotSchema.parse(request.body);

    const existing = await request.tenantDb.timeSlot.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("TimeSlot", id);

    const slot = await request.tenantDb.timeSlot.update({
      where: { id },
      data: body,
    });

    return { data: slot };
  });

  // ── DEACTIVATE TIME SLOT ──────────────────────────────────

  fastify.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const { id } = request.params as { id: string };

    const existing = await request.tenantDb.timeSlot.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("TimeSlot", id);

    const deactivated = await request.tenantDb.timeSlot.update({
      where: { id },
      data: { isActive: false },
    });

    return { data: deactivated };
  });

  // ── AVAILABLE SLOTS (for checkout) ────────────────────────

  fastify.get("/available", async (request: FastifyRequest, reply: FastifyReply) => {
    const { date, zoneId } = availableQuery.parse(request.query);
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay(); // 0=Sun, 6=Sat
    const now = new Date();

    const where: any = {
      isActive: true,
      daysOfWeek: { has: dayOfWeek },
    };
    if (zoneId) where.deliveryZoneId = zoneId;

    const slots = await request.tenantDb.timeSlot.findMany({
      where,
      orderBy: { startTime: "asc" },
      include: {
        deliveryZone: { select: { id: true, name: true } },
      },
    });

    // Filter by cutoff time and check capacity
    const available = await Promise.all(
      slots.map(async (slot) => {
        // Check if past cutoff
        const [hours, minutes] = slot.startTime.split(":").map(Number);
        const slotStart = new Date(targetDate);
        slotStart.setHours(hours, minutes, 0, 0);
        const cutoff = new Date(slotStart.getTime() - slot.cutoffMinutes * 60 * 1000);

        if (now > cutoff) {
          return null; // Past cutoff, not available
        }

        // Check capacity
        const bookedCount = await request.tenantDb.order.count({
          where: {
            timeSlotId: slot.id,
            deliveryDate: {
              gte: targetDate,
              lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
            },
            status: { notIn: ["CANCELLED", "RETURNED"] },
          },
        });

        const remainingCapacity = slot.maxCapacity - bookedCount;
        if (remainingCapacity <= 0) return null;

        return {
          id: slot.id,
          name: slot.name,
          startTime: slot.startTime,
          endTime: slot.endTime,
          surcharge: slot.surcharge,
          remainingCapacity,
          zone: slot.deliveryZone,
        };
      }),
    );

    return { data: available.filter(Boolean) };
  });
}

export default timeSlotsRoutes;
