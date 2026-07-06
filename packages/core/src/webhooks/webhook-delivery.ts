// @ts-nocheck
/**
 * Webhook Delivery Service
 * Handles sending webhooks with retry logic, signature verification, and delivery tracking
 */

import { signPayload, WEBHOOK_HEADERS } from "./signer";
import type { WebhookDelivery, WebhookEndpoint, WebhookEvent } from "./types";
import { WebhookManager } from "./webhook-manager";

/**
 * Configuration constants
 */
const DELIVERY_TIMEOUT_MS = 30000; // 30 second timeout per attempt
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Exponential backoff intervals (in milliseconds)
 * Used for scheduling retries
 */
const RETRY_INTERVALS_MS = [
  10 * 1000, // 10 seconds
  60 * 1000, // 1 minute
  5 * 60 * 1000, // 5 minutes
];

/**
 * Webhook Delivery Service
 * Manages delivery attempts, retries, and failure handling
 */
export class WebhookDeliveryService {
  private webhookManager: WebhookManager;
  private prisma: any;

  /**
   * Initialize delivery service
   */
  constructor(webhookManager: WebhookManager, prisma: any) {
    this.webhookManager = webhookManager;
    this.prisma = prisma;
  }

  /**
   * Deliver a webhook to an endpoint
   * @param endpoint - Webhook endpoint configuration
   * @param event - Event to deliver
   * @param delivery - Delivery record
   * @returns Result of delivery attempt
   */
  async deliver(
    endpoint: WebhookEndpoint,
    event: WebhookEvent,
    delivery: WebhookDelivery,
  ): Promise<{
    success: boolean;
    statusCode?: number;
    durationMs: number;
    responseBody?: string;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Prepare payload
      const payload = {
        id: event.id,
        type: event.type,
        tenantId: event.tenantId,
        timestamp: event.timestamp.toISOString(),
        data: event.data,
        source: event.source,
        correlationId: event.correlationId,
      };

      const payloadString = JSON.stringify(payload);

      // Sign the payload
      const signature = signPayload(payloadString, endpoint.secret);
      const timestamp = new Date().toISOString();

      // Build headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        [WEBHOOK_HEADERS.SIGNATURE]: signature,
        [WEBHOOK_HEADERS.TIMESTAMP]: timestamp,
        [WEBHOOK_HEADERS.EVENT]: event.type,
        [WEBHOOK_HEADERS.DELIVERY_ID]: delivery.id,
        "User-Agent": "Witylogix-Webhook-Delivery/2.0",
      };

      // Create abort controller with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        DELIVERY_TIMEOUT_MS,
      );

      let response: Response;
      let responseBody = "";

      try {
        // Perform delivery
        response = await fetch(endpoint.url, {
          method: "POST",
          headers,
          body: payloadString,
          signal: controller.signal,
        });

        // Try to read response body
        try {
          responseBody = await response.text();
        } catch {
          // Response body may not be readable
          responseBody = "";
        }
      } finally {
        clearTimeout(timeoutId);
      }

      const durationMs = Date.now() - startTime;
      const success = response.ok; // 2xx status codes

      // Truncate response body to 10KB
      const truncatedBody = responseBody.slice(0, 10240);

      return {
        success,
        statusCode: response.status,
        durationMs,
        responseBody: truncatedBody,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      let errorMessage = "Unknown error";

      if (error instanceof TypeError) {
        errorMessage = `Network error: ${error.message}`;
      } else if (error instanceof DOMException && error.name === "AbortError") {
        errorMessage = "Request timeout";
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        durationMs,
        error: errorMessage,
      };
    }
  }

  /**
   * Process pending deliveries for a tenant
   * Executes retries for failed deliveries based on retry schedule
   * @param tenantId - Tenant ID
   * @param batchSize - Number of deliveries to process
   * @returns Number of deliveries processed
   */
  async processPendingDeliveries(
    tenantId: string,
    batchSize: number = 10,
  ): Promise<number> {
    // Get pending deliveries that are ready to be retried
    const now = new Date();
    const pending = await (this.prisma as any).webhookDelivery.findMany({
      where: {
        tenantId,
        status: "pending",
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      },
      orderBy: { createdAt: "asc" },
      take: batchSize,
      include: {
        endpoint: true,
      },
    });

    let processed = 0;

    for (const delivery of pending) {
      try {
        // Reconstruct event from delivery data
        const event: WebhookEvent = {
          id: delivery.eventId,
          type: delivery.eventType,
          tenantId: delivery.tenantId,
          data: delivery.requestBody ? JSON.parse(delivery.requestBody) : {},
          timestamp: new Date(delivery.createdAt),
          source: "webhook-delivery",
        };

        // Attempt delivery
        const result = await this.deliver(delivery.endpoint, event, delivery);

        if (result.success) {
          // Record success
          await this.webhookManager.recordSuccess(
            delivery.id,
            result.statusCode || 200,
            result.durationMs,
            result.responseBody,
          );
        } else {
          // Record failure
          await this.webhookManager.recordFailure(
            delivery.id,
            result.statusCode,
            result.error,
            result.durationMs,
            result.responseBody,
          );
        }

        processed++;
      } catch (error) {
        // Log error and continue with next delivery
        console.error(
          `Failed to process delivery ${delivery.id}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    return processed;
  }

  /**
   * Calculate retry delay using exponential backoff
   * @param attempt - Current attempt number (1-indexed)
   * @returns Delay in milliseconds
   */
  private calculateRetryDelay(attempt: number): number {
    if (attempt > MAX_RETRY_ATTEMPTS) {
      return 0;
    }

    const index = Math.min(attempt - 1, RETRY_INTERVALS_MS.length - 1);
    return RETRY_INTERVALS_MS[index];
  }

  /**
   * Check if a delivery should be retried
   * @param delivery - Delivery record
   * @returns True if should retry
   */
  shouldRetry(delivery: WebhookDelivery): boolean {
    return (
      delivery.status === "failed" && delivery.attempt < delivery.maxAttempts
    );
  }

  /**
   * Manually retry a delivery
   * @param deliveryId - Delivery ID
   * @returns Updated delivery
   */
  async retryDelivery(deliveryId: string): Promise<WebhookDelivery | null> {
    return await this.webhookManager.retryDelivery(deliveryId);
  }

  /**
   * Get max retry attempts
   */
  getMaxRetryAttempts(): number {
    return MAX_RETRY_ATTEMPTS;
  }

  /**
   * Get retry delay for an attempt number
   */
  getRetryDelay(attempt: number): number {
    return this.calculateRetryDelay(attempt);
  }

  /**
   * Verify a webhook request signature
   * @param payload - Request body as string
   * @param signature - Signature from header
   * @param secret - Endpoint secret
   * @returns True if signature is valid
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = signPayload(payload, secret);
    return this.constantTimeCompare(signature, expectedSignature);
  }

  /**
   * Constant-time string comparison
   * @param a - First string
   * @param b - Second string
   * @returns True if equal
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}

/**
 * Singleton instance
 */
let deliveryServiceInstance: WebhookDeliveryService | null = null;

/**
 * Get or initialize the webhook delivery service
 */
export function getWebhookDeliveryService(
  webhookManager: WebhookManager,
  prisma: any,
): WebhookDeliveryService {
  if (!deliveryServiceInstance) {
    deliveryServiceInstance = new WebhookDeliveryService(
      webhookManager,
      prisma,
    );
  }
  return deliveryServiceInstance;
}

/**
 * Legacy functions for backward compatibility
 */

/**
 * Deliver a webhook to a subscriber endpoint (legacy)
 * @param subscription - Webhook subscription
 * @param payload - Webhook payload
 */
export async function deliverWebhook(
  subscription: any,
  payload: any,
): Promise<{
  success: boolean;
  statusCode?: number;
  responseTime: number;
  error?: string;
}> {
  const startTime = Date.now();
  const payloadString = JSON.stringify(payload);
  const signature = signPayload(payloadString, subscription.secret);
  const timestamp = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    const response = await fetch(subscription.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [WEBHOOK_HEADERS.SIGNATURE]: signature,
        [WEBHOOK_HEADERS.TIMESTAMP]: timestamp,
        [WEBHOOK_HEADERS.EVENT]: payload.event,
        [WEBHOOK_HEADERS.DELIVERY_ID]: payload.id,
        "User-Agent": "Witylogix-Webhook-Delivery/1.0",
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;
    const success = response.ok;

    return {
      success,
      statusCode: response.status,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    let errorMessage = "Unknown error";

    if (error instanceof TypeError) {
      errorMessage = `Network error: ${error.message}`;
    } else if (error instanceof DOMException && error.name === "AbortError") {
      errorMessage = "Request timeout";
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      success: false,
      responseTime,
      error: errorMessage,
    };
  }
}

/**
 * Schedule a retry for a failed webhook delivery (legacy)
 */
export function scheduleRetry(attempt: any): any {
  const nextAttemptNumber = attempt.attempt + 1;

  if (nextAttemptNumber > MAX_RETRY_ATTEMPTS) {
    return {
      ...attempt,
      status: "dead_letter",
      attempt: nextAttemptNumber,
    };
  }

  const backoffIndex = Math.min(
    attempt.attempt - 1,
    RETRY_INTERVALS_MS.length - 1,
  );
  const backoffDelay = Math.max(
    0,
    backoffIndex >= 0 ? RETRY_INTERVALS_MS[backoffIndex] : 0,
  );
  const nextScheduledAt = new Date(Date.now() + backoffDelay);

  return {
    ...attempt,
    status: "pending",
    attempt: nextAttemptNumber,
    scheduledAt: nextScheduledAt,
  };
}

/**
 * Get retry delay (legacy)
 */
export function getRetryDelay(attempt: number): number {
  const index = Math.min(attempt - 1, RETRY_INTERVALS_MS.length - 1);
  return Math.max(0, index >= 0 ? RETRY_INTERVALS_MS[index] : 0);
}

/**
 * Check if should retry (legacy)
 */
export function shouldRetry(attempt: any): boolean {
  return attempt.status === "failed" && attempt.attempt < MAX_RETRY_ATTEMPTS;
}

/**
 * Get max retry attempts (legacy)
 */
export function getMaxRetryAttempts(): number {
  return MAX_RETRY_ATTEMPTS;
}
