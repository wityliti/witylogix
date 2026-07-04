/**
 * Process Manager type definitions for background worker orchestration.
 *
 * Defines types for worker status tracking, configuration, and health monitoring.
 */

/**
 * Worker execution status.
 */
export type WorkerStatus =
  | "idle"
  | "running"
  | "stopping"
  | "stopped"
  | "error";

/**
 * Worker configuration.
 */
export interface WorkerConfig {
  /** Unique worker name identifier */
  name: string;
  /** Maximum concurrent jobs this worker processes */
  concurrency: number;
  /** Maximum number of retry attempts for failed jobs */
  maxRetries: number;
  /** Delay in milliseconds between retry attempts */
  retryDelay: number;
  /** Job processing timeout in milliseconds */
  timeout: number;
  /** Whether this worker is enabled and should run */
  enabled: boolean;
}

/**
 * Process information for a single worker.
 */
export interface ProcessInfo {
  /** Worker name */
  name: string;
  /** Current status of the worker */
  status: WorkerStatus;
  /** Process ID (if running) */
  pid?: number;
  /** Timestamp when worker started */
  startedAt: number;
  /** Timestamp when worker stopped (if applicable) */
  stoppedAt?: number;
  /** Last error message if worker encountered an error */
  lastError?: string;
  /** Total number of jobs processed */
  jobsProcessed: number;
  /** Total number of jobs that failed */
  jobsFailed: number;
  /** Worker uptime in milliseconds */
  uptime: number;
}

/**
 * Aggregate health check result for all workers.
 */
export interface HealthCheck {
  /** Overall health status (true if all enabled workers are running) */
  healthy: boolean;
  /** Status of individual workers */
  workers: ProcessInfo[];
  /** Timestamp of health check */
  timestamp: number;
}

/**
 * Job processing result returned by workers.
 */
export interface JobResult {
  /** Whether job processing was successful */
  success: boolean;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Optional error information if processing failed */
  error?: {
    message: string;
    retriable: boolean;
  };
  /** Optional output data from successful processing */
  data?: Record<string, unknown>;
}

/**
 * Configuration for process manager initialization.
 */
export interface ProcessManagerConfig {
  /** Graceful shutdown timeout in milliseconds */
  shutdownTimeoutMs: number;
  /** Whether to drain queues during shutdown */
  drainQueues: boolean;
  /** Enable auto-restart for failed workers */
  autoRestart: boolean;
  /** Initial backoff delay for worker restart (milliseconds) */
  restartBackoffMs: number;
  /** Maximum backoff delay for worker restart (milliseconds) */
  restartMaxBackoffMs: number;
}

/**
 * Event callback type for worker errors.
 */
export type WorkerErrorCallback = (
  workerName: string,
  error: Error,
  jobInfo?: Record<string, unknown>,
) => void;
