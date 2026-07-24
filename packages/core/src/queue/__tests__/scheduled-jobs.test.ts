import { describe, it, expect, beforeEach, vi } from "vitest";
import { ScheduledJobsManager } from "../scheduled-jobs";
import { Queue } from "bullmq";

describe("ScheduledJobsManager", () => {
  let manager: ScheduledJobsManager;
  let mockQueues: Map<string, any>;
  let mockAnalyticsQueue: any;

  beforeEach(() => {
    mockAnalyticsQueue = {
      name: "analytics",
      add: vi.fn().mockResolvedValue({ id: "test-job-id" }),
      getRepeatableJobs: vi.fn().mockResolvedValue([]),
      removeRepeatableByKey: vi.fn().mockResolvedValue(undefined),
    };

    mockQueues = new Map([["analytics", mockAnalyticsQueue]]);
    manager = new ScheduledJobsManager(mockQueues);
  });

  describe("getJobDefinition", () => {
    it("should return job definition for valid job ID", () => {
      const def = manager.getJobDefinition("daily-usage-aggregation");

      expect(def).toBeDefined();
      expect(def?.name).toBe("Daily Usage Aggregation");
      expect(def?.pattern).toBe("0 2 * * *");
    });

    it("should return undefined for invalid job ID", () => {
      const def = manager.getJobDefinition("nonexistent-job");

      expect(def).toBeUndefined();
    });
  });

  describe("getAllJobs", () => {
    it("should return all job definitions", () => {
      const jobs = manager.getAllJobs();

      expect(jobs.length).toBeGreaterThan(0);
      expect(jobs.some((j) => j.id === "daily-usage-aggregation")).toBe(true);
      expect(jobs.some((j) => j.id === "hourly-health-check")).toBe(true);
    });
  });

  describe("calculateNextRunTime", () => {
    it("should calculate next run time from cron expression", () => {
      const nextRun = manager.calculateNextRunTime("0 2 * * *");

      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun.getTime()).toBeGreaterThan(Date.now());
    });

    it("should handle invalid cron expression gracefully", () => {
      const nextRun = manager.calculateNextRunTime("invalid cron");

      // Should return default (1 minute from now)
      expect(nextRun).toBeInstanceOf(Date);
      expect(nextRun.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("registerJob", () => {
    it("should register a repeatable job", async () => {
      const success = await manager.registerJob(
        "daily-usage-aggregation",
        "0 3 * * *",
      );

      expect(success).toBe(true);
      expect(mockAnalyticsQueue.add).toHaveBeenCalledWith(
        "daily-usage-aggregation",
        { type: "daily-rollup" },
        expect.objectContaining({
          repeat: { pattern: "0 3 * * *" },
        }),
      );
    });

    it("should return false for nonexistent job", async () => {
      const success = await manager.registerJob("nonexistent", "0 * * * *");

      expect(success).toBe(false);
    });
  });

  describe("enableJob and disableJob", () => {
    it("should enable a job", async () => {
      await manager.disableJob("daily-usage-aggregation");
      let def = manager.getJobDefinition("daily-usage-aggregation");
      expect(def?.enabled).toBe(false);

      await manager.enableJob("daily-usage-aggregation");
      def = manager.getJobDefinition("daily-usage-aggregation");
      expect(def?.enabled).toBe(true);
    });

    it("should disable a job", async () => {
      const success = await manager.disableJob("daily-usage-aggregation");

      expect(success).toBe(true);
      const def = manager.getJobDefinition("daily-usage-aggregation");
      expect(def?.enabled).toBe(false);
    });

    it("should return false for nonexistent job", async () => {
      const success = await manager.disableJob("nonexistent");

      expect(success).toBe(false);
    });
  });

  describe("recordExecution", () => {
    it("should record successful execution", () => {
      manager.recordExecution("daily-usage-aggregation", 1500, "success");

      const status = manager.getJobStatus("daily-usage-aggregation");
      expect(status?.lastRuns).toHaveLength(1);
      expect(status?.lastRuns[0].status).toBe("success");
      expect(status?.lastRuns[0].duration).toBe(1500);
    });

    it("should record failed execution with error", () => {
      manager.recordExecution(
        "daily-usage-aggregation",
        500,
        "failed",
        "Database connection timeout",
      );

      const status = manager.getJobStatus("daily-usage-aggregation");
      expect(status?.lastRuns).toHaveLength(1);
      expect(status?.lastRuns[0].status).toBe("failed");
      expect(status?.lastRuns[0].error).toBe("Database connection timeout");
    });

    it("should keep only last 10 runs", () => {
      for (let i = 0; i < 15; i++) {
        manager.recordExecution("daily-usage-aggregation", 1000 + i, "success");
      }

      const status = manager.getJobStatus("daily-usage-aggregation");
      expect(status?.lastRuns).toHaveLength(10);
    });

    it("should update nextRunAt for enabled jobs", () => {
      manager.recordExecution("daily-usage-aggregation", 1000, "success");

      const status = manager.getJobStatus("daily-usage-aggregation");
      expect(status?.nextRunAt).toBeDefined();
      expect(status?.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("getJobStatus", () => {
    it("should return job status with execution history", () => {
      manager.recordExecution("hourly-health-check", 200, "success");
      manager.recordExecution("hourly-health-check", 210, "success");

      const status = manager.getJobStatus("hourly-health-check");

      expect(status).toBeDefined();
      expect(status?.name).toBe("Hourly Health Check");
      expect(status?.enabled).toBe(true);
      expect(status?.lastRuns).toHaveLength(2);
    });

    it("should return null for nonexistent job", () => {
      const status = manager.getJobStatus("nonexistent");

      expect(status).toBeNull();
    });
  });

  describe("getExecutionHistory", () => {
    it("should return execution history with limit", () => {
      for (let i = 0; i < 15; i++) {
        manager.recordExecution("daily-usage-aggregation", 1000 + i, "success");
      }

      const history = manager.getExecutionHistory("daily-usage-aggregation", 5);

      expect(history).toHaveLength(5);
    });

    it("should return default 10 items if no limit specified", () => {
      for (let i = 0; i < 15; i++) {
        manager.recordExecution("daily-usage-aggregation", 1000 + i, "success");
      }

      const history = manager.getExecutionHistory("daily-usage-aggregation");

      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe("getAllJobsStatus", () => {
    it("should return status for all jobs", async () => {
      await manager.registerJob("daily-usage-aggregation", "0 2 * * *");
      manager.recordExecution("daily-usage-aggregation", 1500, "success");

      const allStatus = manager.getAllJobsStatus();

      expect(allStatus.length).toBeGreaterThan(0);
      expect(allStatus.some((s) => s.id === "daily-usage-aggregation")).toBe(
        true,
      );
    });
  });
});
