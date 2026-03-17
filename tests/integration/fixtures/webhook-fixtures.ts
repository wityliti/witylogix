/**
 * Webhook Fixtures for Delivery, Security, and Analytics Tests
 * Provides factory functions for endpoints, events, deliveries, and subscriptions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

export interface WebhookEndpoint {
  id: string;
  url: string;
  version: string;
  description: string;
  secret: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEventType {
  name: string;
  version: string;
  schema: Record<string, unknown>;
  isRetryable: boolean;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: Date;
  orgId: string;
  version: string;
}

export interface WebhookDelivery {
  id: string;
  eventId: string;
  endpointId: string;
  attempt: number;
  statusCode?: number;
  responseTime: number;
  success: boolean;
  error?: string;
  timestamp: Date;
  nextRetry?: Date;
}

export interface WebhookSubscription {
  id: string;
  endpointId: string;
  eventTypes: string[];
  filters?: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
}

export interface DLQEntry {
  id: string;
  eventId: string;
  endpointId: string;
  reason: string;
  failureCount: number;
  lastError: string;
  enqueuedAt: Date;
}

/**
 * Factory: Create webhook endpoint
 */
export function createWebhookEndpoint(
  overrides?: Partial<WebhookEndpoint>
): WebhookEndpoint {
  const now = new Date();
  return {
    id: `endpoint-${Date.now()}`,
    url: "https://api.example.com/webhooks/payment",
    version: "v1",
    description: "Payment events webhook",
    secret: "sk_live_" + "webhook_" + "FAKESECRET",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Factory: Create webhook event type
 */
export function createWebhookEventType(
  name: string,
  overrides?: Partial<WebhookEventType>
): WebhookEventType {
  return {
    name,
    version: "1.0.0",
    schema: {
      id: "string",
      timestamp: "ISO8601",
      data: "object",
    },
    isRetryable: true,
    ...overrides,
  };
}

/**
 * Factory: Create webhook event
 */
export function createWebhookEvent(
  type: string,
  overrides?: Partial<WebhookEvent>
): WebhookEvent {
  return {
    id: `event-${Date.now()}`,
    type,
    data: {
      resourceId: "res-123",
      action: "created",
      metadata: { source: "api" },
    },
    timestamp: new Date(),
    orgId: "org-123",
    version: "1.0.0",
    ...overrides,
  };
}

/**
 * Factory: Create successful webhook delivery
 */
export function createWebhookDelivery(
  eventId: string,
  endpointId: string,
  overrides?: Partial<WebhookDelivery>
): WebhookDelivery {
  return {
    id: `delivery-${Date.now()}`,
    eventId,
    endpointId,
    attempt: 1,
    statusCode: 200,
    responseTime: 250,
    success: true,
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Factory: Create failed webhook delivery
 */
export function createFailedWebhookDelivery(
  eventId: string,
  endpointId: string,
  attempt: number = 1
): WebhookDelivery {
  return {
    id: `delivery-fail-${Date.now()}`,
    eventId,
    endpointId,
    attempt,
    statusCode: 500,
    responseTime: 5000,
    success: false,
    error: "Internal Server Error",
    timestamp: new Date(),
    nextRetry: new Date(Date.now() + 60000 * Math.pow(2, attempt - 1)),
  };
}

/**
 * Factory: Create webhook subscription
 */
export function createWebhookSubscription(
  endpointId: string,
  eventTypes: string[],
  overrides?: Partial<WebhookSubscription>
): WebhookSubscription {
  return {
    id: `sub-${Date.now()}`,
    endpointId,
    eventTypes,
    filters: { status: "completed" },
    isActive: true,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Factory: Create DLQ entry
 */
export function createDLQEntry(
  eventId: string,
  endpointId: string,
  overrides?: Partial<DLQEntry>
): DLQEntry {
  return {
    id: `dlq-${Date.now()}`,
    eventId,
    endpointId,
    reason: "max_retries_exceeded",
    failureCount: 5,
    lastError: "Connection timeout after 30s",
    enqueuedAt: new Date(),
    ...overrides,
  };
}

/**
 * Factory: Create batch delivery payload
 */
export function createBatchDeliveryPayload(
  eventCount: number = 10
) {
  return {
    batchId: `batch-${Date.now()}`,
    timestamp: new Date().toISOString(),
    events: Array.from({ length: eventCount }, (_, i) =>
      createWebhookEvent(`event.type.${i}`)
    ),
  };
}

/**
 * Factory: Create HMAC-SHA256 signed payload
 */
export function createHMACSHA256Signature(
  payload: string,
  secret: string
): string {
  const crypto = require("crypto");
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

/**
 * Factory: Create RSA signed payload
 */
export function createRSASignature(
  payload: string,
  privateKey: string
): string {
  const crypto = require("crypto");
  const sign = crypto.createSign("sha256");
  sign.update(payload);
  return sign.sign(privateKey, "hex");
}

/**
 * Factory: Create JWT token
 */
export function createJWTToken(
  payload: Record<string, unknown>,
  secret: string
): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const encodedPayload = Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const crypto = require("crypto");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${encodedPayload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${header}.${encodedPayload}.${signature}`;
}

/**
 * Factory: Create replay protection nonce
 */
export function createReplayProtectionNonce(): {
  timestamp: number;
  nonce: string;
} {
  const crypto = require("crypto");
  return {
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  };
}

/**
 * Factory: Create webhook delivery history
 */
export function createDeliveryHistory(endpointId: string) {
  return {
    endpointId,
    totalAttempts: 150,
    successCount: 140,
    failureCount: 10,
    dlqCount: 0,
    averageLatency: 245,
    p95Latency: 1200,
    p99Latency: 4500,
    lastDeliveryTime: new Date(),
  };
}

/**
 * Factory: Create endpoint health metrics
 */
export function createEndpointHealthMetrics(endpointId: string) {
  return {
    endpointId,
    uptime: 0.9998,
    successRate: 0.9933,
    failureRate: 0.0067,
    avgResponseTime: 245,
    p50ResponseTime: 150,
    p95ResponseTime: 1200,
    p99ResponseTime: 4500,
    circuitBreakerOpen: false,
    lastCheckTime: new Date(),
  };
}
