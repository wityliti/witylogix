/**
 * User management routes — tenant-scoped CRUD for dashboard users.
 *
 * These routes allow shop admins to invite, list, update, and deactivate
 * dashboard users within their shop. Org-level user management is handled
 * separately via the /orgs/me/members routes.
 *
 * Role hierarchy (shop-level):
 *   SUPER_ADMIN > ADMIN > DISPATCHER > VIEWER
 *
 * Rules:
 *   - Only SUPER_ADMIN can create other SUPER_ADMINs
 *   - Users can only manage users with equal or lower roles
 *   - A shop must always have at least one SUPER_ADMIN
 *   - Users cannot deactivate themselves (prevents lockout)
 *
 * Routes:
 *   GET    /              List users in current shop
 *   GET    /:id           Get single user
 *   POST   /              Invite (create) a new user
 *   PATCH  /:id           Update user (name, role)
 *   PATCH  /:id/password  Change user password (admin or self)
 *   DELETE /:id           Deactivate user (soft delete)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@witylogix/db";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  ConflictError,
} from "../lib/errors.js";

// ─── Constants ──────────────────────────────────────────────

const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  DISPATCHER: 2,
  VIEWER: 1,
};

const VALID_ROLES = ["SUPER_ADMIN", "ADMIN", "DISPATCHER", "VIEWER"] as const;

// ─── Schemas ────────────────────────────────────────────────

const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(VALID_ROLES).default("VIEWER"),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  role: z.enum(VALID_ROLES).optional(),
  isActive: z.boolean().optional(),
});

const changePasswordSchema = z.object({
  password: z.string().min(8),
  currentPassword: z.string().optional(), // Required when user changes own password
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(VALID_ROLES).optional(),
  search: z.string().optional(),
  includeInactive: z.coerce.boolean().default(false),
});

// ─── Helpers ────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const { scrypt, randomBytes } = await import("crypto");
  const { promisify } = await import("util");
  const scryptAsync = promisify(scrypt);
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const { scrypt } = await import("crypto");
  const { promisify } = await import("util");
  const scryptAsync = promisify(scrypt);
  const [salt, hash] = stored.split(":");
  const hashBuffer = (await scryptAsync(password, salt, 64)) as Buffer;
  return hashBuffer.toString("hex") === hash;
}

function canManageRole(actorRole: string, targetRole: string): boolean {
  return (ROLE_HIERARCHY[actorRole] ?? 0) >= (ROLE_HIERARCHY[targetRole] ?? 0);
}

// ─── Route Plugin ───────────────────────────────────────────

async function usersRoutes(fastify: FastifyInstance): Promise<void> {
  // All user routes require authentication + tenant context
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── LIST USERS ──────────────────────────────────────────────

  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const query = listQuerySchema.parse(request.query);
    const { page, limit, role, search, includeInactive } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      shopId: request.auth.shopId,
    };

    if (!includeInactive) {
      where.isActive = true;
    }

    if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

  // ── GET SINGLE USER ─────────────────────────────────────────

  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const { id } = request.params as { id: string };

    const user = await prisma.user.findFirst({
      where: { id, shopId: request.auth.shopId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundError("User", id);

    return { data: user };
  });

  // ── CREATE (INVITE) USER ────────────────────────────────────

  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const body = createUserSchema.parse(request.body);

    // Only SUPER_ADMIN can create SUPER_ADMIN users
    if (body.role === "SUPER_ADMIN" && request.auth.role !== "SUPER_ADMIN") {
      throw new ForbiddenError("Only SUPER_ADMIN can create other SUPER_ADMIN users");
    }

    // Ensure the actor can manage the target role
    if (!canManageRole(request.auth.role, body.role)) {
      throw new ForbiddenError(
        `Your role (${request.auth.role}) cannot create users with role ${body.role}`,
      );
    }

    // Check email uniqueness within shop
    const existing = await prisma.user.findUnique({
      where: {
        shopId_email: { shopId: request.auth.shopId, email: body.email },
      },
    });

    if (existing) {
      throw new ConflictError(`A user with email '${body.email}' already exists in this shop`);
    }

    const hashedPassword = await hashPassword(body.password);

    const user = await prisma.user.create({
      data: {
        shopId: request.auth.shopId,
        name: body.name,
        email: body.email,
        password: hashedPassword,
        role: body.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // If shop belongs to an org, auto-add as org MEMBER
    const shop = await prisma.shop.findUnique({
      where: { id: request.auth.shopId },
      select: { orgId: true },
    });

    if (shop?.orgId) {
      await prisma.orgMember.create({
        data: {
          orgId: shop.orgId,
          userId: user.id,
          role: "MEMBER",
          shopIds: [request.auth.shopId],
        },
      }).catch(() => {
        // Silently fail if already a member (edge case)
      });
    }

    // Send welcome/invite email via notification queue
    try {
      const shop = await db.shop.findUnique({
        where: { id: request.auth.shopId },
        select: { name: true },
      });

      const notificationQueue = (context.notificationQueue as any);
      if (notificationQueue) {
        await notificationQueue.add('send-notification', {
          channel: 'EMAIL',
          templateId: 'welcome-email',
          to: user.email,
          variables: { name: user.name, shopName: shop?.name || 'Your Shop' },
          shopId: request.auth.shopId,
        });
      }
    } catch (emailError) {
      // Log but don't fail the user creation if notification queue is unavailable
      console.warn('Failed to queue welcome email:', emailError);
    }

    reply.status(201);
    return { data: user };
  });

  // ── UPDATE USER ─────────────────────────────────────────────

  fastify.patch("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const { id } = request.params as { id: string };
    const body = updateUserSchema.parse(request.body);

    const user = await prisma.user.findFirst({
      where: { id, shopId: request.auth.shopId },
      select: { id: true, role: true, isActive: true },
    });

    if (!user) throw new NotFoundError("User", id);

    // Cannot modify users with higher role
    if (!canManageRole(request.auth.role, user.role)) {
      throw new ForbiddenError(
        `Your role (${request.auth.role}) cannot modify users with role ${user.role}`,
      );
    }

    // Role escalation checks
    if (body.role) {
      if (body.role === "SUPER_ADMIN" && request.auth.role !== "SUPER_ADMIN") {
        throw new ForbiddenError("Only SUPER_ADMIN can assign the SUPER_ADMIN role");
      }

      if (!canManageRole(request.auth.role, body.role)) {
        throw new ForbiddenError(
          `Your role (${request.auth.role}) cannot assign role ${body.role}`,
        );
      }
    }

    // Check email uniqueness if changing email
    if (body.email) {
      const existing = await prisma.user.findUnique({
        where: {
          shopId_email: { shopId: request.auth.shopId, email: body.email },
        },
      });
      if (existing && existing.id !== id) {
        throw new ConflictError(`A user with email '${body.email}' already exists in this shop`);
      }
    }

    // Deactivation checks
    if (body.isActive === false) {
      // Cannot deactivate yourself
      if (id === request.auth.userId) {
        throw new ValidationError("You cannot deactivate your own account");
      }

      // Cannot deactivate if this is the last active SUPER_ADMIN
      if (user.role === "SUPER_ADMIN") {
        const adminCount = await prisma.user.count({
          where: {
            shopId: request.auth.shopId,
            role: "SUPER_ADMIN",
            isActive: true,
            id: { not: id },
          },
        });
        if (adminCount === 0) {
          throw new ValidationError(
            "Cannot deactivate the last SUPER_ADMIN. Promote another user first.",
          );
        }
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: body,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return { data: updated };
  });

  // ── CHANGE PASSWORD ─────────────────────────────────────────

  fastify.patch("/:id/password", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = changePasswordSchema.parse(request.body);

    const isSelf = id === request.auth.userId;
    const isAdmin = request.auth.role === "SUPER_ADMIN" || request.auth.role === "ADMIN";

    if (!isSelf && !isAdmin) {
      throw new ForbiddenError("You can only change your own password or must be an admin");
    }

    const user = await prisma.user.findFirst({
      where: { id, shopId: request.auth.shopId },
      select: { id: true, password: true, role: true },
    });

    if (!user) throw new NotFoundError("User", id);

    // Admins can't change passwords for higher-role users
    if (!isSelf && !canManageRole(request.auth.role, user.role)) {
      throw new ForbiddenError(
        `Your role (${request.auth.role}) cannot change password for ${user.role} users`,
      );
    }

    // Self password change requires current password verification
    if (isSelf) {
      if (!body.currentPassword) {
        throw new ValidationError("Current password is required when changing your own password");
      }
      if (!user.password) {
        throw new ValidationError("Account does not have a password set");
      }
      const valid = await verifyPassword(body.currentPassword, user.password);
      if (!valid) {
        throw new ValidationError("Current password is incorrect");
      }
    }

    const hashedPassword = await hashPassword(body.password);
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return { data: { message: "Password updated successfully" } };
  });

  // ── DEACTIVATE USER (SOFT DELETE) ───────────────────────────

  fastify.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const { id } = request.params as { id: string };

    const user = await prisma.user.findFirst({
      where: { id, shopId: request.auth.shopId },
      select: { id: true, role: true, isActive: true },
    });

    if (!user) throw new NotFoundError("User", id);

    // Cannot deactivate yourself
    if (id === request.auth.userId) {
      throw new ValidationError("You cannot deactivate your own account");
    }

    // Cannot deactivate users with higher role
    if (!canManageRole(request.auth.role, user.role)) {
      throw new ForbiddenError(
        `Your role (${request.auth.role}) cannot deactivate users with role ${user.role}`,
      );
    }

    // Cannot deactivate the last SUPER_ADMIN
    if (user.role === "SUPER_ADMIN") {
      const adminCount = await prisma.user.count({
        where: {
          shopId: request.auth.shopId,
          role: "SUPER_ADMIN",
          isActive: true,
          id: { not: id },
        },
      });
      if (adminCount === 0) {
        throw new ValidationError(
          "Cannot deactivate the last SUPER_ADMIN. Promote another user first.",
        );
      }
    }

    // Soft delete — preserves audit trail
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return { data: { message: "User deactivated", userId: id } };
  });

  // ── GET CURRENT USER PROFILE ────────────────────────────────

  fastify.get("/me", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth.userId) {
      throw new ForbiddenError("This endpoint is only available for dashboard users");
    }

    const user = await prisma.user.findUnique({
      where: { id: request.auth.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        shop: {
          select: {
            id: true,
            name: true,
            shopifyDomain: true,
            orgId: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundError("User", request.auth.userId);

    // Include org membership if applicable
    let orgMembership = null;
    if (user.shop?.orgId) {
      orgMembership = await prisma.orgMember.findUnique({
        where: {
          orgId_userId: { orgId: user.shop.orgId, userId: user.id },
        },
        select: {
          role: true,
          shopIds: true,
          isActive: true,
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      });
    }

    return {
      data: {
        ...user,
        orgMembership,
      },
    };
  });
}

export default usersRoutes;
