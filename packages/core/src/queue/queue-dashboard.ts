import { Queue, Worker, QueueEvents, Job } from "bullmq";
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Redis } from "ioredis";

export interface QueueStats {
  name: string;
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  isPaused: number;
  throughputPerMin: number;
  avgProcessingTimeMs: number;
  errorRate: number;
}

export interface JobDetails {
  id: string;
  name: string;
  data: any;
  progress: number;
  attempts: number;
  maxAttempts: number;
  failedReason?: string;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  logs: string[];
  status: "waiting" | "active" | "completed" | "failed" | "delayed" | "paused";
}

export interface QueueHealth {
  throughputPerMin: number;
  avgProcessingTimeMs: number;
  errorRate: number;
  workerCount: number;
  totalProcessed: number;
  totalFailed: number;
}

export class QueueDashboard {
  private queues: Map<string, Queue> = new Map();
  private redis: Redis;
  private queueNames: string[] = [];

  constructor(redis: Redis, queueNames: string[] = []) {
    this.redis = redis;
    this.queueNames = queueNames;
  }

  registerQueue(name: string, queue: Queue): void {
    this.queues.set(name, queue);
    if (!this.queueNames.includes(name)) {
      this.queueNames.push(name);
    }
  }

  async getAllQueuesStats(): Promise<QueueStats[]> {
    const stats: QueueStats[] = [];

    for (const queueName of this.queueNames) {
      const queue = this.queues.get(queueName);
      if (!queue) continue;

      const counts = await queue.getJobCounts(
        "active",
        "waiting",
        "completed",
        "failed",
        "delayed",
        "paused",
      );

      const isPaused = await queue.isPaused();
      const health = await this.getQueueHealth(queueName);

      stats.push({
        name: queueName,
        active: counts.active || 0,
        waiting: counts.waiting || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
        paused: isPaused,
        isPaused: isPaused ? 1 : 0,
        throughputPerMin: health.throughputPerMin,
        avgProcessingTimeMs: health.avgProcessingTimeMs,
        errorRate: health.errorRate,
      });
    }

    return stats;
  }

  async getJobDetails(
    queueName: string,
    jobId: string,
  ): Promise<JobDetails | null> {
    const queue = this.queues.get(queueName);
    if (!queue) return null;

    const job = await queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    const progress = job.progress();
    const logs = await job.logs(0, -1);

    return {
      id: job.id || "",
      name: job.name,
      data: job.data,
      progress: typeof progress === "number" ? progress : 0,
      attempts: job.attemptsMade || 0,
      maxAttempts: job.opts?.attempts || 0,
      failedReason: job.failedReason,
      timestamp: job.timestamp || 0,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      logs: logs.map((log) => log.msg),
      status: (state as JobDetails["status"]) || "waiting",
    };
  }

  async retryJob(queueName: string, jobId: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) return false;

    const job = await queue.getJob(jobId);
    if (!job) return false;

    try {
      await job.retry("failed");
      return true;
    } catch (error) {
      return false;
    }
  }

  async retryAllFailed(queueName: string): Promise<number> {
    const queue = this.queues.get(queueName);
    if (!queue) return 0;

    const failedJobs = await queue.getFailed(0, -1);
    let retried = 0;

    for (const job of failedJobs) {
      try {
        await job.retry("failed");
        retried++;
      } catch (error) {
        // Continue with next job
      }
    }

    return retried;
  }

  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) return false;

    const job = await queue.getJob(jobId);
    if (!job) return false;

    try {
      await job.remove();
      return true;
    } catch (error) {
      return false;
    }
  }

  async cleanCompletedJobs(
    queueName: string,
    olderThanDays: number,
  ): Promise<number> {
    const queue = this.queues.get(queueName);
    if (!queue) return 0;

    const timestamp = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const completedJobs = await queue.getCompleted(0, -1);

    let cleaned = 0;
    for (const job of completedJobs) {
      if ((job.finishedOn || 0) < timestamp) {
        try {
          await job.remove();
          cleaned++;
        } catch (error) {
          // Continue with next job
        }
      }
    }

    return cleaned;
  }

  async pauseQueue(queueName: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) return false;

    try {
      await queue.pause();
      return true;
    } catch (error) {
      return false;
    }
  }

  async resumeQueue(queueName: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) return false;

    try {
      await queue.resume();
      return true;
    } catch (error) {
      return false;
    }
  }

  private async getQueueHealth(queueName: string): Promise<QueueHealth> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return {
        throughputPerMin: 0,
        avgProcessingTimeMs: 0,
        errorRate: 0,
        workerCount: 0,
        totalProcessed: 0,
        totalFailed: 0,
      };
    }

    try {
      const counts = await queue.getJobCounts("completed", "failed");

      const totalProcessed = counts.completed || 0;
      const totalFailed = counts.failed || 0;
      const errorRate =
        totalProcessed > 0
          ? (totalFailed / (totalProcessed + totalFailed)) * 100
          : 0;

      // Calculate throughput per minute from Redis stats
      const statsKey = `bull:${queueName}:stats:processed`;
      const throughputStr = await this.redis.get(statsKey);
      const throughputPerMin = throughputStr ? parseInt(throughputStr, 10) : 0;

      const avgTimeKey = `bull:${queueName}:stats:avgTime`;
      const avgTimeStr = await this.redis.get(avgTimeKey);
      const avgProcessingTimeMs = avgTimeStr ? parseInt(avgTimeStr, 10) : 0;

      return {
        throughputPerMin,
        avgProcessingTimeMs,
        errorRate,
        workerCount: 1, // Placeholder for worker tracking
        totalProcessed,
        totalFailed,
      };
    } catch (error) {
      return {
        throughputPerMin: 0,
        avgProcessingTimeMs: 0,
        errorRate: 0,
        workerCount: 0,
        totalProcessed: 0,
        totalFailed: 0,
      };
    }
  }
}

export async function registerQueueDashboard(
  fastify: FastifyInstance,
  dashboard: QueueDashboard,
): Promise<void> {
  // Get all queues with stats
  fastify.get(
    "/api/queues",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const stats = await dashboard.getAllQueuesStats();
      return reply.send({ queues: stats });
    },
  );

  // Get job details
  fastify.get<{ Params: { queueName: string; jobId: string } }>(
    "/api/queues/:queueName/jobs/:jobId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { queueName, jobId } = request.params as any;
      const job = await dashboard.getJobDetails(queueName, jobId);

      if (!job) {
        return reply.status(404).send({ error: "Job not found" });
      }

      return reply.send(job);
    },
  );

  // Retry single job
  fastify.post<{ Params: { queueName: string; jobId: string } }>(
    "/api/queues/:queueName/jobs/:jobId/retry",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { queueName, jobId } = request.params as any;
      const success = await dashboard.retryJob(queueName, jobId);

      if (!success) {
        return reply.status(400).send({ error: "Failed to retry job" });
      }

      return reply.send({ success: true });
    },
  );

  // Retry all failed jobs
  fastify.post<{ Params: { queueName: string } }>(
    "/api/queues/:queueName/retry-all-failed",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { queueName } = request.params as any;
      const count = await dashboard.retryAllFailed(queueName);
      return reply.send({ retriedCount: count });
    },
  );

  // Remove job
  fastify.delete<{ Params: { queueName: string; jobId: string } }>(
    "/api/queues/:queueName/jobs/:jobId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { queueName, jobId } = request.params as any;
      const success = await dashboard.removeJob(queueName, jobId);

      if (!success) {
        return reply.status(400).send({ error: "Failed to remove job" });
      }

      return reply.send({ success: true });
    },
  );

  // Clean completed jobs older than X days
  fastify.post<{
    Params: { queueName: string };
    Body: { olderThanDays: number };
  }>(
    "/api/queues/:queueName/clean-completed",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { queueName } = request.params as any;
      const { olderThanDays } = request.body as any;
      const cleaned = await dashboard.cleanCompletedJobs(
        queueName,
        olderThanDays || 7,
      );
      return reply.send({ cleanedCount: cleaned });
    },
  );

  // Pause queue
  fastify.post<{ Params: { queueName: string } }>(
    "/api/queues/:queueName/pause",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { queueName } = request.params as any;
      const success = await dashboard.pauseQueue(queueName);

      if (!success) {
        return reply.status(400).send({ error: "Failed to pause queue" });
      }

      return reply.send({ success: true });
    },
  );

  // Resume queue
  fastify.post<{ Params: { queueName: string } }>(
    "/api/queues/:queueName/resume",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { queueName } = request.params as any;
      const success = await dashboard.resumeQueue(queueName);

      if (!success) {
        return reply.status(400).send({ error: "Failed to resume queue" });
      }

      return reply.send({ success: true });
    },
  );
}
