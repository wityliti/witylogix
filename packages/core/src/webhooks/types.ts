/**
 * Webhook Types and Interfaces
 * Defines all webhook-related types for the Witylogix platform
 */

/**
 * Webhook payload structure sent to subscriber endpoints
 */
export interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  shopId: string;
  timestamp: string;
  data: Record<string, unknown>;
  version: string; // ISO date format, e.g., "2024-01-01"
}

/**
 * Supported webhook event types across the platform
 */
export type WebhookEventType =
  | "shipment.created"
  | "shipment.status_changed"
  | "shipment.delivered"
  | "shipment.failed"
  | "order.created"
  | "order.updated"
  | "order.cancelled"
  | "driver.assigned"
  | "driver.location_updated"
  | "route.optimized"
  | "route.completed"
  | "payment.completed"
  | "payment.refunded";

/**
 * Webhook subscription configuration
 * Represents a shop's subscription to specific events
 */
export interface WebhookSubscription {
  id: string;
  shopId: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  isActive: boolean;
  failureCount: number;
  lastDeliveryAt?: Date;
  lastFailureAt?: Date;
}

/**
 * Result of a webhook delivery attempt
 */
export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseTime: number;
  error?: string;
  retryAfter?: number;
}

/**
 * Webhook delivery attempt record
 * Tracks individual delivery attempts and retries
 */
export interface WebhookDeliveryAttempt {
  id: string;
  webhookId: string;
  subscriptionId: string;
  event: WebhookEventType;
  attempt: number;
  maxAttempts: number;
  status: "pending" | "delivered" | "failed" | "dead_letter";
  statusCode?: number;
  responseTime?: number;
  error?: string;
  scheduledAt: Date;
  deliveredAt?: Date;
}
