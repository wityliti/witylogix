/**
 * Shop management — tenant configuration + multi-provider routing + notifications.
 *
 * Routes:
 *   GET    /me                       Get current shop profile
 *   PATCH  /me                       Update shop settings
 *   GET    /me/stats                 Get shop dashboard stats
 *   GET    /me/routing               Get routing config (provider registry + tenant state)
 *   PATCH  /me/routing               Update tenant routing credentials (BYOK only)
 *   GET    /me/routing/meter         Get routing metering stats (deployer fallback usage)
 *   GET    /me/notifications         Get notification config (per-channel registries + tenant state)
 *   PATCH  /me/notifications/:channel Update tenant notification credentials per channel (BYOK only)
 *   GET    /me/notifications/meter   Get notification metering stats (deployer fallback usage)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { getConfig } from "../lib/config.js";
import {
  getProviderRegistry,
  getProviderMeta,
  type RoutingProviderSlug,
  type RoutingCredentials,
} from "@witylogix/core/routing";
import {
  getAllNotificationRegistries,
  getNotificationProviderMeta,
  type NotificationChannel,
  type TenantNotificationConfig,
} from "@witylogix/core/notifications";

// ─── Zod Schemas ────────────────────────────────────────────

const VALID_PROVIDERS: [string, ...string[]] = [
  "mapbox",
  "osrm",
  "google_maps",
  "here",
  "graphhopper",
  "tomtom",
];

const updateRoutingSchema = z.object({
  /** The provider the tenant wants to use. */
  provider: z.enum(VALID_PROVIDERS).optional(),
  /** API key / access token for key-based providers. */
  apiKey: z.string().min(1).max(500).optional(),
  /** Base URL for self-hosted providers (OSRM). */
  baseUrl: z.string().url().max(500).optional(),
  /** Set true to remove all tenant routing credentials. */
  removeCredentials: z.boolean().optional(),
});

const VALID_CHANNELS: [string, ...string[]] = [
  "email",
  "sms",
  "whatsapp",
  "push",
];

const updateNotificationChannelSchema = z.object({
  /** The provider the tenant wants to use for this channel. */
  provider: z.string().min(1).max(100).optional(),
  /** Credentials — stored as key-value pairs matching registry CredentialField keys. */
  credentials: z.record(z.string().max(2000)).optional(),
  /** Set true to remove all tenant credentials for this channel. */
  removeCredentials: z.boolean().optional(),
});

const updateShopSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  timezone: z.string().optional(),
  currency: z.string().length(3).optional(),
  settings: z.record(z.unknown()).optional(),
});

// ─── Route Plugin ───────────────────────────────────────────

async function shopsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireAuth);
  fastify.addHook("preHandler", tenantContext);

  // ── GET CURRENT SHOP ──────────────────────────────────────

  fastify.get("/me", async (request: FastifyRequest, reply: FastifyReply) => {
    const shop = await request.tenantDb.shop.findUnique({
      where: { id: request.shopId },
      select: {
        id: true,
        shopifyDomain: true,
        name: true,
        email: true,
        phone: true,
        timezone: true,
        currency: true,
        planTier: true,
        settings: true,
        installedAt: true,
        _count: {
          select: {
            orders: true,
            drivers: true,
            deliveryZones: true,
            routes: true,
          },
        },
      },
    });

    // Strip sensitive keys from settings before returning
    if (shop?.settings && typeof shop.settings === "object") {
      const safe = { ...(shop.settings as Record<string, unknown>) };
      // Strip any routing credentials from the top-level response
      if (safe.routing && typeof safe.routing === "object") {
        const routing = { ...(safe.routing as Record<string, unknown>) };
        if (routing.apiKey)
          routing.apiKey = maskToken(routing.apiKey as string);
        safe.routing = routing;
      }
      // Legacy: strip old mapboxAccessToken if it exists
      if (safe.mapboxAccessToken) {
        safe.mapboxAccessToken = maskToken(safe.mapboxAccessToken as string);
      }
      // Strip notification credentials
      if (safe.notifications && typeof safe.notifications === "object") {
        const notifs = { ...(safe.notifications as Record<string, unknown>) };
        for (const ch of VALID_CHANNELS) {
          if (notifs[ch] && typeof notifs[ch] === "object") {
            const channelConf = { ...(notifs[ch] as Record<string, unknown>) };
            // Mask any credential-like values (leave provider visible)
            for (const [k, v] of Object.entries(channelConf)) {
              if (k !== "provider" && typeof v === "string" && v.length > 0) {
                channelConf[k] = maskToken(v);
              }
            }
            notifs[ch] = channelConf;
          }
        }
        safe.notifications = notifs;
      }
      (shop as any).settings = safe;
    }

    return { data: shop };
  });

  // ── UPDATE SHOP SETTINGS ──────────────────────────────────

  fastify.patch("/me", async (request: FastifyRequest, reply: FastifyReply) => {
    await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

    const body = updateShopSchema.parse(request.body);

    // If settings is provided, merge with existing (don't replace)
    let data: any = { ...body };
    if (body.settings) {
      const current = await request.tenantDb.shop.findUnique({
        where: { id: request.shopId },
        select: { settings: true },
      });
      data.settings = {
        ...((current?.settings as any) || {}),
        ...body.settings,
      };
    }

    const shop = await request.tenantDb.shop.update({
      where: { id: request.shopId },
      data,
    });

    return { data: shop };
  });

  // ── ROUTING CONFIG ──────────────────────────────────────────
  //
  // GET  /me/routing  — Returns:
  //   - deployerDefault: the deployer's default provider
  //   - byokEnabled: whether tenants can choose their own provider
  //   - registry: all available providers (metadata for UI)
  //   - tenant: the tenant's current routing config (provider, credential status)
  //
  // PATCH /me/routing — Allows tenants to set their own provider + credentials
  //                     (only when ROUTING_BYOK=true).

  fastify.get(
    "/me/routing",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const config = getConfig();
      const shop = await request.tenantDb.shop.findUnique({
        where: { id: request.shopId },
        select: { settings: true },
      });

      const settings = (shop?.settings ?? {}) as Record<string, unknown>;

      // Read tenant routing config from settings.routing (new format)
      // or fall back to legacy settings.mapboxAccessToken
      const tenantRouting = (settings.routing ?? {}) as Record<string, unknown>;
      const legacyToken = settings.mapboxAccessToken as string | undefined;

      const tenantProvider = tenantRouting.provider as
        | RoutingProviderSlug
        | undefined;
      const hasTenantKey = Boolean(tenantRouting.apiKey || legacyToken);
      const hasTenantBaseUrl = Boolean(tenantRouting.baseUrl);

      // Determine effective token to show masked
      const effectiveKey = (tenantRouting.apiKey || legacyToken) as
        | string
        | undefined;

      return {
        data: {
          // Deployer-controlled settings (read-only for tenant)
          deployerDefault: config.ROUTING_PROVIDER,
          byokEnabled: config.ROUTING_BYOK,
          hasPlatformFallback: Boolean(
            resolveDeployerHasCredential(config.ROUTING_PROVIDER),
          ),

          // Tenant-specific (writable when BYOK=true)
          tenant: {
            provider: tenantProvider || null,
            hasApiKey: hasTenantKey,
            hasBaseUrl: hasTenantBaseUrl,
            apiKeyMasked: effectiveKey ? maskToken(effectiveKey) : null,
            baseUrl: tenantRouting.baseUrl || null,
          },

          // Full provider registry for Settings UI
          registry: getProviderRegistry().map((p) => ({
            slug: p.slug,
            displayName: p.displayName,
            description: p.description,
            authType: p.authType,
            credentialLabel: p.credentialLabel,
            credentialPlaceholder: p.credentialPlaceholder,
            credentialHelpUrl: p.credentialHelpUrl ?? null,
            requiresBaseUrl: p.requiresBaseUrl,
            capabilities: p.capabilities,
            status: p.status,
          })),
        },
      };
    },
  );

  fastify.patch(
    "/me/routing",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const config = getConfig();

      // Only allow credential changes when deployer has enabled BYOK
      if (!config.ROUTING_BYOK) {
        return reply.status(403).send({
          statusCode: 403,
          error: "Forbidden",
          message:
            "Routing credentials are managed by the platform administrator. " +
            "BYOK (Bring Your Own Key) mode is not enabled for this deployment.",
        });
      }

      const body = updateRoutingSchema.parse(request.body);

      const current = await request.tenantDb.shop.findUnique({
        where: { id: request.shopId },
        select: { settings: true },
      });

      const settings = {
        ...((current?.settings ?? {}) as Record<string, unknown>),
      };

      if (body.removeCredentials) {
        // Clear all routing credentials
        delete settings.routing;
        // Also clear legacy key if it exists
        delete settings.mapboxAccessToken;
      } else {
        // Validate credential format if provider-specific pattern exists
        if (body.provider && body.apiKey) {
          const meta = getProviderMeta(body.provider as RoutingProviderSlug);
          if (
            meta?.credentialPattern &&
            !meta.credentialPattern.test(body.apiKey)
          ) {
            return reply.status(400).send({
              statusCode: 400,
              error: "Bad Request",
              message: `Invalid ${meta.displayName} credential format. Expected format matching: ${meta.credentialPlaceholder}`,
            });
          }

          // Verify provider is available (not "coming_soon")
          if (meta?.status !== "available") {
            return reply.status(400).send({
              statusCode: 400,
              error: "Bad Request",
              message: `${meta?.displayName ?? body.provider} provider is not yet available. Coming soon!`,
            });
          }
        }

        // Build the new routing config
        const routing: Record<string, unknown> = {
          ...((settings.routing ?? {}) as Record<string, unknown>),
        };

        if (body.provider) routing.provider = body.provider;
        if (body.apiKey) routing.apiKey = body.apiKey;
        if (body.baseUrl) routing.baseUrl = body.baseUrl;

        settings.routing = routing;

        // Clear legacy key if migrating to new format
        if (body.provider && settings.mapboxAccessToken) {
          delete settings.mapboxAccessToken;
        }
      }

      await request.tenantDb.shop.update({
        where: { id: request.shopId },
        data: { settings },
      });

      // Re-read to return current state
      const updated = await request.tenantDb.shop.findUnique({
        where: { id: request.shopId },
        select: { settings: true },
      });
      const updatedSettings = (updated?.settings ?? {}) as Record<
        string,
        unknown
      >;
      const updatedRouting = (updatedSettings.routing ?? {}) as Record<
        string,
        unknown
      >;

      return {
        data: {
          provider: updatedRouting.provider || null,
          hasApiKey: Boolean(updatedRouting.apiKey),
          hasBaseUrl: Boolean(updatedRouting.baseUrl),
          apiKeyMasked: updatedRouting.apiKey
            ? maskToken(updatedRouting.apiKey as string)
            : null,
        },
      };
    },
  );

  // ── ROUTING METERING STATS ──────────────────────────────────

  fastify.get(
    "/me/routing/meter",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      try {
        // Total fallback calls in last 30 days
        const total = await request.tenantDb.routingMeterEvent.count({
          where: {
            shopId: request.shopId,
            timestamp: { gte: thirtyDaysAgo },
          },
        });

        // Breakdown by operation
        const byOperation = await request.tenantDb.routingMeterEvent.groupBy({
          by: ["operation"],
          where: {
            shopId: request.shopId,
            timestamp: { gte: thirtyDaysAgo },
          },
          _count: true,
        });

        // Breakdown by provider
        const byProvider = await request.tenantDb.routingMeterEvent.groupBy({
          by: ["provider"],
          where: {
            shopId: request.shopId,
            timestamp: { gte: thirtyDaysAgo },
          },
          _count: true,
        });

        return {
          data: {
            period: "30d",
            totalFallbackCalls: total,
            byOperation: byOperation.map((row) => ({
              operation: row.operation,
              count: row._count,
            })),
            byProvider: byProvider.map((row) => ({
              provider: row.provider,
              count: row._count,
            })),
          },
        };
      } catch {
        // Table may not exist yet
        return {
          data: {
            period: "30d",
            totalFallbackCalls: 0,
            byOperation: [],
            byProvider: [],
          },
        };
      }
    },
  );

  // ── NOTIFICATION CONFIG ──────────────────────────────────────
  //
  // Same pattern as routing: per-channel registries, BYOK tenant overrides,
  // metered fallback to deployer credentials.
  //
  // GET  /me/notifications           — Returns per-channel registries + tenant state
  // PATCH /me/notifications/:channel — Update tenant credentials for a channel
  // GET  /me/notifications/meter     — Metering stats for fallback usage

  fastify.get(
    "/me/notifications",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const config = getConfig();
      const shop = await request.tenantDb.shop.findUnique({
        where: { id: request.shopId },
        select: { settings: true },
      });

      const settings = (shop?.settings ?? {}) as Record<string, unknown>;
      const tenantNotifs = (settings.notifications ?? {}) as Record<
        string,
        Record<string, unknown>
      >;

      // Build per-channel tenant state
      const channels: Record<
        string,
        {
          provider: string | null;
          hasCredentials: boolean;
          credentialsMasked: Record<string, string>;
        }
      > = {};

      for (const ch of VALID_CHANNELS) {
        const channelConf = tenantNotifs[ch] ?? {};
        const creds: Record<string, string> = {};
        let hasCreds = false;

        for (const [k, v] of Object.entries(channelConf)) {
          if (k !== "provider" && typeof v === "string" && v.length > 0) {
            creds[k] = maskToken(v);
            hasCreds = true;
          }
        }

        channels[ch] = {
          provider: (channelConf.provider as string) || null,
          hasCredentials: hasCreds,
          credentialsMasked: creds,
        };
      }

      // Determine deployer defaults for each channel
      const deployerDefaults: Record<string, string> = {
        email: config.EMAIL_PROVIDER,
        sms: config.SMS_PROVIDER,
        whatsapp: config.WHATSAPP_PROVIDER,
        push: config.PUSH_PROVIDER,
      };

      return {
        data: {
          byokEnabled: config.NOTIFICATIONS_BYOK,
          deployerDefaults,
          channels,
          // Full per-channel registries for the Settings UI
          registries: serializeNotificationRegistries(),
        },
      };
    },
  );

  fastify.patch(
    "/me/notifications/:channel",
    async (
      request: FastifyRequest<{ Params: { channel: string } }>,
      reply: FastifyReply,
    ) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const config = getConfig();
      const { channel } = request.params;

      // Validate channel
      if (!VALID_CHANNELS.includes(channel)) {
        return reply.status(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: `Invalid channel "${channel}". Must be one of: ${VALID_CHANNELS.join(", ")}`,
        });
      }

      // Only allow credential changes when deployer has enabled BYOK
      if (!config.NOTIFICATIONS_BYOK) {
        return reply.status(403).send({
          statusCode: 403,
          error: "Forbidden",
          message:
            "Notification credentials are managed by the platform administrator. " +
            "BYOK (Bring Your Own Key) mode is not enabled for this deployment.",
        });
      }

      const body = updateNotificationChannelSchema.parse(request.body);

      const current = await request.tenantDb.shop.findUnique({
        where: { id: request.shopId },
        select: { settings: true },
      });

      const settings = {
        ...((current?.settings ?? {}) as Record<string, unknown>),
      };
      const notifications = {
        ...((settings.notifications ?? {}) as Record<string, unknown>),
      };

      if (body.removeCredentials) {
        delete notifications[channel];
      } else {
        // Validate provider exists in registry
        if (body.provider) {
          const meta = getNotificationProviderMeta(
            channel as NotificationChannel,
            body.provider,
          );
          if (!meta) {
            return reply.status(400).send({
              statusCode: 400,
              error: "Bad Request",
              message: `Unknown ${channel} provider "${body.provider}".`,
            });
          }
          if (meta.status !== "available") {
            return reply.status(400).send({
              statusCode: 400,
              error: "Bad Request",
              message: `${meta.displayName} provider is not yet available. Coming soon!`,
            });
          }
        }

        // Build new channel config
        const channelConf: Record<string, unknown> = {
          ...((notifications[channel] ?? {}) as Record<string, unknown>),
        };

        if (body.provider) channelConf.provider = body.provider;
        if (body.credentials) {
          for (const [k, v] of Object.entries(body.credentials)) {
            if (v) channelConf[k] = v;
          }
        }

        notifications[channel] = channelConf;
      }

      settings.notifications = notifications;

      await request.tenantDb.shop.update({
        where: { id: request.shopId },
        data: { settings },
      });

      // Re-read to return current state
      const updated = await request.tenantDb.shop.findUnique({
        where: { id: request.shopId },
        select: { settings: true },
      });
      const updatedSettings = (updated?.settings ?? {}) as Record<
        string,
        unknown
      >;
      const updatedNotifs = (updatedSettings.notifications ?? {}) as Record<
        string,
        unknown
      >;
      const updatedChannel = (updatedNotifs[channel] ?? {}) as Record<
        string,
        unknown
      >;

      const maskedCreds: Record<string, string> = {};
      for (const [k, v] of Object.entries(updatedChannel)) {
        if (k !== "provider" && typeof v === "string" && v.length > 0) {
          maskedCreds[k] = maskToken(v);
        }
      }

      return {
        data: {
          channel,
          provider: updatedChannel.provider || null,
          hasCredentials: Object.keys(maskedCreds).length > 0,
          credentialsMasked: maskedCreds,
        },
      };
    },
  );

  // ── NOTIFICATION METERING STATS ──────────────────────────────

  fastify.get(
    "/me/notifications/meter",
    async (request: FastifyRequest, reply: FastifyReply) => {
      await requireRole("SUPER_ADMIN", "ADMIN")(request, reply);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      try {
        const total = await request.tenantDb.notificationMeterEvent.count({
          where: {
            shopId: request.shopId,
            timestamp: { gte: thirtyDaysAgo },
          },
        });

        const byChannel = await request.tenantDb.notificationMeterEvent.groupBy(
          {
            by: ["channel"],
            where: {
              shopId: request.shopId,
              timestamp: { gte: thirtyDaysAgo },
            },
            _count: true,
          },
        );

        const byProvider =
          await request.tenantDb.notificationMeterEvent.groupBy({
            by: ["provider"],
            where: {
              shopId: request.shopId,
              timestamp: { gte: thirtyDaysAgo },
            },
            _count: true,
          });

        return {
          data: {
            period: "30d",
            totalFallbackCalls: total,
            byChannel: byChannel.map((row) => ({
              channel: row.channel,
              count: row._count,
            })),
            byProvider: byProvider.map((row) => ({
              provider: row.provider,
              count: row._count,
            })),
          },
        };
      } catch {
        return {
          data: {
            period: "30d",
            totalFallbackCalls: 0,
            byChannel: [],
            byProvider: [],
          },
        };
      }
    },
  );

  // ── DASHBOARD STATS ───────────────────────────────────────

  fastify.get(
    "/me/stats",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [
        totalOrders,
        todayOrders,
        pendingOrders,
        inTransitOrders,
        deliveredToday,
        activeDrivers,
        totalDrivers,
        activeZones,
      ] = await Promise.all([
        request.tenantDb.order.count(),
        request.tenantDb.order.count({
          where: { createdAt: { gte: today, lt: tomorrow } },
        }),
        request.tenantDb.order.count({
          where: { status: { in: ["PENDING", "ACCEPTED"] } },
        }),
        request.tenantDb.order.count({
          where: {
            status: { in: ["PICKED_UP", "OUT_FOR_DELIVERY", "ARRIVED"] },
          },
        }),
        request.tenantDb.order.count({
          where: {
            status: "DELIVERED",
            actualDelivery: { gte: today, lt: tomorrow },
          },
        }),
        request.tenantDb.driver.count({
          where: { status: { in: ["AVAILABLE", "ON_ROUTE"] }, isActive: true },
        }),
        request.tenantDb.driver.count({ where: { isActive: true } }),
        request.tenantDb.deliveryZone.count({ where: { isActive: true } }),
      ]);

      return {
        data: {
          orders: {
            total: totalOrders,
            today: todayOrders,
            pending: pendingOrders,
            inTransit: inTransitOrders,
            deliveredToday,
          },
          drivers: {
            active: activeDrivers,
            total: totalDrivers,
          },
          zones: {
            active: activeZones,
          },
        },
      };
    },
  );
}

// ─── Helpers ───────────────────────────────────────────────

/** Mask a token for safe display: "pk.eyJ1Ijoi..." → "pk.eyJ1••••••••Ijoi" */
function maskToken(token: string): string {
  if (token.length <= 12) return "••••••••";
  return `${token.slice(0, 8)}${"•".repeat(8)}${token.slice(-4)}`;
}

/**
 * Check whether the deployer has set credentials for a given provider.
 */
function resolveDeployerHasCredential(provider: string): boolean {
  switch (provider) {
    case "mapbox":
      return Boolean(process.env.MAPBOX_ACCESS_TOKEN);
    case "osrm":
      return Boolean(process.env.OSRM_BASE_URL);
    case "google_maps":
      return Boolean(process.env.GOOGLE_MAPS_API_KEY);
    case "here":
      return Boolean(process.env.HERE_API_KEY);
    case "graphhopper":
      return Boolean(process.env.GRAPHHOPPER_API_KEY);
    case "tomtom":
      return Boolean(process.env.TOMTOM_API_KEY);
    default:
      return false;
  }
}

/**
 * Serialize notification registries for the API response.
 * Strips RegExp patterns (not JSON-serializable) from credential fields.
 */
function serializeNotificationRegistries() {
  const registries = getAllNotificationRegistries();
  const result: Record<string, unknown[]> = {};

  for (const [channel, providers] of Object.entries(registries)) {
    result[channel] = providers.map((p) => ({
      slug: p.slug,
      displayName: p.displayName,
      description: p.description,
      authType: p.authType,
      credentials: p.credentials.map((c) => ({
        key: c.key,
        label: c.label,
        placeholder: c.placeholder,
        type: c.type,
        required: c.required,
        helpUrl: c.helpUrl ?? null,
        // Don't serialize RegExp pattern — frontend validates via API
      })),
      status: p.status,
    }));
  }

  return result;
}

export default shopsRoutes;
