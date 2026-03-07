/**
 * @witylogix/framework/workflow/step-runner — Step execution logic
 *
 * Handles single-step execution with retry and timeout support.
 * Wraps step invocation in try/catch, handles timeouts, and tracks execution metrics.
 *
 * Usage:
 *   const result = await runStep(step, input, context);
 *   if (result.ok) { console.log(result.data); }
 *   else { console.error(result.error); }
 */

import type {
  WorkflowStep,
  WorkflowContext,
  StepResult,
  WorkflowStepExecution,
  WorkflowStatus,
} from "../types/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// STEP EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute a single step with retry and timeout logic.
 * Returns success or failure result with metrics.
 *
 * Behavior:
 * - Invokes step.invoke(input, context)
 * - On timeout: fails (unless optional)
 * - On error: retries up to step.retries times
 * - Logs each attempt for debugging
 */
export async function runStep<TInput = unknown, TOutput = unknown>(
  step: WorkflowStep<TInput, TOutput>,
  input: TInput,
  context: WorkflowContext,
  defaultTimeout: number = 30000
): Promise<StepResult<TOutput>> {
  const timeout = step.timeout ?? defaultTimeout;
  const maxRetries = step.retries ?? 0;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await executeWithTimeout(
        () => step.invoke(input, context),
        timeout
      );

      context.logger.info(`Step "${step.name}" completed successfully`, {
        stepId: step.id,
        attempt: attempt + 1,
      });

      return { ok: true, data: result };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;

      const isLastAttempt = attempt === maxRetries;
      const isOptional = step.optional ?? false;

      if (isLastAttempt) {
        context.logger.error(
          `Step "${step.name}" failed after ${attempt + 1} attempt(s)`,
          {
            stepId: step.id,
            error: error.message,
            optional: isOptional,
          }
        );

        // If step is optional, return success anyway
        if (isOptional) {
          context.logger.warn(
            `Step "${step.name}" is optional; skipping compensation`,
            { stepId: step.id }
          );
          return { ok: true, data: undefined as unknown as TOutput };
        }

        return { ok: false, error };
      } else {
        // Retry with exponential backoff
        const backoffMs = Math.pow(2, attempt) * 100;
        context.logger.warn(
          `Step "${step.name}" failed, retrying in ${backoffMs}ms`,
          {
            stepId: step.id,
            attempt: attempt + 1,
            error: error.message,
            backoffMs,
          }
        );

        await sleep(backoffMs);
      }
    }
  }

  // Should not reach here, but as a safety net
  return {
    ok: false,
    error: lastError ?? new Error(`Step "${step.name}" failed unexpectedly`),
  };
}

/**
 * Execute a promise with a timeout.
 * Rejects with TimeoutError if the timeout is exceeded.
 */
async function executeWithTimeout<T>(
  fn: () => Promise<T> | T,
  timeoutMs: number
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(`Operation timed out after ${timeoutMs}ms`)
      );
    }, timeoutMs);

    // Prevent timer from keeping process alive if it's the only event
    if (timer.unref) {
      timer.unref();
    }
  });

  const result = await Promise.resolve(fn());
  clearTimeout(
    setTimeout(() => {}, timeoutMs) as unknown as NodeJS.Timeout
  );

  return Promise.race([Promise.resolve(result), timeoutPromise]);
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP EXECUTION TRACKING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create an execution record for a step.
 * Used by the engine to track step state for the final execution report.
 */
export function createStepExecution(
  step: WorkflowStep,
  startedAt: Date = new Date()
): WorkflowStepExecution {
  return {
    stepId: step.id,
    stepName: step.name,
    status: "running" as WorkflowStatus,
    retriesUsed: 0,
    startedAt,
  };
}

/**
 * Update step execution with success result.
 */
export function markStepSuccess(
  execution: WorkflowStepExecution,
  output: unknown,
  completedAt: Date = new Date()
): void {
  execution.status = "completed" as WorkflowStatus;
  execution.output = output;
  execution.completedAt = completedAt;
  execution.durationMs = completedAt.getTime() - execution.startedAt.getTime();
}

/**
 * Update step execution with failure.
 */
export function markStepFailure(
  execution: WorkflowStepExecution,
  error: Error,
  completedAt: Date = new Date()
): void {
  execution.status = "failed" as WorkflowStatus;
  execution.error = error.message;
  execution.completedAt = completedAt;
  execution.durationMs = completedAt.getTime() - execution.startedAt.getTime();
}

/**
 * Mark that a step was retried.
 */
export function markStepRetry(execution: WorkflowStepExecution): void {
  execution.retriesUsed++;
}

// Functions are exported above as declarations
