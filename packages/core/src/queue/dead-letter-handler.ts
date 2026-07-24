import { Queue, Job } from "bullmq";
import { Redis } from "ioredis";

export type FailureCategory =
  | "timeout"
  | "validation"
  | "external_api"
  | "database"
  | "unknown";

export interface DLQItem {
  jobId: string;
  jobName: string;
  queue: string;
  data: any;
  failedReason: string;
  category: FailureCategory;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  failedAt: Date;
}

export interface DLQAlert {
  level: "warning" | "critical";
  count: number;
  threshold: number;
  timestamp: Date;
}

export class DeadLetterQueue {
  private redis: Redis;
  private dlqKey = "bull:dlq:items";
  private dlqAlertKey = "bull:dlq:alerts";
  private dlqCleanupCheckInterval = 24 * 60 * 60 * 1000; // 24 hours
  private lastCleanupCheck = 0;

  private failurePatterns = {
    timeout: /timeout|timed out|exceeded|deadline/i,
    validation: /validation|invalid|schema|required|format/i,
    external_api: /api|external|service|connection|network|http/i,
    database: /database|sql|query|constraint|unique|foreign/i,
  };

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Categorize failure based on error message
   */
  private categorizeFailure(failedReason: string): FailureCategory {
    for (const [category, pattern] of Object.entries(this.failurePatterns)) {
      if (pattern.test(failedReason)) {
        return category as FailureCategory;
      }
    }
    return "unknown";
  }

  /**
   * Add job to DLQ when it fails permanently
   */
  async addToDeadLetter(
    queue: Queue,
    job: Job,
    failedReason: string,
  ): Promise<void> {
    const category = this.categorizeFailure(failedReason);

    const dlqItem: DLQItem = {
      jobId: job.id || "",
      jobName: job.name,
      queue: queue.name,
      data: job.data,
      failedReason,
      category,
      attempts: job.attemptsMade || 0,
      maxAttempts: job.opts?.attempts || 0,
      createdAt: new Date(job.timestamp || Date.now()),
      failedAt: new Date(),
    };

    // Store in Redis hash
    const itemKey = `${dlqItem.queue}:${dlqItem.jobId}`;
    await this.redis.hset(this.dlqKey, itemKey, JSON.stringify(dlqItem));

    // Check thresholds for alerts
    await this.checkDLQThresholds();
  }

  /**
   * Get all items in DLQ for a queue
   */
  async listDeadLetters(queueName?: string): Promise<DLQItem[]> {
    const allItems = await this.redis.hgetall(this.dlqKey);
    const items: DLQItem[] = [];

    for (const itemJson of Object.values(allItems)) {
      const item = JSON.parse(itemJson) as DLQItem;
      if (!queueName || item.queue === queueName) {
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Get specific DLQ item
   */
  async getDeadLetter(
    jobId: string,
    queueName: string,
  ): Promise<DLQItem | null> {
    const itemKey = `${queueName}:${jobId}`;
    const itemJson = await this.redis.hget(this.dlqKey, itemKey);

    if (!itemJson) return null;
    return JSON.parse(itemJson) as DLQItem;
  }

  /**
   * Retry a dead letter job
   */
  async retryDeadLetter(queue: Queue, jobId: string): Promise<boolean> {
    const dlqItem = await this.getDeadLetter(jobId, queue.name);
    if (!dlqItem) return false;

    try {
      // Add job back to queue with fresh attempt count
      await queue.add(dlqItem.jobName, dlqItem.data, {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      });

      // Remove from DLQ
      const itemKey = `${queue.name}:${jobId}`;
      await this.redis.hdel(this.dlqKey, itemKey);

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Bulk retry all dead letters in a queue
   */
  async bulkRetryDeadLetters(queue: Queue): Promise<number> {
    const items = await this.listDeadLetters(queue.name);
    let retried = 0;

    for (const item of items) {
      if (await this.retryDeadLetter(queue, item.jobId)) {
        retried++;
      }
    }

    return retried;
  }

  /**
   * Remove a dead letter item
   */
  async removeDeadLetter(jobId: string, queueName: string): Promise<boolean> {
    const itemKey = `${queueName}:${jobId}`;
    const result = await this.redis.hdel(this.dlqKey, itemKey);
    return result > 0;
  }

  /**
   * Purge all dead letters for a queue
   */
  async purgeDeadLetters(queueName: string): Promise<number> {
    const items = await this.listDeadLetters(queueName);

    for (const item of items) {
      await this.removeDeadLetter(item.jobId, queueName);
    }

    return items.length;
  }

  /**
   * Check DLQ against thresholds and alert if needed
   */
  private async checkDLQThresholds(): Promise<void> {
    const items = await this.listDeadLetters();
    const count = items.length;

    const alerts: DLQAlert[] = [];

    if (count > 50) {
      alerts.push({
        level: "critical",
        count,
        threshold: 50,
        timestamp: new Date(),
      });
    } else if (count > 10) {
      alerts.push({
        level: "warning",
        count,
        threshold: 10,
        timestamp: new Date(),
      });
    }

    if (alerts.length > 0) {
      for (const alert of alerts) {
        await this.redis.rpush(this.dlqAlertKey, JSON.stringify(alert));
      }

      // Keep last 100 alerts
      await this.redis.ltrim(this.dlqAlertKey, -100, -1);
    }
  }

  /**
   * Get DLQ alerts
   */
  async getDLQAlerts(limit: number = 10): Promise<DLQAlert[]> {
    const alertsJson = await this.redis.lrange(this.dlqAlertKey, -limit, -1);

    return alertsJson.map((json) => JSON.parse(json) as DLQAlert);
  }

  /**
   * Get failure categorization stats
   */
  async getFailureStats(
    queueName?: string,
  ): Promise<Record<FailureCategory, number>> {
    const items = await this.listDeadLetters(queueName);
    const stats: Record<FailureCategory, number> = {
      timeout: 0,
      validation: 0,
      external_api: 0,
      database: 0,
      unknown: 0,
    };

    for (const item of items) {
      stats[item.category]++;
    }

    return stats;
  }

  /**
   * Auto-cleanup dead letters older than 30 days
   */
  async autoCleanup(): Promise<number> {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const items = await this.listDeadLetters();

    let cleaned = 0;
    for (const item of items) {
      const age = now - item.failedAt.getTime();
      if (age > thirtyDaysMs) {
        await this.removeDeadLetter(item.jobId, item.queue);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Trigger cleanup if needed (runs at most every 24 hours)
   */
  async triggerCleanupIfNeeded(): Promise<number> {
    const now = Date.now();
    if (now - this.lastCleanupCheck < this.dlqCleanupCheckInterval) {
      return 0;
    }

    this.lastCleanupCheck = now;
    return await this.autoCleanup();
  }

  /**
   * Get DLQ size for a queue
   */
  async getSize(queueName?: string): Promise<number> {
    const items = await this.listDeadLetters(queueName);
    return items.length;
  }

  /**
   * Export DLQ items as JSON
   */
  async exportAsJson(queueName?: string): Promise<string> {
    const items = await this.listDeadLetters(queueName);
    return JSON.stringify(items, null, 2);
  }
}
