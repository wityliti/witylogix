/**
 * Process Manager module — public API exports for background worker orchestration.
 *
 * Exports:
 *   • Types: Worker configuration, status, health checks
 *   • ProcessManager: Main orchestrator class
 *   • BaseWorker: Abstract base class for worker implementations
 *   • Worker Implementations: Billing, campaign, notification, analytics workers
 */

// ─── Types ──────────────────────────────────────────────────────

export type {
  WorkerStatus,
  WorkerConfig,
  ProcessInfo,
  HealthCheck,
  JobResult,
  ProcessManagerConfig,
  WorkerErrorCallback,
} from "./types.js";

// ─── Core Classes ───────────────────────────────────────────────

export { ProcessManager, BaseWorker } from "./manager.js";

// ─── Worker Implementations ─────────────────────────────────────

export { BillingWorker } from "./workers/billing-worker.js";
export { CampaignWorker } from "./workers/campaign-worker.js";
export { NotificationWorker } from "./workers/notification-worker.js";
export { AnalyticsWorker } from "./workers/analytics-worker.js";
