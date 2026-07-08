/**
 * Synchronization scheduler for cron-based platform syncs.
 *
 * Provides:
 * - Cron-based scheduling (5m, 15m, 30m, 1h, 6h, 24h intervals)
 * - Real-time webhook triggering
 * - Concurrency control (max 3 concurrent syncs per tenant)
 * - Priority queue (webhook > scheduled > manual)
 * - Health checks and stale job detection
 * - Pause/resume functionality
 *
 * @module sync/sync-scheduler
 */

import type { PlatformType, SyncDirection } from "./sync-types.js";

/**
 * Sync interval presets
 */
export enum SyncInterval {
  REALTIME = 0,
  FIVE_MINUTES = 300000,
  FIFTEEN_MINUTES = 900000,
  THIRTY_MINUTES = 1800000,
  ONE_HOUR = 3600000,
  SIX_HOURS = 21600000,
  TWENTY_FOUR_HOURS = 86400000,
}

/**
 * Scheduled sync job priority
 */
export enum SyncPriority {
  MANUAL = 0,
  SCHEDULED = 1,
  WEBHOOK = 2,
}

/**
 * Scheduled sync job
 */
export interface ScheduledJob {
  jobId: string;
  tenantId: string;
  platformType: PlatformType;
  priority: SyncPriority;
  interval: SyncInterval;
  direction: SyncDirection;
  lastRunAt?: string;
  nextRunAt: string;
  isEnabled: boolean;
  isRunning: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Sync scheduler with cron scheduling and concurrency control
 */
export class SyncScheduler {
  private scheduledJobs: Map<string, ScheduledJob> = new Map();
  private runningJobs: Set<string> = new Set();
  private pausedPlatforms: Set<string> = new Set();
  private readonly maxConcurrentPerTenant = 3;
  private tenantConcurrencyMap: Map<string, number> = new Map();
  private jobTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Schedule a sync job
   * @param tenantId - Tenant ID
   * @param platformType - Platform type
   * @param direction - Sync direction
   * @param interval - Sync interval
   * @param priority - Job priority
   * @returns Scheduled job
   */
  public scheduleSync(
    tenantId: string,
    platformType: PlatformType,
    direction: SyncDirection,
    interval: SyncInterval,
    priority: SyncPriority = SyncPriority.SCHEDULED,
  ): ScheduledJob {
    const jobId = this.generateJobId();
    const now = new Date();

    const job: ScheduledJob = {
      jobId,
      tenantId,
      platformType,
      priority,
      interval,
      direction,
      nextRunAt: new Date(now.getTime() + interval).toISOString(),
      isEnabled: true,
      isRunning: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    this.scheduledJobs.set(jobId, job);

    // Schedule if not already running
    if (interval > 0) {
      this.scheduleJobTimer(job);
    }

    return job;
  }

  /**
   * Schedule a one-time sync
   * @param tenantId - Tenant ID
   * @param platformType - Platform type
   * @param direction - Sync direction
   * @param priority - Job priority
   * @returns Scheduled job
   */
  public scheduleOnceNow(
    tenantId: string,
    platformType: PlatformType,
    direction: SyncDirection,
    priority: SyncPriority = SyncPriority.MANUAL,
  ): ScheduledJob {
    return this.scheduleSync(
      tenantId,
      platformType,
      direction,
      SyncInterval.REALTIME,
      priority,
    );
  }

  /**
   * Get all scheduled jobs
   */
  public getAllJobs(): ScheduledJob[] {
    return Array.from(this.scheduledJobs.values());
  }

  /**
   * Get jobs for a tenant
   * @param tenantId - Tenant ID
   */
  public getJobsForTenant(tenantId: string): ScheduledJob[] {
    return Array.from(this.scheduledJobs.values()).filter(
      (job) => job.tenantId === tenantId,
    );
  }

  /**
   * Get jobs for a platform
   * @param tenantId - Tenant ID
   * @param platformType - Platform type
   */
  public getJobsForPlatform(
    tenantId: string,
    platformType: PlatformType,
  ): ScheduledJob[] {
    return Array.from(this.scheduledJobs.values()).filter(
      (job) => job.tenantId === tenantId && job.platformType === platformType,
    );
  }

  /**
   * Pause syncs for a platform
   * @param tenantId - Tenant ID
   * @param platformType - Platform type
   */
  public pausePlatform(tenantId: string, platformType: PlatformType): void {
    const key = `${tenantId}#${platformType}`;
    this.pausedPlatforms.add(key);

    // Cancel any running jobs for this platform
    for (const job of this.getJobsForPlatform(tenantId, platformType)) {
      if (this.jobTimers.has(job.jobId)) {
        clearTimeout(this.jobTimers.get(job.jobId)!);
        this.jobTimers.delete(job.jobId);
      }
    }
  }

  /**
   * Resume syncs for a platform
   * @param tenantId - Tenant ID
   * @param platformType - Platform type
   */
  public resumePlatform(tenantId: string, platformType: PlatformType): void {
    const key = `${tenantId}#${platformType}`;
    this.pausedPlatforms.delete(key);

    // Re-schedule jobs for this platform
    for (const job of this.getJobsForPlatform(tenantId, platformType)) {
      if (job.isEnabled && !this.jobTimers.has(job.jobId)) {
        this.scheduleJobTimer(job);
      }
    }
  }

  /**
   * Check if platform is paused
   * @param tenantId - Tenant ID
   * @param platformType - Platform type
   */
  public isPaused(tenantId: string, platformType: PlatformType): boolean {
    const key = `${tenantId}#${platformType}`;
    return this.pausedPlatforms.has(key);
  }

  /**
   * Get jobs ready to run
   * @returns Jobs ready for execution
   */
  public getReadyJobs(): ScheduledJob[] {
    const now = new Date().getTime();
    const ready: ScheduledJob[] = [];

    for (const job of this.scheduledJobs.values()) {
      if (
        job.isEnabled &&
        !job.isRunning &&
        !this.isPaused(job.tenantId, job.platformType) &&
        this.canRunConcurrently(job.tenantId)
      ) {
        const nextRun = new Date(job.nextRunAt).getTime();
        if (nextRun <= now) {
          ready.push(job);
        }
      }
    }

    // Sort by priority (higher first)
    ready.sort((a, b) => b.priority - a.priority);

    return ready;
  }

  /**
   * Mark job as running
   * @param jobId - Job ID
   */
  public markJobRunning(jobId: string): void {
    const job = this.scheduledJobs.get(jobId);
    if (job) {
      job.isRunning = true;
      this.runningJobs.add(jobId);

      const tenantConcurrency =
        this.tenantConcurrencyMap.get(job.tenantId) || 0;
      this.tenantConcurrencyMap.set(job.tenantId, tenantConcurrency + 1);
    }
  }

  /**
   * Mark job as completed
   * @param jobId - Job ID
   */
  public markJobCompleted(jobId: string): void {
    const job = this.scheduledJobs.get(jobId);
    if (job) {
      job.isRunning = false;
      job.lastRunAt = new Date().toISOString();

      // Calculate next run time
      if (job.interval > 0) {
        job.nextRunAt = new Date(Date.now() + job.interval).toISOString();

        // Re-schedule
        this.scheduleJobTimer(job);
      }

      this.runningJobs.delete(jobId);

      const tenantConcurrency =
        (this.tenantConcurrencyMap.get(job.tenantId) || 1) - 1;
      this.tenantConcurrencyMap.set(
        job.tenantId,
        Math.max(0, tenantConcurrency),
      );
    }
  }

  /**
   * Disable a scheduled job
   * @param jobId - Job ID
   */
  public disableJob(jobId: string): void {
    const job = this.scheduledJobs.get(jobId);
    if (job) {
      job.isEnabled = false;
      job.updatedAt = new Date().toISOString();

      // Cancel timer
      if (this.jobTimers.has(jobId)) {
        clearTimeout(this.jobTimers.get(jobId)!);
        this.jobTimers.delete(jobId);
      }
    }
  }

  /**
   * Enable a scheduled job
   * @param jobId - Job ID
   */
  public enableJob(jobId: string): void {
    const job = this.scheduledJobs.get(jobId);
    if (job) {
      job.isEnabled = true;
      job.updatedAt = new Date().toISOString();

      // Re-schedule
      if (job.interval > 0) {
        this.scheduleJobTimer(job);
      }
    }
  }

  /**
   * Delete a scheduled job
   * @param jobId - Job ID
   */
  public deleteJob(jobId: string): void {
    const job = this.scheduledJobs.get(jobId);
    if (job) {
      // Cancel timer
      if (this.jobTimers.has(jobId)) {
        clearTimeout(this.jobTimers.get(jobId)!);
        this.jobTimers.delete(jobId);
      }

      this.scheduledJobs.delete(jobId);
    }
  }

  /**
   * Get running jobs
   */
  public getRunningJobs(): ScheduledJob[] {
    return Array.from(this.runningJobs)
      .map((jobId) => this.scheduledJobs.get(jobId))
      .filter((job) => job !== undefined) as ScheduledJob[];
  }

  /**
   * Check for stale jobs and restart them
   * @param staleThresholdMs - Time threshold for stale detection (default 1 hour)
   * @returns Restarted jobs
   */
  public checkAndRestartStaleJobs(
    staleThresholdMs: number = 3600000,
  ): ScheduledJob[] {
    const now = Date.now();
    const restarted: ScheduledJob[] = [];

    for (const job of this.runningJobs) {
      const scheduledJob = this.scheduledJobs.get(job);
      if (scheduledJob) {
        const lastRunTime = scheduledJob.lastRunAt
          ? new Date(scheduledJob.lastRunAt).getTime()
          : now;
        if (now - lastRunTime > staleThresholdMs) {
          // Mark as not running and add to restart list
          scheduledJob.isRunning = false;
          this.runningJobs.delete(job);
          restarted.push(scheduledJob);

          const tenantConcurrency =
            (this.tenantConcurrencyMap.get(scheduledJob.tenantId) || 1) - 1;
          this.tenantConcurrencyMap.set(
            scheduledJob.tenantId,
            Math.max(0, tenantConcurrency),
          );
        }
      }
    }

    return restarted;
  }

  /**
   * Clear all jobs and timers (for cleanup)
   */
  public clear(): void {
    for (const timer of this.jobTimers.values()) {
      clearTimeout(timer);
    }
    this.jobTimers.clear();
    this.scheduledJobs.clear();
    this.runningJobs.clear();
    this.pausedPlatforms.clear();
    this.tenantConcurrencyMap.clear();
  }

  /**
   * Get scheduler statistics
   */
  public getStats(): {
    totalScheduledJobs: number;
    runningJobs: number;
    pausedPlatforms: number;
    avgConcurrency: number;
  } {
    let totalConcurrency = 0;
    let tenantCount = 0;

    for (const concurrency of this.tenantConcurrencyMap.values()) {
      totalConcurrency += concurrency;
      tenantCount++;
    }

    return {
      totalScheduledJobs: this.scheduledJobs.size,
      runningJobs: this.runningJobs.size,
      pausedPlatforms: this.pausedPlatforms.size,
      avgConcurrency: tenantCount > 0 ? totalConcurrency / tenantCount : 0,
    };
  }

  /**
   * Check if job can run given concurrency limits
   */
  private canRunConcurrently(tenantId: string): boolean {
    const currentConcurrency = this.tenantConcurrencyMap.get(tenantId) || 0;
    return currentConcurrency < this.maxConcurrentPerTenant;
  }

  /**
   * Schedule job timer
   */
  private scheduleJobTimer(job: ScheduledJob): void {
    // Clear existing timer if any
    if (this.jobTimers.has(job.jobId)) {
      clearTimeout(this.jobTimers.get(job.jobId)!);
    }

    if (job.interval === 0) return; // Don't schedule webhook-only jobs

    const now = Date.now();
    const nextRun = new Date(job.nextRunAt).getTime();
    const delay = Math.max(0, nextRun - now);

    const timer = setTimeout(() => {
      this.jobTimers.delete(job.jobId);
      // Timer fires, job will be picked up by getReadyJobs()
    }, delay);

    this.jobTimers.set(job.jobId, timer);
  }

  private generateJobId(): string {
    return `SCHED_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
