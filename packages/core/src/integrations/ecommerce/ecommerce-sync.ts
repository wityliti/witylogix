/**
 * Multi-Platform E-Commerce Sync Engine
 * Manages synchronization of orders, products, and customers across multiple platforms
 */

import type {
  IECommerceAdapter,
  ECommerceAdapterConfig,
  ECommerceOrder,
  ECommerceProduct,
  ECommerceCustomer,
  SyncOptions,
  SyncResult,
  SyncStatus,
  AuditLogEntry,
} from "./types.js";

/**
 * Sync Job State
 */
interface SyncJob {
  id: string;
  platform: string;
  entityType: "order" | "product" | "customer";
  status: "pending" | "running" | "completed" | "failed";
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  result?: SyncResult;
}

/**
 * Sync Statistics
 */
interface SyncStatistics {
  platform: string;
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  lastSyncAt: Date | null;
  averageDurationMs: number;
}

/**
 * E-Commerce Sync Engine
 */
export class SyncEngine {
  private adapters: Map<string, IECommerceAdapter> = new Map();
  private syncStatus: Map<string, SyncStatus> = new Map();
  private auditLog: AuditLogEntry[] = [];
  private syncJobs: SyncJob[] = [];
  private maxAuditLogs = 10000;
  private maxSyncJobs = 1000;

  /**
   * Register adapter for platform
   */
  registerAdapter(platform: string, adapter: IECommerceAdapter): void {
    if (this.adapters.has(platform)) {
      throw new Error(`Adapter for ${platform} already registered`);
    }

    this.adapters.set(platform, adapter);
    this.syncStatus.set(platform, {
      platform,
      lastSyncAt: null,
      status: "idle",
    });
  }

  /**
   * Unregister adapter
   */
  unregisterAdapter(platform: string): void {
    this.adapters.delete(platform);
    this.syncStatus.delete(platform);
  }

  /**
   * Sync orders from platform
   */
  async syncOrders(
    platform: string,
    options?: SyncOptions,
  ): Promise<SyncResult> {
    const adapter = this.getAdapter(platform);
    const jobId = this.createJob(platform, "order");

    try {
      this.updateSyncStatus(platform, "syncing");

      const startTime = Date.now();
      const orders = await adapter.getOrders(options);

      const result: SyncResult = {
        platform,
        entityType: "order",
        created: 0,
        updated: 0,
        deleted: 0,
        failed: 0,
        duration: Date.now() - startTime,
        startedAt: new Date(),
        completedAt: new Date(),
        errors: [],
      };

      // Process orders in chunks
      const chunkSize = options?.chunkSize || 50;

      for (let i = 0; i < orders.length; i += chunkSize) {
        const chunk = orders.slice(i, i + chunkSize);

        for (const order of chunk) {
          try {
            // Here you would typically persist the order to your database
            // For now, we just track the metrics
            result.created += 1;

            this.auditLog.push({
              timestamp: new Date(),
              platform,
              entityType: "order",
              entityId: order.id,
              action: "sync",
              source: "sync",
            });
          } catch (error) {
            result.failed += 1;
            result.errors.push({
              id: order.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      this.completeJob(jobId, result);
      this.updateSyncStatus(platform, "idle", null, result.startedAt);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.failJob(jobId, errorMessage);
      this.updateSyncStatus(platform, "error", errorMessage);

      throw error;
    }
  }

  /**
   * Sync products from platform
   */
  async syncProducts(
    platform: string,
    options?: SyncOptions,
  ): Promise<SyncResult> {
    const adapter = this.getAdapter(platform);
    const jobId = this.createJob(platform, "product");

    try {
      this.updateSyncStatus(platform, "syncing");

      const startTime = Date.now();
      const products = await adapter.getProducts(options);

      const result: SyncResult = {
        platform,
        entityType: "product",
        created: 0,
        updated: 0,
        deleted: 0,
        failed: 0,
        duration: Date.now() - startTime,
        startedAt: new Date(),
        completedAt: new Date(),
        errors: [],
      };

      // Process products in chunks
      const chunkSize = options?.chunkSize || 25;

      for (let i = 0; i < products.length; i += chunkSize) {
        const chunk = products.slice(i, i + chunkSize);

        for (const product of chunk) {
          try {
            // Here you would typically persist the product to your database
            result.created += 1;

            this.auditLog.push({
              timestamp: new Date(),
              platform,
              entityType: "product",
              entityId: product.id,
              action: "sync",
              source: "sync",
            });
          } catch (error) {
            result.failed += 1;
            result.errors.push({
              id: product.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      this.completeJob(jobId, result);
      this.updateSyncStatus(platform, "idle", null, result.startedAt);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.failJob(jobId, errorMessage);
      this.updateSyncStatus(platform, "error", errorMessage);

      throw error;
    }
  }

  /**
   * Sync customers from platform
   */
  async syncCustomers(
    platform: string,
    options?: SyncOptions,
  ): Promise<SyncResult> {
    const adapter = this.getAdapter(platform);
    const jobId = this.createJob(platform, "customer");

    try {
      this.updateSyncStatus(platform, "syncing");

      const startTime = Date.now();
      const customers = await adapter.getCustomers(options);

      const result: SyncResult = {
        platform,
        entityType: "customer",
        created: 0,
        updated: 0,
        deleted: 0,
        failed: 0,
        duration: Date.now() - startTime,
        startedAt: new Date(),
        completedAt: new Date(),
        errors: [],
      };

      // Process customers in chunks
      const chunkSize = options?.chunkSize || 50;

      for (let i = 0; i < customers.length; i += chunkSize) {
        const chunk = customers.slice(i, i + chunkSize);

        for (const customer of chunk) {
          try {
            // Here you would typically persist the customer to your database
            result.created += 1;

            this.auditLog.push({
              timestamp: new Date(),
              platform,
              entityType: "customer",
              entityId: customer.id,
              action: "sync",
              source: "sync",
            });
          } catch (error) {
            result.failed += 1;
            result.errors.push({
              id: customer.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      this.completeJob(jobId, result);
      this.updateSyncStatus(platform, "idle", null, result.startedAt);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.failJob(jobId, errorMessage);
      this.updateSyncStatus(platform, "error", errorMessage);

      throw error;
    }
  }

  /**
   * Sync all platforms
   */
  async syncAll(options?: SyncOptions): Promise<Map<string, SyncResult>> {
    const results = new Map<string, SyncResult>();

    for (const platform of this.adapters.keys()) {
      try {
        const orderResult = await this.syncOrders(platform, options);
        const productResult = await this.syncProducts(platform, options);
        const customerResult = await this.syncCustomers(platform, options);

        // Combine results
        results.set(`${platform}:orders`, orderResult);
        results.set(`${platform}:products`, productResult);
        results.set(`${platform}:customers`, customerResult);
      } catch (error) {
        console.error(`Failed to sync ${platform}:`, error);
      }
    }

    return results;
  }

  /**
   * Perform conflict resolution
   */
  async resolveConflict(
    platform: string,
    entityType: string,
    externalVersion: Record<string, unknown>,
    internalVersion: Record<string, unknown>,
    strategy: "last-write-wins" | "external-wins" | "internal-wins" = "last-write-wins",
  ): Promise<Record<string, unknown>> {
    switch (strategy) {
      case "external-wins":
        return externalVersion;

      case "internal-wins":
        return internalVersion;

      case "last-write-wins":
      default:
        // Compare timestamps
        const externalTime = new Date(
          (externalVersion as any).updatedAt || (externalVersion as any).updated_at || 0,
        ).getTime();
        const internalTime = new Date(
          (internalVersion as any).updatedAt || (internalVersion as any).updated_at || 0,
        ).getTime();

        return externalTime > internalTime ? externalVersion : internalVersion;
    }
  }

  /**
   * Get sync status for platform
   */
  getSyncStatus(platform: string): SyncStatus {
    const status = this.syncStatus.get(platform);
    if (!status) {
      throw new Error(`Unknown platform: ${platform}`);
    }
    return status;
  }

  /**
   * Get sync status for all platforms
   */
  getAllSyncStatus(): Map<string, SyncStatus> {
    return new Map(this.syncStatus);
  }

  /**
   * Get sync statistics
   */
  getSyncStatistics(platform: string): SyncStatistics {
    const platformJobs = this.syncJobs.filter((job) => job.platform === platform);
    const completedJobs = platformJobs.filter((job) => job.status === "completed");
    const failedJobs = platformJobs.filter((job) => job.status === "failed");

    const totalDuration = completedJobs.reduce((sum, job) => sum + (job.result?.duration || 0), 0);
    const averageDuration =
      completedJobs.length > 0 ? totalDuration / completedJobs.length : 0;

    return {
      platform,
      totalSyncs: platformJobs.length,
      successfulSyncs: completedJobs.length,
      failedSyncs: failedJobs.length,
      lastSyncAt: this.syncStatus.get(platform)?.lastSyncAt || null,
      averageDurationMs: averageDuration,
    };
  }

  /**
   * Get audit log
   */
  getAuditLog(platform?: string, limit = 100): AuditLogEntry[] {
    let entries = this.auditLog;

    if (platform) {
      entries = entries.filter((entry) => entry.platform === platform);
    }

    return entries.slice(-limit);
  }

  /**
   * Get recent sync jobs
   */
  getRecentSyncJobs(platform?: string, limit = 50): SyncJob[] {
    let jobs = this.syncJobs;

    if (platform) {
      jobs = jobs.filter((job) => job.platform === platform);
    }

    return jobs.slice(-limit);
  }

  /**
   * Clear sync history
   */
  clearSyncHistory(olderThanMs = 86400000): void {
    const cutoffTime = Date.now() - olderThanMs;

    this.syncJobs = this.syncJobs.filter((job) => {
      const jobTime = job.startedAt.getTime();
      return jobTime > cutoffTime;
    });

    this.auditLog = this.auditLog.filter((entry) => {
      const entryTime = entry.timestamp.getTime();
      return entryTime > cutoffTime;
    });
  }

  /**
   * Health check all adapters
   */
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [platform, adapter] of this.adapters) {
      try {
        const isHealthy = await adapter.healthCheck();
        results.set(platform, isHealthy);
      } catch {
        results.set(platform, false);
      }
    }

    return results;
  }

  /**
   * Reset sync engine (for testing)
   */
  reset(): void {
    this.adapters.clear();
    this.syncStatus.clear();
    this.auditLog = [];
    this.syncJobs = [];
  }

  // Private helper methods

  private getAdapter(platform: string): IECommerceAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new Error(`No adapter registered for platform: ${platform}`);
    }
    return adapter;
  }

  private createJob(
    platform: string,
    entityType: "order" | "product" | "customer",
  ): string {
    const jobId = `${platform}:${entityType}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;

    const job: SyncJob = {
      id: jobId,
      platform,
      entityType,
      status: "running",
      startedAt: new Date(),
    };

    this.syncJobs.push(job);

    // Keep only recent jobs
    if (this.syncJobs.length > this.maxSyncJobs) {
      this.syncJobs = this.syncJobs.slice(-this.maxSyncJobs);
    }

    return jobId;
  }

  private completeJob(jobId: string, result: SyncResult): void {
    const job = this.syncJobs.find((j) => j.id === jobId);
    if (job) {
      job.status = "completed";
      job.completedAt = new Date();
      job.result = result;
    }
  }

  private failJob(jobId: string, error: string): void {
    const job = this.syncJobs.find((j) => j.id === jobId);
    if (job) {
      job.status = "failed";
      job.completedAt = new Date();
      job.error = error;
    }
  }

  private updateSyncStatus(
    platform: string,
    status: "idle" | "syncing" | "error",
    error?: string,
    lastSyncAt?: Date,
  ): void {
    const currentStatus = this.syncStatus.get(platform);
    if (currentStatus) {
      currentStatus.status = status;
      currentStatus.lastError = error;
      if (lastSyncAt) {
        currentStatus.lastSyncAt = lastSyncAt;
      }
    }
  }
}

/**
 * Create sync engine instance
 */
export function createSyncEngine(): SyncEngine {
  return new SyncEngine();
}
