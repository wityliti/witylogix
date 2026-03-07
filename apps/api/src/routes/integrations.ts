/**
 * Integration Marketplace — API endpoints.
 *
 * Routes:
 *   GET    /                          List installed integrations for current shop
 *   GET    /marketplace               Browse marketplace catalog
 *   GET    /marketplace/:slug         Get detailed info about an integration app
 *   POST   /:slug/install             Install an integration
 *   DELETE /:slug                     Uninstall an integration
 *   PATCH  /:slug                     Update credentials or config
 *   POST   /:slug/test               Test connection / health check
 *   GET    /:slug/events             Get event log for an integration
 *   GET    /meter                    Unified metering stats
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { prisma } from "@witylogix/db";
import {
  INTEGRATION_REGISTRY,
  getIntegrationsByCategory,
  getIntegrationBySlug,
  getAvailableIntegrations,
  searchIntegrations,
  getIntegrationCounts,
  getAllIntegrationSlugs,
  maskCredentials,
  type IntegrationCategory,
  type IntegrationStatus,
  type IntegrationAppMeta,
  CATEGORY_LABELS,
} from "@witylogix/core/integrations";

// ─── Zod Schemas ────────────────────────────────────────────

const marketplaceQuerySchema = z.object({
  category: z
    .enum(["COMMUNICATION", "ROUTING", "ORDER_MANAGEMENT", "INVENTORY", "PAYMENT", "ANALYTICS"])
    .optional(),
  status: z.enum(["AVAILABLE", "COMING_SOON", "BETA", "DEPRECATED"]).optional(),
  subcategory: z.string().max(50).optional(),
  search: z.string().max(200).optional(),
});

const installSchema = z.object({
  credentials: z.record(z.string().max(5000)).optional().default({}),
  config: z.record(z.unknown()).optional().default({}),
});

const updateSchema = z.object({
  credentials: z.record(z.string().max(5000)).optional(),
  config: z.record(z.unknown()).optional(),
  isEnabled: z.boolean().optional(),
});

const eventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  eventType: z
    .enum(["INSTALL", "UNINSTALL", "SYNC", "WEBHOOK", "HEALTH_CHECK", "METER", "CONFIG_UPDATE"])
    .optional(),
});

const meterQuerySchema = z.object({
  since: z.string().datetime().optional(),
  appSlug: z.string().max(100).optional(),
});

// ─── Route Registration ─────────────────────────────────────

export default async function integrationRoutes(app: FastifyInstance): Promise<void> {
  // All routes require authentication + tenant context
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", tenantContext);

  // ── GET / — List installed integrations ─────────────────────

  app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const shopId = request.shopId;

    const installed = await prisma.integration.findMany({
      where: { shopId },
      include: { app: true },
      orderBy: { installedAt: "desc" },
    });

    const result = installed.map((integration) => ({
      slug: integration.appSlug,
      name: integration.app.name,
      description: integration.app.description,
      category: integration.app.category,
      subcategory: integration.app.subcategory,
      logoUrl: integration.app.logoUrl,
      isEnabled: integration.isEnabled,
      healthStatus: integration.healthStatus,
      lastSyncAt: integration.lastSyncAt,
      lastHealthCheckAt: integration.lastHealthCheckAt,
      credentials: maskCredentials(integration.credentials as Record<string, unknown>),
      config: integration.config,
      installedAt: integration.installedAt,
      updatedAt: integration.updatedAt,
    }));

    return reply.send({
      integrations: result,
      counts: getIntegrationCounts(),
    });
  });

  // ── GET /marketplace — Browse catalog ───────────────────────

  app.get("/marketplace", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = marketplaceQuerySchema.parse(request.query);
    const shopId = request.shopId;

    // Get integrations from registry
    let apps: IntegrationAppMeta[];

    if (query.search) {
      apps = searchIntegrations(query.search);
    } else {
      apps = getAvailableIntegrations({
        status: query.status as IntegrationStatus | undefined,
        category: query.category as IntegrationCategory | undefined,
      });
    }

    // Apply subcategory filter
    if (query.subcategory) {
      apps = apps.filter((a) => a.subcategory === query.subcategory);
    }

    // Get installed slugs for this shop
    const installed = await prisma.integration.findMany({
      where: { shopId },
      select: { appSlug: true, isEnabled: true, healthStatus: true },
    });
    const installedMap = new Map(installed.map((i) => [i.appSlug, i]));

    // Annotate each app with install status
    const result = apps.map((app) => {
      const install = installedMap.get(app.slug);
      return {
        ...app,
        installed: !!install,
        isEnabled: install?.isEnabled ?? false,
        healthStatus: install?.healthStatus ?? null,
      };
    });

    return reply.send({
      apps: result,
      categories: CATEGORY_LABELS,
      counts: getIntegrationCounts(),
    });
  });

  // ── GET /marketplace/:slug — Integration detail ─────────────

  app.get(
    "/marketplace/:slug",
    async (
      request: FastifyRequest<{ Params: { slug: string } }>,
      reply: FastifyReply,
    ) => {
      const { slug } = request.params;
      const appMeta = getIntegrationBySlug(slug);

      if (!appMeta) {
        return reply.status(404).send({ error: "Integration not found" });
      }

      // Check if installed for current shop
      const installation = await prisma.integration.findUnique({
        where: {
          shopId_appSlug: { shopId: request.shopId, appSlug: slug },
        },
      });

      return reply.send({
        app: appMeta,
        installed: !!installation,
        installation: installation
          ? {
              isEnabled: installation.isEnabled,
              healthStatus: installation.healthStatus,
              credentials: maskCredentials(
                installation.credentials as Record<string, unknown>,
              ),
              config: installation.config,
              lastSyncAt: installation.lastSyncAt,
              lastHealthCheckAt: installation.lastHealthCheckAt,
              installedAt: installation.installedAt,
            }
          : null,
      });
    },
  );

  // ── POST /:slug/install — Install integration ──────────────

  app.post<{ Params: { slug: string } }>(
    "/:slug/install",
    { preHandler: [requireRole("ADMIN")] },
    async (request, reply) => {
      const { slug } = request.params;
      const body = installSchema.parse(request.body);
      const shopId = request.shopId;

      // Validate integration exists and is installable
      const appMeta = getIntegrationBySlug(slug);
      if (!appMeta) {
        return reply.status(404).send({ error: "Integration not found" });
      }
      if (appMeta.status === "COMING_SOON") {
        return reply
          .status(400)
          .send({ error: `${appMeta.name} is coming soon and cannot be installed yet.` });
      }
      if (appMeta.status === "DEPRECATED") {
        return reply
          .status(400)
          .send({ error: `${appMeta.name} is deprecated and cannot be installed.` });
      }

      // Check for existing installation
      const existing = await prisma.integration.findUnique({
        where: { shopId_appSlug: { shopId, appSlug: slug } },
      });
      if (existing) {
        return reply
          .status(409)
          .send({ error: `${appMeta.name} is already installed. Use PATCH to update.` });
      }

      // Validate required credentials
      const missingFields = appMeta.credentialFields
        .filter((f) => f.required && !body.credentials[f.key])
        .map((f) => f.label);

      if (missingFields.length > 0) {
        return reply.status(400).send({
          error: "Missing required credentials",
          missingFields,
        });
      }

      // Ensure IntegrationApp exists in DB (seed from registry if needed)
      await ensureAppInDb(appMeta);

      // Create the installation
      const integration = await prisma.integration.create({
        data: {
          shopId,
          appSlug: slug,
          isEnabled: true,
          credentials: body.credentials as Prisma.InputJsonValue,
          config: body.config as Prisma.InputJsonValue,
          healthStatus: "UNKNOWN",
        },
      });

      // Record install event
      await prisma.integrationEvent.create({
        data: {
          shopId,
          appSlug: slug,
          integrationId: integration.id,
          eventType: "INSTALL",
          metadata: { credentialKeys: Object.keys(body.credentials) },
        },
      });

      return reply.status(201).send({
        message: `${appMeta.name} installed successfully`,
        integration: {
          slug: integration.appSlug,
          isEnabled: integration.isEnabled,
          healthStatus: integration.healthStatus,
          installedAt: integration.installedAt,
        },
      });
    },
  );

  // ── DELETE /:slug — Uninstall integration ───────────────────

  app.delete<{ Params: { slug: string } }>(
    "/:slug",
    { preHandler: [requireRole("ADMIN")] },
    async (request, reply) => {
      const { slug } = request.params;
      const shopId = request.shopId;

      const existing = await prisma.integration.findUnique({
        where: { shopId_appSlug: { shopId, appSlug: slug } },
      });

      if (!existing) {
        return reply.status(404).send({ error: "Integration not installed" });
      }

      // Record uninstall event before deleting
      await prisma.integrationEvent.create({
        data: {
          shopId,
          appSlug: slug,
          integrationId: existing.id,
          eventType: "UNINSTALL",
          metadata: {},
        },
      });

      await prisma.integration.delete({
        where: { shopId_appSlug: { shopId, appSlug: slug } },
      });

      return reply.send({ message: `${slug} uninstalled successfully` });
    },
  );

  // ── PATCH /:slug — Update credentials or config ─────────────

  app.patch<{ Params: { slug: string } }>(
    "/:slug",
    { preHandler: [requireRole("ADMIN")] },
    async (request, reply) => {
      const { slug } = request.params;
      const body = updateSchema.parse(request.body);
      const shopId = request.shopId;

      const existing = await prisma.integration.findUnique({
        where: { shopId_appSlug: { shopId, appSlug: slug } },
      });

      if (!existing) {
        return reply.status(404).send({ error: "Integration not installed" });
      }

      const updateData: Record<string, unknown> = {};

      if (body.credentials !== undefined) {
        // Merge with existing credentials (allow partial updates)
        const currentCreds = (existing.credentials as Record<string, unknown>) ?? {};
        updateData.credentials = { ...currentCreds, ...body.credentials };
      }

      if (body.config !== undefined) {
        const currentConfig = (existing.config as Record<string, unknown>) ?? {};
        updateData.config = { ...currentConfig, ...body.config };
      }

      if (body.isEnabled !== undefined) {
        updateData.isEnabled = body.isEnabled;
      }

      const updated = await prisma.integration.update({
        where: { shopId_appSlug: { shopId, appSlug: slug } },
        data: updateData,
      });

      // Record config update event
      await prisma.integrationEvent.create({
        data: {
          shopId,
          appSlug: slug,
          integrationId: existing.id,
          eventType: "CONFIG_UPDATE",
          metadata: { updatedFields: Object.keys(updateData) },
        },
      });

      return reply.send({
        message: `${slug} updated successfully`,
        integration: {
          slug: updated.appSlug,
          isEnabled: updated.isEnabled,
          healthStatus: updated.healthStatus,
          credentials: maskCredentials(updated.credentials as Record<string, unknown>),
          config: updated.config,
          updatedAt: updated.updatedAt,
        },
      });
    },
  );

  // ── POST /:slug/test — Test connection / health check ───────

  app.post(
    "/:slug/test",
    async (
      request: FastifyRequest<{ Params: { slug: string } }>,
      reply: FastifyReply,
    ) => {
      const { slug } = request.params;
      const shopId = request.shopId;

      const existing = await prisma.integration.findUnique({
        where: { shopId_appSlug: { shopId, appSlug: slug } },
      });

      if (!existing) {
        return reply.status(404).send({ error: "Integration not installed" });
      }

      // For now, just validate that required credential fields are present
      const appMeta = getIntegrationBySlug(slug);
      if (!appMeta) {
        return reply.status(404).send({ error: "Integration not found in registry" });
      }

      const creds = (existing.credentials as Record<string, unknown>) ?? {};
      const missingRequired = appMeta.credentialFields
        .filter((f) => f.required && !creds[f.key])
        .map((f) => f.key);

      const healthy = missingRequired.length === 0;
      const healthStatus = healthy ? "HEALTHY" : "ERROR";

      // Update health status
      await prisma.integration.update({
        where: { shopId_appSlug: { shopId, appSlug: slug } },
        data: {
          healthStatus,
          lastHealthCheckAt: new Date(),
        },
      });

      // Record health check event
      await prisma.integrationEvent.create({
        data: {
          shopId,
          appSlug: slug,
          integrationId: existing.id,
          eventType: "HEALTH_CHECK",
          metadata: { healthy, missingRequired },
        },
      });

      return reply.send({
        slug,
        healthy,
        healthStatus,
        missingRequired: missingRequired.length > 0 ? missingRequired : undefined,
        lastHealthCheckAt: new Date(),
      });
    },
  );

  // ── GET /:slug/events — Event log ──────────────────────────

  app.get(
    "/:slug/events",
    async (
      request: FastifyRequest<{ Params: { slug: string } }>,
      reply: FastifyReply,
    ) => {
      const { slug } = request.params;
      const query = eventsQuerySchema.parse(request.query);
      const shopId = request.shopId;

      const where: Record<string, unknown> = {
        shopId,
        appSlug: slug,
      };

      if (query.eventType) {
        where.eventType = query.eventType;
      }

      const [events, total] = await Promise.all([
        prisma.integrationEvent.findMany({
          where,
          orderBy: { timestamp: "desc" },
          take: query.limit,
          skip: query.offset,
        }),
        prisma.integrationEvent.count({ where }),
      ]);

      return reply.send({
        events,
        total,
        limit: query.limit,
        offset: query.offset,
      });
    },
  );

  // ── GET /meter — Unified metering stats ─────────────────────

  app.get("/meter", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = meterQuerySchema.parse(request.query);
    const shopId = request.shopId;

    const where: Record<string, unknown> = {
      shopId,
      eventType: "METER",
    };

    if (query.since) {
      where.timestamp = { gte: new Date(query.since) };
    }

    if (query.appSlug) {
      where.appSlug = query.appSlug;
    }

    const events = await prisma.integrationEvent.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: 500,
    });

    // Aggregate by slug
    const bySlug: Record<string, number> = {};
    for (const event of events) {
      bySlug[event.appSlug] = (bySlug[event.appSlug] || 0) + 1;
    }

    return reply.send({
      total: events.length,
      bySlug,
      events: events.slice(0, 100), // Return first 100 for display
    });
  });
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Ensure an IntegrationApp row exists in the DB (seed from registry metadata).
 * This is idempotent — upserts based on slug.
 */
async function ensureAppInDb(meta: IntegrationAppMeta): Promise<void> {
  await prisma.integrationApp.upsert({
    where: { slug: meta.slug },
    update: {
      name: meta.name,
      description: meta.description,
      longDescription: meta.longDescription,
      category: meta.category,
      subcategory: meta.subcategory,
      logoUrl: meta.logoUrl,
      websiteUrl: meta.websiteUrl,
      docsUrl: meta.docsUrl,
      authType: meta.authType,
      credentialSchema: JSON.parse(JSON.stringify(meta.credentialFields)),
      capabilities: meta.capabilities as string[],
      status: meta.status,
      isBuiltIn: meta.isBuiltIn,
      version: meta.version,
    },
    create: {
      slug: meta.slug,
      name: meta.name,
      description: meta.description,
      longDescription: meta.longDescription,
      category: meta.category,
      subcategory: meta.subcategory,
      logoUrl: meta.logoUrl,
      websiteUrl: meta.websiteUrl,
      docsUrl: meta.docsUrl,
      authType: meta.authType,
      credentialSchema: JSON.parse(JSON.stringify(meta.credentialFields)),
      capabilities: meta.capabilities as string[],
      status: meta.status,
      isBuiltIn: meta.isBuiltIn,
      version: meta.version,
    },
  });
}
