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

// ─── OUTBOUND WEBHOOK TYPES ─────────────────────────────────────

/**
 * Webhook configuration for tenant endpoints
 */
export interface WebhookEndpointConfig {
  url: string;
  events: string[]; // Supports wildcards like "order.*"
  active?: boolean;
  metadata?: Record<string, any>;
  headers?: Record<string, string>;
}

/**
 * Webhook endpoint stored in database
 */
export interface WebhookEndpoint {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  circuitBreakerOpen: boolean;
  failureCount: number;
  successCount: number;
  lastDeliveryAt?: Date;
  lastFailureAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Delivery status enumeration
 */
export type DeliveryStatus = "pending" | "delivering" | "delivered" | "failed" | "circuit_open";

/**
 * Webhook delivery record
 */
export interface WebhookDelivery {
  id: string;
  endpointId: string;
  tenantId: string;
  eventType: string;
  eventId: string;
  status: DeliveryStatus;
  attempt: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  durationMs?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Delivery attempt details
 */
export interface DeliveryAttempt {
  timestamp: Date;
  statusCode?: number;
  responseBody?: string;
  durationMs?: number;
  error?: string;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Circuit breaker state
 */
export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailureAt?: Date;
  failureThreshold: number;
  resetTimeoutMs: number;
}

/**
 * Webhook signature metadata
 */
export interface WebhookSignature {
  signature: string;
  timestamp: string;
  payload: string;
}

/**
 * Webhook event to be delivered
 */
export interface WebhookEvent {
  id: string;
  type: string;
  tenantId: string;
  data: Record<string, any>;
  timestamp: Date;
  source: string;
  correlationId?: string;
}
