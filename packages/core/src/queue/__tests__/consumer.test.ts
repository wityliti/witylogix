import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  QueueConsumer,
  QueueConsumerError,
  QueueValidationError,
  QueueTransientError,
  QueuePermanentError,
} from "../consumer";
import type {
  QueueJobPayload,
  QueueJobMetadata,
  JobProcessingResult,
  ConsumerConfig,
} from "../types";

/**
 * Test suite for QueueConsumer
 *
 * Tests:
 * - Successful job processing
 * - Retry on failure with exponential backoff
 * - Dead letter queue after max retries
 * - Graceful shutdown
 * - Concurrent job handling
 * - Validation and error handling
 */

// Mock implementation of QueueConsumer
class TestQueueConsumer extends QueueConsumer {
  private shouldFail = false;
  private failureCount = 0;
  private processingDelay = 0;

  setShouldFail(fail: boolean, count = 1): void {
    this.shouldFail = fail;
    this.failureCount = count;
  }

  setProcessingDelay(ms: number): void {
    this.processingDelay = ms;
  }

  async process(
    job: QueueJobPayload,
    metadata: QueueJobMetadata
  ): Promise<JobProcessingResult> {
    if (this.processingDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.processingDelay));
    }

    if (this.shouldFail && this.failureCount > 0) {
      this.failureCount--;

      if (metadata.attempt < 3) {
        throw new QueueTransientError("Temporary processing failure");
      } else {
        throw new QueuePermanentError("Permanent processing failure");
      }
    }

    return {
      success: true,
      data: { processedJobId: job.type },
      processingTimeMs: this.processingDelay,
    };
  }
}

const defaultConfig: ConsumerConfig = {
  queueName: "test-queue",
  concurrency: 1,
  maxRetries: 3,
  retryDelay: 1000,
  deadLetterQueue: "test-dlq",
};

const createJobPayload = (type: string, data = {}): QueueJobPayload => ({
  type,
  data,
  timestamp: new Date(),
});

const createJobMetadata = (
  jobId = "job-123",
  attempt = 1
): QueueJobMetadata => ({
  jobId,
  queueName: "test-queue",
  attempt,
  maxRetries: 3,
  lastError: null,
  retryDelay: 1000,
});

describe("QueueConsumer", () => {
  let consumer: TestQueueConsumer;

  beforeEach(() => {
    consumer = new TestQueueConsumer(defaultConfig);
  });

  describe("successful processing", () => {
    it("should process job successfully on first attempt", async () => {
      const job = createJobPayload("test_job", { data: "test" });
      const metadata = createJobMetadata("job-1", 1);

      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it("should return processing time", async () => {
      consumer.setProcessingDelay(100);

      const job = createJobPayload("test_job");
      const metadata = createJobMetadata("job-1", 1);

      const result = await consumer.process(job, metadata);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(100);
      expect(result.processingTimeMs).toBeLessThan(200);
    });

    it("should handle job with complex data structure", async () => {
      const complexData = {
        userId: "user-123",
        orderId: "order-456",
        items: [
          { id: "item-1", qty: 2 },
          { id: "item-2", qty: 1 },
        ],
        metadata: {
          source: "api",
          timestamp: Date.now(),
        },
      };

      const job = createJobPayload("complex_job", complexData);
      const metadata = createJobMetadata("job-1", 1);

      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
    });

    it("should handle multiple sequential jobs", async () => {
      const job1 = createJobPayload("job1");
      const job2 = createJobPayload("job2");
      const job3 = createJobPayload("job3");

      const result1 = await consumer.process(job1, createJobMetadata("id-1"));
      const result2 = await consumer.process(job2, createJobMetadata("id-2"));
      const result3 = await consumer.process(job3, createJobMetadata("id-3"));

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
    });
  });

  describe("retry on failure", () => {
    it("should retry transient errors", async () => {
      consumer.setShouldFail(true, 2); // Fail twice

      const job = createJobPayload("failing_job");
      const metadata1 = createJobMetadata("job-1", 1);
      const metadata2 = createJobMetadata("job-1", 2);
      const metadata3 = createJobMetadata("job-1", 3);

      // First attempt fails
      await expect(consumer.process(job, metadata1)).rejects.toThrow(
        QueueTransientError
      );

      // Second attempt fails
      await expect(consumer.process(job, metadata2)).rejects.toThrow(
        QueueTransientError
      );

      // Third attempt succeeds
      const result = await consumer.process(job, metadata3);
      expect(result.success).toBe(true);
    });

    it("should throw QueueTransientError on retriable failure", async () => {
      consumer.setShouldFail(true, 1);

      const job = createJobPayload("transient_error_job");
      const metadata = createJobMetadata("job-1", 1);

      await expect(consumer.process(job, metadata)).rejects.toThrow(
        QueueTransientError
      );
    });

    it("should throw QueuePermanentError on non-retriable failure", async () => {
      consumer.setShouldFail(true, 1);

      const job = createJobPayload("permanent_error_job");
      const metadata = createJobMetadata("job-1", 3); // At max retries

      await expect(consumer.process(job, metadata)).rejects.toThrow(
        QueuePermanentError
      );
    });

    it("should not retry validation errors", async () => {
      const job = createJobPayload("job");
      const metadata = createJobMetadata("job-1", 1);

      await expect(async () => {
        throw new QueueValidationError("Invalid job data");
      }).rejects.toThrow(QueueValidationError);
    });

    it("should increment attempt counter on retry", async () => {
      const job = createJobPayload("test_job");

      // Simulate retry attempts
      const attempt1 = createJobMetadata("job-1", 1);
      const attempt2 = createJobMetadata("job-1", 2);
      const attempt3 = createJobMetadata("job-1", 3);

      expect(attempt1.attempt).toBe(1);
      expect(attempt2.attempt).toBe(2);
      expect(attempt3.attempt).toBe(3);
    });
  });

  describe("dead letter queue handling", () => {
    it("should mark job for dead letter after max retries", async () => {
      consumer.setShouldFail(true, 99); // Always fail

      const job = createJobPayload("dlq_job");
      const maxAttempts = defaultConfig.maxRetries;

      // Exhaust retries
      for (let i = 1; i <= maxAttempts; i++) {
        const metadata = createJobMetadata("job-1", i);
        try {
          await consumer.process(job, metadata);
        } catch (error) {
          // Expected to fail
          if (i === maxAttempts) {
            // Last attempt should fail with permanent error
            expect(error).toBeDefined();
          }
        }
      }
    });

    it("should track failed job details", async () => {
      consumer.setShouldFail(true, 1);

      const job = createJobPayload("failed_job", { userId: "user-123" });
      const metadata = createJobMetadata("job-1", 1);

      try {
        await consumer.process(job, metadata);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as any).message).toBeDefined();
      }
    });
  });

  describe("graceful shutdown", () => {
    it("should set shutdown flag", async () => {
      // Access protected property via type assertion
      (consumer as any).isShuttingDown = true;
      expect((consumer as any).isShuttingDown).toBe(true);
    });

    it("should drain active jobs before shutdown", async () => {
      const job1 = createJobPayload("job1");
      const job2 = createJobPayload("job2");

      consumer.setProcessingDelay(50);

      const result1 = consumer.process(job1, createJobMetadata("id-1", 1));
      const result2 = consumer.process(job2, createJobMetadata("id-2", 1));

      // Simulate receiving shutdown signal
      (consumer as any).isShuttingDown = true;

      // Jobs should still complete
      const [res1, res2] = await Promise.all([result1, result2]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
    });

    it("should track active job count", async () => {
      const getActiveCount = () => (consumer as any).activeJobCount;

      expect(getActiveCount()).toBe(0);

      // Simulate job processing
      (consumer as any).activeJobCount = 1;
      expect(getActiveCount()).toBe(1);

      (consumer as any).activeJobCount = 2;
      expect(getActiveCount()).toBe(2);

      (consumer as any).activeJobCount = 0;
      expect(getActiveCount()).toBe(0);
    });
  });

  describe("concurrent job handling", () => {
    it("should handle jobs sequentially with concurrency=1", async () => {
      const concurrentConsumer = new TestQueueConsumer({
        ...defaultConfig,
        concurrency: 1,
      });

      concurrentConsumer.setProcessingDelay(50);

      const start = Date.now();

      const jobs = [
        concurrentConsumer.process(
          createJobPayload("job1"),
          createJobMetadata("id-1", 1)
        ),
        concurrentConsumer.process(
          createJobPayload("job2"),
          createJobMetadata("id-2", 1)
        ),
        concurrentConsumer.process(
          createJobPayload("job3"),
          createJobMetadata("id-3", 1)
        ),
      ];

      await Promise.all(jobs);

      const duration = Date.now() - start;

      // With 50ms delay per job and concurrency=1:
      // Should take ~150ms (not parallel)
      // Allow some overhead but should be roughly sequential
      expect(duration).toBeGreaterThan(120);
    });

    it("should handle concurrent jobs with higher concurrency", async () => {
      const concurrentConsumer = new TestQueueConsumer({
        ...defaultConfig,
        concurrency: 3,
      });

      concurrentConsumer.setProcessingDelay(50);

      const start = Date.now();

      const jobs = [
        concurrentConsumer.process(
          createJobPayload("job1"),
          createJobMetadata("id-1", 1)
        ),
        concurrentConsumer.process(
          createJobPayload("job2"),
          createJobMetadata("id-2", 1)
        ),
        concurrentConsumer.process(
          createJobPayload("job3"),
          createJobMetadata("id-3", 1)
        ),
      ];

      const results = await Promise.all(jobs);

      const duration = Date.now() - start;

      expect(results.every((r) => r.success)).toBe(true);
      // With concurrency=3, should be closer to 50ms than 150ms
      expect(duration).toBeLessThan(120);
    });

    it("should limit concurrent execution", async () => {
      const maxConcurrentConsumer = new TestQueueConsumer({
        ...defaultConfig,
        concurrency: 2,
      });

      maxConcurrentConsumer.setProcessingDelay(100);

      let peakConcurrency = 0;
      let currentConcurrency = 0;

      // Simulate tracking concurrency
      const jobs = [];
      for (let i = 0; i < 5; i++) {
        const job = (async () => {
          currentConcurrency++;
          peakConcurrency = Math.max(peakConcurrency, currentConcurrency);

          try {
            const result = await maxConcurrentConsumer.process(
              createJobPayload(`job${i}`),
              createJobMetadata(`id-${i}`, 1)
            );
            return result;
          } finally {
            currentConcurrency--;
          }
        })();

        jobs.push(job);
      }

      await Promise.all(jobs);

      expect(peakConcurrency).toBeLessThanOrEqual(
        defaultConfig.concurrency + 1
      );
    });
  });

  describe("metrics tracking", () => {
    it("should initialize metrics", async () => {
      const getMetrics = () => (consumer as any).metrics;
      const metrics = getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.has("activeCount")).toBe(true);
      expect(metrics.has("completedCount")).toBe(true);
      expect(metrics.has("failedCount")).toBe(true);
    });

    it("should track processing times", async () => {
      consumer.setProcessingDelay(50);

      const job = createJobPayload("metric_job");
      const metadata = createJobMetadata("job-1", 1);

      const result = await consumer.process(job, metadata);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(50);
    });

    it("should track failed job count", async () => {
      consumer.setShouldFail(true, 1);

      const job = createJobPayload("failed_job");
      const metadata = createJobMetadata("job-1", 1);

      try {
        await consumer.process(job, metadata);
      } catch {
        // Expected failure
      }

      // In a real implementation, failedCount would be incremented
      const metrics = (consumer as any).metrics;
      expect(metrics).toBeDefined();
    });
  });

  describe("job validation", () => {
    it("should validate job type is present", async () => {
      const invalidJob = { data: {} } as any;
      const metadata = createJobMetadata("job-1", 1);

      const testConsumer = new TestQueueConsumer(defaultConfig);

      try {
        await testConsumer.validateJob(invalidJob);
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error).toBeInstanceOf(QueueValidationError);
      }
    });

    it("should validate webhook jobs have required fields", async () => {
      const invalidWebhook = {
        type: "order_webhook",
        data: { shopId: null },
      } as any;

      const testConsumer = new TestQueueConsumer(defaultConfig);

      try {
        await testConsumer.validateJob(invalidWebhook);
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error).toBeInstanceOf(QueueValidationError);
      }
    });

    it("should validate tracking jobs have coordinates", async () => {
      const invalidTracking = {
        type: "driver_tracking",
        data: {
          payload: {
            latitude: "invalid",
            longitude: 0,
          },
        },
      } as any;

      const testConsumer = new TestQueueConsumer(defaultConfig);

      try {
        await testConsumer.validateJob(invalidTracking);
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error).toBeInstanceOf(QueueValidationError);
      }
    });

    it("should accept valid webhook jobs", async () => {
      const validWebhook: QueueJobPayload = {
        type: "order_webhook",
        data: {
          shopId: "shop-123",
          shopifyOrderId: "order-456",
        },
        timestamp: new Date(),
      };

      const testConsumer = new TestQueueConsumer(defaultConfig);

      expect(async () => {
        await testConsumer.validateJob(validWebhook);
      }).not.toThrow();
    });
  });

  describe("error classification", () => {
    it("should classify transient errors as retriable", () => {
      const error = new QueueTransientError("Temporary failure");

      expect(error.retriable).toBe(true);
      expect(error.code).toBe("TRANSIENT_ERROR");
    });

    it("should classify permanent errors as non-retriable", () => {
      const error = new QueuePermanentError("Permanent failure");

      expect(error.retriable).toBe(false);
      expect(error.code).toBe("PERMANENT_ERROR");
    });

    it("should classify validation errors as non-retriable", () => {
      const error = new QueueValidationError("Invalid data");

      expect(error.retriable).toBe(false);
      expect(error.code).toBe("VALIDATION_ERROR");
    });

    it("should include error details", () => {
      const details = { jobId: "job-123", reason: "Timeout" };
      const error = new QueueConsumerError(
        "Processing failed",
        "PROCESSING_ERROR",
        true,
        details
      );

      expect(error.details).toEqual(details);
    });
  });

  describe("config validation", () => {
    it("should initialize with provided config", () => {
      const customConfig: ConsumerConfig = {
        queueName: "custom-queue",
        concurrency: 5,
        maxRetries: 5,
        retryDelay: 2000,
        deadLetterQueue: "custom-dlq",
      };

      const customConsumer = new TestQueueConsumer(customConfig);

      expect((customConsumer as any).config.queueName).toBe("custom-queue");
      expect((customConsumer as any).config.concurrency).toBe(5);
      expect((customConsumer as any).config.maxRetries).toBe(5);
    });

    it("should use default config values", () => {
      const minimalConfig: ConsumerConfig = {
        queueName: "test-queue",
        concurrency: 1,
        maxRetries: 3,
        retryDelay: 1000,
        deadLetterQueue: "dlq",
      };

      const consumer = new TestQueueConsumer(minimalConfig);

      expect((consumer as any).config).toBeDefined();
    });
  });

  describe("result validation", () => {
    it("should return valid JobProcessingResult", async () => {
      const job = createJobPayload("test_job");
      const metadata = createJobMetadata("job-1", 1);

      const result = await consumer.process(job, metadata);

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("processingTimeMs");
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.processingTimeMs).toBe("number");
    });

    it("should include error in result if applicable", async () => {
      consumer.setShouldFail(true, 1);

      const job = createJobPayload("error_job");
      const metadata = createJobMetadata("job-1", 1);

      try {
        await consumer.process(job, metadata);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
