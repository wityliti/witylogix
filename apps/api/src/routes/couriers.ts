/**
 * Courier Partner Routes
 *
 * API endpoints for multi-courier delivery management:
 *   GET    /couriers/partners                 List available courier partners
 *   POST   /couriers/partners                 Register new courier partner
 *   DELETE /couriers/partners/:id             Unregister courier partner
 *   PATCH  /couriers/partners/:id             Update courier configuration
 *   GET    /couriers/quote                    Get multi-courier quote comparison
 *   POST   /couriers/dispatch                 Dispatch delivery with auto-selection
 *   GET    /couriers/deliveries/:id          Get delivery status and tracking
 *   POST   /couriers/deliveries/:id/cancel   Cancel an active delivery
 *   GET    /couriers/deliveries/:id/tracking Get real-time tracking info
 *   POST   /couriers/webhooks/:provider      Receive webhook from courier
 *   GET    /couriers/compare                 Compare quotes from all providers
 *   GET    /couriers/stats                   Get delivery statistics and analytics
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Prisma } from "@witylogix/db";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { prisma } from "@witylogix/db";
import {
  OnfleetClient,
  StuartClient,
  UberDirectClient,
  CourierDispatcher,
  CourierNormalizer,
  QuoteComparator,
  type CourierConfig,
  type QuoteRequest,
  type CreateDeliveryRequest,
  type DispatchRequest,
  DeliveryStatus,
  WebhookEvent,
} from "@witylogix/core/integrations/couriers";

// ─── Zod Schemas ────────────────────────────────────────────────

const registerPartnerSchema = z.object({
  provider: z.enum(["onfleet", "stuart", "uber_direct"]),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  credentials: z.record(z.string()).default({}),
  config: z.record(z.unknown()).optional().default({}),
});

const updatePartnerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  credentials: z.record(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
  isEnabled: z.boolean().optional(),
});

const quoteRequestSchema = z.object({
  pickup: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string().optional(),
    name: z.string().optional(),
    phone: z.string().optional(),
    instructions: z.string().optional(),
  }),
  dropoff: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string().optional(),
    name: z.string().optional(),
    phone: z.string().optional(),
    instructions: z.string().optional(),
  }),
  package: z
    .object({
      weight: z.number().optional(),
      dimensions: z.object({ length: z.number(), width: z.number(), height: z.number() }).optional(),
      transportType: z.enum(["bike", "car", "van"]).optional(),
      itemCount: z.number().optional(),
      fragile: z.boolean().optional(),
      requiresSignature: z.boolean().optional(),
    })
    .optional(),
  scheduledFor: z.string().datetime().optional(),
  providers: z.array(z.string()).optional(),
});

const dispatchSchema = z.object({
  orderId: z.string().optional(),
  pickup: quoteRequestSchema.shape.pickup,
  dropoff: quoteRequestSchema.shape.dropoff,
  package: quoteRequestSchema.shape.package,
  recipient: z
    .object({
      name: z.string(),
      email: z.string().email().optional(),
      phone: z.string(),
      instructions: z.string().optional(),
    })
    .optional(),
  preferredCourier: z.string().optional(),
  strategy: z.enum(["cheapest", "fastest", "preferred", "auto"]).optional().default("auto"),
  scheduledFor: z.string().datetime().optional(),
});

const webhookSchema = z.object({
  signature: z.string().optional(),
  timestamp: z.number().optional(),
  body: z.record(z.unknown()),
});

const statsQuerySchema = z.object({
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  provider: z.string().optional(),
  status: z.enum(["pending", "picked_up", "in_transit", "delivered", "failed", "cancelled"]).optional(),
});

// ─── Route Registration ─────────────────────────────────────────

export default async function courierRoutes(app: FastifyInstance): Promise<void> {
  // All routes require authentication + tenant context
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", tenantContext);

  // Initialize dispatcher with registered adapters
  const dispatcher = new CourierDispatcher();

  // ── GET /couriers/partners — List registered partners ───────────

  app.get("/partners", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId!;

    const partners = await prisma.courierPartner.findMany({
      where: { tenantId },
      select: {
        id: true,
        provider: true,
        name: true,
        description: true,
        isEnabled: true,
        status: true,
        healthStatus: true,
        lastSyncAt: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return reply.send(partners);
  });

  // ── POST /couriers/partners — Register new partner ───────────────

  app.post("/partners", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId!;
    const body = registerPartnerSchema.parse(request.body);

    // Validate credentials with provider
    const adapter = this.createAdapter(body.provider, body.credentials as CourierConfig);
    try {
      await adapter.validateConfig();
    } catch (error) {
      return reply.status(400).send({
        error: "Invalid credentials",
        message: error instanceof Error ? error.message : "Failed to validate credentials",
      });
    }

    // Check for duplicate provider
    const existing = await prisma.courierPartner.findFirst({
      where: { tenantId, provider: body.provider },
    });

    if (existing) {
      return reply.status(409).send({
        error: "Duplicate provider",
        message: `${body.provider} is already registered for this tenant`,
      });
    }

    const partner = await prisma.courierPartner.create({
      data: {
        tenantId,
        provider: body.provider,
        name: body.name,
        description: body.description,
        credentials: body.credentials,
        config: body.config,
        status: "ACTIVE",
        healthStatus: "UNKNOWN",
      },
    });

    return reply.status(201).send(partner);
  });

  // ── DELETE /couriers/partners/:id — Unregister partner ──────────

  app.delete("/partners/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };

    const partner = await prisma.courierPartner.findFirst({
      where: { id, tenantId },
    });

    if (!partner) {
      return reply.status(404).send({ error: "Partner not found" });
    }

    await prisma.courierPartner.delete({
      where: { id },
    });

    return reply.send({ message: "Partner unregistered" });
  });

  // ── PATCH /couriers/partners/:id — Update partner ────────────────

  app.patch("/partners/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };
    const body = updatePartnerSchema.parse(request.body);

    const partner = await prisma.courierPartner.findFirst({
      where: { id, tenantId },
    });

    if (!partner) {
      return reply.status(404).send({ error: "Partner not found" });
    }

    // If credentials updated, validate them
    if (body.credentials) {
      const adapter = this.createAdapter(
        partner.provider,
        { ...partner.credentials, ...body.credentials } as CourierConfig,
      );
      try {
        await adapter.validateConfig();
      } catch (error) {
        return reply.status(400).send({
          error: "Invalid credentials",
          message: error instanceof Error ? error.message : "Failed to validate credentials",
        });
      }
    }

    const updated = await prisma.courierPartner.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        credentials: body.credentials ? { ...partner.credentials, ...body.credentials } : undefined,
        config: body.config ? { ...partner.config, ...body.config } : undefined,
        isEnabled: body.isEnabled,
      },
    });

    return reply.send(updated);
  });

  // ── GET /couriers/quote — Get quotes from all/specified providers ──

  app.get(
    "/quote",
    async (request: FastifyRequest<{ Querystring: typeof quoteRequestSchema._type }>, reply: FastifyReply) => {
      const tenantId = request.tenantId!;
      const query = quoteRequestSchema.parse(request.query);

      // Get active partners
      const partners = await prisma.courierPartner.findMany({
        where: {
          tenantId,
          isEnabled: true,
          ...(query.providers && { provider: { in: query.providers } }),
        },
      });

      if (partners.length === 0) {
        return reply.status(400).send({
          error: "No active partners configured",
        });
      }

      // Register adapters
      for (const partner of partners) {
        const adapter = this.createAdapter(partner.provider, partner.credentials as CourierConfig);
        dispatcher.registerAdapter(adapter);
      }

      // Get quotes
      const quoteRequest: QuoteRequest = {
        pickup: query.pickup,
        dropoff: query.dropoff,
        package: query.package,
        scheduledFor: query.scheduledFor ? new Date(query.scheduledFor) : undefined,
      };

      try {
        const { quotes, normalized, errors } = await dispatcher.getQuotes(quoteRequest);

        return reply.send({
          quotes,
          analysis: normalized,
          errors,
        });
      } catch (error) {
        return reply.status(500).send({
          error: "Failed to get quotes",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // ── POST /couriers/dispatch — Create delivery with auto-selection ──

  app.post("/dispatch", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId!;
    const body = dispatchSchema.parse(request.body);

    // Get active partners
    const partners = await prisma.courierPartner.findMany({
      where: { tenantId, isEnabled: true },
    });

    if (partners.length === 0) {
      return reply.status(400).send({
        error: "No active partners configured",
      });
    }

    // Register adapters
    for (const partner of partners) {
      const adapter = this.createAdapter(partner.provider, partner.credentials as CourierConfig);
      dispatcher.registerAdapter(adapter);
    }

    const dispatchRequest: DispatchRequest = {
      orderId: body.orderId,
      pickup: body.pickup,
      dropoff: body.dropoff,
      package: body.package,
      recipient: body.recipient,
      preferredCourier: body.preferredCourier,
      strategy: body.strategy,
      scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
    };

    try {
      const result = await dispatcher.dispatch(dispatchRequest);

      // Save delivery record
      const partnerRecord = await prisma.courierPartner.findFirst({
        where: { tenantId, provider: result.courier },
      });

      if (!partnerRecord) {
        throw new Error("Partner record not found");
      }

      const delivery = await prisma.courierDelivery.create({
        data: {
          tenantId,
          partnerId: partnerRecord.id,
          externalId: result.deliveryId,
          orderId: body.orderId,
          status: "PENDING",
          trackingUrl: result.trackingUrl,
          trackingNumber: result.deliveryId,
          quote: result.quote as unknown as Prisma.InputJsonValue,
        },
      });

      return reply.status(201).send({
        dispatch: result,
        tracking: delivery,
      });
    } catch (error) {
      return reply.status(400).send({
        error: "Dispatch failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ── GET /couriers/deliveries/:id — Get delivery status ──────────

  app.get("/deliveries/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };

    const delivery = await prisma.courierDelivery.findFirst({
      where: { id, tenantId },
      include: { partner: true },
    });

    if (!delivery) {
      return reply.status(404).send({ error: "Delivery not found" });
    }

    try {
      const adapter = this.createAdapter(delivery.partner.provider, delivery.partner.credentials as CourierConfig);
      const status = await adapter.getDeliveryStatus(delivery.externalId);

      return reply.send({
        delivery: {
          id: delivery.id,
          externalId: delivery.externalId,
          status: delivery.status,
          trackingUrl: delivery.trackingUrl,
          driverName: delivery.driverName,
          driverPhone: delivery.driverPhone,
          createdAt: delivery.createdAt,
          deliveredAt: delivery.deliveredAt,
        },
        liveStatus: status,
      });
    } catch (error) {
      return reply.status(500).send({
        error: "Failed to fetch status",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ── POST /couriers/deliveries/:id/cancel — Cancel delivery ──────

  app.post("/deliveries/:id/cancel", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };

    const delivery = await prisma.courierDelivery.findFirst({
      where: { id, tenantId },
      include: { partner: true },
    });

    if (!delivery) {
      return reply.status(404).send({ error: "Delivery not found" });
    }

    if (delivery.status === "DELIVERED" || delivery.status === "CANCELLED") {
      return reply.status(400).send({
        error: "Cannot cancel delivery",
        message: `Delivery is already ${delivery.status.toLowerCase()}`,
      });
    }

    try {
      const adapter = this.createAdapter(delivery.partner.provider, delivery.partner.credentials as CourierConfig);
      const status = await adapter.cancelDelivery(delivery.externalId);

      // Update delivery status
      await prisma.courierDelivery.update({
        where: { id },
        data: {
          status: "CANCELLED",
          lastStatusUpdate: new Date(),
        },
      });

      return reply.send({
        message: "Delivery cancelled",
        status,
      });
    } catch (error) {
      return reply.status(500).send({
        error: "Failed to cancel delivery",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ── GET /couriers/deliveries/:id/tracking — Live tracking info ───

  app.get("/deliveries/:id/tracking", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId!;
    const { id } = request.params as { id: string };

    const delivery = await prisma.courierDelivery.findFirst({
      where: { id, tenantId },
      include: { partner: true },
    });

    if (!delivery) {
      return reply.status(404).send({ error: "Delivery not found" });
    }

    try {
      const adapter = this.createAdapter(delivery.partner.provider, delivery.partner.credentials as CourierConfig);

      // Get driver location and status in parallel
      const [location, status] = await Promise.all([
        adapter.getDriverLocation(delivery.externalId).catch(() => null),
        adapter.getDeliveryStatus(delivery.externalId),
      ]);

      return reply.send({
        delivery: {
          id: delivery.id,
          status: status.status,
          trackingUrl: delivery.trackingUrl,
        },
        driver: location
          ? {
              location,
              name: status.driverName,
              phone: status.driverPhone,
            }
          : null,
        estimatedArrival: status.estimatedArrivalAt,
      });
    } catch (error) {
      return reply.status(500).send({
        error: "Failed to get tracking info",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ── POST /couriers/webhooks/:provider — Receive webhook ──────────

  app.post("/webhooks/:provider", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId!;
    const { provider } = request.params as { provider: string };

    // Log webhook
    const log = await prisma.courierWebhookLog.create({
      data: {
        partnerId: "unknown",
        eventType: "unknown",
        payload: request.body as Prisma.InputJsonValue,
        headers: request.headers as Prisma.InputJsonValue,
      },
    });

    try {
      // Process webhook
      await dispatcher.handleWebhook(provider, request.body);

      // Mark as processed
      await prisma.courierWebhookLog.update({
        where: { id: log.id },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });

      return reply.send({ success: true });
    } catch (error) {
      await prisma.courierWebhookLog.update({
        where: { id: log.id },
        data: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });

      return reply.status(400).send({
        error: "Failed to process webhook",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // ── GET /couriers/compare — Compare all active providers ────────

  app.get("/compare", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId!;

    const partners = await prisma.courierPartner.findMany({
      where: { tenantId, isEnabled: true },
      select: {
        id: true,
        provider: true,
        name: true,
        healthStatus: true,
        lastError: true,
      },
    });

    return reply.send({
      partners,
      health: partners.map((p) => ({
        provider: p.provider,
        name: p.name,
        status: p.healthStatus,
        lastError: p.lastError,
      })),
    });
  });

  // ── GET /couriers/stats — Delivery statistics ────────────────────

  app.get("/stats", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId!;
    const query = statsQuerySchema.parse(request.query);

    const where: Prisma.CourierDeliveryWhereInput = {
      tenantId,
      createdAt: {
        gte: query.since ? new Date(query.since) : undefined,
        lte: query.until ? new Date(query.until) : undefined,
      },
      partner: query.provider ? { provider: query.provider } : undefined,
      status: query.status ? (query.status.toUpperCase() as any) : undefined,
    };

    const [total, delivered, failed, cancelled, avgCost] = await Promise.all([
      prisma.courierDelivery.count({ where }),
      prisma.courierDelivery.count({ where: { ...where, status: "DELIVERED" } }),
      prisma.courierDelivery.count({ where: { ...where, status: "FAILED" } }),
      prisma.courierDelivery.count({ where: { ...where, status: "CANCELLED" } }),
      prisma.courierDelivery.aggregate({
        where,
        _avg: { actualCost: true },
      }),
    ]);

    return reply.send({
      total,
      delivered,
      failed,
      cancelled,
      pending: total - delivered - failed - cancelled,
      successRate: total > 0 ? ((delivered / total) * 100).toFixed(2) + "%" : "0%",
      averageCost: avgCost._avg.actualCost,
    });
  });

  // ── GET /couriers/partner-stats — Per-provider delivery stats ────

  app.get("/partner-stats", async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId!;

    const partners = await prisma.courierPartner.findMany({
      where: { tenantId },
      select: { id: true, provider: true },
    });

    const stats = await Promise.all(
      partners.map(async (p) => {
        const [active, total, delivered] = await Promise.all([
          prisma.courierDelivery.count({
            where: { partnerId: p.id, status: { in: ["PENDING", "PICKED_UP", "IN_TRANSIT"] } },
          }),
          prisma.courierDelivery.count({ where: { partnerId: p.id } }),
          prisma.courierDelivery.count({
            where: { partnerId: p.id, status: "DELIVERED" },
          }),
        ]);
        return {
          provider: p.provider,
          activeDeliveries: active,
          totalDeliveries: total,
          successRate: total > 0 ? Math.round((delivered / total) * 100) : null,
        };
      })
    );

    return reply.send({ stats });
  });
}

// ─── Helper Functions ────────────────────────────────────────────

function createAdapter(provider: string, config: CourierConfig) {
  switch (provider) {
    case "onfleet":
      return new OnfleetClient(config);
    case "stuart":
      return new StuartClient(config);
    case "uber_direct":
      return new UberDirectClient(config);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
