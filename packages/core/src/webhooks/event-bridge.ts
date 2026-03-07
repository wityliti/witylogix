// @ts-nocheck
/**
 * Event Webhook Bridge
 * Connects TypedEventBus emissions to outbound webhook deliveries
 *
 * Responsibilities:
 * - Subscribe to all event types from the event bus
 * - Filter events based on webhook subscriptions
 * - Transform event data into webhook payload format
 * - Apply tenant-scoped webhook delivery
 * - Track metrics and handle errors gracefully
 */

import type {
  TypedEventBus,
} from "../event-bus/index.js";
import type {
  EventEnvelope,
  EventMetadata,
} from "../event-bus/types.js";
import {
  WebhookManager,
} from "./webhook-manager.js";
import {
  WebhookDeliveryService,
} from "./webhook-delivery.js";
import type {
  WebhookEndpoint,
  WebhookEvent,
} from "./types.js";
import type {
  EventWebhookBridgeConfig,
  BridgeMetrics,
  WebhookPayloadTransformation,
} from "./event-bridge.types.js";

/**
 * EventWebhookBridge
 * Bridges the gap between domain events and outbound webhooks
 */
export class EventWebhookBridge {
  private eventBus: TypedEventBus<any>;
  private webhookManager: WebhookManager;
  private deliveryService: WebhookDeliveryService;
  private prisma: any;
  private config: EventWebhookBridgeConfig;
  private subscriptionIds: Map<string, string> = new Map();
  private isRunning = false;
  private startTime: Date | null = null;
  private metrics: BridgeMetrics = {
    eventsProcessed: 0,
    webhooksTriggered: 0,
    deliveryErrors: 0,
    deliverySuccesses: 0,
    subscriptionsCount: 0,
    subscribedEventTypes: [],
    errorsByType: {},
    eventsByType: {},
    uptimeMs: 0,
  };

  /**
   * Initialize the event bridge
   * @param eventBus - TypedEventBus instance
   * @param webhookManager - WebhookManager instance
   * @param prisma - Prisma client instance
   * @param config - Bridge configuration
   */
  constructor(
    eventBus: TypedEventBus<any>,
    webhookManager: WebhookManager,
    prisma: any,
    config: EventWebhookBridgeConfig = {},
  ) {
    this.eventBus = eventBus;
    this.webhookManager = webhookManager;
    this.prisma = prisma;
    this.deliveryService = new WebhookDeliveryService(webhookManager, prisma);
    this.config = {
      consumerGroup: config.consumerGroup ?? "webhook-bridge",
      replay: config.replay ?? false,
      batchSize: config.batchSize ?? 10,
      verbose: config.verbose ?? false,
      tags: config.tags,
    };
  }

  /**
   * Start the event bridge
   * Subscribes to all event types and begins routing events to webhooks
   * @returns Promise that resolves when bridge is ready
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("[EventWebhookBridge] Bridge is already running");
      return;
    }

    try {
      this.isRunning = true;
      this.startTime = new Date();

      if (this.config.verbose) {
        console.log("[EventWebhookBridge] Starting bridge...");
      }

      // Subscribe to all domain events
      const eventTypes = [
        "order.created",
        "order.updated",
        "order.cancelled",
        "shipment.created",
        "shipment.status_changed",
        "shipment.delivered",
        "shipment.failed",
        "driver.assigned",
        "driver.location_updated",
        "route.optimized",
        "route.completed",
        "payment.completed",
        "payment.refunded",
        "delivery.completed",
        "delivery.failed",
        "customer.created",
        "customer.updated",
        "customer.deleted",
      ];

      // Subscribe to each event type
      for (const eventType of eventTypes) {
        try {
          const subscriptionId = await this.eventBus.subscribe(
            eventType,
            (envelope: EventEnvelope) => this.handleEvent(envelope),
            {
              consumerGroup: this.config.consumerGroup,
              replay: this.config.replay,
              tags: this.config.tags,
            },
          );

          this.subscriptionIds.set(eventType, subscriptionId);
          this.metrics.subscribedEventTypes.push(eventType);

          if (this.config.verbose) {
            console.log(`[EventWebhookBridge] Subscribed to ${eventType}`);
          }
        } catch (error) {
          console.error(
            `[EventWebhookBridge] Failed to subscribe to ${eventType}:`,
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      this.metrics.subscriptionsCount = this.subscriptionIds.size;

      if (this.config.verbose) {
        console.log(
          `[EventWebhookBridge] Bridge started with ${this.subscriptionIds.size} subscriptions`,
        );
      }
    } catch (error) {
      this.isRunning = false;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[EventWebhookBridge] Failed to start bridge:", errorMsg);
      throw error;
    }
  }

  /**
   * Stop the event bridge
   * Unsubscribes all handlers
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn("[EventWebhookBridge] Bridge is not running");
      return;
    }

    try {
      if (this.config.verbose) {
        console.log("[EventWebhookBridge] Stopping bridge...");
      }

      // Unsubscribe all handlers
      for (const [eventType, subscriptionId] of this.subscriptionIds) {
        try {
          this.eventBus.unsubscribe(subscriptionId);

          if (this.config.verbose) {
            console.log(`[EventWebhookBridge] Unsubscribed from ${eventType}`);
          }
        } catch (error) {
          console.error(
            `[EventWebhookBridge] Failed to unsubscribe from ${eventType}:`,
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      this.subscriptionIds.clear();
      this.isRunning = false;

      if (this.config.verbose) {
        console.log("[EventWebhookBridge] Bridge stopped");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[EventWebhookBridge] Error during shutdown:", errorMsg);
      throw error;
    }
  }

  /**
   * Handle a single event from the event bus
   * Routes it to all matching webhook endpoints
   * @param envelope - Event envelope from event bus
   */
  private async handleEvent(envelope: EventEnvelope): Promise<void> {
    try {
      const eventType = envelope.metadata.type;
      const tenantId = envelope.metadata.tenantId;

      // Increment metrics
      this.metrics.eventsProcessed++;
      this.metrics.eventsByType[eventType] =
        (this.metrics.eventsByType[eventType] ?? 0) + 1;
      this.metrics.lastEventAt = new Date();

      if (this.config.verbose) {
        console.log(
          `[EventWebhookBridge] Processing event: ${eventType} for tenant ${tenantId}`,
        );
      }

      // Get all webhook endpoints for this tenant
      const endpoints = await this.getWebhookEndpointsForTenant(tenantId);

      if (endpoints.length === 0) {
        if (this.config.verbose) {
          console.log(
            `[EventWebhookBridge] No webhook endpoints for tenant ${tenantId}`,
          );
        }
        return;
      }

      // Filter endpoints that are subscribed to this event type
      const matchingEndpoints = this.filterEndpointsByEventType(
        endpoints,
        eventType,
      );

      if (matchingEndpoints.length === 0) {
        if (this.config.verbose) {
          console.log(
            `[EventWebhookBridge] No endpoints subscribed to ${eventType}`,
          );
        }
        return;
      }

      // Deliver webhook to each matching endpoint
      for (const endpoint of matchingEndpoints) {
        try {
          await this.deliverWebhookForEvent(envelope, endpoint);
          this.metrics.webhooksTriggered++;
          this.metrics.deliverySuccesses++;
        } catch (error) {
          this.metrics.deliveryErrors++;
          this.metrics.lastErrorAt = new Date();
          const errorType = error instanceof Error
            ? error.constructor.name
            : "UnknownError";
          this.metrics.errorsByType[errorType] =
            (this.metrics.errorsByType[errorType] ?? 0) + 1;

          console.error(
            `[EventWebhookBridge] Failed to deliver webhook for ${eventType}:`,
            error instanceof Error ? error.message : String(error),
          );
          // Continue processing other endpoints - don't let one failure stop the rest
        }
      }
    } catch (error) {
      this.metrics.deliveryErrors++;
      this.metrics.lastErrorAt = new Date();
      console.error(
        "[EventWebhookBridge] Error handling event:",
        error instanceof Error ? error.message : String(error),
      );
      // Don't throw - gracefully handle errors to prevent blocking event processing
    }
  }

  /**
   * Deliver a webhook for an event to a specific endpoint
   * @param envelope - Event envelope
   * @param endpoint - Target webhook endpoint
   */
  private async deliverWebhookForEvent(
    envelope: EventEnvelope,
    endpoint: WebhookEndpoint,
  ): Promise<void> {
    // Check if endpoint is active and circuit breaker is not open
    if (!endpoint.active) {
      if (this.config.verbose) {
        console.log(
          `[EventWebhookBridge] Endpoint ${endpoint.id} is not active`,
        );
      }
      return;
    }

    if (endpoint.circuitBreakerOpen) {
      if (this.config.verbose) {
        console.log(
          `[EventWebhookBridge] Circuit breaker open for endpoint ${endpoint.id}`,
        );
      }
      return;
    }

    // Transform event to webhook format
    const webhookEvent: WebhookEvent = {
      id: envelope.metadata.id,
      type: envelope.metadata.type,
      tenantId: envelope.metadata.tenantId,
      data: envelope.data,
      timestamp: new Date(),
      source: envelope.metadata.source || "witylogix",
      correlationId: envelope.metadata.correlationId,
    };

    // Create delivery record
    const delivery = await (prisma as any).webhookDelivery.create({
      data: {
        id: `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        endpointId: endpoint.id,
        tenantId: endpoint.tenantId,
        eventType: webhookEvent.type,
        eventId: webhookEvent.id,
        status: "pending",
        attempt: 1,
        maxAttempts: 3,
        requestBody: JSON.stringify(webhookEvent),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Attempt delivery
    const result = await this.deliveryService.deliver(
      endpoint,
      webhookEvent,
      delivery,
    );

    // Update delivery record with result
    const deliveryStatus = result.success ? "delivered" : "failed";
    await (prisma as any).webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: deliveryStatus,
        responseStatus: result.statusCode,
        responseBody: result.responseBody,
        durationMs: result.durationMs,
        error: result.error,
        updatedAt: new Date(),
      },
    });

    if (this.config.verbose) {
      console.log(
        `[EventWebhookBridge] Webhook delivery for ${webhookEvent.type} to ${endpoint.url}: ${result.success ? "success" : "failed"}`,
      );
    }
  }

  /**
   * Get all webhook endpoints for a tenant
   * @param tenantId - Tenant ID
   * @returns Array of webhook endpoints
   */
  private async getWebhookEndpointsForTenant(
    tenantId: string,
  ): Promise<WebhookEndpoint[]> {
    try {
      const endpoints = await (prisma as any).webhookEndpoint.findMany({
        where: {
          tenantId,
          active: true,
        },
      });

      return endpoints;
    } catch (error) {
      console.error(
        `[EventWebhookBridge] Error fetching endpoints for tenant ${tenantId}:`,
        error instanceof Error ? error.message : String(error),
      );
      return [];
    }
  }

  /**
   * Filter endpoints by event type subscription
   * Supports exact match and wildcard patterns (e.g., "order.*")
   * @param endpoints - Array of webhook endpoints
   * @param eventType - Event type to match
   * @returns Filtered endpoints
   */
  private filterEndpointsByEventType(
    endpoints: WebhookEndpoint[],
    eventType: string,
  ): WebhookEndpoint[] {
    return endpoints.filter((endpoint) => {
      for (const pattern of endpoint.events) {
        if (this.eventTypeMatches(eventType, pattern)) {
          return true;
        }
      }
      return false;
    });
  }

  /**
   * Check if an event type matches a subscription pattern
   * Supports wildcards: "order.*" matches "order.created", "order.updated", etc.
   * @param eventType - Event type to check
   * @param pattern - Subscription pattern
   * @returns True if event type matches pattern
   */
  private eventTypeMatches(eventType: string, pattern: string): boolean {
    // Exact match
    if (pattern === eventType) {
      return true;
    }

    // Wildcard match
    if (pattern.endsWith(".*")) {
      const prefix = pattern.slice(0, -2);
      return eventType.startsWith(prefix + ".");
    }

    return false;
  }

  /**
   * Get current bridge metrics
   * @returns Current metrics snapshot
   */
  getMetrics(): BridgeMetrics {
    const uptimeMs = this.startTime
      ? Date.now() - this.startTime.getTime()
      : 0;

    return {
      ...this.metrics,
      uptimeMs,
    };
  }

  /**
   * Check if bridge is currently running
   * @returns True if bridge is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Reset metrics counters
   */
  resetMetrics(): void {
    this.metrics = {
      eventsProcessed: 0,
      webhooksTriggered: 0,
      deliveryErrors: 0,
      deliverySuccesses: 0,
      subscriptionsCount: this.subscriptionIds.size,
      subscribedEventTypes: Array.from(this.subscriptionIds.keys()),
      errorsByType: {},
      eventsByType: {},
      uptimeMs: 0,
    };
  }
}

export default EventWebhookBridge;
