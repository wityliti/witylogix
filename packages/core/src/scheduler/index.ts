/**
 * Task scheduler - simple cron-like task scheduling.
 *
 * Features:
 * - Interface: ScheduledTask with name, cronExpression, handler, enabled
 * - TaskScheduler class: register(), start(), stop(), getStatus()
 * - Built-in tasks: data retention cleanup, stale shipment checker, sync health monitor
 *
 * Usage:
 * const scheduler = new TaskScheduler();
 * scheduler.register({
 *   name: "cleanup",
 *   cronExpression: "0 2 * * *",
 *   handler: async () => { ... },
 *   enabled: true
 * });
 * await scheduler.start();
 */

import { getNextRun, matches } from "./cron-parser.js";

// Types

export interface ScheduledTask {
  name: string;
  cronExpression: string;
  handler: () => Promise<void>;
  enabled: boolean;
  description?: string;
}

export interface TaskStatus {
  name: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun: Date;
  isRunning: boolean;
  errorCount: number;
  successCount: number;
}

export interface SchedulerStatus {
  isRunning: boolean;
  tasksRegistered: number;
  tasksEnabled: number;
  tasks: TaskStatus[];
}

// Task Scheduler Class

export class TaskScheduler {
  private tasks = new Map<
    string,
    ScheduledTask & { status: TaskStatus; timeout?: NodeJS.Timeout }
  >();
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs = 60000;

  register(task: ScheduledTask): void {
    if (this.tasks.has(task.name)) {
      throw new Error(`Task with name "${task.name}" is already registered`);
    }

    try {
      getNextRun(task.cronExpression);
    } catch (error) {
      throw new Error(
        `Invalid cron expression for task "${task.name}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const status: TaskStatus = {
      name: task.name,
      enabled: task.enabled,
      nextRun: getNextRun(task.cronExpression),
      isRunning: false,
      errorCount: 0,
      successCount: 0,
    };

    this.tasks.set(task.name, {
      ...task,
      status,
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("Scheduler is already running");
      return;
    }

    this.isRunning = true;
    console.log(
      `[Scheduler] Starting with ${this.tasks.size} tasks registered`,
    );

    await this.check();

    this.checkInterval = setInterval(() => {
      this.check().catch((err) => {
        console.error("[Scheduler] Error during check:", err);
      });
    }, this.checkIntervalMs);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    for (const taskData of this.tasks.values()) {
      if (taskData.timeout) {
        clearTimeout(taskData.timeout);
      }
    }

    console.log("[Scheduler] Stopped");
  }

  private async check(): Promise<void> {
    const now = new Date();

    for (const [taskName, taskData] of this.tasks) {
      const { cronExpression, enabled, handler, status } = taskData;

      if (!enabled) {
        continue;
      }

      const isTimeToRun = matches(cronExpression, now);

      if (!isTimeToRun) {
        continue;
      }

      if (status.lastRun) {
        const minutesAgo = (now.getTime() - status.lastRun.getTime()) / 60000;
        if (minutesAgo < 1) {
          continue;
        }
      }

      await this.executeTask(taskName, handler, status);

      status.nextRun = getNextRun(cronExpression, now);
    }
  }

  private async executeTask(
    taskName: string,
    handler: () => Promise<void>,
    status: TaskStatus,
  ): Promise<void> {
    status.isRunning = true;
    const startTime = Date.now();

    try {
      await handler();
      status.successCount++;
      status.lastRun = new Date();

      const duration = Date.now() - startTime;
      console.log(`[Scheduler] Task "${taskName}" completed in ${duration}ms`);
    } catch (error) {
      status.errorCount++;
      console.error(
        `[Scheduler] Task "${taskName}" failed:`,
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      status.isRunning = false;
    }
  }

  getStatus(): SchedulerStatus {
    const tasks: TaskStatus[] = Array.from(this.tasks.values()).map((t) => ({
      ...t.status,
    }));

    return {
      isRunning: this.isRunning,
      tasksRegistered: this.tasks.size,
      tasksEnabled: Array.from(this.tasks.values()).filter((t) => t.enabled)
        .length,
      tasks,
    };
  }

  getTaskStatus(taskName: string): TaskStatus | null {
    const taskData = this.tasks.get(taskName);
    return taskData ? taskData.status : null;
  }

  setTaskEnabled(taskName: string, enabled: boolean): void {
    const taskData = this.tasks.get(taskName);
    if (!taskData) {
      throw new Error(`Task "${taskName}" not found`);
    }

    taskData.enabled = enabled;
    taskData.status.enabled = enabled;

    if (enabled) {
      taskData.status.nextRun = getNextRun(taskData.cronExpression);
    }
  }
}

// Built-in Tasks

export const dataRetentionCleanupTask: ScheduledTask = {
  name: "data-retention-cleanup",
  cronExpression: "0 2 * * *",
  enabled: true,
  description: "Clean up old data and audit logs",
  handler: async () => {
    console.log("Data retention cleanup would run here");
  },
};

export const staleShipmentCheckerTask: ScheduledTask = {
  name: "stale-shipment-checker",
  cronExpression: "0 * * * *",
  enabled: true,
  description: "Check for shipments stuck in transit",
  handler: async () => {
    console.log("Stale shipment checker would run here");
  },
};

export const syncHealthMonitorTask: ScheduledTask = {
  name: "sync-health-monitor",
  cronExpression: "0 * * * *",
  enabled: true,
  description: "Monitor integration health and reconnect if needed",
  handler: async () => {
    console.log("Sync health monitor would run here");
  },
};

// Global scheduler instance
export const globalScheduler = new TaskScheduler();
