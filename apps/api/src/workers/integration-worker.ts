/**
 * Integration Worker — BullMQ worker for async integration jobs.
 *
 * Job types:
 *   sync          — Pull data from external services (e.g., inventory levels, orders)
 *   health_check  — Verify integration credentials and connectivity
 *   webhook_process — Process incoming webhooks from third-party services
 *
 * Architecture mirrors the notification-worker pattern:
 *   1. Receive job with shopId + appSlug + integrationId
 *   2. Load tenant's integration credentials from DB
 *   3. Dispatch to the appropriate handler
 *   4. Update integration health status
 *   5. Record event in integration_events table
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@witylogix/db";
import { getConfig } from "../lib/config.js";
import type { IntegrationJobData } from "../lib/queue.js";
import { registerWorker } from "../lib/queue.js";
import { getIntegrationBySlug } from "@witylogix/core/integrations";

// ─── Job Handlers ──────────────────────────────────────────

async function handleSync(job: Job<IntegrationJobData>): Promise<void> {
  const { shopId, appSlug, integrationId } = job.data;

  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration || !integration.isEnabled) {
    console.warn(`[integration-worker] Integration ${appSlug} not found or disabled for shop ${shopId}`);
    return;
  }

  const appMeta = getIntegrationBySlug(appSlug);
  if (!appMeta) {
    console.warn(`[integration-worker] Unknown integration slug: ${appSlug}`);
    return;
  }

  // TODO: Implement per-integration sync logic when providers are built
  // For now, just update lastSyncAt and record the event
  console.info(`[integration-worker] Sync requested for ${appSlug} (shop: ${shopId}) — stub`);

  await prisma.integration.update({
    where: { id: integrationId },
    data: { lastSyncAt: new Date() },
  });

  await prisma.integrationEvent.create({
    data: {
      shopId,
      appSlug,
      integrationId,
      eventType: "SYNC",
      operation: "sync",
      metadata: { status: "completed_stub" },
    },
  });
}

async function handleHealthCheck(job: Job<IntegrationJobData>): Promise<void> {
  const { shopId, appSlug, integrationId } = job.data;

  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) {
    return;
  }

  const appMeta = getIntegrationBySlug(appSlug);
  if (!appMeta) {
    return;
  }

  // Validate required credentials are present
  const creds = (integration.credentials as Record<string, unknown>) ?? {};
  const missingRequired = appMeta.credentialFields
    .filter((f) => f.required && !creds[f.key])
    .map((f) => f.key);

  const healthy = missingRequired.length === 0;
  const healthStatus = healthy ? "HEALTHY" : "ERROR";

  await prisma.integration.update({
    where: { id: integrationId },
    data: {
      healthStatus,
      lastHealthCheckAt: new Date(),
    },
  });

  await prisma.integrationEvent.create({
    data: {
      shopId,
      appSlug,
      integrationId,
      eventType: "HEALTH_CHECK",
      metadata: { healthy, missingRequired, healthStatus },
    },
  });

  if (!healthy) {
    console.warn(
      `[integration-worker] Health check failed for ${appSlug} (shop: ${shopId}): missing ${missingRequired.join(", ")}`,
    );
  }
}

async function handleWebhookProcess(job: Job<IntegrationJobData>): Promise<void> {
  const { shopId, appSlug, integrationId, payload } = job.data;

  // TODO: Implement per-integration webhook processing when providers are built
  console.info(
    `[integration-worker] Webhook received for ${appSlug} (shop: ${shopId}) — stub`,
  );

  await prisma.integrationEvent.create({
    data: {
      shopId,
      appSlug,
      integrationId,
      eventType: "WEBHOOK",
      operation: "process",
      metadata: { payloadKeys: payload ? Object.keys(payload) : [] },
    },
  });
}

// ─── Worker Setup ──────────────────────────────────────────

async function processIntegrationJob(job: Job<IntegrationJobData>): Promise<void> {
  const startTime = Date.now();

  try {
    switch (job.data.jobType) {
      case "sync":
        await handleSync(job);
        break;
      case "health_check":
        await handleHealthCheck(job);
        break;
      case "webhook_process":
        await handleWebhookProcess(job);
        break;
      default:
        console.error(`[integration-worker] Unknown job type: ${(job.data as any).jobType}`);
    }
  } catch (err) {
    console.error(
      `[integration-worker] Job ${job.id} failed for ${job.data.appSlug}:`,
      err,
    );
    throw err; // Re-throw for BullMQ retry
  }

  const duration = Date.now() - startTime;
  console.info(
    `[integration-worker] Job ${job.id} (${job.data.jobType}/${job.data.appSlug}) completed in ${duration}ms`,
  );
}

/**
 * Start the integration worker. Called from server.ts at startup.
 */
export function startIntegrationWorker(): void {
  const config = getConfig();
  const connection = {
    host: new URL(config.REDIS_URL).hostname || "localhost",
    port: Number(new URL(config.REDIS_URL).port) || 6379,
  };

  const worker = new Worker<IntegrationJobData>(
    "integrations",
    processIntegrationJob,
    {
      connection,
      concurrency: 5,
      limiter: {
        max: 20,
        duration: 60_000, // 20 jobs per minute per worker
      },
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[integration-worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("completed", (job) => {
    console.info(`[integration-worker] Job ${job.id} completed`);
  });

  registerWorker(worker);
  console.info("[integration-worker] Worker started (concurrency: 5)");
}
