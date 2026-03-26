/**
 * @witylogix/framework/queue/workflow-scheduler — Scheduled workflow execution
 *
 * Manages recurring and one-time scheduled workflow execution using cron expressions.
 */

import { EventEmitter } from "node:events";
import type { ScheduleConfig } from "./types.js";
import type { WorkflowQueue } from "./workflow-queue.js";

interface ScheduledWorkflow extends ScheduleConfig {
  id: string;
  createdAt: Date;
  lastRunAt?: Date;
  nextRunAt?: Date;
  timesRun: number;
}

export class WorkflowScheduler extends EventEmitter {
  private queue: WorkflowQueue;
  private schedules: Map<string, ScheduledWorkflow> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private _isRunning = false;

  constructor(queue: WorkflowQueue) {
    super();
    this.queue = queue;
  }

  async start(): Promise<void> {
    if (this._isRunning) {
      console.warn("[WorkflowScheduler] Already running");
      return;
    }
    this._isRunning = true;
    this.emit("scheduler:started", { timestamp: new Date() });
    console.log("[WorkflowScheduler] Started");
    for (const [name, schedule] of this.schedules.entries()) {
      if (schedule.active !== false) {
        this.scheduleWorkflow(name, schedule);
      }
    }
  }

  async stop(): Promise<void> {
    if (!this._isRunning) return;
    this._isRunning = false;
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.emit("scheduler:stopped", { timestamp: new Date() });
    console.log("[WorkflowScheduler] Stopped");
  }

  async schedule(
    name: string,
    workflowName: string,
    input: unknown,
    cron: string,
    options?: { timezone?: string; limit?: number; active?: boolean }
  ): Promise<void> {
    if (this.schedules.has(name)) {
      throw new Error(`Schedule "${name}" already exists`);
    }
    const schedule: ScheduledWorkflow = {
      id: `schedule_${name}_${Date.now()}`,
      name,
      workflowName,
      input,
      cron,
      timezone: options?.timezone,
      limit: options?.limit,
      active: options?.active !== false,
      createdAt: new Date(),
      timesRun: 0,
    };
    this.schedules.set(name, schedule);
    this.emit("schedule:created", { name, workflowName, cron, timestamp: new Date() });
    console.log(`[WorkflowScheduler] Scheduled "${name}" (${cron})`);
    if (this._isRunning && schedule.active !== false) {
      this.scheduleWorkflow(name, schedule);
    }
  }

  async unschedule(name: string): Promise<boolean> {
    const schedule = this.schedules.get(name);
    if (!schedule) return false;
    const timer = this.timers.get(name);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(name);
    }
    this.schedules.delete(name);
    this.emit("schedule:deleted", { name, workflowName: schedule.workflowName, timestamp: new Date() });
    console.log(`[WorkflowScheduler] Unscheduled "${name}"`);
    return true;
  }

  async update(name: string, updates: Partial<Pick<ScheduledWorkflow, "input" | "cron" | "active">>): Promise<boolean> {
    const schedule = this.schedules.get(name);
    if (!schedule) return false;
    if (updates.input !== undefined) schedule.input = updates.input;
    if (updates.cron !== undefined) schedule.cron = updates.cron;
    if (updates.active !== undefined) schedule.active = updates.active;
    if (this._isRunning) {
      const timer = this.timers.get(name);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(name);
      }
      if (schedule.active !== false) {
        this.scheduleWorkflow(name, schedule);
      }
    }
    this.emit("schedule:updated", { name, updates, timestamp: new Date() });
    console.log(`[WorkflowScheduler] Updated schedule "${name}"`);
    return true;
  }

  async listScheduled(): Promise<ScheduledWorkflow[]> {
    return Array.from(this.schedules.values());
  }

  async getSchedule(name: string): Promise<ScheduledWorkflow | undefined> {
    return this.schedules.get(name);
  }

  private getNextExecutionTime(cron: string): number {
    const parts = cron.split(" ");
    if (parts.length !== 5) return 60000;
    const [minute, hour] = parts;
    const now = new Date();
    let next = new Date(now);
    if (hour !== "*" && minute !== "*") {
      const nextHour = parseInt(hour, 10);
      const nextMinute = parseInt(minute, 10);
      next.setHours(nextHour, nextMinute, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    } else if (minute !== "*") {
      const nextMinute = parseInt(minute, 10);
      next.setMinutes(nextMinute, 0, 0);
      if (next <= now) {
        next.setHours(next.getHours() + 1);
      }
    } else {
      next.setHours(next.getHours() + 1);
      next.setMinutes(0, 0, 0);
    }
    return Math.max(0, next.getTime() - now.getTime());
  }

  private scheduleWorkflow(name: string, schedule: ScheduledWorkflow): void {
    const nextRun = this.getNextExecutionTime(schedule.cron);
    const timer = setTimeout(async () => {
      try {
        if (schedule.limit && schedule.timesRun >= schedule.limit) {
          await this.unschedule(name);
          return;
        }
        const jobId = await this.queue.enqueue(schedule.workflowName, schedule.input, {
          userId: "system",
          tenantId: "system",
          transactionId: `scheduled_${name}_${Date.now()}`,
          metadata: { scheduleName: name, scheduledExecution: true },
        });
        schedule.lastRunAt = new Date();
        schedule.timesRun++;
        this.emit("schedule:executed", {
          name,
          workflowName: schedule.workflowName,
          jobId,
          timesRun: schedule.timesRun,
          timestamp: new Date(),
        });
        console.log(`[WorkflowScheduler] Executed "${name}" (run ${schedule.timesRun}): job ${jobId}`);
        this.scheduleWorkflow(name, schedule);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.emit("schedule:error", { name, error: message, timestamp: new Date() });
        console.error(`[WorkflowScheduler] Error executing "${name}":`, error);
        this.scheduleWorkflow(name, schedule);
      }
    }, nextRun);
    this.timers.set(name, timer);
    schedule.nextRunAt = new Date(Date.now() + nextRun);
  }

  isRunning(): boolean {
    return this._isRunning;
  }

  getScheduleCount(): number {
    return this.schedules.size;
  }

  async close(): Promise<void> {
    await this.stop();
    this.schedules.clear();
    this.emit("scheduler:closed", { timestamp: new Date() });
  }
}
