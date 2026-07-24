/**
 * @witylogix/framework/workflow/engine — Core workflow execution engine
 *
 * Orchestrates workflow execution with support for:
 * - Step-by-step execution with error handling
 * - Automatic compensation on failure (rollback)
 * - Lifecycle hooks (before/after workflow/step)
 * - Event emission for monitoring and tracing
 * - Timeout and retry support
 *
 * Architecture:
 * 1. Register workflows via registerWorkflow()
 * 2. Execute workflows via executeWorkflow(name, input, context)
 * 3. Engine runs steps sequentially (or concurrently if async=true)
 * 4. On step failure: run compensation in reverse order
 * 5. Emit events throughout lifecycle for observability
 *
 * Example:
 *   const engine = new WorkflowEngine();
 *   engine.registerWorkflow(orderWorkflow);
 *   const execution = await engine.executeWorkflow("order", orderData, context);
 */

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";

import type {
  WorkflowDefinition,
  WorkflowContext,
  WorkflowExecution,
  WorkflowStatus,
  WorkflowEvent,
  WorkflowEventListener,
  WorkflowExecutionOptions,
  WorkflowStep,
} from "../types/index.js";

import { WorkflowRegistry } from "./registry.js";
import {
  runStep,
  createStepExecution,
  markStepSuccess,
  markStepFailure,
} from "./step-runner.js";
import { runCompensation, isCompensationNeeded } from "./compensation.js";

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main workflow orchestration engine.
 * Manages workflow registration, execution, and event dispatch.
 */
export class WorkflowEngine extends EventEmitter {
  private registry: WorkflowRegistry;
  private executingWorkflows: Map<string, Promise<WorkflowExecution>> =
    new Map();

  constructor(registry?: WorkflowRegistry) {
    super();
    this.registry = registry ?? WorkflowRegistry.instance();
  }

  // ───────────────────────────────────────────────────────────────────────
  // REGISTRATION
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Register a workflow definition.
   * Can be called multiple times for different workflows.
   * Throws if workflow name already registered.
   */
  registerWorkflow(definition: WorkflowDefinition): void {
    this.registry.register(definition);
    this.emitEvent({
      type: "workflow:started",
      workflowName: definition.name,
      executionId: "registration",
      timestamp: new Date(),
      data: { version: definition.version, stepCount: definition.steps.length },
    });
  }

  /**
   * Get a registered workflow definition.
   */
  getWorkflow(name: string): WorkflowDefinition | undefined {
    return this.registry.get(name);
  }

  /**
   * List all registered workflow names.
   */
  listWorkflows(): string[] {
    return this.registry.list();
  }

  // ───────────────────────────────────────────────────────────────────────
  // EXECUTION
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Execute a workflow by name.
   *
   * Process:
   * 1. Look up workflow definition
   * 2. Create execution record
   * 3. Run beforeWorkflow hook
   * 4. Execute each step sequentially with error handling
   * 5. On step failure: run compensation in reverse
   * 6. Run afterWorkflow hook
   * 7. Return execution record with all details
   *
   * @param workflowName Name of the registered workflow
   * @param input Data passed to the first step
   * @param context Shared runtime context (tenantDb, userId, logger, etc.)
   * @param options Execution options (timeout, retries, etc.)
   */
  async executeWorkflow(
    workflowName: string,
    input: unknown,
    context: WorkflowContext,
    options: WorkflowExecutionOptions = {},
  ): Promise<WorkflowExecution> {
    const definition = this.registry.get(workflowName);
    if (!definition) {
      throw new Error(`Workflow "${workflowName}" not found in registry`);
    }

    const executionId = options.executionId ?? randomUUID();

    // Prevent duplicate concurrent executions of the same workflow instance
    if (this.executingWorkflows.has(executionId)) {
      throw new Error(
        `Workflow execution "${executionId}" is already in progress`,
      );
    }

    const execution: WorkflowExecution = {
      id: executionId,
      workflowName,
      status: "running" as WorkflowStatus,
      input,
      steps: [],
      startedAt: new Date(),
    };

    // Track this execution
    const promise = this.runWorkflow(
      definition,
      input,
      context,
      options,
      execution,
    );
    this.executingWorkflows.set(executionId, promise);

    try {
      return await promise;
    } finally {
      this.executingWorkflows.delete(executionId);
    }
  }

  /**
   * Private: execute the workflow steps.
   */
  private async runWorkflow(
    definition: WorkflowDefinition,
    input: unknown,
    context: WorkflowContext,
    options: WorkflowExecutionOptions,
    execution: WorkflowExecution,
  ): Promise<WorkflowExecution> {
    const combinedOptions = {
      timeout: options.timeout ?? definition.options?.timeout,
      retries: options.retries ?? definition.options?.retries ?? 0,
      async: options.async ?? definition.options?.async ?? false,
      ...options,
    };

    try {
      // Emit workflow started event
      this.emitEvent({
        type: "workflow:started",
        workflowName: definition.name,
        executionId: execution.id,
        timestamp: new Date(),
        data: { stepCount: definition.steps.length },
      });

      // Run beforeWorkflow hook
      if (definition.hooks?.beforeWorkflow) {
        await Promise.resolve(
          definition.hooks.beforeWorkflow(definition.name, input, context),
        );
      }

      // Execute steps
      let currentInput = input;
      const stepDefMap = new Map(
        definition.steps.map((step) => [step.id, step]),
      );

      for (const stepDef of definition.steps) {
        const stepExecution = createStepExecution(stepDef);
        execution.steps.push(stepExecution);

        // Run beforeStep hook
        if (definition.hooks?.beforeStep) {
          await Promise.resolve(
            definition.hooks.beforeStep(stepDef, currentInput, context),
          );
        }

        // Emit step started event
        this.emitEvent({
          type: "step:started",
          workflowName: definition.name,
          executionId: execution.id,
          stepId: stepDef.id,
          stepName: stepDef.name,
          timestamp: new Date(),
        });

        // Execute the step
        const result = await runStep(
          stepDef,
          currentInput,
          context,
          combinedOptions.timeout,
        );

        if (result.ok) {
          markStepSuccess(stepExecution, result.data);
          currentInput = result.data;

          // Emit step completed event
          this.emitEvent({
            type: "step:completed",
            workflowName: definition.name,
            executionId: execution.id,
            stepId: stepDef.id,
            stepName: stepDef.name,
            timestamp: new Date(),
            data: { output: result.data },
          });

          context.logger.debug(
            `Workflow "${definition.name}" step "${stepDef.name}" completed`,
            { stepId: stepDef.id, executionId: execution.id },
          );
        } else {
          markStepFailure(stepExecution, result.error);

          // Emit step failed event
          this.emitEvent({
            type: "step:failed",
            workflowName: definition.name,
            executionId: execution.id,
            stepId: stepDef.id,
            stepName: stepDef.name,
            timestamp: new Date(),
            error: result.error,
          });

          // Step is required and failed: initiate compensation
          context.logger.error(
            `Workflow "${definition.name}" step "${stepDef.name}" failed`,
            {
              stepId: stepDef.id,
              error: result.error.message,
              executionId: execution.id,
            },
          );

          execution.status = "compensating" as WorkflowStatus;
          execution.error = result.error;

          // Run compensation if needed
          if (isCompensationNeeded(definition.steps, execution.steps)) {
            this.emitEvent({
              type: "compensation:started",
              workflowName: definition.name,
              executionId: execution.id,
              timestamp: new Date(),
            });

            const compensationResult = await runCompensation(
              definition.steps,
              execution.steps,
              context,
            );

            execution.status = compensationResult.success
              ? ("compensated" as WorkflowStatus)
              : ("failed" as WorkflowStatus);

            this.emitEvent({
              type: "compensation:completed",
              workflowName: definition.name,
              executionId: execution.id,
              timestamp: new Date(),
              data: {
                compensated: compensationResult.compensated,
                failed: compensationResult.failed,
              },
            });
          } else {
            execution.status = "failed" as WorkflowStatus;
          }

          break; // Stop processing remaining steps
        }

        // Run afterStep hook
        if (definition.hooks?.afterStep) {
          await Promise.resolve(
            definition.hooks.afterStep(stepExecution, context),
          );
        }
      }

      // If we made it through all steps, mark as completed
      if (execution.status === "running") {
        execution.status = "completed" as WorkflowStatus;
        execution.output = currentInput;

        // Emit workflow completed event
        this.emitEvent({
          type: "workflow:completed",
          workflowName: definition.name,
          executionId: execution.id,
          timestamp: new Date(),
          data: { output: currentInput },
        });
      } else if (execution.status === "compensating") {
        // Compensation ran but could not be marked as compensated above
        execution.status = "failed" as WorkflowStatus;

        // Emit workflow failed event
        this.emitEvent({
          type: "workflow:failed",
          workflowName: definition.name,
          executionId: execution.id,
          timestamp: new Date(),
          error: execution.error,
        });
      }

      // Run afterWorkflow hook
      if (definition.hooks?.afterWorkflow) {
        await Promise.resolve(
          definition.hooks.afterWorkflow(execution, context),
        );
      }

      return execution;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      execution.status = "failed" as WorkflowStatus;
      execution.error = error;
      execution.completedAt = new Date();

      context.logger.error(
        `Workflow "${definition.name}" failed unexpectedly: ${error.message}`,
        { executionId: execution.id, error },
      );

      this.emitEvent({
        type: "workflow:failed",
        workflowName: definition.name,
        executionId: execution.id,
        timestamp: new Date(),
        error,
      });

      return execution;
    } finally {
      // Always set completion time
      if (!execution.completedAt) {
        execution.completedAt = new Date();
        execution.durationMs =
          execution.completedAt.getTime() - execution.startedAt.getTime();
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // EVENTS
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to workflow events.
   * Useful for monitoring, tracing, and logging.
   */
  onWorkflowEvent(listener: WorkflowEventListener): void {
    this.on("workflow-event", listener);
  }

  /**
   * Unsubscribe from workflow events.
   */
  offWorkflowEvent(listener: WorkflowEventListener): void {
    this.off("workflow-event", listener);
  }

  /**
   * Emit a workflow event.
   */
  private emitEvent(event: WorkflowEvent): void {
    this.emit("workflow-event", event);
  }

  // ───────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Get running executions (for monitoring/debugging).
   */
  getRunningExecutions(): string[] {
    return Array.from(this.executingWorkflows.keys());
  }

  /**
   * Check if an execution is in progress.
   */
  isExecuting(executionId: string): boolean {
    return this.executingWorkflows.has(executionId);
  }
}

// WorkflowEngine is exported above
