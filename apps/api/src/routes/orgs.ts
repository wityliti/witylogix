/**
 * Organization management — multi-shop tenant grouping.
 *
 * These routes allow merchants with multiple Shopify stores to:
 * - Create an organization
 * - Link shops to the org (post-install, never during Shopify OAuth)
 * - Manage org members and their shop access
 * - View cross-shop stats
 *
 * Routes:
 *   POST   /                  Create organization
 *   GET    /me                Get current user's org
 *   PATCH  /me                Update org settings
 *   GET    /me/shops          List shops in org
 *   POST   /me/shops          Link a shop to the org
 *   DELETE /me/shops/:shopId  Unlink a shop from the org
 *   GET    /me/members        List org members
 *   POST   /me/members        Invite a user to the org
 *   PATCH  /me/members/:id    Update member role/shop access
 *   DELETE /me/members/:id    Remove member from org
 *   GET    /me/stats          Cross-shop aggregate stats
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@witylogix/db";
import { requireAuth, requireOrgRole } from "../middleware/auth.js";
import { tenantContext, orgContext } from "../middleware/tenant.js";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  ConflictError,
} from "../lib/errors.js";

// ─── Schemas ────────────────────────────────────────────────

const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  email: z.string().email().optional(),
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().nullable().optional(),
  settings: z.record(z.unknown()).optional(),
});

const linkShopSchema = z.object({
  shopId: z.string().uuid(),
});

const inviteMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]).default("MEMBER"),
  shopIds: z.array(z.string().uuid()).default([]), // empty = all shops
});

const updateMemberSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]).optional(),
  shopIds: z.array(z.string().uuid()).optional(),
  isActive: z.boolean().optional(),
});

// ─── Route Plugin ───────────────────────────────────────────

async function orgsRoutes(fastify: FastifyInstance): Promise<void> {
  // All org routes require authentication
  fastify.addHook("preHandler", requireAuth);

  // ── CREATE ORGANIZATION ───────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createOrgSchema.parse(request.body);

    if (!request.auth.shopId) {
      throw new ValidationError(
        "Must be authenticated with a shop to create an org",
      );
    }

    // Check slug uniqueness
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: body.slug },
    });
    if (existingOrg) {
      throw new ConflictError(
        `Organization slug '${body.slug}' is already taken`,
      );
    }

    // Check if shop already belongs to an org
    const shop = await prisma.shop.findUnique({
      where: { id: request.auth.shopId },
      select: { id: true, orgId: true },
    });
    if (shop?.orgId) {
      throw new ConflictError("This shop already belongs to an organization");
    }

    // Create org, link the shop, and make the current user OWNER
    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: body.name,
          slug: body.slug,
          email: body.email,
          planTier: "FREE",
        },
      });

      // Link the creating shop to the org
      await tx.shop.update({
        where: { id: request.auth.shopId },
        data: { orgId: created.id },
      });

      // Make the creating user the OWNER
      if (request.auth.userId) {
        await tx.orgMember.create({
          data: {
            orgId: created.id,
            userId: request.auth.userId,
            role: "OWNER",
            shopIds: [], // empty = access to all shops
          },
        });
      }

      return created;
    });

    reply.status(201);
    return { data: org };
  });

  // ── GET CURRENT ORG ───────────────────────────────────────

  fastify.get("/me", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth.orgId) {
      return { data: null, message: "Not part of any organization" };
    }

    const org = await prisma.organization.findUnique({
      where: { id: request.auth.orgId },
      include: {
        _count: {
          select: {
            shops: true,
            orgMembers: true,
            drivers: true,
            deliveryZones: true,
          },
        },
      },
    });

    return { data: org };
  });

  // ── UPDATE ORG ────────────────────────────────────────────

  fastify.patch("/me", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireOrgRole("OWNER", "ADMIN")(request, reply);

    const body = updateOrgSchema.parse(request.body);

    // Merge settings if provided
    let data: any = { ...body };
    if (body.settings) {
      const current = await prisma.organization.findUnique({
        where: { id: request.auth.orgId! },
        select: { settings: true },
      });
      data.settings = {
        ...((current?.settings as any) || {}),
        ...body.settings,
      };
    }

    const org = await prisma.organization.update({
      where: { id: request.auth.orgId! },
      data,
    });

    return { data: org };
  });

  // ── LIST SHOPS IN ORG ─────────────────────────────────────

  fastify.get(
    "/me/shops",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth.orgId) {
        return { data: [] };
      }

      const shops = await prisma.shop.findMany({
        where: { orgId: request.auth.orgId, isActive: true },
        select: {
          id: true,
          name: true,
          shopifyDomain: true,
          currency: true,
          timezone: true,
          isActive: true,
          installedAt: true,
          _count: { select: { orders: true, drivers: true } },
        },
        orderBy: { name: "asc" },
      });

      return { data: shops };
    },
  );

  // ── LINK SHOP TO ORG ──────────────────────────────────────

  fastify.post(
    "/me/shops",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireOrgRole("OWNER", "ADMIN")(request, reply);

      const { shopId } = linkShopSchema.parse(request.body);

      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { id: true, orgId: true, isActive: true },
      });

      if (!shop) throw new NotFoundError("Shop", shopId);
      if (!shop.isActive)
        throw new ValidationError("Cannot link an inactive shop");
      if (shop.orgId)
        throw new ConflictError("This shop already belongs to an organization");

      await prisma.shop.update({
        where: { id: shopId },
        data: { orgId: request.auth.orgId! },
      });

      return { data: { message: "Shop linked to organization", shopId } };
    },
  );

  // ── UNLINK SHOP FROM ORG ──────────────────────────────────

  fastify.delete(
    "/me/shops/:shopId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireOrgRole("OWNER")(request, reply);

      const { shopId } = request.params as { shopId: string };

      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { id: true, orgId: true },
      });

      if (!shop) throw new NotFoundError("Shop", shopId);
      if (shop.orgId !== request.auth.orgId) {
        throw new ForbiddenError(
          "This shop does not belong to your organization",
        );
      }

      await prisma.shop.update({
        where: { id: shopId },
        data: { orgId: null },
      });

      return { data: { message: "Shop unlinked from organization", shopId } };
    },
  );

  // ── LIST ORG MEMBERS ──────────────────────────────────────

  fastify.get(
    "/me/members",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth.orgId) {
        return { data: [] };
      }

      const members = await prisma.orgMember.findMany({
        where: { orgId: request.auth.orgId },
        include: {
          user: {
            select: { id: true, name: true, email: true, shopId: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      return { data: members };
    },
  );

  // ── INVITE MEMBER ─────────────────────────────────────────

  fastify.post(
    "/me/members",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireOrgRole("OWNER", "ADMIN")(request, reply);

      const body = inviteMemberSchema.parse(request.body);

      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: body.userId },
        select: { id: true },
      });
      if (!user) throw new NotFoundError("User", body.userId);

      // Check for existing membership
      const existing = await prisma.orgMember.findUnique({
        where: {
          orgId_userId: { orgId: request.auth.orgId!, userId: body.userId },
        },
      });
      if (existing)
        throw new ConflictError(
          "User is already a member of this organization",
        );

      // Only OWNER can create other OWNERs
      if (body.role === "OWNER" && request.auth.orgRole !== "OWNER") {
        throw new ForbiddenError(
          "Only organization owners can create other owners",
        );
      }

      const member = await prisma.orgMember.create({
        data: {
          orgId: request.auth.orgId!,
          userId: body.userId,
          role: body.role,
          shopIds: body.shopIds,
        },
      });

      reply.status(201);
      return { data: member };
    },
  );

  // ── UPDATE MEMBER ─────────────────────────────────────────

  fastify.patch(
    "/me/members/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireOrgRole("OWNER", "ADMIN")(request, reply);

      const { id } = request.params as { id: string };
      const body = updateMemberSchema.parse(request.body);

      const member = await prisma.orgMember.findFirst({
        where: { id, orgId: request.auth.orgId! },
      });
      if (!member) throw new NotFoundError("OrgMember", id);

      // Prevent non-owners from changing owner role
      if (body.role === "OWNER" && request.auth.orgRole !== "OWNER") {
        throw new ForbiddenError("Only owners can assign the OWNER role");
      }
      if (member.role === "OWNER" && request.auth.orgRole !== "OWNER") {
        throw new ForbiddenError("Only owners can modify other owners");
      }

      const updated = await prisma.orgMember.update({
        where: { id },
        data: body,
      });

      return { data: updated };
    },
  );

  // ── REMOVE MEMBER ─────────────────────────────────────────

  fastify.delete(
    "/me/members/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireOrgRole("OWNER")(request, reply);

      const { id } = request.params as { id: string };

      const member = await prisma.orgMember.findFirst({
        where: { id, orgId: request.auth.orgId! },
      });
      if (!member) throw new NotFoundError("OrgMember", id);

      // Prevent removing yourself if you're the last owner
      if (member.userId === request.auth.userId) {
        const ownerCount = await prisma.orgMember.count({
          where: { orgId: request.auth.orgId!, role: "OWNER", isActive: true },
        });
        if (ownerCount <= 1) {
          throw new ValidationError(
            "Cannot remove the last owner. Transfer ownership first.",
          );
        }
      }

      await prisma.orgMember.delete({ where: { id } });
      return { data: { message: "Member removed from organization" } };
    },
  );

  // ── CROSS-SHOP STATS ──────────────────────────────────────

  fastify.get(
    "/me/stats",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth.orgId) {
        return { data: null };
      }

      // Get all shop IDs in the org
      const shops = await prisma.shop.findMany({
        where: { orgId: request.auth.orgId, isActive: true },
        select: { id: true, name: true },
      });

      const shopIds = shops.map((s) => s.id);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [totalOrders, todayOrders, inTransit, activeDrivers] =
        await Promise.all([
          prisma.order.count({ where: { shopId: { in: shopIds } } }),
          prisma.order.count({
            where: {
              shopId: { in: shopIds },
              createdAt: { gte: today, lt: tomorrow },
            },
          }),
          prisma.order.count({
            where: {
              shopId: { in: shopIds },
              status: { in: ["PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED"] },
            },
          }),
          prisma.driver.count({
            where: {
              OR: [{ orgId: request.auth.orgId }, { shopId: { in: shopIds } }],
              status: { in: ["AVAILABLE", "ON_ROUTE"] },
              isActive: true,
            },
          }),
        ]);

      // Per-shop breakdown
      const perShop = await Promise.all(
        shops.map(async (shop) => {
          const orderCount = await prisma.order.count({
            where: { shopId: shop.id },
          });
          const todayCount = await prisma.order.count({
            where: { shopId: shop.id, createdAt: { gte: today, lt: tomorrow } },
          });
          return {
            shopId: shop.id,
            name: shop.name,
            totalOrders: orderCount,
            todayOrders: todayCount,
          };
        }),
      );

      return {
        data: {
          shopCount: shops.length,
          totalOrders,
          todayOrders,
          inTransit,
          activeDrivers,
          perShop,
        },
      };
    },
  );
}

export default orgsRoutes;
