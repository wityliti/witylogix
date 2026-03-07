/**
 * Type definitions for the Workflow Integration system.
 *
 * Provides configuration and result types for automatic workflow triggering
 * from API operations (order creation, driver assignment, delivery completion).
 */

// ───────────────────────────────────────────────────────────────────────────
// TRIGGER MODE & CONFIGURATION
// ───────────────────────────────────────────────────────────────────────────

/**
 * Trigger mode for workflow auto-execution.
 * - `auto`: Automatically trigger workflow after operation succeeds
 * - `manual`: Require explicit trigger via API endpoint
 * - `disabled`: Workflows disabled for this tenant
 */
export type TriggerMode = "auto" | "manual" | "disabled";

/**
 * Per-tenant workflow integration configuration.
 */
export interface WorkflowIntegrationConfig {
  /** Tenant ID (shop ID) */
  tenantId: string;

  /** Default trigger mode for all workflows */
  triggerMode: TriggerMode;

  /** Override trigger mode per workflow name */
  perWorkflow?: Record<string, TriggerMode>;

  /** Auto-retry failed workflows */
  autoRetry?: boolean;

  /** Max retry attempts */
  maxRetries?: number;

  /** Non-blocking execution: fire and forget */
  nonBlocking?: boolean;

  /** Timeout for workflow execution (ms) */
  executionTimeoutMs?: number;
}

/**
 * Integration context passed to workflow service.
 */
export interface IntegrationContext {
  tenantId: string;
  userId: string;
  shopId: string;
  requestId?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  tenantDb?: any; // Prisma client instance
  logger?: any; // Pino logger
}

// ───────────────────────────────────────────────────────────────────────────
// WORKFLOW TRIGGER RESULTS
// ───────────────────────────────────────────────────────────────────────────

/**
 * Result of triggering a workflow from API operation.
 */
export interface WorkflowTriggerResult {
  /** Workflow execution ID */
  executionId: string;

  /** Workflow name triggered */
  workflowName: string;

  /** Status: 'triggered', 'running', 'completed', 'failed' */
  status: "triggered" | "running" | "completed" | "failed";

  /** Workflow execution output (if completed) */
  output?: Record<string, unknown>;

  /** Error message (if failed) */
  error?: string;

  /** Timestamp workflow was triggered */
  triggeredAt: Date;

  /** Timestamp workflow completed (if applicable) */
  completedAt?: Date;

  /** Duration in milliseconds */
  durationMs?: number;

  /** True if execution is non-blocking (fire-and-forget) */
  isNonBlocking: boolean;
}

/**
 * Order operation data for triggering createDeliveryOrder workflow.
 */
export interface OrderOperationData {
  orderId: string;
  shopifyOrderId: string;
  shopifyOrderNumber?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupLocationId: string;
  deliveryAddressLine1: string;
  deliveryAddressLine2?: string;
  deliveryCity: string;
  deliveryProvince?: string;
  deliveryPostalCode: string;
  deliveryCountry: string;
  items: Array<{
    productId: string;
    variantId?: string;
    title: string;
    quantity: number;
    weight?: number;
    price?: number;
  }>;
  preferredDeliveryDate?: Date;
  timeSlotId?: string;
  totalPrice: number;
  totalWeight: number;
  notes?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Driver assignment operation data for triggering assignDriver workflow.
 */
export interface DriverAssignmentData {
  orderId: string;
  driverId: string;
  assignedAt: Date;
  estimatedPickupTime?: Date;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Delivery completion operation data for triggering completeDelivery workflow.
 */
export interface DeliveryCompletionData {
  orderId: string;
  driverId: string;
  completedAt: Date;
  proofOfDeliveryUrls?: string[];
  deliveryNotes?: string;
  customerSignature?: string;
  metadata?: Record<string, unknown>;
}

// ───────────────────────────────────────────────────────────────────────────
// WORKFLOW EVENT TYPES
// ───────────────────────────────────────────────────────────────────────────

/**
 * Event emitted when workflow is triggered from API operation.
 */
export interface WorkflowTriggeredEvent {
  workflowName: string;
  executionId: string;
  operationType: "order.created" | "driver.assigned" | "delivery.completed";
  tenantId: string;
  userId: string;
  triggeredAt: Date;
  isNonBlocking: boolean;
}

/**
 * Event emitted when workflow completes successfully.
 */
export interface WorkflowCompletedEvent {
  workflowName: string;
  executionId: string;
  operationType: "order.created" | "driver.assigned" | "delivery.completed";
  tenantId: string;
  output?: Record<string, unknown>;
  durationMs: number;
  completedAt: Date;
}

/**
 * Event emitted when workflow fails.
 */
export interface WorkflowFailedEvent {
  workflowName: string;
  executionId: string;
  operationType: "order.created" | "driver.assigned" | "delivery.completed";
  tenantId: string;
  error: string;
  durationMs: number;
  failedAt: Date;
  retriesRemaining?: number;
}
