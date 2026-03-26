/**
 * @witylogix/framework/types — Core workflow engine type definitions
 *
 * Defines the contract for workflow steps, execution, compensation, and hooks.
 * Inspired by Medusa v2 workflows and Temporal.io semantics.
 *
 * Key concepts:
 * - WorkflowStep: Atomic unit of work with invoke + compensate logic
 * - WorkflowContext: Shared runtime context (tenant, user, logger, etc.)
 * - StepResult: Typed success/failure outcome
 * - WorkflowExecution: Runtime state tracking for a workflow instance
 * - Compensation: Undo logic run in reverse order on failure
 */

// ─────────────────────────────────────────────────────────────────────────────
// LOGGING & CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, err?: Error | Record<string, unknown>): void;
}

/**
 * Shared context passed to all workflow steps.
 * Provides access to tenant database, user identity, logging, and metadata.
 */
export interface WorkflowContext {
  /** Tenant-scoped Prisma client (RLS enforced) */
  tenantDb: any;

  /** Global Prisma client (admin/system operations) */
  prisma: any;

  /** Current user ID initiating the workflow */
  userId: string;

  /** Current tenant/shop ID */
  tenantId: string;

  /** Structured logger for debugging and audit trails */
  logger: Logger;

  /** Arbitrary metadata (e.g., request headers, correlation IDs) */
  metadata: Record<string, unknown>;

  /** Transaction/request ID for tracing */
  transactionId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result of a single step execution.
 * Discriminated union: either success with data, or failure with error.
 */
export type StepResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: Error };

/**
 * Input handler for a step.
 * Transforms upstream output into step input, or uses context directly.
 */
export type StepInputHandler<TUpstream, TInput> = (
  upstreamOutput: TUpstream,
  context: WorkflowContext
) => TInput | Promise<TInput>;

/**
 * The executable work of a step.
 * Pure function: given input and context, returns output or throws.
 */
export type StepInvokeHandler<TInput, TOutput> = (
  input: TInput,
  context: WorkflowContext
) => TOutput | Promise<TOutput>;

/**
 * Compensation handler: undo work from invoke.
 * Called during rollback. Must be idempotent (safe to retry).
 */
export type StepCompensateHandler<TOutput> = (
  output: TOutput,
  context: WorkflowContext
) => void | Promise<void>;

/**
 * Configuration for a single workflow step.
 * Defines invoke logic, compensation, retries, and timeout.
 */
export interface WorkflowStep<TInput = unknown, TOutput = unknown> {
  /** Unique identifier within the workflow */
  id: string;

  /** Human-readable name for logging/monitoring */
  name: string;

  /** The work to execute */
  invoke: StepInvokeHandler<TInput, TOutput>;

  /** Undo logic (optional). Called in reverse order on failure. */
  compensate?: StepCompensateHandler<TOutput>;

  /** Number of retries on transient failure (default: 0) */
  retries?: number;

  /** Timeout in milliseconds for this step (default: 30000) */
  timeout?: number;

  /** If true, step failure does not stop the workflow (default: false) */
  optional?: boolean;

  /** Metadata about the step for monitoring/tracing */
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW DEFINITION & EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Workflow execution status.
 */
export enum WorkflowStatus {
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  COMPENSATING = "compensating",
  COMPENSATED = "compensated",
}

/**
 * Per-step execution snapshot.
 */
export interface WorkflowStepExecution {
  stepId: string;
  stepName: string;
  status: WorkflowStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  retriesUsed: number;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
}

/**
 * Complete execution record for a workflow instance.
 * Tracks state, step results, and timestamps.
 */
export interface WorkflowExecution {
  /** Unique execution ID */
  id: string;

  /** Workflow name (from definition) */
  workflowName: string;

  /** Overall status: running → completed | failed | compensating → compensated */
  status: WorkflowStatus;

  /** Input to the entire workflow */
  input: unknown;

  /** Final output of the workflow (on success) */
  output?: unknown;

  /** Per-step execution records */
  steps: WorkflowStepExecution[];

  /** Overall workflow error (on failure) */
  error?: Error;

  /** When execution started */
  startedAt: Date;

  /** When execution ended (on completion, failure, or compensation) */
  completedAt?: Date;

  /** How long the entire workflow took (in ms) */
  durationMs?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS & OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lifecycle hook: runs before workflow execution starts.
 */
export type BeforeWorkflowHook = (
  name: string,
  input: unknown,
  context: WorkflowContext
) => void | Promise<void>;

/**
 * Lifecycle hook: runs after workflow execution completes (success or failure).
 */
export type AfterWorkflowHook = (
  execution: WorkflowExecution,
  context: WorkflowContext
) => void | Promise<void>;

/**
 * Lifecycle hook: runs before a step executes.
 */
export type BeforeStepHook = (
  step: WorkflowStep,
  input: unknown,
  context: WorkflowContext
) => void | Promise<void>;

/**
 * Lifecycle hook: runs after a step completes (success or failure).
 */
export type AfterStepHook = (
  stepExecution: WorkflowStepExecution,
  context: WorkflowContext
) => void | Promise<void>;

/**
 * Hook collection for a workflow.
 */
export interface WorkflowHooks {
  beforeWorkflow?: BeforeWorkflowHook;
  afterWorkflow?: AfterWorkflowHook;
  beforeStep?: BeforeStepHook;
  afterStep?: AfterStepHook;
}

/**
 * Execution options for a workflow instance.
 */
export interface WorkflowExecutionOptions {
  /** Number of retries on failure (default: 0) */
  retries?: number;

  /** Timeout in milliseconds for the entire workflow (default: no limit) */
  timeout?: number;

  /** If true, allow async steps to run concurrently (default: false) */
  async?: boolean;

  /** Custom execution ID (if not provided, generated) */
  executionId?: string;

  /** Additional metadata to attach to this execution */
  metadata?: Record<string, unknown>;
}

/**
 * Complete definition of a workflow.
 * Reusable template for creating workflow instances.
 */
export interface WorkflowDefinition {
  /** Unique name for this workflow */
  name: string;

  /** Ordered array of steps to execute */
  steps: WorkflowStep[];

  /** Lifecycle hooks */
  hooks?: WorkflowHooks;

  /** Default execution options */
  options?: WorkflowExecutionOptions;

  /** Description for documentation/monitoring */
  description?: string;

  /** Version tag */
  version?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENTS & MONITORING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Workflow execution event.
 * Emitted by the engine for monitoring, tracing, and audit logs.
 */
export interface WorkflowEvent {
  type:
    | "workflow:started"
    | "workflow:completed"
    | "workflow:failed"
    | "workflow:compensating"
    | "workflow:compensated"
    | "step:started"
    | "step:completed"
    | "step:failed"
    | "step:retrying"
    | "compensation:started"
    | "compensation:completed"
    | "compensation:failed";

  workflowName: string;
  executionId: string;
  stepId?: string;
  stepName?: string;
  timestamp: Date;
  data?: Record<string, unknown>;
  error?: Error;
}

/**
 * Listener for workflow events.
 */
export type WorkflowEventListener = (event: WorkflowEvent) => void | Promise<void>;
