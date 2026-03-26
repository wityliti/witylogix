/**
 * Webhook Event Dispatcher
 * Routes events to subscribed endpoints and manages delivery queue
 */

import { v4 as uuidv4 } from "uuid";
import { WebhookPayload, WebhookEventType, WebhookSubscription, WebhookDeliveryAttempt } from "./types";
import { deliverWebhook, scheduleRetry, shouldRetry } from "./delivery";

/**
 * In-memory storage for demonstration
 * In production, this would use a database
 */
interface DispatcherStore {
  subscriptions: Map<string, WebhookSubscription[]>;
  deliveryQueue: WebhookDeliveryAttempt[];
  deadLetterQueue: WebhookDeliveryAttempt[];
}

const store: DispatcherStore = {
  subscriptions: new Map(),
  deliveryQueue: [],
  deadLetterQueue: [],
};

/**
 * Dispatcher configuration
 */
const DISPATCHER_CONFIG = {
  QUEUE_PROCESS_INTERVAL_MS: 5000, // Process queue every 5 seconds
  QUEUE_BATCH_SIZE: 10, // Process up to 10 items per interval
};

/**
 * Process the delivery queue
 * Attempts to deliver pending webhooks
 * Schedules retries for failed deliveries
 * Moves dead letter deliveries to dead letter queue
 */
export async function processQueue(): Promise<void> {
  const now = new Date();
  const pending = store.deliveryQueue.filter(
    (attempt) => attempt.status === "pending" && attempt.scheduledAt <= now
  );

  // Process up to QUEUE_BATCH_SIZE items
  const toBatch = pending.slice(0, DISPATCHER_CONFIG.QUEUE_BATCH_SIZE);

  for (const attempt of toBatch) {
    try {
      // Find the subscription for this attempt
      const subscription = findSubscription(attempt.subscriptionId);
      if (!subscription) {
        moveToDeadLetter(attempt, "Subscription not found");
        continue;
      }

      // Create the payload
      const payload: WebhookPayload = {
        id: attempt.webhookId,
        event: attempt.event,
        shopId: subscription.shopId,
        timestamp: new Date().toISOString(),
        data: {}, // Data should be passed from original event dispatch
        version: "2024-01-01",
      };

      // Attempt delivery
      const result = await deliverWebhook(subscription, payload);

      if (result.success) {
        // Mark as delivered
        attempt.status = "delivered";
        attempt.deliveredAt = new Date();
        attempt.statusCode = result.statusCode;
        attempt.responseTime = result.responseTime;

        // Update subscription metrics
        subscription.lastDeliveryAt = new Date();
        subscription.failureCount = 0;
      } else {
        // Mark as failed
        attempt.status = "failed";
        attempt.statusCode = result.statusCode;
        attempt.responseTime = result.responseTime;
        attempt.error = result.error;

        // Update subscription failure count
        subscription.failureCount = (subscription.failureCount || 0) + 1;
        subscription.lastFailureAt = new Date();

        // Schedule retry or move to dead letter
        if (shouldRetry(attempt)) {
          const retryAttempt = scheduleRetry(attempt);
          // Replace in queue
          const index = store.deliveryQueue.indexOf(attempt);
          if (index !== -1) {
            store.deliveryQueue[index] = retryAttempt;
          }
        } else {
          moveToDeadLetter(attempt, result.error || "Max retries exceeded");
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      moveToDeadLetter(attempt, errorMessage);
    }
  }
}

/**
 * Dispatch an event to all matching subscriptions
 * @param shopId - Shop ID for the event
 * @param event - Event type
 * @param data - Event data
 */
export async function dispatchEvent(
  shopId: string,
  event: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  const subscriptions = store.subscriptions.get(shopId) || [];

  // Find matching subscriptions
  const matching = subscriptions.filter(
    (sub) => sub.isActive && sub.events.includes(event)
  );

  // Queue delivery for each matching subscription
  for (const subscription of matching) {
    const attempt: WebhookDeliveryAttempt = {
      id: uuidv4(),
      webhookId: uuidv4(),
      subscriptionId: subscription.id,
      event,
      attempt: 1,
      maxAttempts: 5,
      status: "pending",
      scheduledAt: new Date(),
    };

    store.deliveryQueue.push(attempt);
  }
}

/**
 * Get current delivery queue
 * @returns Array of pending and in-progress delivery attempts
 */
export function getDeliveryQueue(): WebhookDeliveryAttempt[] {
  return store.deliveryQueue.filter((a) => a.status !== "dead_letter");
}

/**
 * Get dead letter queue for a shop
 * @param shopId - Shop ID to filter by
 * @returns Array of dead letter delivery attempts
 */
export function getDeadLetterQueue(shopId: string): WebhookDeliveryAttempt[] {
  return store.deadLetterQueue.filter(
    (attempt) => {
      const subscription = findSubscription(attempt.subscriptionId);
      return subscription?.shopId === shopId;
    }
  );
}

/**
 * Register a webhook subscription
 * Used for testing and setup
 * @param subscription - Webhook subscription to register
 */
export function registerSubscription(subscription: WebhookSubscription): void {
  const shopId = subscription.shopId;
  const subscriptions = store.subscriptions.get(shopId) || [];
  subscriptions.push(subscription);
  store.subscriptions.set(shopId, subscriptions);
}

/**
 * Unregister a webhook subscription
 * @param subscriptionId - ID of subscription to remove
 */
export function unregisterSubscription(subscriptionId: string): boolean {
  for (const [shopId, subscriptions] of store.subscriptions.entries()) {
    const index = subscriptions.findIndex((s) => s.id === subscriptionId);
    if (index !== -1) {
      subscriptions.splice(index, 1);
      return true;
    }
  }
  return false;
}

/**
 * Find a subscription by ID
 * @param subscriptionId - ID to search for
 * @returns Subscription or undefined
 */
function findSubscription(subscriptionId: string): WebhookSubscription | undefined {
  for (const subscriptions of store.subscriptions.values()) {
    const subscription = subscriptions.find((s) => s.id === subscriptionId);
    if (subscription) {
      return subscription;
    }
  }
  return undefined;
}

/**
 * Move a delivery attempt to dead letter queue
 * @param attempt - Attempt to move
 * @param reason - Reason for moving to dead letter
 */
function moveToDeadLetter(attempt: WebhookDeliveryAttempt, reason: string): void {
  attempt.status = "dead_letter";
  attempt.error = reason;

  // Remove from main queue
  const index = store.deliveryQueue.indexOf(attempt);
  if (index !== -1) {
    store.deliveryQueue.splice(index, 1);
  }

  // Add to dead letter queue
  store.deadLetterQueue.push(attempt);
}

/**
 * Get dispatcher statistics
 * Useful for monitoring
 */
export function getStats() {
  return {
    totalSubscriptions: Array.from(store.subscriptions.values()).reduce((sum, arr) => sum + arr.length, 0),
    pendingDeliveries: store.deliveryQueue.filter((a) => a.status === "pending").length,
    failedDeliveries: store.deliveryQueue.filter((a) => a.status === "failed").length,
    deadLetterCount: store.deadLetterQueue.length,
  };
}
