/**
 * Base QueueConsumer class for message processing with BullMQ.
 *
 * Features:
 *   • Retry with exponential backoff
 *   • Dead letter queue handling
 *   • Graceful shutdown with job draining
 *   • Concurrency control and rate limiting
 *   • Metrics reporting and monitoring
 *   • Error tracking and alerting
 */

import type {
  QueueJobPayload,
  QueueJobMetadata,
  JobProcessingResult,
  QueueMetrics,
  ShutdownOptions,
  ConsumerConfig,
} from "./types.js";

/**
 * Custom error class for queue processing failures.
 */
export class QueueConsumerError extends Error {
  constructor(
    message: string,
    public code: string,
    public retriable: boolean = true,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "QueueConsumerError";
  }
}

/**
 * Custom error for validation failures.
 */
export class QueueValidationError extends QueueConsumerError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", false, details);
    this.name = "QueueValidationError";
  }
}

/**
 * Custom error for temporary failures (retriable).
 */
export class QueueTransientError extends QueueConsumerError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "TRANSIENT_ERROR", true, details);
    this.name = "QueueTransientError";
  }
}

/**
 * Custom error for permanent failures (not retriable).
 */
export class QueuePermanentError extends QueueConsumerError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "PERMANENT_ERROR", false, details);
    this.name = "QueuePermanentError";
  }
}

/**
 * Base queue consumer class implementing BullMQ worker pattern.
 *
 * Subclass this to implement specific job handlers. Override `process()` method.
 */
export abstract class QueueConsumer {
  protected config: ConsumerConfig;
  protected metrics: Map<string, unknown> = new Map();
  protected isShuttingDown = false;
  protected activeJobCount = 0;

  /**
   * Initialize the queue consumer with configuration.
   */
  constructor(config: ConsumerConfig) {
    this.config = config;
    this.initializeMetrics();
  }

  /**
   * Initialize metrics tracking structures.
   */
  private initializeMetrics(): void {
    this.metrics.set("activeCount", 0);
    this.metrics.set("waitingCount", 0);
    this.metrics.set("completedCount", 0);
    this.metrics.set("failedCount", 0);
    this.metrics.set("delayedCount", 0);
    this.metrics.set("totalProcessingTimeMs", 0);
    this.metrics.set("processingTimes", [] as number[]);
    this.metrics.set("peakConcurrency", 0);
  }

  /**
   * Abstract method to process a job. Implement in subclass.
   *
   * @param job The job payload to process
   * @param metadata Metadata about the job attempt
   * @returns Processing result with success/error information
   * @throws QueueConsumerError for non-retriable failures
   */
  abstract process(
    job: QueueJobPayload,
    metadata: QueueJobMetadata,
  ): Promise<JobProcessingResult>;

  /**
   * Validate job payload structure and required fields.
   * Override in subclass for custom validation.
   *
   * @param job Job payload to validate
   * @throws QueueValidationError if validation fails
   */
  protected async validateJob(job: QueueJobPayload): Promise<void> {
    if (!job || !job.type) {
      throw new QueueValidationError("Job missing required 'type' field");
    }

    // Basic type-specific validations
    switch (job.type) {
      case "order_webhook":
        if (!job.data.shopId || !job.data.shopifyOrderId) {
          throw new QueueValidationError(
            "OrderWebhookJob missing shopId or shopifyOrderId",
          );
        }
        break;

      case "driver_tracking":
        if (
          typeof job.data.payload.latitude !== "number" ||
          typeof job.data.payload.longitude !== "number"
        ) {
          throw new QueueValidationError(
            "DriverTrackingJob missing valid coordinates",
          );
        }
        break;

      case "notification":
        if (!job.data.channel || !job.data.payload.recipientAddress) {
          throw new QueueValidationError(
            "NotificationJob missing channel or recipient",
          );
        }
        break;

      default:
        break;
    }
  }

  /**
   * Execute job processing with error handling and retry logic.
   *
   * @param job Job to process
   * @param attempt Current attempt number (1-based)
   * @returns Processing result
   */
  async executeJob(
    job: QueueJobPayload,
    attempt: number = 1,
  ): Promise<JobProcessingResult> {
    const jobId = this.extractJobId(job);
    const startTime = Date.now();

    try {
      // Validate job payload
      await this.validateJob(job);

      // Create metadata for this attempt
      const metadata: QueueJobMetadata = {
        jobId,
        type: job.type,
        createdAt: startTime,
        processingStartedAt: startTime,
        attempts: attempt,
        maxAttempts: this.config.maxAttempts,
      };

      // Check for shutdown signal
      if (this.isShuttingDown) {
        throw new QueueTransientError(
          "Consumer is shutting down, job requeued",
          { jobId },
        );
      }

      // Increment active job count
      this.activeJobCount++;
      this.updateMetric("activeCount", this.activeJobCount);
      this.updatePeakConcurrency();

      // Process the job
      const result = await this.process(job, metadata);

      // Update success metrics
      const processingTimeMs = Date.now() - startTime;
      this.recordJobSuccess(processingTimeMs);

      return {
        ...result,
        processingTimeMs,
      };
    } catch (error) {
      // Handle errors with retry logic
      const processingTimeMs = Date.now() - startTime;
      return this.handleJobError(
        error,
        jobId,
        attempt,
        processingTimeMs,
        job.type,
      );
    } finally {
      // Cleanup
      this.activeJobCount--;
      this.updateMetric("activeCount", this.activeJobCount);
    }
  }

  /**
   * Handle job processing errors with retry policy.
   *
   * @param error The error that occurred
   * @param jobId Job identifier
   * @param attempt Current attempt number
   * @param processingTimeMs Time spent processing
   * @param jobType Type of job
   * @returns Processing result with error details
   */
  private handleJobError(
    error: unknown,
    jobId: string,
    attempt: number,
    processingTimeMs: number,
    jobType: string,
  ): JobProcessingResult {
    const isConsumerError = error instanceof QueueConsumerError;
    const isRetriable = isConsumerError ? error.retriable : true;
    const code = isConsumerError ? error.code : "UNKNOWN_ERROR";
    const message =
      error instanceof Error ? error.message : String(error);

    // Determine if we should retry
    const shouldRetry =
      isRetriable && attempt < this.config.maxAttempts;

    // Calculate backoff delay for next attempt
    const delayMs = shouldRetry
      ? this.calculateBackoffDelay(attempt)
      : undefined;

    // Update failure metrics
    this.recordJobFailure(message, code, shouldRetry);

    // Log error
    console.error(
      `[QueueConsumer] Job failed: ${jobId} (${jobType}) attempt ${attempt}/${this.config.maxAttempts}`,
      {
        message,
        code,
        retriable: isRetriable,
        willRetry: shouldRetry,
        delayMs,
        processingTimeMs,
        details: isConsumerError ? error.details : undefined,
      },
    );

    // If permanent failure or max retries exceeded, send to dead letter queue
    if (!shouldRetry) {
      this.sendToDeadLetterQueue({
        jobId,
        jobType,
        originalError: {
          message,
          code,
        },
        failedAttempt: attempt,
        processingTimeMs,
      });
    }

    return {
      success: false,
      jobId,
      processingTimeMs,
      error: {
        message,
        code,
        retriable: shouldRetry,
      },
    };
  }

  /**
   * Calculate exponential backoff delay for retry.
   *
   * @param attempt Current attempt number (1-based)
   * @returns Delay in milliseconds
   */
  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay =
      this.config.initialDelayMs *
      Math.pow(this.config.backoffMultiplier, attempt - 1);

    const capped = Math.min(
      exponentialDelay,
      this.config.maxDelayMs,
    );

    // Add jitter: ±10% to prevent thundering herd
    const jitter = capped * 0.1 * (Math.random() * 2 - 1);
    return Math.max(1, capped + jitter);
  }

  /**
   * Send a failed job to dead letter queue for manual review.
   *
   * @param deadLetterJob The failed job metadata
   */
  private sendToDeadLetterQueue(deadLetterJob: {
    jobId: string;
    jobType: string;
    originalError: { message: string; code: string };
    failedAttempt: number;
    processingTimeMs: number;
  }): void {
    // In production, this would push to a separate Redis queue
    // or send to a monitoring/alerting system
    console.warn("[QueueConsumer] Job sent to DLQ", deadLetterJob);

    // Emit metric for monitoring
    this.metrics.set("dlqCount", (this.metrics.get("dlqCount") as number || 0) + 1);
  }

  /**
   * Record successful job completion.
   *
   * @param processingTimeMs Time spent processing
   */
  private recordJobSuccess(processingTimeMs: number): void {
    const completed = (this.metrics.get("completedCount") as number) + 1;
    this.metrics.set("completedCount", completed);

    const totalTime = (this.metrics.get("totalProcessingTimeMs") as number) + processingTimeMs;
    this.metrics.set("totalProcessingTimeMs", totalTime);

    const times = this.metrics.get("processingTimes") as number[];
    times.push(processingTimeMs);
    if (times.length > 1000) times.shift(); // Keep recent 1000 samples
  }

  /**
   * Record job failure with error tracking.
   *
   * @param message Error message
   * @param code Error code
   * @param willRetry Whether the job will be retried
   */
  private recordJobFailure(
    message: string,
    code: string,
    willRetry: boolean,
  ): void {
    const failed = (this.metrics.get("failedCount") as number) + 1;
    this.metrics.set("failedCount", failed);

    if (!willRetry) {
      const dlq = (this.metrics.get("dlqCount") as number || 0) + 1;
      this.metrics.set("dlqCount", dlq);
    }

    // Track error codes
    const errorCounts = this.metrics.get("errorCounts") as Map<string, number> || new Map();
    errorCounts.set(code, (errorCounts.get(code) ?? 0) + 1);
    this.metrics.set("errorCounts", errorCounts);
  }

  /**
   * Update metric value.
   *
   * @param key Metric key
   * @param value New value
   */
  private updateMetric(key: string, value: unknown): void {
    this.metrics.set(key, value);
  }

  /**
   * Track peak concurrency.
   */
  private updatePeakConcurrency(): void {
    const current = this.metrics.get("peakConcurrency") as number;
    if (this.activeJobCount > current) {
      this.metrics.set("peakConcurrency", this.activeJobCount);
    }
  }

  /**
   * Extract job ID from payload (implementation-specific).
   *
   * @param job Job payload
   * @returns Job identifier string
   */
  private extractJobId(job: QueueJobPayload): string {
    switch (job.type) {
      case "order_webhook":
        return `order_${job.data.shopifyOrderId}`;
      case "product_webhook":
        return `product_${job.data.shopifyProductId}`;
      case "driver_tracking":
        return `driver_${job.data.driverId}_${Date.now()}`;
      case "notification":
        return job.data.notificationId;
      case "event_scheduler":
        return job.data.eventId;
      case "analytics_event":
        return job.data.payload.eventId;
      case "inventory_webhook":
        return `inventory_${job.data.variantId}_${job.data.locationId}`;
      default:
        return `job_${Date.now()}`;
    }
  }

  /**
   * Get current queue metrics.
   *
   * @returns Queue metrics snapshot
   */
  getMetrics(): QueueMetrics {
    const completedCount = this.metrics.get("completedCount") as number;
    const processingTimes = this.metrics.get("processingTimes") as number[];
    const totalTime = this.metrics.get("totalProcessingTimeMs") as number;

    const averageProcessingTimeMs =
      completedCount > 0 ? totalTime / completedCount : 0;

    const processingRate =
      completedCount > 0
        ? completedCount / ((totalTime || 1) / 1000) // jobs per second
        : 0;

    return {
      queueName: this.config.queueName,
      activeCount: this.activeJobCount,
      waitingCount: this.metrics.get("waitingCount") as number,
      completedCount,
      failedCount: this.metrics.get("failedCount") as number,
      delayedCount: this.metrics.get("delayedCount") as number,
      paused: this.isShuttingDown,
      processingRate,
      averageProcessingTimeMs,
      peakConcurrency: this.metrics.get("peakConcurrency") as number,
    };
  }

  /**
   * Initiate graceful shutdown of the consumer.
   * Stops accepting new jobs, waits for in-flight jobs to complete.
   *
   * @param options Shutdown configuration
   * @returns Promise resolving when shutdown is complete
   */
  async gracefulShutdown(options: ShutdownOptions): Promise<void> {
    console.log(
      `[QueueConsumer] Starting graceful shutdown (${this.config.queueName})`,
    );

    this.isShuttingDown = true;

    if (options.drainQueue && !options.force) {
      // Wait for in-flight jobs to complete
      const startTime = Date.now();
      const timeoutTime = startTime + options.timeoutMs;

      while (this.activeJobCount > 0) {
        if (Date.now() > timeoutTime) {
          console.warn(
            `[QueueConsumer] Graceful shutdown timeout, ${this.activeJobCount} jobs still active`,
          );
          break;
        }

        await this.sleep(100);
      }
    }

    if (options.force) {
      console.warn(
        `[QueueConsumer] Force shutdown requested, terminating ${this.activeJobCount} active jobs`,
      );
    }

    console.log(`[QueueConsumer] Shutdown complete (${this.config.queueName})`);
  }

  /**
   * Sleep utility for async delays.
   *
   * @param ms Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Reset all metrics to initial state.
   */
  resetMetrics(): void {
    this.initializeMetrics();
  }
}
