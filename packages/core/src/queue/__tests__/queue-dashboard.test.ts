import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { QueueDashboard } from '../queue-dashboard';

describe('QueueDashboard', () => {
  let redis: Redis;
  let dashboard: QueueDashboard;
  let mockQueue: any;

  beforeEach(() => {
    redis = new Redis();
    dashboard = new QueueDashboard(redis, ['test-queue']);

    mockQueue = {
      name: 'test-queue',
      getJobCounts: vi.fn().mockResolvedValue({
        active: 5,
        waiting: 10,
        completed: 100,
        failed: 2,
        delayed: 3,
        paused: 0,
      }),
      isPaused: vi.fn().mockResolvedValue(false),
      getJob: vi.fn(),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
    };

    dashboard.registerQueue('test-queue', mockQueue as any);
  });

  afterEach(async () => {
    await redis.disconnect();
  });

  describe('getAllQueuesStats', () => {
    it('should return stats for all queues', async () => {
      const stats = await dashboard.getAllQueuesStats();

      expect(stats).toHaveLength(1);
      expect(stats[0]).toMatchObject({
        name: 'test-queue',
        active: 5,
        waiting: 10,
        completed: 100,
        failed: 2,
        delayed: 3,
      });
    });

    it('should handle missing queues gracefully', async () => {
      const emptyDashboard = new QueueDashboard(redis, ['nonexistent']);
      const stats = await emptyDashboard.getAllQueuesStats();

      expect(stats).toHaveLength(0);
    });
  });

  describe('getJobDetails', () => {
    it('should return job details', async () => {
      const mockJob = {
        id: 'job-123',
        name: 'test-job',
        data: { test: 'data' },
        progress: vi.fn().mockReturnValue(50),
        attemptsMade: 1,
        opts: { attempts: 3 },
        failedReason: null,
        timestamp: Date.now(),
        processedOn: Date.now() - 1000,
        finishedOn: null,
        logs: vi.fn().mockResolvedValue([
          { msg: 'Starting job' },
          { msg: 'Processing data' },
        ]),
        getState: vi.fn().mockResolvedValue('active'),
      };

      mockQueue.getJob.mockResolvedValue(mockJob);

      const details = await dashboard.getJobDetails('test-queue', 'job-123');

      expect(details).toMatchObject({
        id: 'job-123',
        name: 'test-job',
        data: { test: 'data' },
        progress: 50,
        attempts: 1,
        maxAttempts: 3,
        status: 'active',
      });
      expect(details?.logs).toContain('Starting job');
    });

    it('should return null for missing job', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const details = await dashboard.getJobDetails('test-queue', 'nonexistent');

      expect(details).toBeNull();
    });
  });

  describe('retryJob', () => {
    it('should retry a single job', async () => {
      const mockJob = {
        id: 'job-123',
        retry: vi.fn().mockResolvedValue(undefined),
      };

      mockQueue.getJob.mockResolvedValue(mockJob);

      const success = await dashboard.retryJob('test-queue', 'job-123');

      expect(success).toBe(true);
      expect(mockJob.retry).toHaveBeenCalledWith('failed');
    });

    it('should handle retry failure', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      const success = await dashboard.retryJob('test-queue', 'nonexistent');

      expect(success).toBe(false);
    });
  });

  describe('pauseQueue and resumeQueue', () => {
    it('should pause a queue', async () => {
      const success = await dashboard.pauseQueue('test-queue');

      expect(success).toBe(true);
      expect(mockQueue.pause).toHaveBeenCalled();
    });

    it('should resume a queue', async () => {
      const success = await dashboard.resumeQueue('test-queue');

      expect(success).toBe(true);
      expect(mockQueue.resume).toHaveBeenCalled();
    });
  });

  describe('removeJob', () => {
    it('should remove a job', async () => {
      const mockJob = {
        id: 'job-123',
        remove: vi.fn().mockResolvedValue(undefined),
      };

      mockQueue.getJob.mockResolvedValue(mockJob);

      const success = await dashboard.removeJob('test-queue', 'job-123');

      expect(success).toBe(true);
      expect(mockJob.remove).toHaveBeenCalled();
    });
  });

  describe('cleanCompletedJobs', () => {
    it('should clean completed jobs older than X days', async () => {
      const oldDate = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
      const recentDate = Date.now() - 1 * 24 * 60 * 60 * 1000; // 1 day ago

      const mockJobs = [
        {
          id: 'old-job',
          finishedOn: oldDate,
          remove: vi.fn().mockResolvedValue(undefined),
        },
        {
          id: 'recent-job',
          finishedOn: recentDate,
          remove: vi.fn(),
        },
      ];

      mockQueue.getCompleted.mockResolvedValue(mockJobs);

      const cleaned = await dashboard.cleanCompletedJobs('test-queue', 7);

      expect(cleaned).toBe(1);
      expect(mockJobs[0].remove).toHaveBeenCalled();
      expect(mockJobs[1].remove).not.toHaveBeenCalled();
    });
  });

  describe('retryAllFailed', () => {
    it('should retry all failed jobs', async () => {
      const mockJobs = [
        { id: 'fail-1', retry: vi.fn().mockResolvedValue(undefined) },
        { id: 'fail-2', retry: vi.fn().mockResolvedValue(undefined) },
      ];

      mockQueue.getFailed.mockResolvedValue(mockJobs);

      const count = await dashboard.retryAllFailed('test-queue');

      expect(count).toBe(2);
      expect(mockJobs[0].retry).toHaveBeenCalledWith('failed');
      expect(mockJobs[1].retry).toHaveBeenCalledWith('failed');
    });
  });
});
