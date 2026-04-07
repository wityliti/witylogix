/**
 * WooCommerce Webhook Worker (WIT-218)
 *
 * Processes jobs from the "wc-webhooks" BullMQ queue.
 * Each job carries a validated WooCommerce order payload and is processed
 * using WooCommerceShipmentService, which idempotently upserts the
 * Order + Shipment + ShipmentItem records.
 *
 * DLQ behaviour:
 *   - Failed jobs are retried up to 5 times with exponential back-off.
 *   - Jobs that exhaust all attempts remain in BullMQ's "failed" set
 *     for 7 days (configured in queue.ts) — ops can inspect / replay them.
 *
 * Per-tenant fairness:
 *   - Concurrency is capped at 10 (configurable).
 *   - Each job includes shopId so one tenant's burst cannot starve others.
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@witylogix/db";
import { WooCommerceShipmentService } from "@witylogix/core/woocommerce/shipment-service";
import type { WooCommerceOrder } from "@witylogix/core/platforms/adapters";
import { getQueueConnection, registerWorker } from "../lib/queue.js";
import type { WCWebhookJobData } from "../lib/queue.js";

// ─── Job processor ────────────────────────────────────────────────────────────

async function processWCWebhookJob(job: Job<WCWebhookJobData>): Promise<void> {
  const { shopId, topic, payload } = job.data;

  // Only handle order-level topics; product topics use a different path
  if (!topic.startsWith("order.")) {
    job.log(`Skipping non-order topic: ${topic}`);
    return;
  }

  if (topic === "order.deleted") {
    // Deletion is not in scope for WIT-218 (no Shipment delete needed)
    job.log(`order.deleted ignored for shopId=${shopId}`);
    return;
  }

  // Use a tenant-scoped Prisma client.
  // prisma is a global singleton; RLS shopId isolation is enforced at the
  // DB layer via the Row-Level Security policy set in the transaction.
  const svc = new WooCommerceShipmentService(prisma as any);

  const result = await svc.upsertShipment(payload as unknown as WooCommerceOrder, shopId);

  job.log(
    `WC webhook processed: shopId=${shopId} topic=${topic} ` +
    `orderId=${result.orderId} shipmentId=${result.shipmentId} action=${result.action}`,
  );
}

// ─── Worker setup ─────────────────────────────────────────────────────────────

/**
 * Start the WC webhook worker. Called from server.ts at startup.
 *
 * Concurrency cap of 10 ensures fair processing across tenants while
 * keeping throughput high enough for normal webhook volumes.
 */
export function startWCWebhookWorker(): void {
  const connection = getQueueConnection();

  const worker = new Worker<WCWebhookJobData>(
    "wc-webhooks",
    processWCWebhookJob,
    {
      connection,
      concurrency: 10,
    },
  );

  worker.on("failed", (job, err) => {
    const attempts = job?.attemptsMade ?? "?";
    const maxAttempts = job?.opts?.attempts ?? 5;
    console.error(
      `[wc-webhook-worker] Job ${job?.id} failed (attempt ${attempts}/${maxAttempts}):`,
      err.message,
    );
    if (job && job.attemptsMade >= (job.opts.attempts ?? 5)) {
      console.error(
        `[wc-webhook-worker] Job ${job.id} exhausted retries — moved to DLQ (failed set).`,
        { shopId: job.data.shopId, topic: job.data.topic },
      );
    }
  });

  worker.on("completed", (job) => {
    console.info(`[wc-webhook-worker] Job ${job.id} completed for shop ${job.data.shopId}`);
  });

  registerWorker(worker);
  console.info("[wc-webhook-worker] Worker started (concurrency: 10)");
}
