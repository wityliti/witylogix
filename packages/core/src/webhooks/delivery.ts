/**
 * Webhook Delivery Engine
 * Handles sending webhooks to subscriber endpoints with retry logic
 */

import {
  WebhookPayload,
  WebhookSubscription,
  WebhookDeliveryResult,
  WebhookDeliveryAttempt,
} from "./types";
import { signPayload, WEBHOOK_HEADERS } from "./signer";

const DELIVERY_TIMEOUT_MS = 10000; // 10 second timeout
const MAX_RETRY_ATTEMPTS = 5;

/**
 * Exponential backoff intervals (in milliseconds)
 * Used for scheduling retries
 */
const RETRY_INTERVALS_MS = [
  30 * 1000, // 30 seconds
  2 * 60 * 1000, // 2 minutes
  15 * 60 * 1000, // 15 minutes
  60 * 60 * 1000, // 1 hour
  4 * 60 * 60 * 1000, // 4 hours
];

/**
 * Deliver a webhook to a subscriber endpoint
 * Includes retry logic and proper error handling
 * @param subscription - Webhook subscription with target URL and secret
 * @param payload - Webhook payload to deliver
 * @returns Delivery result with status and metrics
 */
export async function deliverWebhook(
  subscription: WebhookSubscription,
  payload: WebhookPayload,
): Promise<WebhookDeliveryResult> {
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

    let retryAfter: number | undefined;
    if (!success && response.headers.has("Retry-After")) {
      const retryAfterValue = response.headers.get("Retry-After");
      if (retryAfterValue) {
        // Retry-After can be in seconds or HTTP date format
        const seconds = parseInt(retryAfterValue, 10);
        if (!isNaN(seconds)) {
          retryAfter = seconds * 1000;
        }
      }
    }

    return {
      success,
      statusCode: response.status,
      responseTime,
      retryAfter,
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
 * Schedule a retry for a failed webhook delivery
 * Uses exponential backoff strategy
 * @param attempt - Current delivery attempt record
 * @returns Updated attempt with retry scheduled or dead letter status
 */
export function scheduleRetry(
  attempt: WebhookDeliveryAttempt,
): WebhookDeliveryAttempt {
  const nextAttemptNumber = attempt.attempt + 1;

  // Check if we've exceeded max retries
  if (nextAttemptNumber > MAX_RETRY_ATTEMPTS) {
    return {
      ...attempt,
      status: "dead_letter",
      attempt: nextAttemptNumber,
    };
  }

  // Calculate backoff delay (use previous attempt index)
  const backoffIndex = Math.min(
    attempt.attempt - 1,
    RETRY_INTERVALS_MS.length - 1,
  );
  const backoffDelay = Math.max(
    0,
    backoffIndex >= 0 ? RETRY_INTERVALS_MS[backoffIndex] : 0,
  );

  // Schedule next attempt
  const nextScheduledAt = new Date(Date.now() + backoffDelay);

  return {
    ...attempt,
    status: "pending",
    attempt: nextAttemptNumber,
    scheduledAt: nextScheduledAt,
  };
}

/**
 * Calculate when a delivery attempt should be retried
 * @param attempt - The delivery attempt number (1-indexed)
 * @returns Delay in milliseconds before retry
 */
export function getRetryDelay(attempt: number): number {
  const index = Math.min(attempt - 1, RETRY_INTERVALS_MS.length - 1);
  return Math.max(0, index >= 0 ? RETRY_INTERVALS_MS[index] : 0);
}

/**
 * Check if a delivery attempt should be retried
 * @param attempt - Delivery attempt record
 * @returns True if the attempt should be retried
 */
export function shouldRetry(attempt: WebhookDeliveryAttempt): boolean {
  return attempt.status === "failed" && attempt.attempt < MAX_RETRY_ATTEMPTS;
}

/**
 * Get max retry attempts configuration
 */
export function getMaxRetryAttempts(): number {
  return MAX_RETRY_ATTEMPTS;
}
