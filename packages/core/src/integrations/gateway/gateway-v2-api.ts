/**
 * Gateway V2 API — REST endpoints for gateway operations
 *
 * Endpoints:
 * - GET /gateway/health — Gateway health status
 * - GET /gateway/providers/:id/status — Provider status
 * - GET /gateway/metrics — Aggregated metrics
 * - POST /gateway/circuit-breakers/:id/reset — Manual reset
 * - GET /gateway/cache/stats — Cache statistics
 * - DELETE /gateway/cache — Clear cache
 * - POST /webhooks — Register webhook endpoint
 * - GET /webhooks — List endpoints
 * - PUT /webhooks/:id — Update endpoint
 * - DELETE /webhooks/:id — Delete endpoint
 * - GET /webhooks/:id/deliveries — Delivery history
 * - POST /webhooks/:id/test — Send test webhook
 * - GET /webhooks/dlq — List DLQ entries
 * - POST /webhooks/dlq/:id/retry — Retry DLQ delivery
 * - DELETE /webhooks/dlq/:id — Delete DLQ entry
 */

import { z } from "zod";
import type { GatewayOrchestrator } from "./integration-gateway-v2";
import type { MetricsCollectorV2 } from "./gateway-metrics";
import type {
  WebhookRegistry,
  DeadLetterQueue,
  FanOutManager,
} from "../webhooks/webhook-engine";
import type { WebhookEndpoint, WebhookEvent } from "../webhooks/webhook-types";

// ─── Validation Schemas ──────────────────────────────────────────

const WebhookEndpointSchema = z.object({
  url: z.string().url(),
  method: z.enum(["POST", "PUT", "PATCH"]).optional().default("POST"),
  headers: z.record(z.string()).optional(),
  eventTypes: z.array(z.string()).min(1),
  rateLimit: z.number().optional(),
  maxConcurrency: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const CircuitBreakerResetSchema = z.object({
  providerId: z.string(),
});

const TestWebhookSchema = z.object({
  eventType: z.string(),
  payload: z.record(z.unknown()),
});

const DLQRetrySchema = z.object({
  deliveryId: z.string().optional(),
});

// ─── Gateway V2 API Handler ─────────────────────────────────────

export class GatewayV2API {
  constructor(
    private gateway: GatewayOrchestrator,
    private metrics: MetricsCollectorV2,
    private webhookRegistry: WebhookRegistry,
    private dlq: DeadLetterQueue,
    private fanOutManager: FanOutManager,
  ) {}

  // ─── Health & Status Endpoints ──────────────────────────────────

  /**
   * GET /gateway/health
   * Gateway health status
   */
  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: Date;
    cacheSize: number;
    dlqDepth: number;
    activeBulkheads: number;
  }> {
    const cacheStats = this.gateway.getCacheStats();
    const dlqDepth = this.dlq.getDepth();

    return {
      status: dlqDepth > 100 ? "degraded" : "healthy",
      timestamp: new Date(),
      cacheSize: cacheStats.size,
      dlqDepth,
      activeBulkheads: 0, // Would need bulkhead registry
    };
  }

  /**
   * GET /gateway/providers/:id/status
   * Provider-specific status
   */
  async getProviderStatus(providerId: string): Promise<{
    providerId: string;
    circuitBreaker: any;
    bulkhead: any;
    metrics: any;
    healthy: boolean;
  }> {
    const cbStatus = this.gateway.getCircuitBreakerStatus(providerId);
    const bulkheadStatus = this.gateway.getBulkheadStatus(providerId);
    const metrics = this.metrics.getProviderMetrics(providerId);

    const healthy =
      cbStatus?.state === "closed" &&
      (metrics?.errorCount ?? 0) / (metrics?.requestCount ?? 1) < 0.05;

    return {
      providerId,
      circuitBreaker: cbStatus,
      bulkhead: bulkheadStatus,
      metrics,
      healthy,
    };
  }

  /**
   * GET /gateway/metrics
   * Aggregated metrics for time window
   */
  async getMetrics(
    timeWindow:
      | "one_minute"
      | "five_minute"
      | "one_hour"
      | "one_day" = "one_hour",
  ): Promise<any> {
    return this.metrics.getAggregatedMetrics(timeWindow);
  }

  // ─── Circuit Breaker Endpoints ──────────────────────────────────

  /**
   * POST /gateway/circuit-breakers/:id/reset
   * Manually reset circuit breaker
   */
  async resetCircuitBreaker(
    providerId: string,
  ): Promise<{ success: boolean; message: string }> {
    const cbStatus = this.gateway.getCircuitBreakerStatus(providerId);
    if (!cbStatus) {
      return {
        success: false,
        message: `No circuit breaker found for provider ${providerId}`,
      };
    }

    this.gateway.resetCircuitBreaker(providerId);

    return {
      success: true,
      message: `Circuit breaker for ${providerId} reset to closed`,
    };
  }

  // ─── Cache Endpoints ────────────────────────────────────────────

  /**
   * GET /gateway/cache/stats
   * Cache statistics
   */
  async getCacheStats(): Promise<{
    size: number;
    hits: number;
    total: number;
    hitRate: number;
  }> {
    const stats = this.gateway.getCacheStats();
    return {
      ...stats,
      hitRate: stats.total > 0 ? (stats.hits / stats.total) * 100 : 0,
    };
  }

  /**
   * DELETE /gateway/cache
   * Clear all cache
   */
  async clearCache(): Promise<{ success: boolean; message: string }> {
    this.gateway.clearCache();
    return { success: true, message: "Cache cleared" };
  }

  // ─── Webhook Endpoints ──────────────────────────────────────────

  /**
   * POST /webhooks
   * Register webhook endpoint
   */
  async registerWebhook(
    providerId: string,
    organizationId: string,
    data: unknown,
  ): Promise<WebhookEndpoint> {
    const validated = WebhookEndpointSchema.parse(data);

    const endpoint: WebhookEndpoint = {
      id: `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      organizationId,
      providerId,
      url: validated.url,
      method: validated.method,
      headers: validated.headers,
      signingSecret: `sk_live_${Math.random().toString(36).substr(2, 32)}`,
      eventTypes: validated.eventTypes,
      active: true,
      paused: false,
      rateLimit: validated.rateLimit,
      maxConcurrency: validated.maxConcurrency,
      metadata: validated.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.webhookRegistry.registerEndpoint(endpoint);
    return endpoint;
  }

  /**
   * GET /webhooks
   * List all webhook endpoints
   */
  async listWebhooks(
    providerId?: string,
    organizationId?: string,
  ): Promise<WebhookEndpoint[]> {
    if (providerId) {
      return this.webhookRegistry.getEndpointsByProvider(providerId);
    }

    // Would need full registry scan
    return [];
  }

  /**
   * PUT /webhooks/:id
   * Update webhook endpoint
   */
  async updateWebhook(
    endpointId: string,
    data: unknown,
  ): Promise<WebhookEndpoint | null> {
    const updates = WebhookEndpointSchema.partial().parse(data);

    return this.webhookRegistry.updateEndpoint(endpointId, updates);
  }

  /**
   * DELETE /webhooks/:id
   * Delete webhook endpoint
   */
  async deleteWebhook(
    endpointId: string,
  ): Promise<{ success: boolean; message: string }> {
    const success = this.webhookRegistry.deleteEndpoint(endpointId);

    return {
      success,
      message: success
        ? `Webhook ${endpointId} deleted`
        : `Webhook ${endpointId} not found`,
    };
  }

  /**
   * GET /webhooks/:id/deliveries
   * Get delivery history for endpoint
   */
  async getDeliveryHistory(
    endpointId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ total: number; deliveries: any[]; hasMore: boolean }> {
    // Would need delivery storage
    return {
      total: 0,
      deliveries: [],
      hasMore: false,
    };
  }

  /**
   * POST /webhooks/:id/test
   * Send test webhook
   */
  async testWebhook(
    endpointId: string,
    data: unknown,
  ): Promise<{
    success: boolean;
    statusCode?: number;
    latencyMs?: number;
    error?: string;
  }> {
    const validated = TestWebhookSchema.parse(data);
    const endpoint = this.webhookRegistry.getEndpoint(endpointId);

    if (!endpoint) {
      return { success: false, error: `Endpoint ${endpointId} not found` };
    }

    const event: WebhookEvent = {
      id: `evt_test_${Date.now()}`,
      type: validated.eventType,
      providerId: endpoint.providerId,
      payload: validated.payload,
      timestamp: new Date(),
    };

    try {
      const startTime = Date.now();

      // Would execute actual delivery
      const deliveries = await this.fanOutManager.fanOut(event, [endpoint], {
        maxConcurrency: 1,
        failFast: true,
        waitForAll: true,
        timeoutMs: 30000,
      });

      const latencyMs = Date.now() - startTime;
      const delivery = deliveries[0];

      return {
        success: delivery.status === "success",
        statusCode: delivery.attempts[0]?.statusCode,
        latencyMs,
        error:
          delivery.attempts[0]?.error ||
          (delivery.status === "success" ? undefined : "Delivery failed"),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ─── Dead Letter Queue Endpoints ────────────────────────────────

  /**
   * GET /webhooks/dlq
   * List DLQ entries
   */
  async listDLQEntries(
    limit: number = 50,
    offset: number = 0,
  ): Promise<{
    total: number;
    entries: any[];
    hasMore: boolean;
  }> {
    const entries = this.dlq.listEntries();
    const paginated = entries.slice(offset, offset + limit);

    return {
      total: entries.length,
      entries: paginated,
      hasMore: offset + limit < entries.length,
    };
  }

  /**
   * POST /webhooks/dlq/:id/retry
   * Manually retry DLQ delivery
   */
  async retryDLQEntry(
    entryId: string,
    data?: unknown,
  ): Promise<{
    success: boolean;
    deliveryId?: string;
    message: string;
  }> {
    const entry = this.dlq.getEntry(entryId);

    if (!entry) {
      return { success: false, message: `DLQ entry ${entryId} not found` };
    }

    const endpoint = this.webhookRegistry.getEndpoint(entry.endpointId);

    if (!endpoint) {
      return {
        success: false,
        message: `Endpoint ${entry.endpointId} not found`,
      };
    }

    const event: WebhookEvent = {
      id: entry.eventId,
      type: "manual_retry",
      providerId: endpoint.providerId,
      payload: entry.eventPayload,
      timestamp: new Date(),
    };

    try {
      const deliveries = await this.fanOutManager.fanOut(event, [endpoint], {
        maxConcurrency: 1,
        failFast: true,
        waitForAll: true,
        timeoutMs: 30000,
      });

      const success = deliveries[0].status === "success";

      if (success) {
        this.dlq.markRetried(entryId);
        this.dlq.deleteEntry(entryId);
      }

      return {
        success,
        deliveryId: deliveries[0].id,
        message: success ? "Delivery succeeded" : "Delivery failed",
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * DELETE /webhooks/dlq/:id
   * Delete DLQ entry
   */
  async deleteDLQEntry(
    entryId: string,
  ): Promise<{ success: boolean; message: string }> {
    const success = this.dlq.deleteEntry(entryId);

    return {
      success,
      message: success
        ? `DLQ entry ${entryId} deleted`
        : `DLQ entry ${entryId} not found`,
    };
  }

  // ─── Validation Helpers ────────────────────────────────────────

  /**
   * Validate request body
   */
  validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
    return schema.parse(data);
  }
}

// ─── Route Handler Factory ──────────────────────────────────────

export function createGatewayV2Routes(api: GatewayV2API) {
  return {
    "GET /gateway/health": () => api.healthCheck(),
    "GET /gateway/providers/:providerId/status": (params: any) =>
      api.getProviderStatus(params.providerId),
    "GET /gateway/metrics": (query: any) => api.getMetrics(query.timeWindow),
    "POST /gateway/circuit-breakers/:providerId/reset": (params: any) =>
      api.resetCircuitBreaker(params.providerId),
    "GET /gateway/cache/stats": () => api.getCacheStats(),
    "DELETE /gateway/cache": () => api.clearCache(),
    "POST /webhooks": (body: any, query: any) =>
      api.registerWebhook(query.providerId, query.organizationId, body),
    "GET /webhooks": (query: any) =>
      api.listWebhooks(query.providerId, query.organizationId),
    "PUT /webhooks/:endpointId": (body: any, params: any) =>
      api.updateWebhook(params.endpointId, body),
    "DELETE /webhooks/:endpointId": (params: any) =>
      api.deleteWebhook(params.endpointId),
    "GET /webhooks/:endpointId/deliveries": (params: any, query: any) =>
      api.getDeliveryHistory(params.endpointId, query.limit, query.offset),
    "POST /webhooks/:endpointId/test": (body: any, params: any) =>
      api.testWebhook(params.endpointId, body),
    "GET /webhooks/dlq": (query: any) =>
      api.listDLQEntries(query.limit, query.offset),
    "POST /webhooks/dlq/:entryId/retry": (body: any, params: any) =>
      api.retryDLQEntry(params.entryId, body),
    "DELETE /webhooks/dlq/:entryId": (params: any) =>
      api.deleteDLQEntry(params.entryId),
  };
}
