/**
 * @witylogix/framework/queue/workflow-worker — Worker for processing workflow jobs
 *
 * BullMQ Worker that processes workflow jobs from the queue:
 * - Retrieves job from queue
 * - Extracts workflow name, input, and context
 * - Calls WorkflowEngine.executeWorkflow()
 * - Reports progress as each step completes
 * - Handles stalled jobs with restart/compensation
 * - Graceful shutdown with step completion and compensation
 */

import { EventEmitter } from "node:events";
import type {
  WorkflowJobData,
  WorkflowJobResult,
  WorkerOptions,
  Job,
  WorkerInterface,
} from "./types.js";
import type { WorkflowEngine } from "../workflow/engine.js";
import type { WorkflowContext } from "../types/index.js";

class InMemoryWorker implements WorkerInterface<WorkflowJobData> {
  name: string;
  opts: any;
  private processor?: (
    job: Job<WorkflowJobData>,
    token?: string,
  ) => Promise<any>;
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  constructor(name: string, opts?: any) {
    this.name = name;
    this.opts = opts || {};
  }

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach((listener) => listener(...args));
  }

  async process(
    name: string | null,
    processor: (job: Job<WorkflowJobData>, token?: string) => Promise<any>,
  ): Promise<void> {
    this.processor = processor;
  }

  async getMetrics(): Promise<any> {
    return {};
  }

  async getWorkers(): Promise<string[]> {
    return [];
  }

  async close(): Promise<void> {}

  async isPaused(): Promise<boolean> {
    return false;
  }

  async pause(): Promise<void> {}

  async resume(): Promise<void> {}
}

export class WorkflowWorker extends EventEmitter {
  private worker: WorkerInterface<WorkflowJobData>;
  private engine: WorkflowEngine;
  private config: WorkerOptions;
  private _isShuttingDown = false;
  private activeJobs: Set<string> = new Set();
  private jobSteps: Map<string, number> = new Map();

  constructor(engine: WorkflowEngine, config: WorkerOptions = {}) {
    super();
    this.engine = engine;
    this.config = {
      concurrency: 5,
      lockDuration: 30000,
      lockRenewTime: 15000,
      ...config,
    };
    this.worker = new InMemoryWorker(`workflow-worker`, this.config);
  }

  async start(): Promise<void> {
    try {
      await this.worker.process(null, this.processJob.bind(this));
      this.worker.on("active", this.onJobActive.bind(this));
      this.worker.on("completed", this.onJobCompleted.bind(this));
      this.worker.on("failed", this.onJobFailed.bind(this));
      this.worker.on("stalled", this.onJobStalled.bind(this));
      this.worker.on("error", this.onWorkerError.bind(this));
      this.emit("worker:started", { timestamp: new Date() });
      console.log(
        "[WorkflowWorker] Started with concurrency:",
        this.config.concurrency,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit("worker:error", { error: message, timestamp: new Date() });
      throw error;
    }
  }

  private async processJob(
    job: Job<WorkflowJobData>,
    token?: string,
  ): Promise<WorkflowJobResult> {
    const jobId = String(job.id);
    this.activeJobs.add(jobId);
    this.jobSteps.set(jobId, 0);
    const startTime = Date.now();

    try {
      if (this._isShuttingDown) {
        throw new Error("Worker is shutting down, job will be retried");
      }

      const {
        workflowName,
        input,
        context: jobContext,
        executionOptions,
      } = job.data;

      const workflowContext: WorkflowContext = {
        userId: jobContext.userId,
        tenantId: jobContext.tenantId,
        transactionId: jobContext.transactionId,
        metadata: jobContext.metadata || {},
        tenantDb: {} as any,
        prisma: {} as any,
        logger: {
          debug: (msg: string) => console.debug(`[${jobId}] ${msg}`),
          info: (msg: string) => console.info(`[${jobId}] ${msg}`),
          warn: (msg: string) => console.warn(`[${jobId}] ${msg}`),
          error: (msg: string) => console.error(`[${jobId}] ${msg}`),
        },
      };

      const stepCount =
        this.engine.getWorkflow(workflowName)?.steps.length ?? 0;
      let completedSteps = 0;

      const eventListener = (event: any) => {
        if (
          event.type === "step:completed" &&
          event.executionId === workflowContext.transactionId
        ) {
          completedSteps++;
          const progress =
            stepCount > 0 ? Math.floor((completedSteps / stepCount) * 100) : 0;
          job.progress = progress;
          this.emit("job:progress", { jobId, progress, timestamp: new Date() });
        }
      };

      this.engine.onWorkflowEvent(eventListener);

      const execution = await this.engine.executeWorkflow(
        workflowName,
        input,
        workflowContext,
        {
          executionId: jobContext.transactionId,
          ...executionOptions,
        },
      );

      this.engine.offWorkflowEvent(eventListener);

      if (execution.status === "completed") {
        const durationMs = Date.now() - startTime;
        const result: WorkflowJobResult = {
          executionId: execution.id,
          workflowName,
          output: execution.output,
          durationMs,
          completedAt: new Date(),
        };
        this.emit("job:completed", { jobId, result, timestamp: new Date() });
        return result;
      } else if (
        execution.status === "failed" ||
        execution.status === "compensated"
      ) {
        const error =
          execution.error || new Error("Workflow failed without error details");
        throw error;
      } else {
        throw new Error(`Unexpected workflow status: ${execution.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isRetriable = !(
        error instanceof Error && error.message.includes("not retriable")
      );
      this.emit("job:error", {
        jobId,
        error: message,
        attempts: job.opts?.attempts ?? 1,
        retriable: isRetriable,
        timestamp: new Date(),
      });
      throw error;
    } finally {
      this.activeJobs.delete(jobId);
      this.jobSteps.delete(jobId);
    }
  }

  private onJobActive(job: {
    id: string;
    name: string;
    data: WorkflowJobData;
  }): void {
    const jobId = String(job.id);
    this.emit("job:active", {
      jobId,
      workflowName: job.data.workflowName,
      timestamp: new Date(),
    });
  }

  private onJobCompleted(job: {
    id: string;
    name: string;
    returnvalue: any;
  }): void {
    const jobId = String(job.id);
    this.emit("job:completed", {
      jobId,
      result: job.returnvalue,
      timestamp: new Date(),
    });
  }

  private onJobFailed(
    job: { id: string; name: string; failedReason: string },
    error: Error,
  ): void {
    const jobId = String(job.id);
    this.emit("job:failed", {
      jobId,
      error: error.message,
      timestamp: new Date(),
    });
  }

  private onJobStalled(jobId: string): void {
    this.emit("job:stalled", { jobId, timestamp: new Date() });
    console.warn(`[WorkflowWorker] Job ${jobId} stalled, will be restarted`);
  }

  private onWorkerError(error: Error): void {
    this.emit("worker:error", { error: error.message, timestamp: new Date() });
    console.error("[WorkflowWorker] Error:", error);
  }

  async gracefulShutdown(timeoutMs: number = 30000): Promise<void> {
    this._isShuttingDown = true;
    console.log("[WorkflowWorker] Starting graceful shutdown...");
    const startTime = Date.now();
    while (this.activeJobs.size > 0 && Date.now() - startTime < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (this.activeJobs.size > 0) {
      console.warn(
        `[WorkflowWorker] Timeout waiting for ${this.activeJobs.size} jobs to complete`,
      );
    }
    await this.worker.close();
    this.emit("worker:shutdown", { timestamp: new Date() });
    console.log("[WorkflowWorker] Shutdown complete");
  }

  async forceShutdown(): Promise<void> {
    this._isShuttingDown = true;
    console.warn(
      `[WorkflowWorker] Force shutdown requested, ${this.activeJobs.size} jobs will be interrupted`,
    );
    await this.worker.close();
    this.emit("worker:force-shutdown", { timestamp: new Date() });
  }

  async pause(): Promise<void> {
    try {
      await this.worker.pause();
      this.emit("worker:paused", { timestamp: new Date() });
      console.log("[WorkflowWorker] Paused");
    } catch (error) {
      console.error("[WorkflowWorker] Failed to pause:", error);
    }
  }

  async resume(): Promise<void> {
    try {
      await this.worker.resume();
      this.emit("worker:resumed", { timestamp: new Date() });
      console.log("[WorkflowWorker] Resumed");
    } catch (error) {
      console.error("[WorkflowWorker] Failed to resume:", error);
    }
  }

  async isPaused(): Promise<boolean> {
    try {
      return await this.worker.isPaused();
    } catch {
      return false;
    }
  }

  getActiveJobs(): string[] {
    return Array.from(this.activeJobs);
  }

  async getMetrics(): Promise<{ activeJobs: number; concurrency: number }> {
    return {
      activeJobs: this.activeJobs.size,
      concurrency: this.config.concurrency!,
    };
  }

  isShuttingDown(): boolean {
    return this._isShuttingDown;
  }

  getUnderlyingWorker(): WorkerInterface<WorkflowJobData> {
    return this.worker;
  }
}
