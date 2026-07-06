// @ts-nocheck
/**
 * Webhook Event Emitter
 * Helper to emit events to the webhook system from the event bus
 */

import { v4 as uuidv4 } from "uuid";
import { WebhookManager, getWebhookManager } from "./webhook-manager";
import type { WebhookEvent } from "./types";

/**
 * Webhook Event Emitter
 * Bridges the event bus with the webhook delivery system
 */
export class WebhookEventEmitter {
  private webhookManager: WebhookManager;
  private prisma: any;

  /**
   * Initialize event emitter
   */
  constructor(webhookManager: WebhookManager, prisma: any) {
    this.webhookManager = webhookManager;
    this.prisma = prisma;
  }

  /**
   * Emit a webhook event to all matching subscriptions
   * @param tenantId - Tenant ID
   * @param eventType - Event type (e.g., "order.created")
   * @param data - Event data
   * @param source - Source service that triggered the event
   * @param correlationId - Optional correlation ID for tracing
   * @returns Delivery IDs that were queued
   */
  async emit(
    tenantId: string,
    eventType: string,
    data: Record<string, any>,
    source: string = "platform",
    correlationId?: string,
  ): Promise<string[]> {
    const event: WebhookEvent = {
      id: uuidv4(),
      type: eventType,
      tenantId,
      data,
      timestamp: new Date(),
      source,
      correlationId,
    };

    // Log the event
    await this.logEvent(event);

    // Queue deliveries
    return await this.webhookManager.deliverEvent(event);
  }

  /**
   * Log event to audit trail
   */
  private async logEvent(event: WebhookEvent): Promise<void> {
    try {
      await (this.prisma as any).webhookEventLog.create({
        data: {
          id: uuidv4(),
          tenantId: event.tenantId,
          eventType: event.type,
          eventId: event.id,
          source: event.source,
          correlationId: event.correlationId,
          data: event.data,
          createdAt: new Date(),
        },
      });
    } catch (error) {
      console.error("Failed to log webhook event:", error);
      // Don't throw - event should still be delivered even if logging fails
    }
  }

  /**
   * Emit an order.created event
   */
  async emitOrderCreated(
    tenantId: string,
    order: Record<string, any>,
    correlationId?: string,
  ): Promise<string[]> {
    return this.emit(
      tenantId,
      "order.created",
      order,
      "order-service",
      correlationId,
    );
  }

  /**
   * Emit an order.updated event
   */
  async emitOrderUpdated(
    tenantId: string,
    order: Record<string, any>,
    correlationId?: string,
  ): Promise<string[]> {
    return this.emit(
      tenantId,
      "order.updated",
      order,
      "order-service",
      correlationId,
    );
  }

  /**
   * Emit an order.cancelled event
   */
  async emitOrderCancelled(
    tenantId: string,
    order: Record<string, any>,
    correlationId?: string,
  ): Promise<string[]> {
    return this.emit(
      tenantId,
      "order.cancelled",
      order,
      "order-service",
      correlationId,
    );
  }

  /**
   * Emit a shipment.created event
   */
  async emitShipmentCreated(
    tenantId: string,
    shipment: Record<string, any>,
    correlationId?: string,
  ): Promise<string[]> {
    return this.emit(
      tenantId,
      "shipment.created",
      shipment,
      "shipment-service",
      correlationId,
    );
  }

  /**
   * Emit a shipment.status_changed event
   */
  async emitShipmentStatusChanged(
    tenantId: string,
    shipment: Record<string, any>,
    previousStatus: string,
    newStatus: string,
    correlationId?: string,
  ): Promise<string[]> {
    return this.emit(
      tenantId,
      "shipment.status_changed",
      { ...shipment, previousStatus, newStatus },
      "shipment-service",
      correlationId,
    );
  }

  /**
   * Emit a shipment.delivered event
   */
  async emitShipmentDelivered(
    tenantId: string,
    shipment: Record<string, any>,
    correlationId?: string,
  ): Promise<string[]> {
    return this.emit(
      tenantId,
      "shipment.delivered",
      shipment,
      "shipment-service",
      correlationId,
    );
  }

  /**
   * Emit a shipment.failed event
   */
  async emitShipmentFailed(
    tenantId: string,
    shipment: Record<string, any>,
    reason: string,
    correlationId?: string,
  ): Promise<string[]> {
    return this.emit(
      tenantId,
      "shipment.failed",
      { ...shipment, failureReason: reason },
      "shipment-service",
      correlationId,
    );
  }

  /**
   * Emit a driver.assigned event
   */
  async emitDriverAssigned(
    tenantId: string,
    assignment: Record<string, any>,
    correlationId?: string,
  ): Promise<string[]> {
    return this.emit(
      tenantId,
      "driver.assigned",
      assignment,
      "dispatch-service",
      correlationId,
    );
  }

  /**
   * Emit a driver.location_updated event
   */
  async emitDriverLocationUpdated(
    tenantId: string,
    location: Record<string, any>,
    correlationId?: string,
  ): Promise<string[]> {
    return this.emit(
      tenantId,
      "driver.location_updated",
      location,
      "location-service",
      correlationId,
    );
  }

  /**
   * Emit a route.optimized event
   */
  async emitRouteOptimized(
    tenantId: string,
    route: Record<string, any>,
    correlationId?: string,
  ): Promise<string[]> {
    return this.emit(
      tenantId,
      "route.optimized",
      route,
      "route-service",
      correlationId,
    );
  }

  /**
   * Emit a route.completed event
   */
  async emitRouteCompleted(
    tenantId: string,
    route: Record<string, any>,
    correlationId?: string,
  ): Promise<string[]> {
    return this.emit(
      tenantId,
      "route.completed",
      route,
      "route-service",
      correlationId,
    );
  }

  /**
   * Emit a payment.completed event
   */
  async emitPaymentCompleted(
    tenantId: string,
    payment: Record<string, any>,
    correlationId?: string,
  ): Promise<string[]> {
    return this.emit(
      tenantId,
      "payment.completed",
      payment,
      "payment-service",
      correlationId,
    );
  }

  /**
   * Emit a payment.refunded event
   */
  async emitPaymentRefunded(
    tenantId: string,
    payment: Record<string, any>,
    correlationId?: string,
  ): Promise<string[]> {
    return this.emit(
      tenantId,
      "payment.refunded",
      payment,
      "payment-service",
      correlationId,
    );
  }
}

/**
 * Singleton instance
 */
let emitterInstance: WebhookEventEmitter | null = null;

/**
 * Get or initialize the webhook event emitter
 */
export function getWebhookEventEmitter(
  prisma: any,
  webhookManager?: WebhookManager,
): WebhookEventEmitter {
  if (!emitterInstance) {
    const manager = webhookManager || getWebhookManager(prisma);
    emitterInstance = new WebhookEventEmitter(manager, prisma);
  }
  return emitterInstance;
}
