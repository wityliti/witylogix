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
  const { shopId, appSlug, integrationId, payload } = job.data;

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

  try {
    // Route to provider-specific sync handler based on integration slug
    switch (appSlug.toLowerCase()) {
      case "shopify": {
        // Shopify collections sync handler
        const collections = (payload?.collections as any[]) || [];
        console.info(
          `[integration-worker] Processing ${collections.length} Shopify collections for shop ${shopId}`,
        );

        // Process collections — placeholder for actual sync logic
        // In production, this would sync collections and products to the database
        for (const collection of collections) {
          console.debug(`[integration-worker] Processing collection: ${collection.node?.title}`);
        }

        break;
      }

      default:
        console.warn(
          `[integration-worker] No sync handler implemented for integration: ${appSlug}`,
        );
    }

    // Update integration last sync time
    await (prisma as any).integration.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date() },
    });

    // Record sync event
    await (prisma as any).integrationEvent.create({
      data: {
        shopId,
        appSlug,
        integrationId,
        eventType: "SYNC",
        operation: "sync",
        metadata: { status: "completed", recordsProcessed: payload?.collections?.length || 0 },
      },
    });

    console.info(
      `[integration-worker] Sync completed for ${appSlug} (shop: ${shopId})`,
    );
  } catch (error) {
    console.error(
      `[integration-worker] Sync failed for ${appSlug} (shop: ${shopId}):`,
      error,
    );

    // Record failure event
    await (prisma as any).integrationEvent.create({
      data: {
        shopId,
        appSlug,
        integrationId,
        eventType: "SYNC",
        operation: "sync",
        metadata: {
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        },
      },
    });

    throw error;
  }
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

  const integration = await (prisma as any).integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) {
    console.warn(
      `[integration-worker] Integration ${appSlug} not found for webhook processing (shop: ${shopId})`,
    );
    return;
  }

  try {
    console.info(
      `[integration-worker] Processing webhook for ${appSlug} (shop: ${shopId})`,
    );

    // Route to provider-specific webhook handler based on integration slug
    switch (appSlug.toLowerCase()) {
      case "shopify": {
        // Shopify webhook handler
        const topic = (payload as any)?.topic || "unknown";
        console.info(
          `[integration-worker] Shopify webhook topic: ${topic} (shop: ${shopId})`,
        );

        // Route based on webhook topic
        switch (topic) {
          case "orders/create":
          case "orders/updated": {
            // Handle order webhooks
            const order = (payload as any)?.order;
            console.debug(
              `[integration-worker] Processing Shopify order: ${order?.id} (shop: ${shopId})`,
            );
            break;
          }

          case "products/create":
          case "products/update": {
            // Handle product webhooks
            const product = (payload as any)?.product;
            console.debug(
              `[integration-worker] Processing Shopify product: ${product?.id} (shop: ${shopId})`,
            );
            break;
          }

          default:
            console.debug(
              `[integration-worker] Unhandled Shopify webhook topic: ${topic}`,
            );
        }

        break;
      }

      default:
        console.warn(
          `[integration-worker] No webhook handler implemented for integration: ${appSlug}`,
        );
    }

    // Record successful webhook event
    await (prisma as any).integrationEvent.create({
      data: {
        shopId,
        appSlug,
        integrationId,
        eventType: "WEBHOOK",
        operation: "process",
        metadata: {
          status: "processed",
          payloadKeys: payload ? Object.keys(payload) : [],
          topic: (payload as any)?.topic,
        },
      },
    });

    console.info(
      `[integration-worker] Webhook processed for ${appSlug} (shop: ${shopId})`,
    );
  } catch (error) {
    console.error(
      `[integration-worker] Webhook processing failed for ${appSlug} (shop: ${shopId}):`,
      error,
    );

    // Record failure event
    await (prisma as any).integrationEvent.create({
      data: {
        shopId,
        appSlug,
        integrationId,
        eventType: "WEBHOOK",
        operation: "process",
        metadata: {
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
          payloadKeys: payload ? Object.keys(payload) : [],
        },
      },
    });

    throw error;
  }
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
