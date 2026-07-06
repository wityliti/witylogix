/**
 * @witylogix/framework/queue/types — Queue and worker type definitions
 *
 * Defines types for BullMQ-based workflow queue, including job data, results,
 * configuration, and dead-letter queue handling.
 */

export interface WorkflowJobData {
  workflowName: string;
  input: unknown;
  context: {
    userId: string;
    tenantId: string;
    transactionId: string;
    metadata?: Record<string, unknown>;
  };
  executionOptions?: {
    timeout?: number;
    retries?: number;
    async?: boolean;
  };
}

export interface WorkflowJobResult {
  executionId: string;
  workflowName: string;
  output?: unknown;
  durationMs: number;
  completedAt: Date;
}

export interface QueueConfig {
  connection?: {
    host?: string;
    port?: number;
    db?: number;
    password?: string;
  };
  queueName?: string;
  defaultJobOptions?: {
    attempts?: number;
    backoff?: {
      type: "fixed" | "exponential";
      delay?: number;
    };
    timeout?: number;
    removeOnComplete?: boolean | { age?: number };
    removeOnFail?: boolean;
  };
  prefix?: string;
}

export interface ScheduleConfig {
  name: string;
  workflowName: string;
  input: unknown;
  cron: string;
  timezone?: string;
  limit?: number;
  active?: boolean;
}

export interface WorkerOptions {
  connection?: {
    host?: string;
    port?: number;
    db?: number;
    password?: string;
  };
  concurrency?: number;
  prefix?: string;
  lockDuration?: number;
  lockRenewTime?: number;
}

export interface DeadLetterEntry {
  id: string;
  jobId?: string;
  workflowName: string;
  input: unknown;
  error: {
    message: string;
    code?: string;
    stack?: string;
  };
  attempts: number;
  failedAt?: string;
  timestamp: Date;
  jobData?: unknown;
}

export interface Job<T = any> {
  id?: string | number;
  name: string;
  data: T;
  progress: number | object;
  opts?: any;
  parentKey?: string;
  parent?: Job;
  log(row: string): Promise<number>;
  updateData(data: T): Promise<void>;
  remove(): Promise<void>;
  retry(state?: "completed" | "failed"): Promise<void>;
  discard(): Promise<void>;
  isActive(): Promise<boolean>;
  isFailed(): Promise<boolean>;
  isCompleted(): Promise<boolean>;
  isDelayed(): Promise<boolean>;
  isWaiting(): Promise<boolean>;
  getState(): Promise<string>;
  getProgress(): Promise<number | object>;
  logs(
    start?: number,
    end?: number,
    asc?: boolean,
  ): Promise<Array<{ msg: string; timestamp: number }>>;
  getChildrenValues(): Promise<object>;
  waitUntilFinished(listener: any, timeout?: number): Promise<any>;
  releaseLock(token: string): Promise<boolean>;
  extendLock(token: string, duration: number): Promise<string>;
  moveToFailed(err: Error, token: string): Promise<string>;
  moveToCompleted(
    returnvalue: any,
    token: string,
    fetchNext?: boolean,
  ): Promise<Job | any[]>;
}

export interface QueueInterface<T = any> {
  name: string;
  opts: any;
  add(name: string, data: T, opts?: any): Promise<Job<T>>;
  addBulk(
    jobs: Array<{ name: string; data: T; opts?: any }>,
  ): Promise<Job<T>[]>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  count(): Promise<number>;
  getJobCounts(types?: string[]): Promise<{ [key: string]: number }>;
  getJob(jobId: string | number): Promise<Job<T> | undefined>;
  getJobs(types: string[], start?: number, end?: number): Promise<Job<T>[]>;
  clean(grace: number, limit?: number, types?: string[]): Promise<number[]>;
  close(): Promise<void>;
  drain(): Promise<void>;
}

export interface WorkerInterface<T = any> {
  name: string;
  opts: any;
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  process(
    name: string | null,
    processor: (job: Job<T>, token?: string) => Promise<any>,
  ): Promise<void>;
  getMetrics(): Promise<any>;
  getWorkers(): Promise<string[]>;
  close(force?: boolean): Promise<void>;
  isPaused(): Promise<boolean>;
  pause(): Promise<void>;
  resume(): Promise<void>;
}

export interface SchedulerInterface {
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  close(): Promise<void>;
}

export interface QueueEventsInterface {
  on(event: string, listener: (args: any) => void): void;
  off(event: string, listener: (args: any) => void): void;
  close(): Promise<void>;
}

export interface JobProgressEvent {
  jobId: string;
  progress: number;
  data?: unknown;
}

export interface JobCompletedEvent {
  jobId: string;
  result: WorkflowJobResult;
}

export interface JobFailedEvent {
  jobId: string;
  error: Error;
  attempts: number;
  maxAttempts: number;
}
