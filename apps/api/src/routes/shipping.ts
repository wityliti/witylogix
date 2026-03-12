/**
 * Shipping Routes — Multi-Carrier Shipping & Label Management
 *
 * Routes:
 *   POST /shipping/rates              Compare rates across carriers
 *   POST /shipping/labels             Create label (auto-selects best rate or specified)
 *   GET  /shipping/track/:tracking    Unified tracking across carriers
 *   POST /shipping/validate-address   Address verification
 *   GET  /shipping/carriers           List available carriers
 *   POST /shipping/webhooks/:provider Webhook receiver (ShipStation, EasyPost, etc.)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { tenantContext } from "../middleware/tenant.js";
import { ValidationError, NotFoundError } from "../lib/errors.js";
import type {
  ShipmentRequest,
  ShipmentRate,
  ShipmentLabel,
  TrackingResult,
  AddressValidationResult,
  ShippingAddress,
  RateRankingCriteria,
  CarrierType,
  ServiceLevel,
  PackageType,
} from "@witylogix/core/integrations";
import {
  CarrierRateEngine,
  ShipStationClient,
  EasyPostClient,
} from "@witylogix/core/integrations";

// ─── Request/Response Schemas ───────────────────────────────────

const addressSchema = z.object({
  name: z.string().min(1),
  street1: z.string().min(1),
  street2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(1),
  country: z.string().min(2).max(2),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  instructions: z.string().optional(),
});

const dimensionsSchema = z.object({
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
});

const weightSchema = z.object({
  value: z.number().positive(),
  unit: z.enum(["lb", "kg"]),
});

const rateRequestSchema = z.object({
  shipmentId: z.string(),
  from: addressSchema,
  to: addressSchema,
  weight: weightSchema,
  dimensions: dimensionsSchema.optional(),
  packageType: z.enum([
    "ENVELOPE",
    "PACKAGE",
    "PALLET",
    "BOX",
    "TUBE",
    "PAK",
    "FLAT_RATE_ENVELOPE",
    "FLAT_RATE_BOX",
  ]).optional(),
  services: z.array(
    z.enum([
      "GROUND",
      "EXPRESS",
      "OVERNIGHT",
      "ECONOMY",
      "STANDARD",
      "PRIORITY",
      "INTERNATIONAL",
    ])
  ).optional(),
  insureValue: z.number().optional(),
  signatureRequired: z.boolean().optional(),
  deliveryConfirmation: z.enum(["NONE", "DELIVERY", "SIGNATURE", "ADULT_SIGNATURE"]).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const labelRequestSchema = z.object({
  shipmentId: z.string(),
  from: addressSchema,
  to: addressSchema,
  weight: weightSchema,
  dimensions: dimensionsSchema.optional(),
  packageType: z.enum([
    "ENVELOPE",
    "PACKAGE",
    "PALLET",
    "BOX",
    "TUBE",
    "PAK",
    "FLAT_RATE_ENVELOPE",
    "FLAT_RATE_BOX",
  ]).optional(),
  rateId: z.string().optional(),
  rankBy: z.enum(["price", "speed", "value"]).default("price"),
  maxPrice: z.number().optional(),
  maxDeliveryDays: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const addressValidationSchema = z.object({
  address: addressSchema,
});

const webhookSchema = z.object({
  body: z.unknown(),
  headers: z.record(z.string()),
});

// ─── Global Rate Engine (singleton) ──────────────────────────────

let rateEngine: CarrierRateEngine | null = null;

/**
 * Initialize the rate engine with configured adapters.
 */
function initializeRateEngine(credentials: {
  shipstation?: { apiKey: string; apiSecret: string };
  easypost?: { apiKey: string };
}): CarrierRateEngine {
  if (rateEngine) {
    return rateEngine;
  }

  rateEngine = new CarrierRateEngine();

  // Register ShipStation if configured
  if (credentials.shipstation) {
    const ss = new ShipStationClient({
      apiKey: credentials.shipstation.apiKey,
      apiSecret: credentials.shipstation.apiSecret,
    });
    rateEngine.registerAdapter("shipstation", ss);
  }

  // Register EasyPost if configured
  if (credentials.easypost) {
    const ep = new EasyPostClient({
      apiKey: credentials.easypost.apiKey,
    });
    rateEngine.registerAdapter("easypost", ep);
  }

  return rateEngine;
}

// ─── Route Handlers ────────────────────────────────────────────

/**
 * POST /shipping/rates
 * Compare rates across all configured carriers.
 */
async function getRates(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { shopId } = await tenantContext(request);
  const validated = rateRequestSchema.parse(request.body);

  // Get shop integrations (mock for now; would fetch from DB)
  const integrationConfig = {
    shipstation: {
      apiKey: process.env.SHIPSTATION_API_KEY || "",
      apiSecret: process.env.SHIPSTATION_API_SECRET || "",
    },
    easypost: {
      apiKey: process.env.EASYPOST_API_KEY || "",
    },
  };

  const engine = initializeRateEngine(integrationConfig);

  const shipmentRequest: ShipmentRequest = {
    shipmentId: validated.shipmentId,
    from: validated.from,
    to: validated.to,
    weight: validated.weight,
    dimensions: validated.dimensions,
    packageType: validated.packageType as PackageType | undefined,
    services: validated.services as ServiceLevel[] | undefined,
    insureValue: validated.insureValue,
    signatureRequired: validated.signatureRequired,
    deliveryConfirmation: validated.deliveryConfirmation,
    metadata: validated.metadata,
  };

  const criteria: RateRankingCriteria = {
    sortBy: "price",
    maxDeliveryDays: validated.services ? undefined : 30,
  };

  try {
    const comparison = await engine.compareRates(shipmentRequest, criteria);

    reply.code(200).send({
      shipmentId: validated.shipmentId,
      rates: comparison.rates,
      bestRate: comparison.bestRate,
      cached: comparison.cached,
      timestamp: comparison.timestamp,
    });
  } catch (error: unknown) {
    console.error("Error fetching rates:", error);
    throw new ValidationError(
      `Failed to fetch shipping rates: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * POST /shipping/labels
 * Create a shipping label.
 */
async function createLabel(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { shopId } = await tenantContext(request);
  const validated = labelRequestSchema.parse(request.body);

  const integrationConfig = {
    shipstation: {
      apiKey: process.env.SHIPSTATION_API_KEY || "",
      apiSecret: process.env.SHIPSTATION_API_SECRET || "",
    },
    easypost: {
      apiKey: process.env.EASYPOST_API_KEY || "",
    },
  };

  const engine = initializeRateEngine(integrationConfig);

  const shipmentRequest: ShipmentRequest = {
    shipmentId: validated.shipmentId,
    from: validated.from,
    to: validated.to,
    weight: validated.weight,
    dimensions: validated.dimensions,
    packageType: validated.packageType as PackageType | undefined,
    metadata: validated.metadata,
  };

  try {
    let rateId = validated.rateId;

    if (!rateId) {
      // Auto-select best rate
      const criteria: RateRankingCriteria = {
        sortBy: validated.rankBy as "price" | "speed" | "value",
        maxPrice: validated.maxPrice,
        maxDeliveryDays: validated.maxDeliveryDays,
      };

      const bestRate = await engine.getBestRate(shipmentRequest, criteria);

      if (!bestRate) {
        throw new ValidationError("No available shipping rates");
      }

      rateId = bestRate.rateId;
    }

    // Create label using the selected rate
    const adapters = engine.getAdapters();
    let label: ShipmentLabel | null = null;

    for (const [name, adapter] of adapters) {
      try {
        label = await adapter.createShipment(shipmentRequest, rateId);
        break;
      } catch (error) {
        console.warn(`Failed to create label with ${name}:`, error);
      }
    }

    if (!label) {
      throw new ValidationError("Failed to create shipping label");
    }

    reply.code(201).send({
      shipmentId: validated.shipmentId,
      label: {
        labelId: label.labelId,
        trackingNumber: label.trackingNumber,
        carrier: label.carrier,
        service: label.service,
        labelUrl: label.labelUrl,
        format: label.format,
        createdAt: label.createdAt,
      },
    });
  } catch (error: unknown) {
    console.error("Error creating label:", error);
    throw new ValidationError(
      `Failed to create shipping label: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * GET /shipping/track/:tracking
 * Get tracking information for a shipment.
 */
async function trackShipment(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { shopId } = await tenantContext(request);
  const { tracking } = request.params as { tracking: string };

  const integrationConfig = {
    shipstation: {
      apiKey: process.env.SHIPSTATION_API_KEY || "",
      apiSecret: process.env.SHIPSTATION_API_SECRET || "",
    },
    easypost: {
      apiKey: process.env.EASYPOST_API_KEY || "",
    },
  };

  const engine = initializeRateEngine(integrationConfig);

  try {
    const adapters = engine.getAdapters();
    let result: TrackingResult | null = null;

    for (const [name, adapter] of adapters) {
      try {
        result = await adapter.track(tracking);
        if (result.status !== "UNKNOWN") {
          break;
        }
      } catch (error) {
        console.warn(`Failed to track with ${name}:`, error);
      }
    }

    if (!result) {
      throw new NotFoundError(`Tracking number not found: ${tracking}`);
    }

    reply.code(200).send({
      trackingNumber: result.trackingNumber,
      carrier: result.carrier,
      status: result.status,
      estimatedDeliveryDate: result.estimatedDeliveryDate,
      deliveryDate: result.deliveryDate,
      events: result.events.map((event) => ({
        timestamp: event.timestamp,
        status: event.status,
        message: event.message,
        location: event.location,
      })),
    });
  } catch (error: unknown) {
    console.error("Error tracking shipment:", error);
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new ValidationError(
      `Failed to track shipment: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * POST /shipping/validate-address
 * Validate and normalize an address.
 */
async function validateAddress(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { shopId } = await tenantContext(request);
  const validated = addressValidationSchema.parse(request.body);

  const integrationConfig = {
    shipstation: {
      apiKey: process.env.SHIPSTATION_API_KEY || "",
      apiSecret: process.env.SHIPSTATION_API_SECRET || "",
    },
    easypost: {
      apiKey: process.env.EASYPOST_API_KEY || "",
    },
  };

  const engine = initializeRateEngine(integrationConfig);

  try {
    const adapters = engine.getAdapters();
    let result: AddressValidationResult | null = null;

    for (const [name, adapter] of adapters) {
      try {
        result = await adapter.validateAddress(validated.address);
        if (result.valid) {
          break;
        }
      } catch (error) {
        console.warn(`Failed to validate address with ${name}:`, error);
      }
    }

    if (!result) {
      result = {
        valid: false,
        messages: ["No address validation service available"],
      };
    }

    reply.code(200).send({
      valid: result.valid,
      address: result.address,
      messages: result.messages || [],
    });
  } catch (error: unknown) {
    console.error("Error validating address:", error);
    throw new ValidationError(
      `Failed to validate address: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * GET /shipping/carriers
 * List available carriers.
 */
async function listCarriers(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { shopId } = await tenantContext(request);

  const carriers = [
    {
      name: "ShipStation",
      slug: "shipstation",
      available:
        !!process.env.SHIPSTATION_API_KEY &&
        !!process.env.SHIPSTATION_API_SECRET,
    },
    {
      name: "EasyPost",
      slug: "easypost",
      available: !!process.env.EASYPOST_API_KEY,
    },
  ];

  reply.code(200).send({ carriers });
}

/**
 * POST /shipping/webhooks/:provider
 * Handle webhooks from shipping providers.
 */
async function handleWebhook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { provider } = request.params as { provider: string };

  const integrationConfig = {
    shipstation: {
      apiKey: process.env.SHIPSTATION_API_KEY || "",
      apiSecret: process.env.SHIPSTATION_API_SECRET || "",
    },
    easypost: {
      apiKey: process.env.EASYPOST_API_KEY || "",
    },
  };

  const engine = initializeRateEngine(integrationConfig);
  const adapters = engine.getAdapters();

  const adapter = adapters.get(provider.toLowerCase());
  if (!adapter) {
    throw new NotFoundError(`Unknown provider: ${provider}`);
  }

  // Parse webhook based on provider
  let event = null;

  if (provider === "shipstation") {
    const ssAdapter = adapter as any;
    event = ssAdapter.parseWebhook(request.body, request.headers);
  } else if (provider === "easypost") {
    const epAdapter = adapter as any;
    event = epAdapter.parseWebhook(request.body, request.headers);
  }

  if (!event) {
    throw new ValidationError("Invalid webhook payload");
  }

  // TODO: Process webhook event (store in DB, trigger notifications, etc.)
  reply.code(202).send({ received: true, eventType: event.eventType });
}

// ─── Route Registration ─────────────────────────────────────────

export async function registerShippingRoutes(
  app: FastifyInstance
): Promise<void> {
  app.post<{ Body: unknown }>(
    "/shipping/rates",
    { onRequest: [requireAuth] },
    getRates
  );

  app.post<{ Body: unknown }>(
    "/shipping/labels",
    { onRequest: [requireAuth] },
    createLabel
  );

  app.get<{ Params: { tracking: string } }>(
    "/shipping/track/:tracking",
    { onRequest: [requireAuth] },
    trackShipment
  );

  app.post<{ Body: unknown }>(
    "/shipping/validate-address",
    { onRequest: [requireAuth] },
    validateAddress
  );

  app.get(
    "/shipping/carriers",
    { onRequest: [requireAuth] },
    listCarriers
  );

  app.post<{ Params: { provider: string }; Body: unknown }>(
    "/shipping/webhooks/:provider",
    handleWebhook
  );
}
