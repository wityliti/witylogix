/**
 * Workflow Triggers — Auto-fire workflows from API endpoints + Socket.io real-time events
 *
 * Core exports:
 * - TriggerRegistry: Register, match, and execute triggers based on conditions
 * - registerApiHooks: Fastify hooks for auto-triggering workflows
 * - WorkflowSocketEmitter: Real-time workflow progress events
 * - createTriggerContext: Extract context from request/response
 *
 * Usage:
 *
 * ```typescript
 * // 1. Setup trigger registry
 * const registry = new TriggerRegistry();
 *
 * // 2. Register triggers for order creation
 * registry.register({
 *   eventType: "order.created",
 *   workflowName: "createDeliveryOrder",
 *   conditions: [
 *     (context) => context.order.status === "PENDING",
 *   ],
 *   priority: 100,
 *   debounceMs: 100,
 * });
 *
 * // 3. Check triggers in API handlers
 * const matches = registry.match("order.created", { order, shop });
 * for (const trigger of matches) {
 *   await trigger.execute(context);
 * }
 * ```
 */

export type {
  WorkflowTrigger,
  TriggerCondition,
  TriggerContext,
  TriggerEventType,
  MatchedTrigger,
  TriggerExecutionOptions,
} from "./trigger-registry.js";

export {
  TriggerRegistry,
  createTriggerContext,
} from "./trigger-registry.js";

export type {
  ApiHooksOptions,
  ApiHookContext,
} from "./api-hooks.js";

export {
  registerApiHooks,
} from "./api-hooks.js";

export type {
  WorkflowSocketEvent,
  WorkflowProgressPayload,
  WorkflowCompletionPayload,
  WorkflowFailurePayload,
} from "./socket-events.js";

export {
  WorkflowSocketEmitter,
} from "./socket-events.js";

export {
  ShopifyWorkflowBridge,
} from "./integrations/shopify-bridge.js";
