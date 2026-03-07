/**
 * @witylogix/framework/queue — Workflow queue and scheduling exports
 *
 * Main entry point for BullMQ-based workflow queue infrastructure.
 * Provides:
 * - WorkflowQueue: Durable queue for workflow jobs
 * - WorkflowWorker: Job processor with lifecycle management
 * - WorkflowScheduler: Cron-based workflow scheduling
 * - DeadLetterHandler: Management of permanently failed jobs
 */

export { WorkflowQueue } from "./workflow-queue.js";
export { WorkflowWorker } from "./workflow-worker.js";
export { WorkflowScheduler } from "./workflow-scheduler.js";
export { DeadLetterHandler } from "./dead-letter.js";

export type {
  WorkflowJobData,
  WorkflowJobResult,
  QueueConfig,
  ScheduleConfig,
  WorkerOptions,
  DeadLetterEntry,
  Job,
  QueueInterface,
  WorkerInterface,
  SchedulerInterface,
  QueueEventsInterface,
  JobProgressEvent,
  JobCompletedEvent,
  JobFailedEvent,
} from "./types.js";
