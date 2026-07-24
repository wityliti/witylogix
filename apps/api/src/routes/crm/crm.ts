/**
 * CRM Integration Routes
 * OAuth flows, sync operations, and CRM management
 *
 * Routes:
 *   POST   /crm/connect/:provider          — Initiate OAuth flow
 *   GET    /crm/callback/:provider         — OAuth callback handler
 *   GET    /crm/contacts                   — Search CRM contacts
 *   POST   /crm/sync                       — Trigger sync
 *   GET    /crm/sync/status                — Get sync status
 *   POST   /crm/webhooks/:provider         — Webhook receiver
 *   GET    /crm/field-mappings             — Get field mappings
 *   PUT    /crm/field-mappings             — Update field mappings
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  SalesforceAdapter,
  HubSpotAdapter,
  CRMSyncEngine,
} from "@witylogix/core/integrations/crm";
import type {
  CRMConnection,
  CRMFieldMapping,
  CRMContact,
  CRMPagedResult,
  CRMProvider,
} from "@witylogix/core/integrations/crm";
import { requireAuth } from "../../middleware/auth.js";
import { tenantContext } from "../../middleware/tenant.js";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "../../lib/errors.js";

// ─── SCHEMAS ─────────────────────────────────────────────────────

const connectSchema = z.object({
  provider: z.enum(["salesforce", "hubspot"]),
  redirectUri: z.string().url().optional(),
});

const callbackSchema = z.object({
  code: z.string(),
  state: z.string().optional(),
});

const contactFilterSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const syncSchema = z.object({
  recordType: z.enum(["contact", "account", "opportunity"]).optional(),
  incremental: z.boolean().optional().default(true),
});

const webhookSchema = z.object({
  eventType: z.string(),
  data: z.record(z.unknown()).optional(),
});

const fieldMappingCreateSchema = z.object({
  witylogixField: z.string(),
  crmField: z.string(),
  recordType: z.enum(["contact", "account", "opportunity", "deal", "activity"]),
  direction: z.enum(["bidirectional", "to_crm", "from_crm"]),
  transformation: z
    .enum(["none", "uppercase", "lowercase", "phone_format", "custom"])
    .optional(),
  transformationScript: z.string().optional(),
  isRequired: z.boolean().optional().default(false),
});

const fieldMappingUpdateSchema = fieldMappingCreateSchema.partial().extend({
  id: z.string(),
});

// ─── TYPE STUBS ─────────────────────────────────────────────────

// These would normally come from database queries
interface StoredCRMConnection extends CRMConnection {
  clientId: string;
  clientSecret: string;
}

interface CRMService {
  getConnection(
    tenantId: string,
    provider: CRMProvider,
  ): Promise<StoredCRMConnection | null>;
  saveConnection(connection: StoredCRMConnection): Promise<void>;
  getFieldMappings(connectionId: string): Promise<CRMFieldMapping[]>;
  saveFieldMapping(mapping: CRMFieldMapping): Promise<void>;
  logWebhookEvent(event: unknown): Promise<void>;
}

// ─── MOCK CRM SERVICE ────────────────────────────────────────────

class MockCRMService implements CRMService {
  private connections: Map<string, StoredCRMConnection> = new Map();
  private fieldMappings: Map<string, CRMFieldMapping[]> = new Map();

  async getConnection(
    tenantId: string,
    provider: CRMProvider,
  ): Promise<StoredCRMConnection | null> {
    const key: string = `${tenantId}:${provider}`;
    return this.connections.get(key) || null;
  }

  async saveConnection(connection: StoredCRMConnection): Promise<void> {
    const key: string = `${connection.tenantId}:${connection.provider}`;
    this.connections.set(key, connection);
  }

  async getFieldMappings(connectionId: string): Promise<CRMFieldMapping[]> {
    return this.fieldMappings.get(connectionId) || [];
  }

  async saveFieldMapping(mapping: CRMFieldMapping): Promise<void> {
    const connectionId: string = mapping.connectionId;
    const mappings: CRMFieldMapping[] =
      this.fieldMappings.get(connectionId) || [];
    const index: number = mappings.findIndex(
      (m: CRMFieldMapping) => m.id === mapping.id,
    );

    if (index >= 0) {
      mappings[index] = mapping;
    } else {
      mappings.push(mapping);
    }

    this.fieldMappings.set(connectionId, mappings);
  }

  async logWebhookEvent(event: unknown): Promise<void> {
    console.log("[CRM Webhook]", JSON.stringify(event, null, 2));
  }
}

const crmService: CRMService = new MockCRMService();

// ─── ROUTE HANDLERS ─────────────────────────────────────────────

/**
 * POST /crm/connect/:provider
 * Initiate OAuth flow
 */
async function handleConnect(
  request: FastifyRequest<{ Params: { provider: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const tenantId: string = request.tenantId || "";
  const provider: CRMProvider = request.params.provider as CRMProvider;
  const body = connectSchema.parse(request.body);

  if (!["salesforce", "hubspot"].includes(provider)) {
    throw new ValidationError("Invalid CRM provider");
  }

  // Get OAuth credentials from env/config
  const clientId: string =
    process.env[`CRM_${provider.toUpperCase()}_CLIENT_ID`] || "";
  const clientSecret: string =
    process.env[`CRM_${provider.toUpperCase()}_CLIENT_SECRET`] || "";
  const redirectUri: string =
    body.redirectUri || `${process.env.API_BASE_URL}/crm/callback/${provider}`;

  if (!clientId || !clientSecret) {
    throw new ValidationError(`${provider} OAuth credentials not configured`);
  }

  // Create temporary connection object for OAuth flow
  const tempConnection: CRMConnection = {
    id: `temp_${Date.now()}`,
    tenantId,
    provider,
    accessToken: "",
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let authUrl: string = "";

  try {
    if (provider === "salesforce") {
      const adapter: SalesforceAdapter = new SalesforceAdapter(tempConnection, {
        clientId,
        clientSecret,
        redirectUri,
        environment: process.env.SALESFORCE_ENV as
          | "sandbox"
          | "production"
          | undefined,
      });
      authUrl = adapter.getAuthorizationUrl();
    } else if (provider === "hubspot") {
      const adapter: HubSpotAdapter = new HubSpotAdapter(tempConnection, {
        clientId,
        clientSecret,
        redirectUri,
      });
      authUrl = adapter.getAuthorizationUrl();
    }
  } catch (error: unknown) {
    throw new ValidationError(
      `Failed to initiate OAuth: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  await reply.code(200).send({
    success: true,
    authUrl,
    redirectUri,
  });
}

/**
 * GET /crm/callback/:provider
 * OAuth callback handler
 */
async function handleCallback(
  request: FastifyRequest<{
    Params: { provider: string };
    Querystring: { code?: string; state?: string };
  }>,
  reply: FastifyReply,
): Promise<void> {
  const tenantId: string = request.tenantId || "";
  const provider: CRMProvider = request.params.provider as CRMProvider;
  const { code, state } = callbackSchema.parse(request.query);

  if (!code) {
    throw new ValidationError("Authorization code is required");
  }

  const clientId: string =
    process.env[`CRM_${provider.toUpperCase()}_CLIENT_ID`] || "";
  const clientSecret: string =
    process.env[`CRM_${provider.toUpperCase()}_CLIENT_SECRET`] || "";
  const redirectUri: string = `${process.env.API_BASE_URL}/crm/callback/${provider}`;

  const tempConnection: CRMConnection = {
    id: `temp_${Date.now()}`,
    tenantId,
    provider,
    accessToken: "",
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    let connection: CRMConnection | null = null;

    if (provider === "salesforce") {
      const adapter: SalesforceAdapter = new SalesforceAdapter(tempConnection, {
        clientId,
        clientSecret,
        redirectUri,
        environment: process.env.SALESFORCE_ENV as
          | "sandbox"
          | "production"
          | undefined,
      });
      connection = await adapter.authenticate(code);
    } else if (provider === "hubspot") {
      const adapter: HubSpotAdapter = new HubSpotAdapter(tempConnection, {
        clientId,
        clientSecret,
        redirectUri,
      });
      connection = await adapter.authenticate(code);
    }

    if (!connection) {
      throw new Error("Failed to authenticate");
    }

    connection.tenantId = tenantId;
    connection.isActive = true;

    // Save connection to database
    await crmService.saveConnection({
      ...connection,
      clientId,
      clientSecret,
    } as StoredCRMConnection);

    // Redirect to success page with connection details
    const frontendRedirect: string = `${process.env.FRONTEND_URL}/crm/connected?provider=${provider}&connectionId=${connection.id}`;

    await reply.redirect(frontendRedirect);
  } catch (error: unknown) {
    const frontendRedirect: string = `${process.env.FRONTEND_URL}/crm/error?provider=${provider}&error=${encodeURIComponent(error instanceof Error ? error.message : "Unknown error")}`;
    await reply.redirect(frontendRedirect);
  }
}

/**
 * GET /crm/contacts
 * Search CRM contacts
 */
async function handleGetContacts(
  request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
  reply: FastifyReply,
): Promise<void> {
  const tenantId: string = request.tenantId || "";
  const body = contactFilterSchema.parse(request.query);

  // Get active CRM connection (for now, assume Salesforce)
  const connection: StoredCRMConnection | null = await crmService.getConnection(
    tenantId,
    "salesforce",
  );

  if (!connection) {
    throw new NotFoundError(
      "No Salesforce connection found. Please connect Salesforce first.",
    );
  }

  try {
    const adapter: SalesforceAdapter = new SalesforceAdapter(connection, {
      clientId: connection.clientId,
      clientSecret: connection.clientSecret,
      redirectUri: "",
    });

    const result: CRMPagedResult<CRMContact> = await adapter.getContacts(
      {
        email: body.email,
        phone: body.phone,
        name: body.name,
      },
      {
        limit: body.limit,
        offset: body.offset,
      },
    );

    await reply.code(200).send({
      success: true,
      data: result.data,
      total: result.total,
      hasMore: result.hasMore,
      cursor: result.cursor,
    });
  } catch (error: unknown) {
    throw new ValidationError(
      `Failed to fetch contacts: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * POST /crm/sync
 * Trigger sync
 */
async function handleSync(
  request: FastifyRequest<{ Body: Record<string, unknown> }>,
  reply: FastifyReply,
): Promise<void> {
  const tenantId: string = request.tenantId || "";
  const body = syncSchema.parse(request.body);

  const connection: StoredCRMConnection | null = await crmService.getConnection(
    tenantId,
    "salesforce",
  );

  if (!connection) {
    throw new NotFoundError("No CRM connection found");
  }

  try {
    const fieldMappings: CRMFieldMapping[] = await crmService.getFieldMappings(
      connection.id,
    );
    const adapter: SalesforceAdapter = new SalesforceAdapter(
      connection,
      {
        clientId: connection.clientId,
        clientSecret: connection.clientSecret,
        redirectUri: "",
      },
      fieldMappings,
    );

    const syncEngine: CRMSyncEngine = new CRMSyncEngine(
      connection,
      adapter,
      fieldMappings,
    );

    const recordType: "contact" | "account" | "opportunity" =
      (body.recordType as "contact" | "account" | "opportunity") || "contact";
    const results = body.incremental
      ? await syncEngine.performIncrementalSync(recordType)
      : await syncEngine.performBidirectionalSync([], recordType);

    const stats = syncEngine.getSyncStats();

    await reply.code(200).send({
      success: true,
      synced: results.length,
      results,
      stats,
    });
  } catch (error: unknown) {
    throw new ValidationError(
      `Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * GET /crm/sync/status
 * Get sync status
 */
async function handleSyncStatus(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const tenantId: string = request.tenantId || "";

  const connection: StoredCRMConnection | null = await crmService.getConnection(
    tenantId,
    "salesforce",
  );

  if (!connection) {
    throw new NotFoundError("No CRM connection found");
  }

  try {
    const fieldMappings: CRMFieldMapping[] = await crmService.getFieldMappings(
      connection.id,
    );
    const adapter: SalesforceAdapter = new SalesforceAdapter(
      connection,
      {
        clientId: connection.clientId,
        clientSecret: connection.clientSecret,
        redirectUri: "",
      },
      fieldMappings,
    );

    const syncEngine: CRMSyncEngine = new CRMSyncEngine(
      connection,
      adapter,
      fieldMappings,
    );
    const stats = syncEngine.getSyncStats();
    const rateLimitInfo = adapter.getRateLimitInfo();

    await reply.code(200).send({
      success: true,
      lastSyncAt: connection.lastSyncAt,
      stats,
      rateLimit: rateLimitInfo,
    });
  } catch (error: unknown) {
    throw new ValidationError(
      `Failed to get sync status: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * POST /crm/webhooks/:provider
 * Webhook receiver
 */
async function handleWebhook(
  request: FastifyRequest<{
    Params: { provider: string };
    Body: Record<string, unknown>;
  }>,
  reply: FastifyReply,
): Promise<void> {
  const tenantId: string = request.tenantId || "";
  const provider: CRMProvider = request.params.provider as CRMProvider;
  const body = webhookSchema.parse(request.body);

  try {
    // Log webhook event
    await crmService.logWebhookEvent({
      tenantId,
      provider,
      timestamp: new Date().toISOString(),
      ...body,
    });

    await reply.code(200).send({
      success: true,
      received: true,
    });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    await reply.code(500).send({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * GET /crm/field-mappings
 * Get field mappings
 */
async function handleGetFieldMappings(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const tenantId: string = request.tenantId || "";

  const connection: StoredCRMConnection | null = await crmService.getConnection(
    tenantId,
    "salesforce",
  );

  if (!connection) {
    throw new NotFoundError("No CRM connection found");
  }

  try {
    const mappings: CRMFieldMapping[] = await crmService.getFieldMappings(
      connection.id,
    );

    await reply.code(200).send({
      success: true,
      mappings,
      total: mappings.length,
    });
  } catch (error: unknown) {
    throw new ValidationError(
      `Failed to get field mappings: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * PUT /crm/field-mappings
 * Create/update field mapping
 */
async function handleUpsertFieldMapping(
  request: FastifyRequest<{ Body: Record<string, unknown> }>,
  reply: FastifyReply,
): Promise<void> {
  const tenantId: string = request.tenantId || "";
  const body = fieldMappingCreateSchema.parse(request.body);

  const connection: StoredCRMConnection | null = await crmService.getConnection(
    tenantId,
    "salesforce",
  );

  if (!connection) {
    throw new NotFoundError("No CRM connection found");
  }

  try {
    const mapping: CRMFieldMapping = {
      id: `mapping_${Date.now()}`,
      connectionId: connection.id,
      witylogixField: body.witylogixField,
      crmField: body.crmField,
      recordType: body.recordType as
        | "contact"
        | "account"
        | "opportunity"
        | "deal"
        | "activity",
      direction: body.direction,
      transformation: body.transformation,
      transformationScript: body.transformationScript,
      isRequired: body.isRequired || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await crmService.saveFieldMapping(mapping);

    await reply.code(201).send({
      success: true,
      mapping,
    });
  } catch (error: unknown) {
    throw new ValidationError(
      `Failed to save field mapping: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// ─── ROUTE REGISTRATION ─────────────────────────────────────────

export async function registerCRMRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.post<{ Params: { provider: string } }>(
    "/crm/connect/:provider",
    { preHandler: [requireAuth, tenantContext] },
    handleConnect,
  );

  fastify.get<{ Params: { provider: string } }>(
    "/crm/callback/:provider",
    handleCallback,
  );

  fastify.get(
    "/crm/contacts",
    { preHandler: [requireAuth, tenantContext] },
    handleGetContacts,
  );

  fastify.post(
    "/crm/sync",
    { preHandler: [requireAuth, tenantContext] },
    handleSync,
  );

  fastify.get(
    "/crm/sync/status",
    { preHandler: [requireAuth, tenantContext] },
    handleSyncStatus,
  );

  fastify.post<{ Params: { provider: string } }>(
    "/crm/webhooks/:provider",
    handleWebhook,
  );

  fastify.get(
    "/crm/field-mappings",
    { preHandler: [requireAuth, tenantContext] },
    handleGetFieldMappings,
  );

  fastify.put(
    "/crm/field-mappings",
    { preHandler: [requireAuth, tenantContext] },
    handleUpsertFieldMapping,
  );
}
