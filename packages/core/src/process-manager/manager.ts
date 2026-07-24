/**
 * Process Manager — orchestrates all background workers.
 *
 * Responsibilities:
 *   • Register and manage worker lifecycle
 *   • Start/stop workers with graceful shutdown
 *   • Auto-restart failed workers with exponential backoff
 *   • Monitor worker health and provide status
 *   • Handle SIGTERM/SIGINT for graceful shutdown
 */

import type {
  WorkerStatus,
  WorkerConfig,
  ProcessInfo,
  HealthCheck,
  JobResult,
  ProcessManagerConfig,
  WorkerErrorCallback,
} from "./types.js";

/**
 * Worker factory function type — creates a worker instance.
 */
type WorkerFactory = (prisma: any, redis: any) => BaseWorker;

/**
 * Base worker abstract class that all workers extend.
 */
export abstract class BaseWorker {
  protected config: WorkerConfig;
  protected status: WorkerStatus = "idle";
  protected startedAt: number = 0;
  protected stoppedAt: number = 0;
  protected jobsProcessed = 0;
  protected jobsFailed = 0;
  protected isShuttingDown = false;

  constructor(
    protected prisma: any,
    protected redis: any,
    config: Partial<WorkerConfig>,
  ) {
    this.config = {
      name: config.name || "unknown",
      concurrency: config.concurrency || 1,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      timeout: config.timeout || 30000,
      enabled: config.enabled !== false,
    };
  }

  /**
   * Start the worker.
   */
  async start(): Promise<void> {
    this.status = "running";
    this.startedAt = Date.now();
    this.stoppedAt = 0;
    console.log(
      JSON.stringify({
        worker: this.config.name,
        status: "started",
        timestamp: new Date().toISOString(),
      }),
    );
  }

  /**
   * Stop the worker gracefully.
   */
  async stop(graceful: boolean = true): Promise<void> {
    this.isShuttingDown = true;
    this.status = "stopping";

    if (graceful) {
      // Wait for in-flight jobs to complete (implementation varies per worker)
      await this.drainJobs();
    }

    this.status = "stopped";
    this.stoppedAt = Date.now();
    console.log(
      JSON.stringify({
        worker: this.config.name,
        status: "stopped",
        uptime: this.getUptime(),
        timestamp: new Date().toISOString(),
      }),
    );
  }

  /**
   * Process a single job. Must be implemented by subclasses.
   */
  abstract processJob(job: any): Promise<JobResult>;

  /**
   * Drain in-flight jobs during shutdown.
   */
  protected async drainJobs(): Promise<void> {
    // Override in subclass if needed
  }

  /**
   * Get current process info.
   */
  getProcessInfo(): ProcessInfo {
    const now = Date.now();
    return {
      name: this.config.name,
      status: this.status,
      pid: process.pid,
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt || undefined,
      lastError: undefined,
      jobsProcessed: this.jobsProcessed,
      jobsFailed: this.jobsFailed,
      uptime:
        this.status === "running" ? now - this.startedAt : this.getUptime(),
    };
  }

  /**
   * Get uptime in milliseconds.
   */
  protected getUptime(): number {
    if (this.status === "running") {
      return Date.now() - this.startedAt;
    }
    return this.stoppedAt > this.startedAt
      ? this.stoppedAt - this.startedAt
      : 0;
  }

  /**
   * Record successful job.
   */
  protected recordSuccess(): void {
    this.jobsProcessed++;
  }

  /**
   * Record failed job.
   */
  protected recordFailure(): void {
    this.jobsFailed++;
  }

  /**
   * Get worker config.
   */
  getConfig(): WorkerConfig {
    return { ...this.config };
  }

  /**
   * Get worker status.
   */
  getStatus(): WorkerStatus {
    return this.status;
  }

  /**
   * Check if worker is running.
   */
  isRunning(): boolean {
    return this.status === "running";
  }
}

/**
 * Process Manager — orchestrates background worker lifecycle.
 */
export class ProcessManager {
  private workers: Map<string, BaseWorker> = new Map();
  private workerFactories: Map<string, WorkerFactory> = new Map();
  private config: ProcessManagerConfig;
  private shutdownHandlers: Set<() => Promise<void>> = new Set();
  private errorCallbacks: Map<string, WorkerErrorCallback[]> = new Map();
  private restartBackoffs: Map<string, number> = new Map();
  private restartIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isShuttingDown = false;

  /**
   * Initialize the process manager.
   */
  constructor(
    private prisma: any,
    private redis: any,
    config: Partial<ProcessManagerConfig> = {},
  ) {
    this.config = {
      shutdownTimeoutMs: config.shutdownTimeoutMs || 30000,
      drainQueues: config.drainQueues !== false,
      autoRestart: config.autoRestart !== false,
      restartBackoffMs: config.restartBackoffMs || 1000,
      restartMaxBackoffMs: config.restartMaxBackoffMs || 30000,
    };

    this.setupSignalHandlers();
  }

  /**
   * Register a worker factory.
   */
  registerWorker(name: string, factory: WorkerFactory): void {
    if (this.workerFactories.has(name)) {
      throw new Error(`Worker "${name}" already registered`);
    }
    this.workerFactories.set(name, factory);
  }

  /**
   * Start all registered and enabled workers.
   */
  async startAll(): Promise<void> {
    console.log(
      JSON.stringify({
        manager: "ProcessManager",
        action: "startAll",
        timestamp: new Date().toISOString(),
      }),
    );

    for (const [name, factory] of this.workerFactories.entries()) {
      try {
        const worker = factory(this.prisma, this.redis);
        const config = worker.getConfig();

        if (!config.enabled) {
          console.log(
            JSON.stringify({
              manager: "ProcessManager",
              worker: name,
              status: "disabled",
              timestamp: new Date().toISOString(),
            }),
          );
          continue;
        }

        this.workers.set(name, worker);
        await worker.start();
      } catch (error) {
        console.error(
          JSON.stringify({
            manager: "ProcessManager",
            worker: name,
            action: "startAll",
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          }),
        );
      }
    }
  }

  /**
   * Stop all workers gracefully.
   */
  async stopAll(graceful: boolean = true): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    console.log(
      JSON.stringify({
        manager: "ProcessManager",
        action: "stopAll",
        graceful,
        timestamp: new Date().toISOString(),
      }),
    );

    const shutdownPromises: Promise<void>[] = [];

    for (const [name, worker] of this.workers.entries()) {
      try {
        shutdownPromises.push(worker.stop(graceful));
      } catch (error) {
        console.error(
          JSON.stringify({
            manager: "ProcessManager",
            worker: name,
            action: "stopAll",
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          }),
        );
      }
    }

    // Clear restart intervals
    for (const interval of this.restartIntervals.values()) {
      clearInterval(interval);
    }
    this.restartIntervals.clear();

    await Promise.all(shutdownPromises);

    // Execute any shutdown handlers
    for (const handler of this.shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        console.error(
          JSON.stringify({
            manager: "ProcessManager",
            action: "shutdownHandler",
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          }),
        );
      }
    }
  }

  /**
   * Restart a single worker.
   */
  async restartWorker(name: string): Promise<void> {
    const worker = this.workers.get(name);
    if (!worker) {
      throw new Error(`Worker "${name}" not found`);
    }

    console.log(
      JSON.stringify({
        manager: "ProcessManager",
        action: "restartWorker",
        worker: name,
        timestamp: new Date().toISOString(),
      }),
    );

    try {
      await worker.stop(true);
      const factory = this.workerFactories.get(name);
      if (factory) {
        const newWorker = factory(this.prisma, this.redis);
        this.workers.set(name, newWorker);
        await newWorker.start();
        this.restartBackoffs.delete(name);
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          manager: "ProcessManager",
          action: "restartWorker",
          worker: name,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        }),
      );
      throw error;
    }
  }

  /**
   * Get status of all workers.
   */
  getStatus(): HealthCheck {
    const workers: ProcessInfo[] = [];
    const now = Date.now();

    for (const worker of this.workers.values()) {
      workers.push(worker.getProcessInfo());
    }

    const healthy = workers.every((w) => w.status === "running" || !w.status);

    return {
      healthy,
      workers,
      timestamp: now,
    };
  }

  /**
   * Get status of a single worker.
   */
  getWorkerStatus(name: string): ProcessInfo | null {
    const worker = this.workers.get(name);
    if (!worker) {
      return null;
    }
    return worker.getProcessInfo();
  }

  /**
   * Enable a worker at runtime.
   */
  async enableWorker(name: string): Promise<void> {
    const factory = this.workerFactories.get(name);
    if (!factory) {
      throw new Error(`Worker "${name}" not registered`);
    }

    let worker = this.workers.get(name);
    if (!worker || !worker.isRunning()) {
      worker = factory(this.prisma, this.redis);
      this.workers.set(name, worker);
      await worker.start();
    }

    console.log(
      JSON.stringify({
        manager: "ProcessManager",
        action: "enableWorker",
        worker: name,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  /**
   * Disable a worker at runtime.
   */
  async disableWorker(name: string): Promise<void> {
    const worker = this.workers.get(name);
    if (!worker) {
      throw new Error(`Worker "${name}" not found`);
    }

    await worker.stop(true);

    console.log(
      JSON.stringify({
        manager: "ProcessManager",
        action: "disableWorker",
        worker: name,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  /**
   * Register error callback for a worker.
   */
  onWorkerError(name: string, callback: WorkerErrorCallback): void {
    if (!this.errorCallbacks.has(name)) {
      this.errorCallbacks.set(name, []);
    }
    this.errorCallbacks.get(name)!.push(callback);
  }

  /**
   * Emit error for all registered callbacks.
   */
  protected emitWorkerError(
    name: string,
    error: Error,
    jobInfo?: Record<string, unknown>,
  ): void {
    const callbacks = this.errorCallbacks.get(name) || [];
    for (const callback of callbacks) {
      try {
        callback(name, error, jobInfo);
      } catch (err) {
        console.error(
          JSON.stringify({
            manager: "ProcessManager",
            action: "emitWorkerError",
            error: err instanceof Error ? err.message : String(err),
            timestamp: new Date().toISOString(),
          }),
        );
      }
    }
  }

  /**
   * Health check for the system.
   */
  healthCheck(): HealthCheck {
    return this.getStatus();
  }

  /**
   * Setup SIGTERM/SIGINT signal handlers.
   */
  private setupSignalHandlers(): void {
    const shutdown = async (signal: string) => {
      console.log(
        JSON.stringify({
          manager: "ProcessManager",
          signal,
          action: "gracefulShutdown",
          timestamp: new Date().toISOString(),
        }),
      );

      try {
        await this.stopAll(this.config.drainQueues);
        process.exit(0);
      } catch (error) {
        console.error(
          JSON.stringify({
            manager: "ProcessManager",
            signal,
            action: "gracefulShutdown",
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          }),
        );
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }

  /**
   * Register a shutdown handler.
   */
  onShutdown(handler: () => Promise<void>): void {
    this.shutdownHandlers.add(handler);
  }

  /**
   * Auto-restart a failed worker with exponential backoff.
   */
  protected async autoRestartWorker(name: string): Promise<void> {
    if (!this.config.autoRestart) {
      return;
    }

    const currentBackoff =
      this.restartBackoffs.get(name) || this.config.restartBackoffMs;
    const nextBackoff = Math.min(
      currentBackoff * 2,
      this.config.restartMaxBackoffMs,
    );

    this.restartBackoffs.set(name, nextBackoff);

    console.log(
      JSON.stringify({
        manager: "ProcessManager",
        worker: name,
        action: "scheduleRestart",
        delayMs: currentBackoff,
        timestamp: new Date().toISOString(),
      }),
    );

    // Clear any existing restart interval
    const existingInterval = this.restartIntervals.get(name);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    const interval = setTimeout(async () => {
      if (this.isShuttingDown) {
        return;
      }

      try {
        await this.restartWorker(name);
      } catch (error) {
        console.error(
          JSON.stringify({
            manager: "ProcessManager",
            worker: name,
            action: "autoRestart",
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          }),
        );
        // Schedule another restart attempt
        await this.autoRestartWorker(name);
      }
    }, currentBackoff);

    this.restartIntervals.set(name, interval as any);
  }
}
