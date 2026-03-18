/**
 * Return Domain Events
 *
 * Event definitions for the returns/RMA lifecycle:
 * - return.requested: Customer initiates a return
 * - return.approved: Merchant approves the return
 * - return.rejected: Merchant rejects the return
 * - return.received: Warehouse receives returned items
 * - return.inspected: Inspection completed with condition assessment
 * - return.refunded: Refund processed and sent to customer
 */

import type { TypedEventBus } from "../event-bus/index.js";
import type { EventEnvelope } from "../event-bus/types.js";
import type { WitylogixEvents } from "../event-bus/types.js";

/**
 * Payload for return.requested event
 * Emitted when a customer creates a return request
 */
export interface ReturnRequestedPayload {
  returnId: string;
  orderId: string;
  tenantId: string;
  customerId: string;
  reason: string;
  items: Array<{
    orderItemId: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
  refundAmount: number;
}

/**
 * Payload for return.approved event
 * Emitted when merchant approves a return request
 */
export interface ReturnApprovedPayload {
  returnId: string;
  orderId: string;
  tenantId: string;
  approvedBy: string;
}

/**
 * Payload for return.rejected event
 * Emitted when merchant rejects a return request
 */
export interface ReturnRejectedPayload {
  returnId: string;
  orderId: string;
  tenantId: string;
  reason: string;
}

/**
 * Payload for return.received event
 * Emitted when warehouse receives returned items
 */
export interface ReturnReceivedPayload {
  returnId: string;
  orderId: string;
  tenantId: string;
  receivedAt: string;
}

/**
 * Payload for return.inspected event
 * Emitted when items are inspected and condition assessed
 */
export interface ReturnInspectedPayload {
  returnId: string;
  orderId: string;
  tenantId: string;
  condition: string;
  adjustedRefund: number;
}

/**
 * Payload for return.refunded event
 * Emitted when refund is processed and sent to customer
 */
export interface ReturnRefundedPayload {
  returnId: string;
  orderId: string;
  tenantId: string;
  refundAmount: number;
  refundMethod: string;
}

/**
 * Emit a return event to the event bus.
 *
 * @param eventBus - TypedEventBus instance
 * @param eventName - Return event type (e.g., "return.requested")
 * @param payload - Event payload with return data
 * @param metadata - Optional metadata overrides (tenantId, correlationId, userId)
 */
export async function emitReturnEvent(
  eventBus: TypedEventBus<WitylogixEvents>,
  eventName: string,
  payload: Record<string, any>,
  metadata?: {
    tenantId?: string;
    correlationId?: string;
    userId?: string;
    requestId?: string;
  },
): Promise<void> {
  await eventBus.emit(eventName as any, payload, {
    tenantId: metadata?.tenantId || payload.tenantId,
    correlationId: metadata?.correlationId,
    userId: metadata?.userId,
    requestId: metadata?.requestId,
  });
}
