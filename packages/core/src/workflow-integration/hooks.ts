// @ts-nocheck

/**
 * Fastify Lifecycle Hooks for Workflow Integration
 *
 * Provides hooks that automatically trigger workflows after successful API operations:
 * - workflowAfterOrderCreate: Fires after POST /orders succeeds
 * - workflowAfterDriverAssign: Fires after PATCH /orders/:id/assign succeeds
 * - workflowAfterDeliveryComplete: Fires after PATCH /orders/:id/status succeeds with DELIVERED
 *
 * These are non-blocking: workflows execute asynchronously via setImmediate,
 * never blocking the API response.
 */

import type { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import { getWorkflowIntegrationService, getIntegrationConfig } from "./index.js";
import type {
  OrderOperationData,
  DriverAssignmentData,
  DeliveryCompletionData,
} from "./types.js";

// ───────────────────────────────────────────────────────────────────────────
// HOOK: ORDER CREATION
// ───────────────────────────────────────────────────────────────────────────

/**
 * Hook fired after order creation succeeds.
 * Triggers createDeliveryOrder workflow if auto-trigger is enabled.
 */
export async function workflowAfterOrderCreate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Only trigger on success
  if (reply.statusCode >= 400) {
    return;
  }

  // Extract created order from response payload
  const payload = (reply as any).payload;
  if (!payload || !payload.data) {
    return;
  }

  const order = payload.data;
  const tenantId = (request as any).tenantId || (request as any).shopId;
  const userId = (request as any).auth?.userId || "unknown";

  if (!tenantId) {
    return; // No tenant context
  }

  // Fire workflow trigger asynchronously (non-blocking)
  setImmediate(async () => {
    try {
      const service = getWorkflowIntegrationService();

      const orderData: OrderOperationData = {
        orderId: order.id,
        shopifyOrderId: order.shopifyOrderId,
        shopifyOrderNumber: order.shopifyOrderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        pickupLocationId: order.pickupLocationId,
        deliveryAddressLine1: order.addressLine1,
        deliveryAddressLine2: order.addressLine2,
        deliveryCity: order.city,
        deliveryProvince: order.province,
        deliveryPostalCode: order.postalCode,
        deliveryCountry: order.country,
        items: order.items || [],
        preferredDeliveryDate: order.deliveryDate,
        timeSlotId: order.timeSlotId,
        totalPrice: order.totalPrice,
        totalWeight: order.totalWeight,
        notes: order.notes,
        tags: order.tags,
        metadata: order.metadata,
      };

      await service.onOrderCreated(orderData, {
        tenantId,
        userId,
        shopId: tenantId,
        requestId: request.id,
        userAgent: request.headers["user-agent"],
        tenantDb: (request as any).tenantDb,
        logger: request.log,
      });
    } catch (err) {
      // Never block the response due to workflow errors
      request.log.error(
        err,
        "[WorkflowIntegration] Error triggering order creation workflow",
      );
    }
  });
}

// ───────────────────────────────────────────────────────────────────────────
// HOOK: DRIVER ASSIGNMENT
// ───────────────────────────────────────────────────────────────────────────

/**
 * Hook fired after driver assignment succeeds.
 * Triggers assignDriver workflow if auto-trigger is enabled.
 */
export async function workflowAfterDriverAssign(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Only trigger on success
  if (reply.statusCode >= 400) {
    return;
  }

  const payload = (reply as any).payload;
  if (!payload || !payload.data) {
    return;
  }

  const order = payload.data;
  const tenantId = (request as any).tenantId || (request as any).shopId;
  const userId = (request as any).auth?.userId || "unknown";

  if (!tenantId || !order.driverId) {
    return;
  }

  // Fire workflow trigger asynchronously
  setImmediate(async () => {
    try {
      const service = getWorkflowIntegrationService();

      const assignData: DriverAssignmentData = {
        orderId: order.id,
        driverId: order.driverId,
        assignedAt: new Date(),
        notes: order.notes,
        metadata: order.metadata,
      };

      await service.onDriverAssignment(assignData, {
        tenantId,
        userId,
        shopId: tenantId,
        requestId: request.id,
        userAgent: request.headers["user-agent"],
        tenantDb: (request as any).tenantDb,
        logger: request.log,
      });
    } catch (err) {
      request.log.error(
        err,
        "[WorkflowIntegration] Error triggering driver assignment workflow",
      );
    }
  });
}

// ───────────────────────────────────────────────────────────────────────────
// HOOK: DELIVERY COMPLETION
// ───────────────────────────────────────────────────────────────────────────

/**
 * Hook fired after delivery status update succeeds.
 * Triggers completeDelivery workflow if status changed to DELIVERED.
 */
export async function workflowAfterDeliveryComplete(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Only trigger on success
  if (reply.statusCode >= 400) {
    return;
  }

  const payload = (reply as any).payload;
  if (!payload || !payload.data) {
    return;
  }

  const order = payload.data;
  const tenantId = (request as any).tenantId || (request as any).shopId;
  const userId = (request as any).auth?.userId || "unknown";

  // Only trigger for DELIVERED status
  if (order.status !== "DELIVERED") {
    return;
  }

  if (!tenantId) {
    return;
  }

  // Fire workflow trigger asynchronously
  setImmediate(async () => {
    try {
      const service = getWorkflowIntegrationService();

      const completionData: DeliveryCompletionData = {
        orderId: order.id,
        driverId: order.driverId,
        completedAt: order.actualDelivery || new Date(),
        deliveryNotes: order.notes,
        metadata: order.metadata,
      };

      await service.onDeliveryCompleted(completionData, {
        tenantId,
        userId,
        shopId: tenantId,
        requestId: request.id,
        userAgent: request.headers["user-agent"],
        tenantDb: (request as any).tenantDb,
        logger: request.log,
      });
    } catch (err) {
      request.log.error(
        err,
        "[WorkflowIntegration] Error triggering delivery completion workflow",
      );
    }
  });
}

// ───────────────────────────────────────────────────────────────────────────
// HELPER: REGISTER HOOKS ON A FASTIFY INSTANCE
// ───────────────────────────────────────────────────────────────────────────

/**
 * Register workflow integration hooks on specific routes.
 * Called by the Fastify workflow-integration plugin during server setup.
 */
export function registerWorkflowHooks(fastify: FastifyInstance): void {
  // Register hooks on order routes
  fastify.addHook("onResponse", async (request, reply) => {
    // POST /api/v4/orders (create)
    if (request.method === "POST" && request.url.match(/^\/api\/[^/]+\/orders\/?$/)) {
      await workflowAfterOrderCreate(request, reply);
    }

    // PATCH /api/v4/orders/:id/assign (driver assignment)
    if (request.method === "PATCH" && request.url.match(/\/orders\/[^/]+\/assign\/?$/)) {
      await workflowAfterDriverAssign(request, reply);
    }

    // PATCH /api/v4/orders/:id/status (status update including delivery)
    if (request.method === "PATCH" && request.url.match(/\/orders\/[^/]+\/status\/?$/)) {
      await workflowAfterDeliveryComplete(request, reply);
    }
  });
}
