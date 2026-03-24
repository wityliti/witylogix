import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import crypto from "crypto";
import {
  NotFoundError,
  ValidationError,
} from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";

/**
 * Settings API Routes
 *
 * Stores settings as JSON in the Shop model's settings field.
 * All routes require authentication and tenant context.
 *
 * Routes:
 *   GET    /              Get all settings for current shop
 *   PUT    /general       Update general settings
 *   PUT    /branding      Update branding settings
 *   PUT    /notifications Update notification preferences
 *   GET    /api-keys      List API keys (masked)
 *   POST   /api-keys      Create new API key
 *   DELETE /api-keys/:id  Revoke API key
 *   GET    /team          List team members
 *   POST   /team/invite   Send invitation
 *   DELETE /team/:userId  Remove team member
 */

// ─── Validation Schemas ──────────────────────────────────

const GeneralSettingsSchema = z.object({
  timezone: z.string().default("UTC"),
  currency: z.string().length(3).default("USD"),
  weightUnit: z.enum(["kg", "lb"]).default("kg"),
  distanceUnit: z.enum(["km", "mi"]).default("km"),
  businessHours: z
    .record(
      z.string(),
      z.object({
        open: z.string(),
        close: z.string(),
        closed: z.boolean().optional(),
      })
    )
    .optional(),
});

const BrandingSettingsSchema = z.object({
  logoUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  trackingPageConfig: z
    .object({
      brandName: z.string().optional(),
      customMessage: z.string().optional(),
      showEstimatedDelivery: z.boolean().default(true),
      showTrackingMap: z.boolean().default(true),
    })
    .optional(),
});

const NotificationSettingsSchema = z.record(
  z.string(),
  z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(false),
    inApp: z.boolean().default(true),
    webhook: z.boolean().default(false),
  })
);

const ApiKeyCreateSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).min(1),
  expiresInDays: z.number().optional(),
});

const TeamInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "manager", "viewer"]),
});

// ─── Helper: Get / Update Shop Settings ──────────────────

function getShopConfig(settings: any, section?: string): any {
  const config = settings || {};
  return section ? config[section] || {} : config;
}

function mergeShopConfig(settings: any, section: string, data: any): any {
  const current = settings || {};
  return {
    ...(current),
    [section]: {
      ...(current[section] || {}),
      ...data,
    },
  };
}

// ─── Route Plugin ────────────────────────────────────────

export default async function settingsRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET / — All settings ───────────────────────────────

  fastify.get("/", async (request: any, reply: FastifyReply) => {
    const shop = await request.tenantDb.shop.findUnique({
      where: { id: request.shopId },
      select: { id: true, name: true, settings: true },
    });

    if (!shop) throw new NotFoundError("Shop not found");

    const config = getShopConfig(shop.settings);

    return reply.code(200).send({
      success: true,
      data: {
        general: config.general || { timezone: "UTC", currency: "USD", weightUnit: "kg", distanceUnit: "km" },
        branding: config.branding || {},
        notifications: config.notifications || {},
      },
    });
  });

  // ── PUT /general — Update general settings ─────────────

  fastify.put("/general", async (request: any, reply: FastifyReply) => {
    try {
      const body = GeneralSettingsSchema.parse(request.body);

      const shop = await request.tenantDb.shop.findUnique({
        where: { id: request.shopId },
        select: { settings: true },
      });

      const updatedSettings = mergeShopConfig(shop?.settings, "general", body);

      await request.tenantDb.shop.update({
        where: { id: request.shopId },
        data: { settings: updatedSettings },
      });

      return reply.code(200).send({
        success: true,
        data: body,
        message: "General settings updated",
      });
    } catch (error: any) {
      if (error?.name === "ZodError") {
        throw new ValidationError(error.message);
      }
      throw error;
    }
  });

  // ── PUT /branding — Update branding settings ───────────

  fastify.put("/branding", async (request: any, reply: FastifyReply) => {
    try {
      const body = BrandingSettingsSchema.parse(request.body);

      const shop = await request.tenantDb.shop.findUnique({
        where: { id: request.shopId },
        select: { settings: true },
      });

      const updatedSettings = mergeShopConfig(shop?.settings, "branding", body);

      await request.tenantDb.shop.update({
        where: { id: request.shopId },
        data: { settings: updatedSettings },
      });

      return reply.code(200).send({
        success: true,
        data: body,
        message: "Branding settings updated",
      });
    } catch (error: any) {
      if (error?.name === "ZodError") {
        throw new ValidationError(error.message);
      }
      throw error;
    }
  });

  // ── PUT /notifications — Notification preferences ──────

  fastify.put("/notifications", async (request: any, reply: FastifyReply) => {
    try {
      const body = NotificationSettingsSchema.parse(request.body);

      const shop = await request.tenantDb.shop.findUnique({
        where: { id: request.shopId },
        select: { settings: true },
      });

      const updatedSettings = mergeShopConfig(shop?.settings, "notifications", body);

      await request.tenantDb.shop.update({
        where: { id: request.shopId },
        data: { settings: updatedSettings },
      });

      return reply.code(200).send({
        success: true,
        data: body,
        message: "Notification preferences updated",
      });
    } catch (error: any) {
      if (error?.name === "ZodError") {
        throw new ValidationError(error.message);
      }
      throw error;
    }
  });

  // ── GET /api-keys — List API keys (masked) ────────────

  fastify.get("/api-keys", async (request: any, reply: FastifyReply) => {
    const shop = await request.tenantDb.shop.findUnique({
      where: { id: request.shopId },
      select: { settings: true },
    });

    const config = getShopConfig(shop?.settings);
    const apiKeys: any[] = config.apiKeys || [];

    // Mask all key values
    const masked = apiKeys
      .filter((k: any) => !k.revoked)
      .map((k: any) => ({
        id: k.id,
        name: k.name,
        keyPreview: k.keyPreview || "wlx_****",
        scopes: k.scopes,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt || null,
        expiresAt: k.expiresAt || null,
      }));

    return reply.code(200).send({
      success: true,
      data: masked,
    });
  });

  // ── POST /api-keys — Create new API key ───────────────

  fastify.post("/api-keys", async (request: any, reply: FastifyReply) => {
    try {
      const body = ApiKeyCreateSchema.parse(request.body);

      // Generate random API key
      const rawKey = `wlx_${crypto.randomBytes(32).toString("hex")}`;
      const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
      const keyPreview = `wlx_${rawKey.slice(4, 8)}...${rawKey.slice(-4)}`;
      const keyId = crypto.randomBytes(8).toString("hex");

      const shop = await request.tenantDb.shop.findUnique({
        where: { id: request.shopId },
        select: { settings: true },
      });

      const config = getShopConfig(shop?.settings);
      const existingKeys: any[] = config.apiKeys || [];

      const newKey = {
        id: keyId,
        name: body.name,
        keyHash,
        keyPreview,
        scopes: body.scopes,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
        expiresAt: body.expiresInDays
          ? new Date(Date.now() + body.expiresInDays * 86400000).toISOString()
          : null,
        revoked: false,
      };

      const settings = shop?.settings || {};
      const apiKeys: any[] = settings.apiKeys || [];
      apiKeys.push(newKey);

      await request.tenantDb.shop.update({
        where: { id: request.shopId },
        data: { settings: { ...settings, apiKeys } },
      });

      // Return plaintext key ONLY on creation
      return reply.code(201).send({
        success: true,
        data: {
          id: keyId,
          name: body.name,
          key: rawKey, // Only returned once!
          keyPreview,
          scopes: body.scopes,
          createdAt: newKey.createdAt,
          expiresAt: newKey.expiresAt,
        },
        message: "API key created. Save it now — it won't be shown again.",
      });
    } catch (error: any) {
      if (error?.name === "ZodError") {
        throw new ValidationError(error.message);
      }
      throw error;
    }
  });

  // ── DELETE /api-keys/:id — Revoke API key ─────────────

  fastify.delete<{ Params: { id: string } }>(
    "/api-keys/:id",
    async (request: any, reply: FastifyReply) => {
      const { id } = request.params;

      const shop = await request.tenantDb.shop.findUnique({
        where: { id: request.shopId },
        select: { settings: true },
      });

      const settings = (shop?.settings || {}) as any;
      const apiKeys: any[] = settings.apiKeys || [];

      const keyIndex = apiKeys.findIndex((k: any) => k.id === id);
      if (keyIndex === -1) {
        throw new NotFoundError(`API key ${id} not found`);
      }

      apiKeys[keyIndex].revoked = true;
      apiKeys[keyIndex].revokedAt = new Date().toISOString();

      await request.tenantDb.shop.update({
        where: { id: request.shopId },
        data: { settings: { ...settings, apiKeys } },
      });

      return reply.code(200).send({
        success: true,
        message: "API key revoked",
      });
    }
  );

  // ── GET /team — List team members ─────────────────────

  fastify.get("/team", async (request: any, reply: FastifyReply) => {
    const users = await request.tenantDb.user.findMany({
      where: { shopId: request.shopId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return reply.code(200).send({
      success: true,
      data: users,
    });
  });

  // ── POST /team/invite — Send team invitation ──────────

  fastify.post("/team/invite", async (request: any, reply: FastifyReply) => {
    try {
      const body = TeamInviteSchema.parse(request.body);

      // Check if user already exists
      const existing = await request.tenantDb.user.findFirst({
        where: { email: body.email, shopId: request.shopId },
      });

      if (existing) {
        return reply.code(409).send({
          success: false,
          error: `User ${body.email} is already a team member`,
        });
      }

      // Generate invite token
      const inviteToken = crypto.randomBytes(32).toString("hex");

      // Store invitation in shop settings
      const shop = await request.tenantDb.shop.findUnique({
        where: { id: request.shopId },
        select: { settings: true },
      });

      const settings = (shop?.settings || {}) as any;
      const invitations: any[] = settings.invitations || [];

      invitations.push({
        email: body.email,
        role: body.role,
        token: inviteToken,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: "pending",
      });

      await request.tenantDb.shop.update({
        where: { id: request.shopId },
        data: { settings: { ...settings, invitations } },
      });

      return reply.code(201).send({
        success: true,
        data: {
          email: body.email,
          role: body.role,
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        },
        message: `Invitation sent to ${body.email}`,
      });
    } catch (error: any) {
      if (error?.name === "ZodError") {
        throw new ValidationError(error.message);
      }
      throw error;
    }
  });

  // ── DELETE /team/:userId — Remove team member ─────────

  fastify.delete<{ Params: { userId: string } }>(
    "/team/:userId",
    async (request: any, reply: FastifyReply) => {
      const { userId } = request.params;

      const user = await request.tenantDb.user.findFirst({
        where: { id: userId, shopId: request.shopId },
      });

      if (!user) {
        throw new NotFoundError(`User ${userId} not found`);
      }

      // Don't allow removing yourself
      if (userId === (request as any).userId) {
        return reply.code(400).send({
          success: false,
          error: "Cannot remove yourself from the team",
        });
      }

      await request.tenantDb.user.delete({
        where: { id: userId },
      });

      return reply.code(200).send({
        success: true,
        message: "Team member removed",
      });
    }
  );
}
