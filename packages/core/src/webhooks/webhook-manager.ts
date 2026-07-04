// @ts-nocheck
/**
 * Webhook Manager
 * Full lifecycle manager for webhook subscriptions and deliveries
 */

import { v4 as uuidv4 } from "uuid";
import { db } from "@witylogix/db";
import { generateSecret } from "./signer";
import type {
  WebhookEndpoint,
  WebhookEndpointConfig,
  WebhookDelivery,
  WebhookEvent,
  CircuitBreakerState,
  DeliveryStatus,
} from "./types";

/**
 * Default retry policy
 */
const DEFAULT_RETRY_POLICY = {
  maxAttempts: 3,
  initialDelayMs: 10000, // 10 seconds
  maxDelayMs: 300000, // 5 minutes
  backoffMultiplier: 6,
};

/**
 * Circuit breaker configuration
 */
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 10,
  resetTimeoutMs: 60 * 60 * 1000, // 1 hour
};

/**
 * Webhook Manager
 * Manages webhook endpoint registration, updates, and event delivery
 */
export class WebhookManager {
  private prisma: any;

  /**
   * Initialize webhook manager with Prisma instance
   */
  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Register a new webhook endpoint for a tenant
   * @param tenantId - Tenant/shop ID
   * @param config - Webhook endpoint configuration
   * @returns Created webhook endpoint
   */
  async registerEndpoint(
    tenantId: string,
    config: WebhookEndpointConfig,
  ): Promise<WebhookEndpoint> {
    if (!config.url) {
      throw new Error("Webhook URL is required");
    }

    if (!config.events || config.events.length === 0) {
      throw new Error("At least one event type must be specified");
    }

    // Validate URL format
    try {
      new URL(config.url);
    } catch {
      throw new Error("Invalid webhook URL format");
    }

    const secret = generateSecret();
    const id = uuidv4();

    const endpoint = await db.webhookEndpoint.create({
      data: {
        id,
        tenantId,
        url: config.url,
        events: config.events,
        secret,
        active: config.active !== false,
        circuitBreakerOpen: false,
        failureCount: 0,
        successCount: 0,
        metadata: config.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return endpoint;
  }

  /**
   * Update an existing webhook endpoint
   * @param id - Endpoint ID
   * @param config - Updated configuration
   * @returns Updated webhook endpoint
   */
  async updateEndpoint(
    id: string,
    config: Partial<WebhookEndpointConfig>,
  ): Promise<WebhookEndpoint> {
    const existing = await db.webhookEndpoint.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Webhook endpoint not found: ${id}`);
    }

    // Validate URL if provided
    if (config.url) {
      try {
        new URL(config.url);
      } catch {
        throw new Error("Invalid webhook URL format");
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (config.url) updateData.url = config.url;
    if (config.events) updateData.events = config.events;
    if (config.active !== undefined) updateData.active = config.active;
    if (config.metadata) updateData.metadata = config.metadata;

    const updated = await db.webhookEndpoint.update({
      where: { id },
      data: updateData,
    });

    return updated;
  }

  /**
   * Soft delete a webhook endpoint
   * @param id - Endpoint ID
   * @returns Deleted endpoint
   */
  async deleteEndpoint(id: string): Promise<WebhookEndpoint> {
    const endpoint = await db.webhookEndpoint.findUnique({
      where: { id },
    });

    if (!endpoint) {
      throw new Error(`Webhook endpoint not found: ${id}`);
    }

    return await db.webhookEndpoint.update({
      where: { id },
      data: { active: false, updatedAt: new Date() },
    });
  }

  /**
   * List webhook endpoints for a tenant with optional filtering
   * @param tenantId - Tenant ID
   * @param filters - Optional filters (active, events)
   * @param pagination - Pagination options
   * @returns Paginated list of endpoints
   */
  async listEndpoints(
    tenantId: string,
    filters?: {
      active?: boolean;
      events?: string[];
    },
    pagination?: { page?: number; limit?: number },
  ): Promise<{
    data: WebhookEndpoint[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;

    const where: any = { tenantId };

    if (filters?.active !== undefined) {
      where.active = filters.active;
    }

    // If event filter provided, we need to check if any of the endpoint's events match
    // This is a simple contains check for now
    if (filters?.events && filters.events.length > 0) {
      where.events = {
        hasSome: filters.events,
      };
    }

    const [data, total] = await Promise.all([
      db.webhookEndpoint.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.webhookEndpoint.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Get a specific webhook endpoint
   * @param id - Endpoint ID
   * @returns Webhook endpoint or null
   */
  async getEndpoint(id: string): Promise<WebhookEndpoint | null> {
    return await db.webhookEndpoint.findUnique({
      where: { id },
    });
  }

  /**
   * Deliver a webhook event to matching endpoints
   * @param event - Webhook event to deliver
   * @returns Delivery IDs that were queued
   */
  async deliverEvent(event: WebhookEvent): Promise<string[]> {
    // Get all active endpoints for this tenant
    const endpoints = await db.webhookEndpoint.findMany({
      where: {
        tenantId: event.tenantId,
        active: true,
        circuitBreakerOpen: false,
      },
    });

    const deliveryIds: string[] = [];

    for (const endpoint of endpoints) {
      // Check if endpoint subscribes to this event type
      if (!this.matchesEventPattern(event.type, endpoint.events)) {
        continue;
      }

      // Create delivery record
      const deliveryId = uuidv4();

      await db.webhookDelivery.create({
        data: {
          id: deliveryId,
          endpointId: endpoint.id,
          tenantId: event.tenantId,
          eventType: event.type,
          eventId: event.id,
          status: "pending",
          attempt: 1,
          maxAttempts: DEFAULT_RETRY_POLICY.maxAttempts,
          requestBody: JSON.stringify(event.data),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      deliveryIds.push(deliveryId);
    }

    return deliveryIds;
  }

  /**
   * Check if an event type matches any endpoint subscription patterns
   * @param eventType - Event type (e.g., "order.created")
   * @param patterns - Subscription patterns (e.g., ["order.*", "order.created"])
   * @returns True if event matches any pattern
   */
  private matchesEventPattern(eventType: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      if (pattern === "*") return true;
      if (pattern === eventType) return true;

      // Support wildcard patterns like "order.*"
      const regexPattern = pattern.replace(/\*/g, ".*");
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(eventType);
    });
  }

  /**
   * Retry a failed delivery
   * @param deliveryId - Delivery ID
   * @returns Updated delivery record
   */
  async retryDelivery(deliveryId: string): Promise<WebhookDelivery | null> {
    const delivery = await db.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new Error(`Delivery not found: ${deliveryId}`);
    }

    if (delivery.status === "delivered") {
      throw new Error("Cannot retry an already delivered webhook");
    }

    if (delivery.attempt >= delivery.maxAttempts) {
      throw new Error("Maximum retry attempts exceeded");
    }

    // Reset to pending and increment attempt
    const updated = await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "pending",
        attempt: delivery.attempt + 1,
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  /**
   * Get delivery history for an endpoint
   * @param endpointId - Endpoint ID
   * @param pagination - Pagination options
   * @returns Paginated delivery records
   */
  async getDeliveryHistory(
    endpointId: string,
    pagination?: { page?: number; limit?: number },
  ): Promise<{
    data: WebhookDelivery[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 50;

    const [data, total] = await Promise.all([
      db.webhookDelivery.findMany({
        where: { endpointId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.webhookDelivery.count({ where: { endpointId } }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Rotate webhook signing secret
   * @param id - Endpoint ID
   * @returns Updated endpoint with new secret
   */
  async rotateSecret(id: string): Promise<WebhookEndpoint> {
    const endpoint = await db.webhookEndpoint.findUnique({
      where: { id },
    });

    if (!endpoint) {
      throw new Error(`Webhook endpoint not found: ${id}`);
    }

    const newSecret = generateSecret();

    return await db.webhookEndpoint.update({
      where: { id },
      data: {
        secret: newSecret,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Enable a webhook endpoint
   * @param id - Endpoint ID
   * @returns Updated endpoint
   */
  async enableEndpoint(id: string): Promise<WebhookEndpoint> {
    return await db.webhookEndpoint.update({
      where: { id },
      data: {
        active: true,
        circuitBreakerOpen: false,
        failureCount: 0,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Disable a webhook endpoint
   * @param id - Endpoint ID
   * @returns Updated endpoint
   */
  async disableEndpoint(id: string): Promise<WebhookEndpoint> {
    return await db.webhookEndpoint.update({
      where: { id },
      data: {
        active: false,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Open circuit breaker for an endpoint (due to repeated failures)
   * @param id - Endpoint ID
   * @returns Updated endpoint
   */
  async openCircuitBreaker(id: string): Promise<WebhookEndpoint> {
    return await db.webhookEndpoint.update({
      where: { id },
      data: {
        circuitBreakerOpen: true,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Reset circuit breaker for an endpoint
   * @param id - Endpoint ID
   * @returns Updated endpoint
   */
  async resetCircuitBreaker(id: string): Promise<WebhookEndpoint> {
    return await db.webhookEndpoint.update({
      where: { id },
      data: {
        circuitBreakerOpen: false,
        failureCount: 0,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Record a successful delivery
   * @param deliveryId - Delivery ID
   * @param statusCode - HTTP status code
   * @param durationMs - Delivery duration in milliseconds
   * @param responseBody - Response body (truncated)
   * @returns Updated delivery
   */
  async recordSuccess(
    deliveryId: string,
    statusCode: number,
    durationMs: number,
    responseBody?: string,
  ): Promise<WebhookDelivery> {
    const delivery = await db.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new Error(`Delivery not found: ${deliveryId}`);
    }

    // Update delivery record
    const updated = await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "delivered",
        responseStatus: statusCode,
        responseBody: responseBody ? responseBody.slice(0, 10240) : undefined,
        durationMs,
        updatedAt: new Date(),
      },
    });

    // Update endpoint metrics
    const endpoint = await db.webhookEndpoint.findUnique({
      where: { id: delivery.endpointId },
    });

    if (endpoint) {
      await db.webhookEndpoint.update({
        where: { id: delivery.endpointId },
        data: {
          lastDeliveryAt: new Date(),
          successCount: endpoint.successCount + 1,
          failureCount: 0, // Reset on success
          updatedAt: new Date(),
        },
      });
    }

    return updated;
  }

  /**
   * Record a failed delivery
   * @param deliveryId - Delivery ID
   * @param statusCode - HTTP status code (if applicable)
   * @param error - Error message
   * @param durationMs - Duration in milliseconds
   * @param responseBody - Response body (if available)
   * @returns Updated delivery
   */
  async recordFailure(
    deliveryId: string,
    statusCode?: number,
    error?: string,
    durationMs?: number,
    responseBody?: string,
  ): Promise<WebhookDelivery> {
    const delivery = await db.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new Error(`Delivery not found: ${deliveryId}`);
    }

    // Calculate next retry delay (exponential backoff)
    let nextRetryAt: Date | undefined;
    if (delivery.attempt < delivery.maxAttempts) {
      const delayMs = this.calculateRetryDelay(delivery.attempt);
      nextRetryAt = new Date(Date.now() + delayMs);
    }

    const newStatus: DeliveryStatus =
      delivery.attempt >= delivery.maxAttempts ? "failed" : "pending";

    // Update delivery record
    const updated = await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: newStatus,
        responseStatus: statusCode,
        responseBody: responseBody ? responseBody.slice(0, 10240) : undefined,
        error,
        durationMs,
        nextRetryAt,
        updatedAt: new Date(),
      },
    });

    // Update endpoint metrics
    const endpoint = await db.webhookEndpoint.findUnique({
      where: { id: delivery.endpointId },
    });

    if (endpoint) {
      const newFailureCount = endpoint.failureCount + 1;

      // Check if circuit breaker threshold exceeded
      const shouldOpenCircuit =
        newFailureCount >= CIRCUIT_BREAKER_CONFIG.failureThreshold;

      await db.webhookEndpoint.update({
        where: { id: delivery.endpointId },
        data: {
          lastFailureAt: new Date(),
          failureCount: newFailureCount,
          circuitBreakerOpen: shouldOpenCircuit,
          updatedAt: new Date(),
        },
      });
    }

    return updated;
  }

  /**
   * Calculate exponential backoff delay for retries
   * @param attempt - Current attempt number
   * @returns Delay in milliseconds
   */
  private calculateRetryDelay(attempt: number): number {
    const { initialDelayMs, maxDelayMs, backoffMultiplier } =
      DEFAULT_RETRY_POLICY;
    const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
    return Math.min(delay, maxDelayMs);
  }

  /**
   * Send a test webhook to an endpoint
   * @param endpointId - Endpoint ID
   * @returns Test result
   */
  async sendTestWebhook(
    endpointId: string,
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const endpoint = await db.webhookEndpoint.findUnique({
      where: { endpointId },
    });

    if (!endpoint) {
      throw new Error(`Endpoint not found: ${endpointId}`);
    }

    const testEvent: WebhookEvent = {
      id: uuidv4(),
      type: "test.ping",
      tenantId: endpoint.tenantId,
      data: {
        message: "This is a test webhook from Witylogix",
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date(),
      source: "webhook-manager",
    };

    // Queue the test delivery
    await this.deliverEvent(testEvent);

    return { success: true };
  }

  /**
   * Get webhook statistics for a tenant
   * @param tenantId - Tenant ID
   * @returns Webhook statistics
   */
  async getStats(tenantId: string): Promise<{
    totalEndpoints: number;
    activeEndpoints: number;
    totalDeliveries: number;
    pendingDeliveries: number;
    failedDeliveries: number;
    circuitBreakerOpen: number;
  }> {
    const [
      totalEndpoints,
      activeEndpoints,
      totalDeliveries,
      pendingDeliveries,
      failedDeliveries,
      circuitBreakerOpen,
    ] = await Promise.all([
      db.webhookEndpoint.count({
        where: { tenantId },
      }),
      db.webhookEndpoint.count({
        where: { tenantId, active: true },
      }),
      db.webhookDelivery.count({
        where: { tenantId },
      }),
      db.webhookDelivery.count({
        where: { tenantId, status: "pending" },
      }),
      db.webhookDelivery.count({
        where: { tenantId, status: "failed" },
      }),
      db.webhookEndpoint.count({
        where: { tenantId, circuitBreakerOpen: true },
      }),
    ]);

    return {
      totalEndpoints,
      activeEndpoints,
      totalDeliveries,
      pendingDeliveries,
      failedDeliveries,
      circuitBreakerOpen,
    };
  }
}

/**
 * Singleton instance (can be initialized once per application)
 */
let webhookManagerInstance: WebhookManager | null = null;

/**
 * Get or initialize the webhook manager
 */
export function getWebhookManager(prisma: any): WebhookManager {
  if (!webhookManagerInstance) {
    webhookManagerInstance = new WebhookManager(prisma);
  }
  return webhookManagerInstance;
}
