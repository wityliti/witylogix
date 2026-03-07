/**
 * Workflow Real-time Events — Type definitions for Socket.io workflow events
 *
 * Defines discriminated unions and payloads for real-time workflow progress updates.
 * Shared between API server and dashboard for type safety.
 *
 * Usage:
 *   // Server
 *   const payload: StepCompletedPayload = { ... };
 *   io.to(room).emit(WORKFLOW_EVENTS.STEP_COMPLETED, payload);
 *
 *   // Dashboard
 *   socket.on(WORKFLOW_EVENTS.STEP_COMPLETED, (payload: StepCompletedPayload) => { ... });
 */

// ─── Event Name Constants ────────────────────────────────────

export const WORKFLOW_EVENTS = {
  // Workflow lifecycle
  WORKFLOW_STARTED: "workflow:started",
  WORKFLOW_COMPLETED: "workflow:completed",
  WORKFLOW_FAILED: "workflow:failed",

  // Step lifecycle
  STEP_STARTED: "workflow:step:started",
  STEP_COMPLETED: "workflow:step:completed",
  STEP_FAILED: "workflow:step:failed",

  // Compensation lifecycle
  COMPENSATION_STARTED: "workflow:compensation:started",
  COMPENSATION_COMPLETED: "workflow:compensation:completed",
} as const;

export type WorkflowEventName = (typeof WORKFLOW_EVENTS)[keyof typeof WORKFLOW_EVENTS];

// ─── Base Payload Type ──────────────────────────────────────

/**
 * Common fields in all workflow events.
 * Emitted with tenant isolation: `tenant:${tenantId}:workflows`
 * Also emitted to execution-specific room: `workflow:${executionId}`
 */
export interface WorkflowEventBase {
  /** Unique execution ID for tracking */
  executionId: string;

  /** Name of the workflow being executed */
  workflowName: string;

  /** ISO 8601 timestamp when event occurred */
  timestamp: string;

  /** Request/transaction ID for tracing across systems */
  transactionId?: string;

  /** Tenant ID for isolation */
  tenantId?: string;
}

// ─── Workflow Lifecycle Payloads ────────────────────────────

/**
 * Emitted when a workflow execution starts.
 * Event: `workflow:started`
 */
export interface WorkflowStartedPayload extends WorkflowEventBase {
  /** Total number of steps in this workflow */
  totalSteps: number;

  /** Input data passed to the workflow */
  input?: unknown;
}

/**
 * Emitted when a workflow completes successfully.
 * Event: `workflow:completed`
 */
export interface WorkflowCompletedPayload extends WorkflowEventBase {
  /** Total number of steps executed */
  totalSteps: number;

  /** Final output from the workflow */
  output?: unknown;

  /** Total execution time in milliseconds */
  durationMs: number;
}

/**
 * Emitted when a workflow fails (after compensation if applicable).
 * Event: `workflow:failed`
 */
export interface WorkflowFailedPayload extends WorkflowEventBase {
  /** Total number of steps attempted */
  totalSteps: number;

  /** Error message */
  error: string;

  /** Stack trace (optional, for debugging) */
  stack?: string;

  /** Total execution time in milliseconds */
  durationMs: number;

  /** Number of steps that were compensated */
  compensatedSteps?: number;
}

// ─── Step Lifecycle Payloads ────────────────────────────────

/**
 * Emitted when a step execution starts.
 * Event: `workflow:step:started`
 */
export interface StepStartedPayload extends WorkflowEventBase {
  /** Step identifier (unique within workflow) */
  stepId: string;

  /** Human-readable step name */
  stepName: string;

  /** Zero-based index of this step */
  stepIndex: number;

  /** Total number of steps in workflow */
  totalSteps: number;

  /** Input data for this step */
  input?: unknown;
}

/**
 * Emitted when a step completes successfully.
 * Event: `workflow:step:completed`
 */
export interface StepCompletedPayload extends WorkflowEventBase {
  /** Step identifier */
  stepId: string;

  /** Step name */
  stepName: string;

  /** Zero-based index of this step */
  stepIndex: number;

  /** Total number of steps */
  totalSteps: number;

  /** Output from the step */
  output?: unknown;

  /** Step execution time in milliseconds */
  durationMs: number;
}

/**
 * Emitted when a step fails.
 * Event: `workflow:step:failed`
 */
export interface StepFailedPayload extends WorkflowEventBase {
  /** Step identifier */
  stepId: string;

  /** Step name */
  stepName: string;

  /** Zero-based index of this step */
  stepIndex: number;

  /** Total number of steps */
  totalSteps: number;

  /** Error message */
  error: string;

  /** Stack trace (optional) */
  stack?: string;

  /** Step execution time in milliseconds before failure */
  durationMs: number;

  /** Number of retries that will be attempted (if applicable) */
  retriesRemaining?: number;

  /** Whether compensation will be triggered */
  willCompensate: boolean;
}

// ─── Compensation Payloads ──────────────────────────────────

/**
 * Emitted when compensation (rollback) starts.
 * Event: `workflow:compensation:started`
 */
export interface CompensationStartedPayload extends WorkflowEventBase {
  /** Number of steps to compensate (in reverse order) */
  stepsToCompensate: number;

  /** Step that failed, triggering compensation */
  failedStepName: string;

  /** Error that triggered compensation */
  error: string;
}

/**
 * Emitted when compensation completes.
 * Event: `workflow:compensation:completed`
 */
export interface CompensationCompletedPayload extends WorkflowEventBase {
  /** Number of steps that were successfully compensated */
  compensatedCount: number;

  /** Number of steps that failed during compensation */
  failedCount: number;

  /** Total compensation time in milliseconds */
  durationMs: number;

  /** Whether all compensations succeeded */
  success: boolean;

  /** Details of failed compensations (if any) */
  failedSteps?: Array<{
    stepId: string;
    stepName: string;
    error: string;
  }>;
}

// ─── Discriminated Union Type ──────────────────────────────

/**
 * All possible workflow socket events.
 * Use `event` to discriminate and get typed payload.
 */
export type WorkflowSocketEvent =
  | { event: typeof WORKFLOW_EVENTS.WORKFLOW_STARTED; payload: WorkflowStartedPayload }
  | { event: typeof WORKFLOW_EVENTS.WORKFLOW_COMPLETED; payload: WorkflowCompletedPayload }
  | { event: typeof WORKFLOW_EVENTS.WORKFLOW_FAILED; payload: WorkflowFailedPayload }
  | { event: typeof WORKFLOW_EVENTS.STEP_STARTED; payload: StepStartedPayload }
  | { event: typeof WORKFLOW_EVENTS.STEP_COMPLETED; payload: StepCompletedPayload }
  | { event: typeof WORKFLOW_EVENTS.STEP_FAILED; payload: StepFailedPayload }
  | { event: typeof WORKFLOW_EVENTS.COMPENSATION_STARTED; payload: CompensationStartedPayload }
  | { event: typeof WORKFLOW_EVENTS.COMPENSATION_COMPLETED; payload: CompensationCompletedPayload };
