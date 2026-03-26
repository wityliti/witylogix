/**
 * @witylogix/framework/workflow/compensation — Compensation/rollback engine
 *
 * Handles workflow rollback by running compensation handlers for completed steps
 * in reverse order. Compensation is "best-effort": continues even if individual
 * compensations fail, ensuring all steps get a chance to clean up.
 *
 * Usage:
 *   const result = await runCompensation(completedSteps, context);
 *   if (!result.success) {
 *     // Some compensations failed; log for manual review
 *   }
 *
 * Key semantics:
 * - Run in reverse order (LIFO)
 * - Only steps with compensate handlers run
 * - Failures logged but don't stop other compensations
 * - Idempotent: safe to retry if workflow crashes mid-rollback
 */

import type {
  WorkflowStep,
  WorkflowContext,
  WorkflowStepExecution,
} from "../types/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result of compensation run.
 * Success: all compensations passed or were skipped.
 * Failure: one or more compensations threw; logged but continued.
 */
export interface CompensationResult {
  success: boolean;
  compensated: string[]; // Step IDs that were compensated
  failed: Array<{ stepId: string; stepName: string; error: string }>; // Steps where compensation threw
  totalAttempted: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPENSATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run compensation for all completed steps in reverse order.
 *
 * Process:
 * 1. Collect completed steps that have compensation handlers
 * 2. Reverse the order (most recent first)
 * 3. Run each compensation, catching and logging errors
 * 4. Return summary of success/failures
 *
 * @param stepDefinitions All steps in the workflow
 * @param stepExecutions Execution records of completed steps
 * @param context Shared workflow context
 */
export async function runCompensation(
  stepDefinitions: WorkflowStep[],
  stepExecutions: WorkflowStepExecution[],
  context: WorkflowContext
): Promise<CompensationResult> {
  const result: CompensationResult = {
    success: true,
    compensated: [],
    failed: [],
    totalAttempted: 0,
  };

  context.logger.info("Starting compensation for failed workflow", {
    stepsCompleted: stepExecutions.length,
    transactionId: context.transactionId,
  });

  // Filter to completed, successful steps that have compensation
  const completedWithCompensation = stepExecutions
    .filter((exec) => exec.status === "completed" && exec.output !== undefined)
    .reverse();

  // Look up step definitions for compensation handlers
  const stepDefMap = new Map(
    stepDefinitions.map((step) => [step.id, step])
  );

  for (const stepExecution of completedWithCompensation) {
    const stepDef = stepDefMap.get(stepExecution.stepId);

    if (!stepDef || !stepDef.compensate) {
      context.logger.debug(
        `No compensation handler for step "${stepExecution.stepName}", skipping`,
        { stepId: stepExecution.stepId }
      );
      continue;
    }

    result.totalAttempted++;

    try {
      context.logger.info(
        `Running compensation for step "${stepExecution.stepName}"`,
        {
          stepId: stepExecution.stepId,
          transactionId: context.transactionId,
        }
      );

      await Promise.resolve(
        stepDef.compensate(stepExecution.output, context)
      );

      result.compensated.push(stepExecution.stepId);

      context.logger.info(
        `Compensation completed for step "${stepExecution.stepName}"`,
        { stepId: stepExecution.stepId }
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      context.logger.error(
        `Compensation failed for step "${stepExecution.stepName}": ${error.message}`,
        {
          stepId: stepExecution.stepId,
          error: error.message,
          transactionId: context.transactionId,
        }
      );

      result.success = false;
      result.failed.push({
        stepId: stepExecution.stepId,
        stepName: stepExecution.stepName,
        error: error.message,
      });

      // Continue to next step instead of throwing
    }
  }

  context.logger.info("Compensation finished", {
    success: result.success,
    compensated: result.compensated.length,
    failed: result.failed.length,
    transactionId: context.transactionId,
  });

  return result;
}

/**
 * Check if compensation is needed (i.e., there are completed steps with compensation).
 * Useful for optimization: skip compensation phase if no cleanup needed.
 */
export function isCompensationNeeded(
  stepDefinitions: WorkflowStep[],
  stepExecutions: WorkflowStepExecution[]
): boolean {
  const stepDefMap = new Map(
    stepDefinitions.map((step) => [step.id, step])
  );

  return stepExecutions.some((exec) => {
    if (exec.status !== "completed") return false;
    const stepDef = stepDefMap.get(exec.stepId);
    return stepDef && stepDef.compensate !== undefined;
  });
}

// runCompensation and isCompensationNeeded are exported above
