import { Queue } from "bullmq";
import { Redis } from "ioredis";

export interface QueueMetrics {
  name: string;
  jobsProcessedTotal: number;
  jobsDurationSeconds: {
    total: number;
    count: number;
    average: number;
  };
  queueSize: number;
  dlqSize: number;
  throughputPerMin: number;
  workerUtilization: number;
  completionRate: number;
  errorRate: number;
}

export class QueueMetrics {
  private redis: Redis;
  private queues: Map<string, Queue> = new Map();
  private metricsPrefix = "metrics:queue:";
  private processingTimes: Map<string, number[]> = new Map();

  constructor(redis: Redis) {
    this.redis = redis;
  }

  registerQueue(name: string, queue: Queue): void {
    this.queues.set(name, queue);
    this.processingTimes.set(name, []);
  }

  /**
   * Record a job completion
   */
  async recordJobCompletion(
    queueName: string,
    durationMs: number,
    success: boolean,
  ): Promise<void> {
    const successKey = `${this.metricsPrefix}${queueName}:completed`;
    const failedKey = `${this.metricsPrefix}${queueName}:failed`;
    const durationKey = `${this.metricsPrefix}${queueName}:duration_total`;
    const countKey = `${this.metricsPrefix}${queueName}:duration_count`;

    if (success) {
      await this.redis.incr(successKey);
    } else {
      await this.redis.incr(failedKey);
    }

    // Track processing times
    await this.redis.incr(durationKey);
    await this.redis.incrby(countKey, durationMs);

    // Keep moving average of last 100 jobs
    const times = this.processingTimes.get(queueName) || [];
    times.push(durationMs);
    if (times.length > 100) {
      times.shift();
    }
    this.processingTimes.set(queueName, times);
  }

  /**
   * Get throughput per minute for a queue
   */
  async getThroughputPerMin(queueName: string): Promise<number> {
    const key = `${this.metricsPrefix}${queueName}:completed`;
    const completedStr = await this.redis.get(key);
    const completed = completedStr ? parseInt(completedStr, 10) : 0;

    // Simple approximation: completed jobs in last 60 seconds
    // In production, use a sliding window counter
    const windowKey = `${this.metricsPrefix}${queueName}:window`;
    const windowCount = await this.redis.get(windowKey);

    return windowCount ? parseInt(windowCount, 10) : 0;
  }

  /**
   * Get average processing time in milliseconds
   */
  async getAvgProcessingTime(queueName: string): Promise<number> {
    const times = this.processingTimes.get(queueName) || [];
    if (times.length === 0) return 0;

    const total = times.reduce((sum, time) => sum + time, 0);
    return Math.round(total / times.length);
  }

  /**
   * Get worker utilization percentage
   */
  async getWorkerUtilization(queueName: string): Promise<number> {
    const queue = this.queues.get(queueName);
    if (!queue) return 0;

    try {
      const counts = await queue.getJobCounts("active");
      const activeCount = counts.active || 0;

      // Estimate based on active jobs (simplified)
      // In production, track actual worker capacity
      const estimatedCapacity = 10; // Default worker slots
      return Math.round((activeCount / estimatedCapacity) * 100);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get job completion rate (completed / (completed + failed))
   */
  async getCompletionRate(queueName: string): Promise<number> {
    const completedKey = `${this.metricsPrefix}${queueName}:completed`;
    const failedKey = `${this.metricsPrefix}${queueName}:failed`;

    const completedStr = await this.redis.get(completedKey);
    const failedStr = await this.redis.get(failedKey);

    const completed = completedStr ? parseInt(completedStr, 10) : 0;
    const failed = failedStr ? parseInt(failedStr, 10) : 0;

    const total = completed + failed;
    if (total === 0) return 100;

    return Math.round((completed / total) * 100);
  }

  /**
   * Get error rate percentage
   */
  async getErrorRate(queueName: string): Promise<number> {
    const completedKey = `${this.metricsPrefix}${queueName}:completed`;
    const failedKey = `${this.metricsPrefix}${queueName}:failed`;

    const completedStr = await this.redis.get(completedKey);
    const failedStr = await this.redis.get(failedKey);

    const completed = completedStr ? parseInt(completedStr, 10) : 0;
    const failed = failedStr ? parseInt(failedStr, 10) : 0;

    const total = completed + failed;
    if (total === 0) return 0;

    return Math.round((failed / total) * 100);
  }

  /**
   * Get all metrics for a queue
   */
  async getQueueMetrics(queueName: string): Promise<QueueMetrics> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return this.emptyMetrics(queueName);
    }

    try {
      const counts = await queue.getJobCounts(
        "waiting",
        "active",
        "delayed",
        "completed",
        "failed",
      );
      const completedKey = `${this.metricsPrefix}${queueName}:completed`;
      const completedStr = await this.redis.get(completedKey);
      const jobsProcessedTotal = completedStr ? parseInt(completedStr, 10) : 0;

      const times = this.processingTimes.get(queueName) || [];
      const totalDuration = times.reduce((sum, time) => sum + time, 0);

      const queueSize =
        (counts.waiting || 0) + (counts.active || 0) + (counts.delayed || 0);

      return {
        name: queueName,
        jobsProcessedTotal,
        jobsDurationSeconds: {
          total: Math.round(totalDuration / 1000),
          count: times.length,
          average: Math.round(totalDuration / Math.max(times.length, 1) / 1000),
        },
        queueSize,
        dlqSize: counts.failed || 0,
        throughputPerMin: await this.getThroughputPerMin(queueName),
        workerUtilization: await this.getWorkerUtilization(queueName),
        completionRate: await this.getCompletionRate(queueName),
        errorRate: await this.getErrorRate(queueName),
      };
    } catch (error) {
      return this.emptyMetrics(queueName);
    }
  }

  /**
   * Get metrics for all registered queues
   */
  async getAllQueueMetrics(): Promise<QueueMetrics[]> {
    const metrics: QueueMetrics[] = [];

    for (const [queueName] of this.queues.entries()) {
      const queueMetrics = await this.getQueueMetrics(queueName);
      metrics.push(queueMetrics);
    }

    return metrics;
  }

  /**
   * Export metrics in Prometheus format
   */
  async exportPrometheus(): Promise<string> {
    const allMetrics = await this.getAllQueueMetrics();
    let prometheusOutput = "";

    // Jobs processed total
    prometheusOutput +=
      "# HELP jobs_processed_total Total number of jobs processed\n";
    prometheusOutput += "# TYPE jobs_processed_total counter\n";
    for (const metrics of allMetrics) {
      prometheusOutput += `jobs_processed_total{queue="${metrics.name}"} ${metrics.jobsProcessedTotal}\n`;
    }

    // Job duration
    prometheusOutput +=
      "# HELP job_duration_seconds Job processing duration in seconds\n";
    prometheusOutput += "# TYPE job_duration_seconds gauge\n";
    for (const metrics of allMetrics) {
      prometheusOutput += `job_duration_seconds{queue="${metrics.name}",type="average"} ${metrics.jobsDurationSeconds.average}\n`;
      prometheusOutput += `job_duration_seconds{queue="${metrics.name}",type="total"} ${metrics.jobsDurationSeconds.total}\n`;
    }

    // Queue size
    prometheusOutput += "# HELP queue_size Number of jobs in queue\n";
    prometheusOutput += "# TYPE queue_size gauge\n";
    for (const metrics of allMetrics) {
      prometheusOutput += `queue_size{queue="${metrics.name}"} ${metrics.queueSize}\n`;
    }

    // DLQ size
    prometheusOutput += "# HELP dlq_size Number of jobs in dead letter queue\n";
    prometheusOutput += "# TYPE dlq_size gauge\n";
    for (const metrics of allMetrics) {
      prometheusOutput += `dlq_size{queue="${metrics.name}"} ${metrics.dlqSize}\n`;
    }

    // Throughput
    prometheusOutput +=
      "# HELP queue_throughput_per_minute Queue throughput in jobs per minute\n";
    prometheusOutput += "# TYPE queue_throughput_per_minute gauge\n";
    for (const metrics of allMetrics) {
      prometheusOutput += `queue_throughput_per_minute{queue="${metrics.name}"} ${metrics.throughputPerMin}\n`;
    }

    // Worker utilization
    prometheusOutput +=
      "# HELP worker_utilization_percent Worker utilization percentage\n";
    prometheusOutput += "# TYPE worker_utilization_percent gauge\n";
    for (const metrics of allMetrics) {
      prometheusOutput += `worker_utilization_percent{queue="${metrics.name}"} ${metrics.workerUtilization}\n`;
    }

    // Completion rate
    prometheusOutput +=
      "# HELP job_completion_rate Job completion rate percentage\n";
    prometheusOutput += "# TYPE job_completion_rate gauge\n";
    for (const metrics of allMetrics) {
      prometheusOutput += `job_completion_rate{queue="${metrics.name}"} ${metrics.completionRate}\n`;
    }

    // Error rate
    prometheusOutput += "# HELP job_error_rate Job error rate percentage\n";
    prometheusOutput += "# TYPE job_error_rate gauge\n";
    for (const metrics of allMetrics) {
      prometheusOutput += `job_error_rate{queue="${metrics.name}"} ${metrics.errorRate}\n`;
    }

    return prometheusOutput;
  }

  /**
   * Reset all metrics for a queue
   */
  async resetMetrics(queueName: string): Promise<void> {
    const completedKey = `${this.metricsPrefix}${queueName}:completed`;
    const failedKey = `${this.metricsPrefix}${queueName}:failed`;
    const durationKey = `${this.metricsPrefix}${queueName}:duration_total`;
    const countKey = `${this.metricsPrefix}${queueName}:duration_count`;

    await Promise.all([
      this.redis.del(completedKey),
      this.redis.del(failedKey),
      this.redis.del(durationKey),
      this.redis.del(countKey),
    ]);

    this.processingTimes.set(queueName, []);
  }

  private emptyMetrics(queueName: string): QueueMetrics {
    return {
      name: queueName,
      jobsProcessedTotal: 0,
      jobsDurationSeconds: {
        total: 0,
        count: 0,
        average: 0,
      },
      queueSize: 0,
      dlqSize: 0,
      throughputPerMin: 0,
      workerUtilization: 0,
      completionRate: 100,
      errorRate: 0,
    };
  }
}
