// @ts-nocheck
/**
 * Type definitions for the Event Webhook Bridge
 * Bridges TypedEventBus emissions to outbound webhook deliveries
 */

import type { EventEnvelope, EventMetadata } from "../event-bus/types.js";
import type { WebhookEndpoint } from "./types.js";

/**
 * Configuration for EventWebhookBridge
 */
export interface EventWebhookBridgeConfig {
  /** Consumer group name for event subscriptions */
  consumerGroup?: string;

  /** Whether to replay past events */
  replay?: boolean;

  /** Batch size for processing events */
  batchSize?: number;

  /** Enable detailed logging */
  verbose?: boolean;

  /** Tags to filter subscriptions */
  tags?: string[];
}

/**
 * Mapping between event type and webhook event type
 * Defines how domain events map to webhook payloads
 */
export interface EventWebhookMapping {
  /** Source event type from event bus (e.g., "order.created") */
  eventType: string;

  /** Target webhook event type (e.g., "order.created") */
  webhookEventType: string;

  /** Optional data transformer function */
  transform?: (data: any) => any;

  /** Optional filter predicate */
  filter?: (envelope: EventEnvelope) => boolean;
}

/**
 * Bridge metrics and statistics
 */
export interface BridgeMetrics {
  /** Total events processed */
  eventsProcessed: number;

  /** Total webhooks triggered */
  webhooksTriggered: number;

  /** Total delivery errors */
  deliveryErrors: number;

  /** Total delivery successes */
  deliverySuccesses: number;

  /** Timestamp of last event processed */
  lastEventAt?: Date;

  /** Timestamp of last error */
  lastErrorAt?: Date;

  /** Current event subscriptions count */
  subscriptionsCount: number;

  /** Event types currently subscribed to */
  subscribedEventTypes: string[];

  /** Errors by type */
  errorsByType: Record<string, number>;

  /** Events processed by type */
  eventsByType: Record<string, number>;

  /** Uptime in milliseconds */
  uptimeMs: number;
}

/**
 * Event to webhook payload transformation result
 */
export interface WebhookPayloadTransformation {
  /** Webhook endpoint to deliver to */
  endpoint: WebhookEndpoint;

  /** Transformed webhook payload */
  payload: {
    id: string;
    event: string;
    tenantId: string;
    timestamp: string;
    data: Record<string, unknown>;
    source: string;
    correlationId?: string;
  };

  /** Whether this endpoint should receive this event */
  shouldDeliver: boolean;

  /** Reason if not delivering */
  skipReason?: string;
}
