/**
 * Campaign Scheduler
 * Manages campaign scheduling with timezone support and rate limiting
 * Uses cron-like scheduling for recurring campaigns
 */

import { CampaignSchedule } from './types.js';

/**
 * Scheduled campaign job
 */
export interface ScheduledJob {
  jobId: string;
  campaignId: string;
  tenantId: string;
  scheduledAt: Date;
  timezone: string;
  maxSendsPerMinute: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rate limiting configuration per channel
 */
export interface RateLimitConfig {
  channel: string;
  maxSendsPerMinute: number;
}

/**
 * Scheduled campaign listing result
 */
export interface ScheduledCampaignResult {
  campaignId: string;
  scheduledAt: Date;
  timezone: string;
  status: string;
  recipientCount: number;
}

/**
 * Error class for scheduler
 */
export class SchedulerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchedulerError';
  }
}

/**
 * Campaign Scheduler for managing scheduled campaign execution
 */
export class CampaignScheduler {
  /**
   * Default rate limits per channel (sends per minute)
   */
  private readonly defaultRateLimits: Record<string, number> = {
    email: 1000, // Email has higher throughput
    sms: 100, // SMS is rate-limited by providers
    whatsapp: 50, // WhatsApp has strict rate limits
    push: 500, // Push is fast but has service limits
  };

  /**
   * Scheduled jobs storage (in-memory map for demo, would use database in production)
   */
  private scheduledJobs: Map<string, ScheduledJob> = new Map();

  constructor(
    private rateLimitOverrides?: Partial<Record<string, number>>
  ) {
    // Apply any custom rate limits
    if (rateLimitOverrides) {
      Object.assign(this.defaultRateLimits, rateLimitOverrides);
    }
  }

  /**
   * Schedule a campaign for execution
   * Returns the job ID for tracking
   */
  schedule(
    campaignId: string,
    tenantId: string,
    schedule: CampaignSchedule
  ): ScheduledJob {
    if (!campaignId || !tenantId || !schedule) {
      throw new SchedulerError('campaignId, tenantId, and schedule are required');
    }

    // Validate scheduled time is in future
    const scheduledAt = new Date(schedule.sendAt);
    const now = new Date();

    if (scheduledAt <= now) {
      throw new SchedulerError('Campaign must be scheduled for a future time');
    }

    // Get timezone, default to UTC
    const timezone = schedule.timezone || 'UTC';

    // Validate timezone is valid
    this.validateTimezone(timezone);

    // Generate job ID
    const jobId = this.generateJobId(campaignId, tenantId);

    // Determine rate limit based on campaign type
    const maxSendsPerMinute = this.getMaxSendsPerMinute('email'); // TODO: derive from campaign type

    const job: ScheduledJob = {
      jobId,
      campaignId,
      tenantId,
      scheduledAt,
      timezone,
      maxSendsPerMinute,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.scheduledJobs.set(jobId, job);

    return job;
  }

  /**
   * Cancel a scheduled campaign
   */
  cancel(campaignId: string): boolean {
    // Find and cancel the job for this campaign
    for (const [jobId, job] of this.scheduledJobs.entries()) {
      if (job.campaignId === campaignId && job.status === 'pending') {
        job.status = 'cancelled';
        job.updatedAt = new Date();
        this.scheduledJobs.set(jobId, job);
        return true;
      }
    }

    return false;
  }

  /**
   * Get all scheduled campaigns for a tenant
   */
  getScheduled(tenantId: string): ScheduledCampaignResult[] {
    const results: ScheduledCampaignResult[] = [];

    for (const job of this.scheduledJobs.values()) {
      if (job.tenantId === tenantId && job.status === 'pending') {
        results.push({
          campaignId: job.campaignId,
          scheduledAt: job.scheduledAt,
          timezone: job.timezone,
          status: job.status,
          recipientCount: 0, // Would be populated from database
        });
      }
    }

    // Sort by scheduled time ascending
    results.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

    return results;
  }

  /**
   * Get a specific scheduled job
   */
  getJob(jobId: string): ScheduledJob | undefined {
    return this.scheduledJobs.get(jobId);
  }

  /**
   * Update job status
   */
  updateJobStatus(
    jobId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  ): ScheduledJob {
    const job = this.scheduledJobs.get(jobId);
    if (!job) {
      throw new SchedulerError(`Job not found: ${jobId}`);
    }

    job.status = status;
    job.updatedAt = new Date();
    this.scheduledJobs.set(jobId, job);

    return job;
  }

  /**
   * Get max sends per minute for a channel
   */
  getMaxSendsPerMinute(channel: string): number {
    return this.defaultRateLimits[channel] || 100;
  }

  /**
   * Calculate batch size based on rate limits and time window
   * Ensures we don't exceed rate limits when sending
   */
  calculateBatchSize(channel: string, durationSeconds: number): number {
    const maxPerMinute = this.getMaxSendsPerMinute(channel);
    const maxPerSecond = maxPerMinute / 60;
    const batchSize = Math.max(1, Math.floor(maxPerSecond * durationSeconds));

    return batchSize;
  }

  /**
   * Calculate delay between batches to respect rate limits
   * Returns delay in milliseconds
   */
  calculateDelayBetweenBatches(
    channel: string,
    batchSize: number
  ): number {
    const maxPerMinute = this.getMaxSendsPerMinute(channel);
    const delayMs = (batchSize / maxPerMinute) * 60 * 1000;

    return Math.ceil(delayMs);
  }

  /**
   * Validate timezone string
   */
  private validateTimezone(timezone: string): void {
    // List of valid IANA timezones (subset for demo)
    const validTimezones = [
      'UTC',
      'America/New_York',
      'America/Los_Angeles',
      'America/Chicago',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Hong_Kong',
      'Asia/Singapore',
      'Asia/Dubai',
      'Asia/Kolkata',
      'Australia/Sydney',
      'Australia/Melbourne',
      'Pacific/Auckland',
      'America/Toronto',
      'America/Mexico_City',
      'America/Sao_Paulo',
      'Africa/Johannesburg',
    ];

    if (!validTimezones.includes(timezone)) {
      throw new SchedulerError(
        `Invalid timezone: ${timezone}. Must be a valid IANA timezone string.`
      );
    }
  }

  /**
   * Generate a unique job ID
   */
  private generateJobId(campaignId: string, tenantId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `job_${tenantId}_${campaignId}_${timestamp}_${random}`;
  }

  /**
   * Get rate limit configuration for a channel
   */
  getRateLimitConfig(channel: string): RateLimitConfig {
    return {
      channel,
      maxSendsPerMinute: this.getMaxSendsPerMinute(channel),
    };
  }

  /**
   * Cleanup old completed/failed jobs (for memory management)
   * In production, this would be handled by the database
   */
  cleanup(olderThanDays: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    let deletedCount = 0;

    for (const [jobId, job] of this.scheduledJobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
        job.updatedAt < cutoffDate
      ) {
        this.scheduledJobs.delete(jobId);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}
