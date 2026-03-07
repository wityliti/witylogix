/**
 * @witylogix/workflows — Core workflow types
 * Defines the WorkflowStep interface and execution context
 */

type PrismaClient = any;

/**
 * Result returned from a workflow step invoke
 */
export interface StepResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Context available to workflow steps
 */
export interface WorkflowContext {
  prisma: PrismaClient;
  shopId?: string;
  orgId?: string;
  userId?: string;
  logger?: {
    info(msg: string, meta?: Record<string, any>): void;
    error(msg: string, meta?: Record<string, any>): void;
    warn(msg: string, meta?: Record<string, any>): void;
    debug(msg: string, meta?: Record<string, any>): void;
  };
  /** Additional context passed between workflow steps */
  metadata?: Record<string, any>;
}

/**
 * Definition of a reusable workflow step
 * Steps are composable units of work with forward and compensating transactions
 */
export interface WorkflowStep<Input = any, Output = any> {
  name: string;
  description?: string;

  /**
   * Main step logic
   * Performs the business operation and returns the result
   */
  invoke(input: Input, context: WorkflowContext): Promise<StepResult<Output>>;

  /**
   * Compensation logic (saga pattern)
   * Reverts side effects if a later step fails
   * Optional: some steps don't need compensation (pure reads)
   */
  compensate?(input: Input, context: WorkflowContext): Promise<void>;
}

/**
 * Workflow execution state
 */
export interface WorkflowState {
  id: string;
  name: string;
  status: "pending" | "running" | "succeeded" | "failed" | "compensating";
  steps: StepExecutionRecord[];
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Record of a single step execution
 */
export interface StepExecutionRecord {
  stepName: string;
  status: "pending" | "succeeded" | "failed" | "compensated";
  input: any;
  output?: any;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Logger interface with reasonable defaults
 */
export function createDefaultLogger(prefix = "WORKFLOW") {
  return {
    info: (msg: string, meta?: Record<string, any>) => {
      console.log(`[${prefix}] INFO: ${msg}`, meta || "");
    },
    error: (msg: string, meta?: Record<string, any>) => {
      console.error(`[${prefix}] ERROR: ${msg}`, meta || "");
    },
    warn: (msg: string, meta?: Record<string, any>) => {
      console.warn(`[${prefix}] WARN: ${msg}`, meta || "");
    },
    debug: (msg: string, meta?: Record<string, any>) => {
      if (process.env.NODE_ENV === "development") {
        console.debug(`[${prefix}] DEBUG: ${msg}`, meta || "");
      }
    },
  };
}
