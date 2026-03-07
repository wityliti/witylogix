/**
 * Calendar Rules — API endpoints.
 *
 * Routes:
 *   GET    /                      List calendar rules (paginated, filterable)
 *   GET    /:id                   Get single rule
 *   POST   /                      Create calendar rule
 *   PATCH  /:id                   Update rule
 *   DELETE /:id                   Soft-deactivate (set isActive=false)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { NotFoundError } from "../lib/errors.js";
import {
  createCalendarRuleSchema,
  paginationSchema,
} from "@witylogix/validators";

// ─── Zod Schemas ────────────────────────────────────────────

const updateCalendarRuleSchema = createCalendarRuleSchema.partial();

const listQuerySchema = paginationSchema.extend({
  shippingProfileId: z.string().uuid().optional(),
  type: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

// ─── Route Plugin ───────────────────────────────────────────

export default async function calendarRuleRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  // All routes require authentication + tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET / — List calendar rules ────────────────────────────

  fastify.get(
    "/",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = listQuerySchema.parse(request.query);
      const shopId = request.shopId;

      const where: Record<string, unknown> = { shopId };

      if (query.shippingProfileId) {
        where.shippingProfileId = query.shippingProfileId;
      }

      if (query.type) {
        where.type = query.type;
      }

      if (query.isActive !== undefined) {
        where.isActive = query.isActive;
      }

      const [rules, total] = await Promise.all([
        request.tenantDb.calendarRule.findMany({
          where,
          orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
          take: query.limit,
          skip: (query.page - 1) * query.limit,
          select: {
            id: true,
            shippingProfileId: true,
            name: true,
            type: true,
            daysOfWeek: true,
            startTime: true,
            endTime: true,
            cutoffMinutes: true,
            maxCapacityPerDay: true,
            isActive: true,
            priority: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        request.tenantDb.calendarRule.count({ where }),
      ]);

      const totalPages = Math.ceil(total / query.limit);

      return {
        data: rules,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages,
        },
      };
    },
  );

  // ── GET /:id — Get single rule ──────────────────────────────

  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const shopId = request.shopId;

      const rule = await request.tenantDb.calendarRule.findUnique({
        where: { id, shopId },
      });

      if (!rule) {
        throw new NotFoundError("CalendarRule", id);
      }

      return { data: rule };
    },
  );

  // ── POST / — Create calendar rule ──────────────────────────

  fastify.post<{ Body: Record<string, unknown> }>(
    "/",
    { preHandler: [requireRole("ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createCalendarRuleSchema.parse(request.body);
      const shopId = request.shopId;

      // If shippingProfileId is provided, verify it exists
      if (body.shippingProfileId) {
        const profile = await request.tenantDb.shippingProfile.findUnique({
          where: { id: body.shippingProfileId, shopId },
        });

        if (!profile) {
          throw new NotFoundError(
            "ShippingProfile",
            body.shippingProfileId,
          );
        }
      }

      const rule = await request.tenantDb.calendarRule.create({
        data: {
          shopId,
          shippingProfileId: body.shippingProfileId || null,
          name: body.name,
          type: body.type,
          daysOfWeek: body.daysOfWeek,
          startTime: body.startTime || null,
          endTime: body.endTime || null,
          cutoffMinutes: body.cutoffMinutes,
          maxCapacityPerDay: body.maxCapacityPerDay || null,
          blackoutDates: body.blackoutDates as string[],
          effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : null,
          effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
          surcharge: body.surcharge,
          priority: body.priority,
          isActive: true,
        },
      });

      return reply.status(201).send({ data: rule });
    },
  );

  // ── PATCH /:id — Update rule ───────────────────────────────

  fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/:id",
    { preHandler: [requireRole("ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = updateCalendarRuleSchema.parse(request.body);
      const shopId = request.shopId;

      // Verify rule exists
      const existing = await request.tenantDb.calendarRule.findUnique({
        where: { id, shopId },
      });

      if (!existing) {
        throw new NotFoundError("CalendarRule", id);
      }

      // If shippingProfileId is being updated, verify it exists
      if (body.shippingProfileId) {
        const profile = await request.tenantDb.shippingProfile.findUnique({
          where: { id: body.shippingProfileId, shopId },
        });

        if (!profile) {
          throw new NotFoundError(
            "ShippingProfile",
            body.shippingProfileId,
          );
        }
      }

      // Process date fields
      const updateData: Record<string, unknown> = { ...body };
      if (body.effectiveFrom) {
        updateData.effectiveFrom = new Date(body.effectiveFrom as string);
      }
      if (body.effectiveTo) {
        updateData.effectiveTo = new Date(body.effectiveTo as string);
      }

      const updated = await request.tenantDb.calendarRule.update({
        where: { id, shopId },
        data: updateData,
      });

      return { data: updated };
    },
  );

  // ── DELETE /:id — Soft-deactivate rule ─────────────────────

  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireRole("ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const shopId = request.shopId;

      const existing = await request.tenantDb.calendarRule.findUnique({
        where: { id, shopId },
      });

      if (!existing) {
        throw new NotFoundError("CalendarRule", id);
      }

      // Soft deactivate
      const updated = await request.tenantDb.calendarRule.update({
        where: { id, shopId },
        data: { isActive: false },
      });

      return { data: updated };
    },
  );
}
