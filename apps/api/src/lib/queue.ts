/**
 * BullMQ queue definitions and connection management.
 *
 * All queues share a Redis connection and are tenant-aware:
 * - Each job includes shopId for RLS context
 * - Job groups ensure fair processing across tenants
 *
 * Queues:
 *   notifications  — email, SMS, WhatsApp, push notifications
 *   optimization   — route optimization (CPU-intensive, separate concurrency)
 *   webhooks       — outbound webhook delivery with retries
 *   maintenance    — scheduled cleanup, cache warming, analytics
 */

import { Queue, Worker, type ConnectionOptions, type Job } from "bullmq";
import Redis from "ioredis";
import { getRedis } from "./redis.js";
import { getConfig } from "./config.js";

// ─── Connection ─────────────────────────────────────────────

export function getQueueConnection(): any {
  const config = getConfig();
  return new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}

// ─── Queue Definitions ──────────────────────────────────────

let _notificationQueue: Queue | null = null;
let _optimizationQueue: Queue | null = null;
let _webhookQueue: Queue | null = null;
let _maintenanceQueue: Queue | null = null;
let _integrationQueue: Queue | null = null;

export function getNotificationQueue(): Queue {
  if (!_notificationQueue) {
    _notificationQueue = new Queue("notifications", {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 86400 }, // 24h
        removeOnFail: { age: 604800 }, // 7 days
      },
    });
  }
  return _notificationQueue;
}

export function getOptimizationQueue(): Queue {
  if (!_optimizationQueue) {
    _optimizationQueue = new Queue("optimization", {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "fixed", delay: 5000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      },
    });
  }
  return _optimizationQueue;
}

export function getWebhookQueue(): Queue {
  if (!_webhookQueue) {
    _webhookQueue = new Queue("webhooks", {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
      },
    });
  }
  return _webhookQueue;
}

export function getIntegrationQueue(): Queue {
  if (!_integrationQueue) {
    _integrationQueue = new Queue("integrations", {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
      },
    });
  }
  return _integrationQueue;
}

export function getMaintenanceQueue(): Queue {
  if (!_maintenanceQueue) {
    _maintenanceQueue = new Queue("maintenance", {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      },
    });
  }
  return _maintenanceQueue;
}

// ─── Job Types ──────────────────────────────────────────────

export interface NotificationJobData {
  shopId: string;
  orderId: string;
  eventType: string; // e.g. "order.out_for_delivery"
  channels: Array<"EMAIL" | "SMS" | "WHATSAPP" | "PUSH">;
  recipient: {
    email?: string;
    phone?: string;
    fcmToken?: string;
  };
  templateData: Record<string, unknown>;
}

export interface OptimizationJobData {
  shopId: string;
  routeId: string;
  depot: { lat: number; lng: number; address?: string };
  orderIds: string[];
  vehicleIds: string[];
  options?: {
    timeLimit?: number;
    returnToDepot?: boolean;
  };
}

export interface WebhookJobData {
  shopId: string;
  url: string;
  topic: string;
  payload: Record<string, unknown>;
}

export interface IntegrationJobData {
  shopId: string;
  appSlug: string;
  integrationId: string;
  jobType: "sync" | "health_check" | "webhook_process";
  payload?: Record<string, unknown>;
}

// ─── Graceful Shutdown ──────────────────────────────────────

const activeWorkers: Worker[] = [];

export function registerWorker(worker: Worker): void {
  activeWorkers.push(worker);
}

export async function shutdownQueues(): Promise<void> {
  // Close all workers first (drain in-flight jobs)
  await Promise.allSettled(
    activeWorkers.map((w) => w.close()),
  );

  // Close queues
  await Promise.allSettled([
    _notificationQueue?.close(),
    _optimizationQueue?.close(),
    _webhookQueue?.close(),
    _integrationQueue?.close(),
    _maintenanceQueue?.close(),
  ]);
}
