/**
 * API Hooks — Fastify hooks for auto-triggering workflows
 *
 * Integrates with Fastify to automatically trigger workflows when API operations succeed.
 * Supports order creation/updates, shipment events, and driver assignment.
 *
 * Usage:
 *
 * ```typescript
 * const app = fastify();
 * const registry = new TriggerRegistry();
 *
 * // Register some triggers first
 * registry.register({
 *   eventType: "order.created",
 *   workflowName: "createDeliveryOrder",
 * });
 *
 * // Install hooks
 * registerApiHooks(app, { registry });
 *
 * // Now when POST /orders succeeds, trigger workflow automatically
 * ```
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { TriggerRegistry, TriggerContext } from "./trigger-registry.js";

// ───────────────────────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────────────────────

/**
 * Context extracted from Fastify request/response
 */
export interface ApiHookContext {
  request: FastifyRequest;
  reply: FastifyReply;
  statusCode: number;
  requestBody?: Record<string, any>;
  responseBody?: Record<string, any>;
}

/**
 * Options for API hooks
 */
export interface ApiHooksOptions {
  registry: TriggerRegistry;
  logger?: { debug: Function; info: Function; error: Function };
  timeout?: number;
  enabled?: boolean;
}

// ───────────────────────────────────────────────────────────────────────────
// ROUTE MATCHERS
// ───────────────────────────────────────────────────────────────────────────

/**
 * Check if a route is a POST /orders (order creation)
 */
function isOrderCreate(request: FastifyRequest): boolean {
  return request.method === "POST" && request.url.includes("/orders");
}

/**
 * Check if a route is a PATCH /orders/:id (order update)
 */
function isOrderUpdate(request: FastifyRequest): boolean {
  return request.method === "PATCH" && request.url.match(/\/orders\/\w+/);
}

/**
 * Check if a route is a shipment creation
 */
function isShipmentCreate(request: FastifyRequest): boolean {
  return request.method === "POST" && request.url.includes("/shipments");
}

/**
 * Check if a route is a shipment status update
 */
function isShipmentStatusUpdate(request: FastifyRequest): boolean {
  return (
    request.method === "PATCH" && request.url.match(/\/shipments\/\w+\/status/)
  );
}

/**
 * Check if a route is a driver assignment
 */
function isDriverAssignment(request: FastifyRequest): boolean {
  return (
    request.method === "POST" && request.url.match(/\/shipments\/\w+\/assign/)
  );
}

/**
 * Check if a route is a delivery completion
 */
function isDeliveryCompletion(request: FastifyRequest): boolean {
  return (
    request.method === "POST" &&
    request.url.match(/\/deliveries\/\w+\/complete/)
  );
}

// ───────────────────────────────────────────────────────────────────────────
// CONTEXT EXTRACTION
// ───────────────────────────────────────────────────────────────────────────

/**
 * Extract entity ID from various API patterns
 */
function extractEntityId(request: FastifyRequest): string {
  // Try to find ID in URL params
  const match = request.url.match(
    /\/(orders|shipments|deliveries)\/([a-zA-Z0-9_-]+)/,
  );
  if (match?.[2]) return match[2];

  // Try to find ID in request body
  const body = request.body as Record<string, any>;
  if (body?.id) return body.id;
  if (body?.orderId) return body.orderId;
  if (body?.shipmentId) return body.shipmentId;

  return "";
}

/**
 * Extract user info from request
 */
function extractUserInfo(request: FastifyRequest): {
  userId?: string;
  shopId?: string;
  orgId?: string;
} {
  const userId = (request.user as any)?.id || (request as any).userId;
  const shopId = (request as any).shopId;
  const orgId = (request as any).orgId;

  return { userId, shopId, orgId };
}

/**
 * Extract entity data from response
 */
function extractEntityData(body: any): Record<string, any> {
  if (!body) return {};

  // If response is already the entity
  if (body.id && (body.orderId || body.shipmentId)) {
    return body;
  }

  // If response has nested data
  if (body.data && body.data.id) {
    return body.data;
  }

  return body;
}

// ───────────────────────────────────────────────────────────────────────────
// HOOK IMPLEMENTATION
// ───────────────────────────────────────────────────────────────────────────

/**
 * Register Fastify hooks for workflow triggers
 */
export function registerApiHooks(
  fastify: FastifyInstance,
  options: ApiHooksOptions,
): void {
  const { registry, logger, timeout = 30000, enabled = true } = options;

  if (!enabled) return;

  // Store original onResponse hook
  const originalOnResponse = fastify.register;

  /**
   * onAfterHandler hook — triggered after successful API response
   * Checks if any triggers match and executes them
   */
  fastify.addHook(
    "onResponse",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Only trigger on successful responses (2xx)
      if (reply.statusCode < 200 || reply.statusCode >= 300) {
        return;
      }

      try {
        const eventType = detectEventType(request);
        if (!eventType) return;

        const hookContext: ApiHookContext = {
          request,
          reply,
          statusCode: reply.statusCode,
          requestBody: request.body as Record<string, any>,
          responseBody: reply.getPayload() as Record<string, any>,
        };

        // Extract context
        const entityId = extractEntityId(request);
        const { userId, shopId, orgId } = extractUserInfo(request);
        const entity = extractEntityData(hookContext.responseBody);

        if (!entityId || !entity || !shopId) {
          return;
        }

        const triggerContext = {
          eventType,
          entityId,
          entity,
          userId,
          shopId,
          orgId,
          metadata: {
            sourceRoute: request.url,
            method: request.method,
            statusCode: reply.statusCode,
          },
        };

        // Match triggers
        const matched = await registry.match(eventType, triggerContext);

        // Execute matched triggers (non-blocking)
        if (matched.length > 0) {
          logger?.debug?.(
            `Matched ${matched.length} triggers for event ${eventType} on entity ${entityId}`,
          );

          // Fire triggers in background
          setImmediate(async () => {
            for (const match of matched) {
              try {
                await match.execute({ timeout });
              } catch (error) {
                logger?.error?.(`Trigger execution failed: ${error}`);
              }
            }
          });
        }
      } catch (error) {
        logger?.error?.(`Error in workflow trigger hook: ${error}`);
        // Never let trigger errors break the API response
      }
    },
  );
}

/**
 * Detect which event type an API request maps to
 */
function detectEventType(
  request: FastifyRequest,
):
  | "order.created"
  | "order.updated"
  | "shipment.created"
  | "shipment.status_changed"
  | "driver.assigned"
  | null {
  if (isOrderCreate(request)) return "order.created";
  if (isOrderUpdate(request)) return "order.updated";
  if (isShipmentCreate(request)) return "shipment.created";
  if (isShipmentStatusUpdate(request)) return "shipment.status_changed";
  if (isDriverAssignment(request)) return "driver.assigned";
  if (isDeliveryCompletion(request)) return null; // Requires custom handling
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// RESPONSE DECORATION
// ───────────────────────────────────────────────────────────────────────────

/**
 * Decorate FastifyReply with getPayload() method if not present
 */
declare module "fastify" {
  interface FastifyReply {
    getPayload(): any;
  }
}

// Implement getPayload() if it doesn't exist
if (typeof (FastifyReply.prototype as any).getPayload !== "function") {
  (FastifyReply.prototype as any).getPayload = function () {
    return (this as any)._payload || {};
  };
}
