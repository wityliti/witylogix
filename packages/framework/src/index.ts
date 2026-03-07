/**
 * @witylogix/framework — Workflow engine framework
 *
 * Complete workflow orchestration engine with compensation, hooks, and event support.
 * Inspired by Medusa v2 workflows and Temporal.io.
 *
 * Core concepts:
 * - WorkflowDefinition: Template for a workflow
 * - WorkflowEngine: Executes workflows
 * - WorkflowStep: Atomic unit of work with compensation
 * - WorkflowContext: Shared runtime (tenant, user, logger)
 * - Compensation: Automatic rollback on failure
 *
 * Quick start:
 *
 *   import { WorkflowEngine, WorkflowDefinition } from "@witylogix/framework";
 *
 *   const orderWorkflow: WorkflowDefinition = {
 *     name: "process-order",
 *     steps: [
 *       {
 *         id: "validate",
 *         name: "Validate Order",
 *         invoke: async (input, context) => {
 *           // Validation logic
 *           return validatedOrder;
 *         },
 *       },
 *       {
 *         id: "charge",
 *         name: "Charge Payment",
 *         invoke: async (amount, context) => {
 *           const charge = await paymentService.charge(amount);
 *           return charge;
 *         },
 *         compensate: async (charge, context) => {
 *           // Refund on failure
 *           await paymentService.refund(charge.id);
 *         },
 *       },
 *       {
 *         id: "ship",
 *         name: "Create Shipment",
 *         invoke: async (order, context) => {
 *           const shipment = await shipmentService.create(order);
 *           return shipment;
 *         },
 *       },
 *     ],
 *     hooks: {
 *       beforeWorkflow: async (name, input, context) => {
 *         context.logger.info(`Starting ${name}`);
 *       },
 *       afterWorkflow: async (execution, context) => {
 *         context.logger.info(`Finished ${execution.workflowName}`, {
 *           status: execution.status,
 *         });
 *       },
 *     },
 *   };
 *
 *   const engine = new WorkflowEngine();
 *   engine.registerWorkflow(orderWorkflow);
 *
 *   // Listen for events
 *   engine.onWorkflowEvent((event) => {
 *     console.log(`[${event.type}] ${event.workflowName}`);
 *   });
 *
 *   // Execute
 *   const execution = await engine.executeWorkflow(
 *     "process-order",
 *     { orderId: "ord_123", amount: 99.99 },
 *     context
 *   );
 *
 *   console.log(execution.status); // "completed" or "failed"
 */

// ─────────────────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────────────────

export type {
  Logger,
  WorkflowContext,
  StepResult,
  WorkflowStep,
  WorkflowStepExecution,
  WorkflowExecution,
  WorkflowDefinition,
  WorkflowHooks,
  WorkflowExecutionOptions,
  BeforeWorkflowHook,
  AfterWorkflowHook,
  BeforeStepHook,
  AfterStepHook,
  StepInputHandler,
  StepInvokeHandler,
  StepCompensateHandler,
  WorkflowEvent,
  WorkflowEventListener,
} from "./types/index.js";

export { WorkflowStatus } from "./types/index.js";

// ─────────────────────────────────────────────────────────────────────────
// CONTAINER EXPORTS
// ─────────────────────────────────────────────────────────────────────────

export { Container, createContainer } from "./container/index.js";

export type { ContainerConfig, ServiceFactory, ServiceLifetime } from "./container/index.js";

// ─────────────────────────────────────────────────────────────────────────
// WORKFLOW EXPORTS
// ─────────────────────────────────────────────────────────────────────────

export { WorkflowEngine } from "./workflow/engine.js";
export { WorkflowRegistry } from "./workflow/registry.js";
export {
  runStep,
  createStepExecution,
  markStepSuccess,
  markStepFailure,
  markStepRetry,
} from "./workflow/step-runner.js";
export { runCompensation, isCompensationNeeded } from "./workflow/compensation.js";

export type { CompensationResult } from "./workflow/compensation.js";
