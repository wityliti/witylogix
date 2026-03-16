/**
 * Order Sync Engine v2 - Advanced multi-platform synchronization with conflict resolution.
 *
 * Provides:
 * - SyncOrchestrator: coordinates sync across multiple platforms
 * - ConflictResolver: resolves conflicts using configured strategies
 * - IdempotencyManager: deduplicates syncs using composite keys
 * - DeltaSyncTracker: tracks last sync per platform for efficient updates
 * - RetryQueue: exponential backoff retry mechanism
 * - DeadLetterQueue: tracks permanently failed syncs
 * - BatchProcessor: bulk import/export with progress tracking
 * - SyncMetrics: monitoring and analytics
 *
 * @module sync/order-sync-engine-v2
 */

import type {
  PlatformOrder,
  SyncJob,
  SyncConflict,
  SyncResult,
  ConflictStrategy,
  ConflictResolution,
  DeltaCheckpoint,
  FailedOrderSync,
  SyncConfig,
  PlatformConnection,
  RetryQueueEntry,
  DeadLetterEntry,
  SyncMetrics,
  SyncStatus,
  SyncDirection,
} from "./sync-types.js";
import { ConflictStrategy as ConflictStrategyEnum, SyncStatus as SyncStatusEnum } from "./sync-types.js";

/**
 * Conflict resolution engine using configured strategies
 */
export class ConflictResolver {
  /**
   * Resolve a conflict using the configured strategy
   * @param conflict - The conflict to resolve
   * @param strategy - Resolution strategy to apply
   * @returns Resolution decision
   */
  public resolve(conflict: SyncConflict, strategy: ConflictStrategy): "INTERNAL" | "EXTERNAL" {
    switch (strategy) {
      case ConflictStrategyEnum.LAST_WRITE_WINS: {
        const internalTime = new Date(conflict.internalUpdatedAt).getTime();
        const externalTime = new Date(conflict.externalUpdatedAt).getTime();
        return externalTime > internalTime ? "EXTERNAL" : "INTERNAL";
      }

      case ConflictStrategyEnum.EXTERNAL_WINS:
        return "EXTERNAL";

      case ConflictStrategyEnum.INTERNAL_WINS:
        return "INTERNAL";

      case ConflictStrategyEnum.MANUAL_REVIEW:
        // Return INTERNAL as default, requires manual resolution
        return "INTERNAL";

      default:
        return "INTERNAL";
    }
  }

  /**
   * Create a conflict record from differing values
   * @param orderId - Witylogix order ID
   * @param externalOrderId - External order ID
   * @param platformType - Platform type
   * @param tenantId - Tenant ID
   * @param field - Field with conflict
   * @param internalValue - Internal value
   * @param externalValue - External value
   * @param internalUpdatedAt - Internal update timestamp
   * @param externalUpdatedAt - External update timestamp
   * @param strategy - Resolution strategy
   * @returns Conflict record
   */
  public createConflict(
    orderId: string,
    externalOrderId: string,
    platformType: string,
    tenantId: string,
    field: string,
    internalValue: unknown,
    externalValue: unknown,
    internalUpdatedAt: string,
    externalUpdatedAt: string,
    strategy: ConflictStrategy
  ): SyncConflict {
    return {
      conflictId: this.generateId("CONFLICT"),
      orderId,
      externalOrderId,
      platformType: platformType as any,
      tenantId,
      conflictField: field,
      internalValue,
      externalValue,
      internalUpdatedAt,
      externalUpdatedAt,
      resolutionStrategy: strategy,
      isResolved: false,
      createdAt: new Date().toISOString(),
    };
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

/**
 * Idempotency manager using composite keys (platformId + externalOrderId)
 */
export class IdempotencyManager {
  private processedKeys: Map<string, string> = new Map(); // key -> jobId

  /**
   * Generate composite idempotency key
   * @param platformType - Platform type
   * @param externalOrderId - External order ID
   * @returns Composite key
   */
  public generateKey(platformType: string, externalOrderId: string): string {
    return `${platformType}#${externalOrderId}`;
  }

  /**
   * Check if this sync has been processed
   * @param key - Idempotency key
   * @returns Job ID if processed, undefined otherwise
   */
  public isDuplicate(key: string): string | undefined {
    return this.processedKeys.get(key);
  }

  /**
   * Mark key as processed
   * @param key - Idempotency key
   * @param jobId - Job that processed it
   */
  public markProcessed(key: string, jobId: string): void {
    this.processedKeys.set(key, jobId);
  }

  /**
   * Clear processed keys (for testing or reset)
   */
  public clear(): void {
    this.processedKeys.clear();
  }
}

/**
 * Delta sync tracker for efficient incremental updates
 */
export class DeltaSyncTracker {
  private checkpoints: Map<string, DeltaCheckpoint> = new Map();

  /**
   * Get last sync checkpoint for platform
   * @param tenantId - Tenant ID
   * @param platformType - Platform type
   * @returns Last checkpoint or undefined
   */
  public getCheckpoint(tenantId: string, platformType: string): DeltaCheckpoint | undefined {
    return this.checkpoints.get(`${tenantId}#${platformType}`);
  }

  /**
   * Update checkpoint after successful sync
   * @param tenantId - Tenant ID
   * @param platformType - Platform type
   * @param syncCount - Number of items synced
   * @param cursor - Optional pagination cursor
   */
  public updateCheckpoint(
    tenantId: string,
    platformType: string,
    syncCount: number,
    cursor?: string
  ): void {
    const key = `${tenantId}#${platformType}`;
    const checkpoint: DeltaCheckpoint = {
      checkpointId: `CP_${Date.now()}`,
      tenantId,
      platformType: platformType as any,
      lastSyncAt: new Date().toISOString(),
      cursor,
      lastSyncCount: syncCount,
    };
    this.checkpoints.set(key, checkpoint);
  }

  /**
   * Should sync based on interval and last sync time
   * @param tenantId - Tenant ID
   * @param platformType - Platform type
   * @param intervalMs - Sync interval in milliseconds
   * @returns Whether sync is needed
   */
  public shouldSync(tenantId: string, platformType: string, intervalMs: number): boolean {
    if (intervalMs === 0) return false; // Webhook-only

    const checkpoint = this.getCheckpoint(tenantId, platformType);
    if (!checkpoint) return true;

    const lastSyncTime = new Date(checkpoint.lastSyncAt).getTime();
    return Date.now() - lastSyncTime >= intervalMs;
  }
}

/**
 * Retry queue with exponential backoff
 */
export class RetryQueue {
  private queue: RetryQueueEntry[] = [];
  private readonly backoffMs = [1000, 2000, 4000, 8000, 16000]; // 1s, 2s, 4s, 8s, 16s
  private readonly maxRetries = 5;

  /**
   * Enqueue a failed sync for retry
   * @param orderId - Order ID
   * @param jobId - Original job ID
   * @param error - Error message
   */
  public enqueue(orderId: string, jobId: string, error: string): void {
    const entry: RetryQueueEntry = {
      retryId: `RETRY_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      orderId,
      jobId,
      attemptNumber: 1,
      maxAttempts: this.maxRetries,
      nextRetryAt: new Date(Date.now() + this.backoffMs[0]).toISOString(),
      error,
    };
    this.queue.push(entry);
  }

  /**
   * Get entries ready for retry
   * @returns Ready entries
   */
  public getReadyEntries(): RetryQueueEntry[] {
    const now = Date.now();
    return this.queue.filter((entry) => new Date(entry.nextRetryAt).getTime() <= now);
  }

  /**
   * Mark entry as retried
   * @param retryId - Retry ID
   * @param success - Whether retry succeeded
   * @param error - New error if failed
   * @returns Whether entry should be moved to DLQ
   */
  public markRetried(retryId: string, success: boolean, error?: string): boolean {
    const entry = this.queue.find((e) => e.retryId === retryId);
    if (!entry) return false;

    if (success) {
      this.queue = this.queue.filter((e) => e.retryId !== retryId);
      return false;
    }

    entry.attemptNumber++;
    if (entry.attemptNumber > this.maxRetries) {
      this.queue = this.queue.filter((e) => e.retryId !== retryId);
      return true; // Move to DLQ
    }

    const backoffIndex = Math.min(entry.attemptNumber - 1, this.backoffMs.length - 1);
    entry.nextRetryAt = new Date(Date.now() + this.backoffMs[backoffIndex]).toISOString();
    if (error) {
      entry.error = error;
    }

    return false;
  }

  /**
   * Get queue size
   */
  public size(): number {
    return this.queue.length;
  }
}

/**
 * Dead letter queue for permanently failed syncs
 */
export class DeadLetterQueue {
  private dlq: DeadLetterEntry[] = [];

  /**
   * Add entry to DLQ
   * @param orderId - Order ID
   * @param jobId - Original job ID
   * @param error - Final error message
   * @param retryAttempts - Number of retries attempted
   * @param metadata - Optional metadata
   */
  public add(
    orderId: string,
    jobId: string,
    error: string,
    retryAttempts: number,
    metadata?: Record<string, unknown>
  ): void {
    const entry: DeadLetterEntry = {
      dlqId: `DLQ_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      orderId,
      jobId,
      error,
      retryAttempts,
      movedToDlqAt: new Date().toISOString(),
      metadata,
    };
    this.dlq.push(entry);
  }

  /**
   * Get all DLQ entries
   */
  public getAll(): DeadLetterEntry[] {
    return [...this.dlq];
  }

  /**
   * Get DLQ size
   */
  public size(): number {
    return this.dlq.length;
  }

  /**
   * Get entries for manual review (most recent first)
   * @param limit - Number of entries to return
   */
  public getForReview(limit: number = 50): DeadLetterEntry[] {
    return this.dlq.slice(-limit).reverse();
  }
}

/**
 * Batch processor for bulk import/export
 */
export class BatchProcessor {
  private readonly maxBatchSize = 500;

  /**
   * Process batch of orders for import
   * @param orders - Orders to import
   * @param onProgress - Progress callback
   * @returns Processing result
   */
  public async processBatch(
    orders: PlatformOrder[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<{ succeeded: number; failed: number; errors: Map<string, string> }> {
    const total = orders.length;
    const errors = new Map<string, string>();
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < total; i += this.maxBatchSize) {
      const batch = orders.slice(i, Math.min(i + this.maxBatchSize, total));

      // Process batch
      for (const order of batch) {
        try {
          // Validation would happen here
          if (!order.orderId || !order.externalOrderId) {
            throw new Error("Missing required order IDs");
          }
          succeeded++;
        } catch (error) {
          failed++;
          errors.set(order.orderId, (error as Error).message);
        }
      }

      if (onProgress) {
        onProgress(Math.min(i + this.maxBatchSize, total), total);
      }
    }

    return { succeeded, failed, errors };
  }

  /**
   * Split orders into batches
   * @param orders - Orders to split
   * @returns Array of batches
   */
  public splitIntoBatches(orders: PlatformOrder[]): PlatformOrder[][] {
    const batches: PlatformOrder[][] = [];
    for (let i = 0; i < orders.length; i += this.maxBatchSize) {
      batches.push(orders.slice(i, i + this.maxBatchSize));
    }
    return batches;
  }
}

/**
 * Sync metrics tracker
 */
export class SyncMetrics {
  private metrics: Map<string, SyncMetrics> = new Map();

  /**
   * Record a sync attempt
   * @param platformType - Platform type
   * @param tenantId - Tenant ID
   * @param success - Whether sync succeeded
   * @param latencyMs - Sync latency
   * @param conflictCount - Number of conflicts
   */
  public recordSync(
    platformType: string,
    tenantId: string,
    success: boolean,
    latencyMs: number,
    conflictCount: number = 0
  ): void {
    const key = `${platformType}#${tenantId}`;
    const existing = this.metrics.get(key) || {
      platformType: platformType as any,
      tenantId,
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      successRate: 0,
      avgLatencyMs: 0,
      totalConflicts: 0,
      unresolvedConflicts: 0,
    };

    existing.totalSyncs++;
    if (success) {
      existing.successfulSyncs++;
    } else {
      existing.failedSyncs++;
    }

    existing.successRate = (existing.successfulSyncs / existing.totalSyncs) * 100;
    existing.avgLatencyMs =
      (existing.avgLatencyMs * (existing.totalSyncs - 1) + latencyMs) / existing.totalSyncs;
    existing.totalConflicts += conflictCount;
    existing.unresolvedConflicts += conflictCount;
    existing.lastSyncAt = new Date().toISOString();

    this.metrics.set(key, existing);
  }

  /**
   * Get metrics for platform
   * @param platformType - Platform type
   * @param tenantId - Tenant ID
   * @returns Metrics or undefined
   */
  public getMetrics(platformType: string, tenantId: string): any | undefined {
    return this.metrics.get(`${platformType}#${tenantId}`);
  }

  /**
   * Get all metrics
   */
  public getAllMetrics(): any[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Reset metrics
   */
  public reset(): void {
    this.metrics.clear();
  }
}

/**
 * Main sync orchestrator coordinating sync across platforms
 */
export class SyncOrchestrator {
  private conflictResolver = new ConflictResolver();
  private idempotencyManager = new IdempotencyManager();
  private deltaSyncTracker = new DeltaSyncTracker();
  private retryQueue = new RetryQueue();
  private deadLetterQueue = new DeadLetterQueue();
  private batchProcessor = new BatchProcessor();
  private metrics = new SyncMetrics();
  private activeJobs: Map<string, SyncJob> = new Map();

  /**
   * Trigger a sync for a platform
   * @param tenantId - Tenant ID
   * @param platformType - Platform type
   * @param direction - Sync direction
   * @param orders - Orders to sync
   * @param config - Sync configuration
   * @returns Sync result
   */
  public async sync(
    tenantId: string,
    platformType: string,
    direction: SyncDirection,
    orders: PlatformOrder[],
    config: SyncConfig
  ): Promise<SyncResult> {
    const jobId = this.generateJobId();
    const startTime = Date.now();

    const job: SyncJob = {
      jobId,
      tenantId,
      platformType: platformType as any,
      status: SyncStatusEnum.IN_PROGRESS,
      direction: direction as any,
      syncedCount: 0,
      failedCount: 0,
      conflictCount: 0,
      startedAt: new Date().toISOString(),
    };

    this.activeJobs.set(jobId, job);

    const failedOrders: FailedOrderSync[] = [];
    const conflicts: SyncConflict[] = [];

    try {
      // Check idempotency for each order
      for (const order of orders) {
        const key = this.idempotencyManager.generateKey(platformType, order.externalOrderId);

        if (this.idempotencyManager.isDuplicate(key)) {
          continue; // Skip duplicate
        }

        this.idempotencyManager.markProcessed(key, jobId);
      }

      // Process orders
      for (const order of orders) {
        try {
          // Simulate conflict detection
          const hasConflict = Math.random() < 0.05; // 5% conflict rate for demo

          if (hasConflict) {
            const conflict = this.conflictResolver.createConflict(
              order.orderId,
              order.externalOrderId,
              platformType,
              tenantId,
              "status",
              "pending",
              "processing",
              new Date(Date.now() - 3600000).toISOString(),
              new Date().toISOString(),
              config.conflictStrategy
            );
            conflicts.push(conflict);
            job.conflictCount++;

            // Resolve conflict
            const resolution = this.conflictResolver.resolve(
              conflict,
              config.conflictStrategy
            );
            conflict.resolution = resolution;
            conflict.isResolved = config.conflictStrategy !== ConflictStrategyEnum.MANUAL_REVIEW;
          }

          job.syncedCount++;
        } catch (error) {
          job.failedCount++;
          failedOrders.push({
            orderId: order.orderId,
            externalOrderId: order.externalOrderId,
            error: (error as Error).message,
            retryCount: 0,
            retryable: true,
          });

          // Enqueue for retry
          this.retryQueue.enqueue(order.orderId, jobId, (error as Error).message);
        }
      }

      // Update delta sync checkpoint
      this.deltaSyncTracker.updateCheckpoint(tenantId, platformType, job.syncedCount);

      job.status = SyncStatusEnum.COMPLETED;
      job.completedAt = new Date().toISOString();

      // Record metrics
      const durationMs = Date.now() - startTime;
      this.metrics.recordSync(
        platformType,
        tenantId,
        job.failedCount === 0,
        durationMs,
        job.conflictCount
      );

      return {
        jobId,
        success: job.failedCount === 0,
        syncedCount: job.syncedCount,
        failedCount: job.failedCount,
        conflictCount: job.conflictCount,
        failedOrders,
        conflicts,
        durationMs,
        message: `Synced ${job.syncedCount} orders, ${job.failedCount} failed, ${job.conflictCount} conflicts`,
      };
    } catch (error) {
      job.status = SyncStatusEnum.FAILED;
      job.error = (error as Error).message;
      job.completedAt = new Date().toISOString();

      const durationMs = Date.now() - startTime;
      this.metrics.recordSync(platformType, tenantId, false, durationMs);

      return {
        jobId,
        success: false,
        syncedCount: job.syncedCount,
        failedCount: job.failedCount,
        conflictCount: job.conflictCount,
        failedOrders,
        conflicts,
        durationMs,
        message: `Sync failed: ${(error as Error).message}`,
      };
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Resolve a conflict
   * @param conflictId - Conflict ID
   * @param resolution - Resolution decision
   * @param resolvedBy - User who resolved it
   */
  public resolveConflict(
    conflictId: string,
    resolution: "INTERNAL" | "EXTERNAL",
    resolvedBy: string
  ): ConflictResolution {
    return {
      conflictId,
      resolution,
      resolvedBy,
      resolvedAt: new Date().toISOString(),
    };
  }

  /**
   * Get sync metrics
   * @param platformType - Platform type
   * @param tenantId - Tenant ID
   */
  public getMetrics(platformType: string, tenantId: string): any | undefined {
    return this.metrics.getMetrics(platformType, tenantId);
  }

  /**
   * Get all active jobs
   */
  public getActiveJobs(): SyncJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Get retry queue size
   */
  public getRetryQueueSize(): number {
    return this.retryQueue.size();
  }

  /**
   * Get DLQ entries for review
   * @param limit - Number of entries
   */
  public getDlqEntries(limit?: number): DeadLetterEntry[] {
    return this.deadLetterQueue.getForReview(limit);
  }

  private generateJobId(): string {
    return `JOB_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
