// @ts-nocheck

/**
 * Workflow Integration Service
 *
 * Bridges API operations (order creation, driver assignment, delivery completion)
 * with the workflow engine, automatically triggering workflows and emitting events.
 *
 * Responsibilities:
 * - Map API request data to workflow input types
 * - Trigger corresponding workflows
 * - Emit events on workflow state changes
 * - Respect per-tenant configuration (auto/manual/disabled)
 * - Graceful fallback if workflow engine fails (non-blocking)
 */

import type { Logger } from "pino";
import { WorkflowEngine, type WorkflowExecution } from "@witylogix/framework";
import type {
  CreateDeliveryOrderInput,
  AssignDriverInput,
  CompleteDeliveryInput,
} from "@witylogix/workflows";
import type {
  WorkflowIntegrationConfig,
  TriggerMode,
  IntegrationContext,
  WorkflowTriggerResult,
  OrderOperationData,
  DriverAssignmentData,
  DeliveryCompletionData,
  WorkflowTriggeredEvent,
  WorkflowCompletedEvent,
  WorkflowFailedEvent,
} from "./types.js";

// ───────────────────────────────────────────────────────────────────────────
// CONFIGURATION STORE
// ───────────────────────────────────────────────────────────────────────────

/**
 * In-memory configuration store.
 * In production, this would be fetched from a database or config service.
 */
const configStore = new Map<string, WorkflowIntegrationConfig>();

/**
 * Set per-tenant workflow integration configuration.
 */
export function setIntegrationConfig(
  tenantId: string,
  config: Partial<WorkflowIntegrationConfig>,
): void {
  const existing = configStore.get(tenantId) || {
    tenantId,
    triggerMode: "auto",
  };
  configStore.set(tenantId, { ...existing, ...config, tenantId });
}

/**
 * Get per-tenant workflow integration configuration.
 * Defaults to auto-trigger if not configured.
 */
function getIntegrationConfig(tenantId: string): WorkflowIntegrationConfig {
  return (
    configStore.get(tenantId) || {
      tenantId,
      triggerMode: "auto",
      nonBlocking: true,
      maxRetries: 3,
      executionTimeoutMs: 30000,
    }
  );
}

// ───────────────────────────────────────────────────────────────────────────
// EVENT HANDLERS (User can subscribe to these)
// ───────────────────────────────────────────────────────────────────────────

type WorkflowEventHandler =
  | ((event: WorkflowTriggeredEvent) => void | Promise<void>)
  | ((event: WorkflowCompletedEvent) => void | Promise<void>)
  | ((event: WorkflowFailedEvent) => void | Promise<void>);

const eventHandlers = {
  "workflow.triggered": [] as Array<
    (e: WorkflowTriggeredEvent) => void | Promise<void>
  >,
  "workflow.completed": [] as Array<
    (e: WorkflowCompletedEvent) => void | Promise<void>
  >,
  "workflow.failed": [] as Array<
    (e: WorkflowFailedEvent) => void | Promise<void>
  >,
};

/**
 * Subscribe to workflow integration events.
 */
export function onWorkflowEvent(
  eventType: "workflow.triggered" | "workflow.completed" | "workflow.failed",
  handler: WorkflowEventHandler,
): void {
  (eventHandlers[eventType] as any).push(handler);
}

/**
 * Emit workflow event to all subscribers.
 */
async function emitWorkflowEvent(
  eventType: keyof typeof eventHandlers,
  event: any,
): Promise<void> {
  const handlers = eventHandlers[eventType] as any[];
  for (const handler of handlers) {
    try {
      await handler(event);
    } catch (err) {
      // Never let event emission errors block execution
      console.error(`Error in ${eventType} handler:`, err);
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// WORKFLOW INTEGRATION SERVICE
// ───────────────────────────────────────────────────────────────────────────

/**
 * Workflow Integration Service — main API for triggering workflows from operations.
 */
export class WorkflowIntegrationService {
  private engine: WorkflowEngine;
  private logger: Logger;

  constructor(engine?: WorkflowEngine, logger?: Logger) {
    this.engine = engine || new WorkflowEngine();
    this.logger = logger || { error: console.error, info: console.log };
  }

  /**
   * Determine if workflow should be triggered for this tenant.
   */
  private shouldTrigger(tenantId: string, workflowName: string): boolean {
    const config = getIntegrationConfig(tenantId);

    if (config.triggerMode === "disabled") {
      return false;
    }

    // Check per-workflow override
    const perWorkflowMode = config.perWorkflow?.[workflowName];
    if (perWorkflowMode) {
      return perWorkflowMode === "auto";
    }

    // Use default mode
    return config.triggerMode === "auto";
  }

  /**
   * Trigger a workflow asynchronously (non-blocking).
   * Returns immediately without waiting for completion.
   */
  private async triggerAsync(
    workflowName: string,
    input: Record<string, unknown>,
    context: IntegrationContext,
  ): Promise<string> {
    // Generate execution ID upfront
    const executionId = crypto.randomUUID();

    // Fire and forget: execute in background
    setImmediate(async () => {
      try {
        const result = await this.engine.executeWorkflow(workflowName, input, {
          tenantDb: context.tenantDb,
          prisma: (globalThis as any).prisma,
          userId: context.userId,
          tenantId: context.tenantId,
          logger: context.logger,
          metadata: context.metadata,
          transactionId: context.requestId,
        });

        // Emit completion event
        if (result.status === "completed") {
          await emitWorkflowEvent("workflow.completed", {
            workflowName,
            executionId: result.id,
            operationType:
              `${workflowName.split(/(?=[A-Z])/)[0].toLowerCase()}.${workflowName
                .split(/(?=[A-Z])/)
                .slice(1)
                .join("")
                .toLowerCase()}` as any,
            tenantId: context.tenantId,
            output: result.output,
            durationMs: result.durationMs || 0,
            completedAt: result.completedAt || new Date(),
          } as WorkflowCompletedEvent);
        } else if (result.status === "failed") {
          await emitWorkflowEvent("workflow.failed", {
            workflowName,
            executionId: result.id,
            operationType:
              `${workflowName.split(/(?=[A-Z])/)[0].toLowerCase()}.${workflowName
                .split(/(?=[A-Z])/)
                .slice(1)
                .join("")
                .toLowerCase()}` as any,
            tenantId: context.tenantId,
            error: result.error?.message || "Unknown error",
            durationMs: result.durationMs || 0,
            failedAt: result.completedAt || new Date(),
          } as WorkflowFailedEvent);
        }
      } catch (err) {
        this.logger.error(
          err,
          `[WorkflowIntegration] Async workflow execution failed for ${workflowName}`,
        );

        await emitWorkflowEvent("workflow.failed", {
          workflowName,
          executionId,
          operationType:
            `${workflowName.split(/(?=[A-Z])/)[0].toLowerCase()}.${workflowName
              .split(/(?=[A-Z])/)
              .slice(1)
              .join("")
              .toLowerCase()}` as any,
          tenantId: context.tenantId,
          error: err instanceof Error ? err.message : String(err),
          durationMs: 0,
          failedAt: new Date(),
        } as WorkflowFailedEvent);
      }
    });

    return executionId;
  }

  /**
   * Trigger a workflow synchronously (blocking).
   * Waits for workflow to complete before returning.
   */
  private async triggerSync(
    workflowName: string,
    input: Record<string, unknown>,
    context: IntegrationContext,
  ): Promise<WorkflowExecution> {
    return await this.engine.executeWorkflow(workflowName, input, {
      tenantDb: context.tenantDb,
      prisma: (globalThis as any).prisma,
      userId: context.userId,
      tenantId: context.tenantId,
      logger: context.logger,
      metadata: context.metadata,
      transactionId: context.requestId,
    });
  }

  /**
   * Triggered when an order is created successfully.
   * Triggers createDeliveryOrder workflow.
   */
  async onOrderCreated(
    orderData: OrderOperationData,
    context: IntegrationContext,
  ): Promise<WorkflowTriggerResult | null> {
    const workflowName = "createDeliveryOrder";
    const config = getIntegrationConfig(context.tenantId);

    // Check if workflow should be triggered for this tenant
    if (!this.shouldTrigger(context.tenantId, workflowName)) {
      this.logger.info(
        {
          tenantId: context.tenantId,
          workflowName,
          triggerMode: config.triggerMode,
        },
        "[WorkflowIntegration] Workflow trigger skipped (mode not auto)",
      );
      return null;
    }

    try {
      // Map API order data to workflow input
      const workflowInput: CreateDeliveryOrderInput = {
        shopId: context.tenantId,
        userId: context.userId,
        externalOrderId: orderData.externalOrderId,
        externalOrderNumber: orderData.externalOrderNumber,
        customerName: orderData.customerName,
        customerEmail: orderData.customerEmail,
        customerPhone: orderData.customerPhone,
        pickupLocationId: orderData.pickupLocationId,
        deliveryAddressLine1: orderData.deliveryAddressLine1,
        deliveryAddressLine2: orderData.deliveryAddressLine2,
        deliveryCity: orderData.deliveryCity,
        deliveryProvince: orderData.deliveryProvince,
        deliveryPostalCode: orderData.deliveryPostalCode,
        deliveryCountry: orderData.deliveryCountry,
        items: orderData.items,
        preferredDeliveryDate: orderData.preferredDeliveryDate,
        timeSlotId: orderData.timeSlotId,
        totalPrice: orderData.totalPrice,
        totalWeight: orderData.totalWeight,
        notes: orderData.notes,
        tags: orderData.tags,
        metadata: orderData.metadata,
      };

      const triggeredAt = new Date();
      let execution: WorkflowExecution;
      let executionId: string;

      if (config.nonBlocking) {
        // Fire and forget
        executionId = await this.triggerAsync(
          workflowName,
          workflowInput,
          context,
        );

        // Emit triggered event immediately
        await emitWorkflowEvent("workflow.triggered", {
          workflowName,
          executionId,
          operationType: "order.created",
          tenantId: context.tenantId,
          userId: context.userId,
          triggeredAt,
          isNonBlocking: true,
        } as WorkflowTriggeredEvent);

        return {
          executionId,
          workflowName,
          status: "triggered",
          triggeredAt,
          isNonBlocking: true,
        };
      } else {
        // Blocking: wait for completion
        execution = await this.triggerSync(
          workflowName,
          workflowInput,
          context,
        );

        executionId = execution.id;

        // Emit triggered event
        await emitWorkflowEvent("workflow.triggered", {
          workflowName,
          executionId,
          operationType: "order.created",
          tenantId: context.tenantId,
          userId: context.userId,
          triggeredAt,
          isNonBlocking: false,
        } as WorkflowTriggeredEvent);

        // Emit completion event
        if (execution.status === "completed") {
          await emitWorkflowEvent("workflow.completed", {
            workflowName,
            executionId,
            operationType: "order.created",
            tenantId: context.tenantId,
            output: execution.output,
            durationMs: execution.durationMs || 0,
            completedAt: execution.completedAt || new Date(),
          } as WorkflowCompletedEvent);
        } else if (execution.status === "failed") {
          await emitWorkflowEvent("workflow.failed", {
            workflowName,
            executionId,
            operationType: "order.created",
            tenantId: context.tenantId,
            error: execution.error?.message || "Unknown error",
            durationMs: execution.durationMs || 0,
            failedAt: execution.completedAt || new Date(),
          } as WorkflowFailedEvent);
        }

        return {
          executionId,
          workflowName,
          status: execution.status as any,
          output: execution.output,
          error: execution.error?.message,
          triggeredAt,
          completedAt: execution.completedAt,
          durationMs: execution.durationMs,
          isNonBlocking: false,
        };
      }
    } catch (err) {
      // Log error but don't block API response
      this.logger.error(
        err,
        `[WorkflowIntegration] Failed to trigger ${workflowName}`,
      );

      // Emit failed event
      const executionId = crypto.randomUUID();
      await emitWorkflowEvent("workflow.failed", {
        workflowName,
        executionId,
        operationType: "order.created",
        tenantId: context.tenantId,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
        failedAt: new Date(),
      } as WorkflowFailedEvent);

      // Return null to indicate workflow was not triggered
      return null;
    }
  }

  /**
   * Triggered when a driver is assigned to an order.
   * Triggers assignDriver workflow.
   */
  async onDriverAssignment(
    assignData: DriverAssignmentData,
    context: IntegrationContext,
  ): Promise<WorkflowTriggerResult | null> {
    const workflowName = "assignDriver";
    const config = getIntegrationConfig(context.tenantId);

    // Check if workflow should be triggered
    if (!this.shouldTrigger(context.tenantId, workflowName)) {
      this.logger.info(
        {
          tenantId: context.tenantId,
          workflowName,
          triggerMode: config.triggerMode,
        },
        "[WorkflowIntegration] Workflow trigger skipped (mode not auto)",
      );
      return null;
    }

    try {
      // Map API data to workflow input
      const workflowInput: AssignDriverInput = {
        orderId: assignData.orderId,
        driverId: assignData.driverId,
        assignedAt: assignData.assignedAt,
        estimatedPickupTime: assignData.estimatedPickupTime,
        notes: assignData.notes,
        metadata: assignData.metadata,
      };

      const triggeredAt = new Date();
      let execution: WorkflowExecution;
      let executionId: string;

      if (config.nonBlocking) {
        executionId = await this.triggerAsync(
          workflowName,
          workflowInput,
          context,
        );

        await emitWorkflowEvent("workflow.triggered", {
          workflowName,
          executionId,
          operationType: "driver.assigned",
          tenantId: context.tenantId,
          userId: context.userId,
          triggeredAt,
          isNonBlocking: true,
        } as WorkflowTriggeredEvent);

        return {
          executionId,
          workflowName,
          status: "triggered",
          triggeredAt,
          isNonBlocking: true,
        };
      } else {
        execution = await this.triggerSync(
          workflowName,
          workflowInput,
          context,
        );

        executionId = execution.id;

        await emitWorkflowEvent("workflow.triggered", {
          workflowName,
          executionId,
          operationType: "driver.assigned",
          tenantId: context.tenantId,
          userId: context.userId,
          triggeredAt,
          isNonBlocking: false,
        } as WorkflowTriggeredEvent);

        if (execution.status === "completed") {
          await emitWorkflowEvent("workflow.completed", {
            workflowName,
            executionId,
            operationType: "driver.assigned",
            tenantId: context.tenantId,
            output: execution.output,
            durationMs: execution.durationMs || 0,
            completedAt: execution.completedAt || new Date(),
          } as WorkflowCompletedEvent);
        } else if (execution.status === "failed") {
          await emitWorkflowEvent("workflow.failed", {
            workflowName,
            executionId,
            operationType: "driver.assigned",
            tenantId: context.tenantId,
            error: execution.error?.message || "Unknown error",
            durationMs: execution.durationMs || 0,
            failedAt: execution.completedAt || new Date(),
          } as WorkflowFailedEvent);
        }

        return {
          executionId,
          workflowName,
          status: execution.status as any,
          output: execution.output,
          error: execution.error?.message,
          triggeredAt,
          completedAt: execution.completedAt,
          durationMs: execution.durationMs,
          isNonBlocking: false,
        };
      }
    } catch (err) {
      this.logger.error(
        err,
        `[WorkflowIntegration] Failed to trigger ${workflowName}`,
      );

      const executionId = crypto.randomUUID();
      await emitWorkflowEvent("workflow.failed", {
        workflowName,
        executionId,
        operationType: "driver.assigned",
        tenantId: context.tenantId,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
        failedAt: new Date(),
      } as WorkflowFailedEvent);

      return null;
    }
  }

  /**
   * Triggered when a delivery is completed.
   * Triggers completeDelivery workflow.
   */
  async onDeliveryCompleted(
    completionData: DeliveryCompletionData,
    context: IntegrationContext,
  ): Promise<WorkflowTriggerResult | null> {
    const workflowName = "completeDelivery";
    const config = getIntegrationConfig(context.tenantId);

    // Check if workflow should be triggered
    if (!this.shouldTrigger(context.tenantId, workflowName)) {
      this.logger.info(
        {
          tenantId: context.tenantId,
          workflowName,
          triggerMode: config.triggerMode,
        },
        "[WorkflowIntegration] Workflow trigger skipped (mode not auto)",
      );
      return null;
    }

    try {
      // Map API data to workflow input
      const workflowInput: CompleteDeliveryInput = {
        orderId: completionData.orderId,
        driverId: completionData.driverId,
        completedAt: completionData.completedAt,
        proofOfDeliveryUrls: completionData.proofOfDeliveryUrls,
        deliveryNotes: completionData.deliveryNotes,
        customerSignature: completionData.customerSignature,
        metadata: completionData.metadata,
      };

      const triggeredAt = new Date();
      let execution: WorkflowExecution;
      let executionId: string;

      if (config.nonBlocking) {
        executionId = await this.triggerAsync(
          workflowName,
          workflowInput,
          context,
        );

        await emitWorkflowEvent("workflow.triggered", {
          workflowName,
          executionId,
          operationType: "delivery.completed",
          tenantId: context.tenantId,
          userId: context.userId,
          triggeredAt,
          isNonBlocking: true,
        } as WorkflowTriggeredEvent);

        return {
          executionId,
          workflowName,
          status: "triggered",
          triggeredAt,
          isNonBlocking: true,
        };
      } else {
        execution = await this.triggerSync(
          workflowName,
          workflowInput,
          context,
        );

        executionId = execution.id;

        await emitWorkflowEvent("workflow.triggered", {
          workflowName,
          executionId,
          operationType: "delivery.completed",
          tenantId: context.tenantId,
          userId: context.userId,
          triggeredAt,
          isNonBlocking: false,
        } as WorkflowTriggeredEvent);

        if (execution.status === "completed") {
          await emitWorkflowEvent("workflow.completed", {
            workflowName,
            executionId,
            operationType: "delivery.completed",
            tenantId: context.tenantId,
            output: execution.output,
            durationMs: execution.durationMs || 0,
            completedAt: execution.completedAt || new Date(),
          } as WorkflowCompletedEvent);
        } else if (execution.status === "failed") {
          await emitWorkflowEvent("workflow.failed", {
            workflowName,
            executionId,
            operationType: "delivery.completed",
            tenantId: context.tenantId,
            error: execution.error?.message || "Unknown error",
            durationMs: execution.durationMs || 0,
            failedAt: execution.completedAt || new Date(),
          } as WorkflowFailedEvent);
        }

        return {
          executionId,
          workflowName,
          status: execution.status as any,
          output: execution.output,
          error: execution.error?.message,
          triggeredAt,
          completedAt: execution.completedAt,
          durationMs: execution.durationMs,
          isNonBlocking: false,
        };
      }
    } catch (err) {
      this.logger.error(
        err,
        `[WorkflowIntegration] Failed to trigger ${workflowName}`,
      );

      const executionId = crypto.randomUUID();
      await emitWorkflowEvent("workflow.failed", {
        workflowName,
        executionId,
        operationType: "delivery.completed",
        tenantId: context.tenantId,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
        failedAt: new Date(),
      } as WorkflowFailedEvent);

      return null;
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ───────────────────────────────────────────────────────────────────────────

let instance: WorkflowIntegrationService | null = null;

/**
 * Get or create singleton instance of the integration service.
 */
export function getWorkflowIntegrationService(): WorkflowIntegrationService {
  if (!instance) {
    instance = new WorkflowIntegrationService();
  }
  return instance;
}

/**
 * Set a custom instance (useful for testing).
 */
export function setWorkflowIntegrationService(
  service: WorkflowIntegrationService,
): void {
  instance = service;
}

export type { WorkflowTriggerResult, IntegrationContext };
