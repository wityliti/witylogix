/**
 * Shipping Profiles — API endpoints.
 *
 * Routes:
 *   GET    /                      List shipping profiles (paginated, filterable)
 *   GET    /:id                   Get profile with locations and calendar rules
 *   POST   /                      Create shipping profile
 *   PATCH  /:id                   Update profile
 *   DELETE /:id                   Soft-deactivate (set isActive=false)
 *   POST   /:id/locations         Link location to profile
 *   DELETE /:id/locations/:locationId  Unlink location from profile
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
} from "../lib/errors.js";
import {
  createShippingProfileSchema,
  paginationSchema,
} from "@witylogix/validators";

// ─── Zod Schemas ────────────────────────────────────────────

const updateShippingProfileSchema = createShippingProfileSchema.partial();

const listQuerySchema = paginationSchema.extend({
  deliveryMethod: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

// ─── Route Plugin ───────────────────────────────────────────

export default async function shippingProfileRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  // All routes require authentication + tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET / — List shipping profiles ──────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listQuerySchema.parse(request.query);
    const shopId = request.shopId;

    const where: Record<string, unknown> = { shopId };

    if (query.deliveryMethod) {
      where.deliveryMethod = query.deliveryMethod;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [profiles, total] = await Promise.all([
      request.tenantDb.shippingProfile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit,
        skip: (query.page - 1) * query.limit,
        select: {
          id: true,
          name: true,
          description: true,
          deliveryMethod: true,
          isDefault: true,
          isActive: true,
          processingTimeHours: true,
          rateType: true,
          flatRate: true,
          freeShippingAbove: true,
          minOrderAmount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      request.tenantDb.shippingProfile.count({ where }),
    ]);

    const totalPages = Math.ceil(total / query.limit);

    return {
      data: profiles,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  });

  // ── GET /:id — Get profile with locations and calendar rules ──

  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const shopId = request.shopId;

      const profile = await request.tenantDb.shippingProfile.findUnique({
        where: { id, shopId },
        include: {
          locations: {
            select: {
              locationId: true,
              location: {
                select: {
                  id: true,
                  name: true,
                  city: true,
                  province: true,
                  country: true,
                },
              },
            },
          },
          calendarRules: {
            select: {
              id: true,
              name: true,
              type: true,
              isActive: true,
              priority: true,
            },
            orderBy: { priority: "asc" },
          },
        },
      });

      if (!profile) {
        throw new NotFoundError("ShippingProfile", id);
      }

      return {
        data: {
          ...profile,
          locations: profile.locations.map((pl: any) => pl.location),
        },
      };
    },
  );

  // ── POST / — Create shipping profile ────────────────────────

  fastify.post<{ Body: Record<string, unknown> }>(
    "/",
    { preHandler: [requireRole("ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = createShippingProfileSchema.parse(request.body);
      const shopId = request.shopId;

      // Check for duplicate default
      if (body.isDefault) {
        const existing = await request.tenantDb.shippingProfile.findFirst({
          where: { shopId, isDefault: true, isActive: true },
        });

        if (existing) {
          throw new ConflictError("Only one default shipping profile allowed");
        }
      }

      const profile = await request.tenantDb.shippingProfile.create({
        data: {
          shopId,
          name: body.name,
          description: body.description,
          deliveryMethod: body.deliveryMethod,
          isDefault: body.isDefault,
          processingTimeHours: body.processingTimeHours,
          rateType: body.rateType,
          flatRate: body.flatRate,
          freeShippingAbove: body.freeShippingAbove,
          minOrderAmount: body.minOrderAmount,
          rateRules: body.rateRules as Record<string, unknown>[],
          isActive: true,
        },
      });

      return reply.status(201).send({ data: profile });
    },
  );

  // ── PATCH /:id — Update profile ────────────────────────────

  fastify.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/:id",
    { preHandler: [requireRole("ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = updateShippingProfileSchema.parse(request.body);
      const shopId = request.shopId;

      // Verify profile exists
      const existing = await request.tenantDb.shippingProfile.findUnique({
        where: { id, shopId },
      });

      if (!existing) {
        throw new NotFoundError("ShippingProfile", id);
      }

      // Check for duplicate default if setting as default
      if (body.isDefault && !existing.isDefault) {
        const otherDefault = await request.tenantDb.shippingProfile.findFirst({
          where: { shopId, isDefault: true, isActive: true, NOT: { id } },
        });

        if (otherDefault) {
          throw new ConflictError("Only one default shipping profile allowed");
        }
      }

      const updated = await request.tenantDb.shippingProfile.update({
        where: { id, shopId },
        data: body as Record<string, unknown>,
      });

      return { data: updated };
    },
  );

  // ── DELETE /:id — Soft-deactivate profile ───────────────────

  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [requireRole("ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const shopId = request.shopId;

      const existing = await request.tenantDb.shippingProfile.findUnique({
        where: { id, shopId },
      });

      if (!existing) {
        throw new NotFoundError("ShippingProfile", id);
      }

      // Soft deactivate
      const updated = await request.tenantDb.shippingProfile.update({
        where: { id, shopId },
        data: { isActive: false },
      });

      return { data: updated };
    },
  );

  // ── POST /:id/locations — Link location to profile ──────────

  fastify.post<{
    Params: { id: string };
    Body: { locationId: string };
  }>(
    "/:id/locations",
    { preHandler: [requireRole("ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { locationId } = request.body as { locationId: string };
      const shopId = request.shopId;

      // Verify profile exists
      const profile = await request.tenantDb.shippingProfile.findUnique({
        where: { id, shopId },
      });

      if (!profile) {
        throw new NotFoundError("ShippingProfile", id);
      }

      // Verify location exists
      const location = await request.tenantDb.location.findUnique({
        where: { id: locationId, shopId },
      });

      if (!location) {
        throw new NotFoundError("Location", locationId);
      }

      // Check for existing link
      const existing =
        await request.tenantDb.shippingProfileLocation.findUnique({
          where: {
            shippingProfileId_locationId: {
              shippingProfileId: id,
              locationId,
            },
          },
        });

      if (existing) {
        throw new ConflictError("Location already linked to this profile");
      }

      const link = await request.tenantDb.shippingProfileLocation.create({
        data: {
          shippingProfileId: id,
          locationId,
        },
      });

      return reply.status(201).send({ data: link });
    },
  );

  // ── DELETE /:id/locations/:locationId — Unlink location ──────

  fastify.delete<{ Params: { id: string; locationId: string } }>(
    "/:id/locations/:locationId",
    { preHandler: [requireRole("ADMIN")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, locationId } = request.params as {
        id: string;
        locationId: string;
      };
      const shopId = request.shopId;

      // Verify profile exists
      const profile = await request.tenantDb.shippingProfile.findUnique({
        where: { id, shopId },
      });

      if (!profile) {
        throw new NotFoundError("ShippingProfile", id);
      }

      // Verify link exists
      const link = await request.tenantDb.shippingProfileLocation.findUnique({
        where: {
          shippingProfileId_locationId: {
            shippingProfileId: id,
            locationId,
          },
        },
      });

      if (!link) {
        throw new NotFoundError("Link", `${id}/${locationId}`);
      }

      await request.tenantDb.shippingProfileLocation.delete({
        where: {
          shippingProfileId_locationId: {
            shippingProfileId: id,
            locationId,
          },
        },
      });

      return { message: "Location unlinked successfully" };
    },
  );
}
