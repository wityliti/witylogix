/**
 * Webhook Types — Type definitions for webhook system
 *
 * Includes:
 * - Webhook endpoint registration
 * - Event subscriptions
 * - Delivery tracking and analytics
 * - Dead letter queue entries
 * - Retry and fan-out policies
 */

import type { EventEmitter } from 'events';

// ─── Webhook Core Types ──────────────────────────────────────────

/**
 * HTTP method for webhook delivery
 */
export type WebhookMethod = 'POST' | 'PUT' | 'PATCH';

/**
 * Webhook delivery status
 */
export type DeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying' | 'dlq';

/**
 * Webhook endpoint configuration
 */
export interface WebhookEndpoint {
  /** Unique identifier */
  id: string;
  /** Organization ID */
  organizationId: string;
  /** Provider ID (e.g., 'stripe', 'shopify') */
  providerId: string;
  /** Endpoint URL to receive webhooks */
  url: string;
  /** HTTP method (POST/PUT/PATCH) */
  method?: WebhookMethod;
  /** Custom headers to send with requests */
  headers?: Record<string, string>;
  /** HMAC signing secret */
  signingSecret: string;
  /** Event types this endpoint subscribes to */
  eventTypes: string[];
  /** Whether endpoint is active */
  active: boolean;
  /** Whether endpoint is paused */
  paused: boolean;
  /** Rate limit (requests per second) for this endpoint */
  rateLimit?: number;
  /** Max concurrent deliveries */
  maxConcurrency?: number;
  /** Custom user metadata */
  metadata?: Record<string, unknown>;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Webhook event structure
 */
export interface WebhookEvent {
  /** Unique event identifier */
  id: string;
  /** Event type (e.g., 'payment.created') */
  type: string;
  /** Provider ID */
  providerId: string;
  /** Event payload */
  payload: Record<string, unknown>;
  /** Event timestamp */
  timestamp: Date;
  /** Idempotency key for replay protection */
  idempotencyKey?: string;
  /** Custom attributes */
  attributes?: Record<string, unknown>;
}

/**
 * Single delivery attempt
 */
export interface DeliveryAttempt {
  /** Attempt number (1-based) */
  attempt: number;
  /** HTTP status code */
  statusCode?: number;
  /** Response body (first 1KB) */
  responseBody?: string;
  /** Error message if failed */
  error?: string;
  /** Attempt timestamp */
  timestamp: Date;
  /** Response latency (ms) */
  latencyMs?: number;
}

/**
 * Webhook delivery record
 */
export interface WebhookDelivery {
  /** Unique delivery ID */
  id: string;
  /** Associated webhook endpoint ID */
  endpointId: string;
  /** Associated event ID */
  eventId: string;
  /** Current status */
  status: DeliveryStatus;
  /** Array of attempts */
  attempts: DeliveryAttempt[];
  /** Next scheduled retry time */
  nextRetryAt?: Date;
  /** Delivery completed timestamp */
  completedAt?: Date;
  /** Total time to first success (ms) */
  totalDurationMs?: number;
}

/**
 * Dead letter queue entry
 */
export interface DeadLetterEntry {
  /** Unique DLQ entry ID */
  id: string;
  /** Associated delivery ID */
  deliveryId: string;
  /** Associated endpoint ID */
  endpointId: string;
  /** Associated event ID */
  eventId: string;
  /** Reason for DLQ placement */
  reason: string;
  /** Last error message */
  lastError: string;
  /** Number of failed attempts */
  failureCount: number;
  /** Webhook endpoint URL */
  endpointUrl: string;
  /** Event payload (for manual inspection) */
  eventPayload: Record<string, unknown>;
  /** Entry creation timestamp */
  createdAt: Date;
  /** Whether entry has been manually retried */
  manuallyRetried: boolean;
  /** TTL in seconds (auto-cleanup) */
  ttlSec?: number;
}

/**
 * Webhook subscription configuration
 */
export interface WebhookSubscription {
  /** Event type pattern (e.g., 'payment.*' or 'payment.created') */
  eventType: string;
  /** Handler function */
  handler: (event: WebhookEvent) => Promise<void>;
  /** Whether to process in background */
  async?: boolean;
  /** Error handler */
  onError?: (error: Error, event: WebhookEvent) => Promise<void>;
}

/**
 * Webhook configuration for a provider
 */
export interface WebhookConfig {
  /** Provider ID */
  providerId: string;
  /** Organization ID */
  organizationId: string;
  /** All endpoints for this provider */
  endpoints: WebhookEndpoint[];
  /** Default retry policy */
  retryPolicy?: RetryPolicy;
  /** Default fan-out config */
  fanOutConfig?: FanOutConfig;
  /** Enable signature verification */
  verifySignature?: boolean;
  /** Signature format (e.g., 'stripe', 'shopify', 'generic') */
  signatureFormat?: string;
}

/**
 * Retry policy for failed deliveries
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial backoff in milliseconds */
  initialBackoffMs: number;
  /** Maximum backoff in milliseconds */
  maxBackoffMs: number;
  /** Backoff multiplier (exponential) */
  multiplier: number;
  /** HTTP status codes to retry on */
  retryableStatusCodes: number[];
  /** Percentage of requests that can be retried */
  retryBudgetPercent?: number;
}

/**
 * Fan-out configuration for one event → multiple endpoints
 */
export interface FanOutConfig {
  /** Maximum concurrent deliveries per event */
  maxConcurrency: number;
  /** Fail-fast (stop on first error) or continue */
  failFast: boolean;
  /** Wait for all deliveries to complete before returning */
  waitForAll: boolean;
  /** Timeout for entire fan-out in milliseconds */
  timeoutMs: number;
}

// ─── Delivery Analytics ──────────────────────────────────────────

/**
 * Endpoint health score
 */
export interface EndpointHealth {
  /** Endpoint ID */
  endpointId: string;
  /** Success rate (0-100) */
  successRate: number;
  /** Average delivery latency (ms) */
  avgLatencyMs: number;
  /** P95 latency (ms) */
  p95LatencyMs: number;
  /** P99 latency (ms) */
  p99LatencyMs: number;
  /** Current failure rate (%) */
  failureRate: number;
  /** Total deliveries */
  totalDeliveries: number;
  /** Failed deliveries in last hour */
  failedLastHour: number;
  /** Is endpoint healthy */
  isHealthy: boolean;
  /** Health score (0-100) */
  healthScore: number;
}

/**
 * Delivery analytics for a time window
 */
export interface DeliveryAnalytics {
  /** Time window start */
  startTime: Date;
  /** Time window end */
  endTime: Date;
  /** Total events processed */
  totalEvents: number;
  /** Total deliveries */
  totalDeliveries: number;
  /** Successful deliveries */
  successfulDeliveries: number;
  /** Failed deliveries */
  failedDeliveries: number;
  /** DLQ entries */
  dlqEntries: number;
  /** Average delivery latency (ms) */
  avgLatencyMs: number;
  /** P50 latency (ms) */
  p50LatencyMs: number;
  /** P95 latency (ms) */
  p95LatencyMs: number;
  /** P99 latency (ms) */
  p99LatencyMs: number;
  /** Success rate (%) */
  successRate: number;
  /** Retry rate (%) */
  retryRate: number;
  /** Retry count */
  retryCount: number;
  /** Per-endpoint stats */
  byEndpoint: Record<string, EndpointHealth>;
}
