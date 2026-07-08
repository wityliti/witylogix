/**
 * Notification Worker — BullMQ job handler with orchestrator delegation.
 *
 * Architecture:
 *   1. Dequeue job from BullMQ with NotificationJobData
 *   2. Extract and validate payload (shopId, channel, templateId, recipient, variables)
 *   3. Call orchestrator.sendNotification() for each channel
 *   4. Log result (success or failure) with job metadata
 *   5. Handle errors appropriately:
 *      - Retryable (RateLimitError, network timeout) → re-throw for BullMQ
 *      - Permanent (ProviderError, AuthenticationError) → log to DLQ
 *
 * Key Principles:
 *   - Worker owns queue orchestration (dequeue, validate, retry)
 *   - Orchestrator owns delivery orchestration (template, routing, retry)
 *   - Clear error classification (retryable vs. permanent)
 *   - Per-tenant provider resolution via TenantProviderRegistry
 *   - Comprehensive logging for audit and debugging
 *
 * Dependencies:
 *   - BullMQ: Job queue for reliable, durable notification processing
 *   - NotificationOrchestrator: Centralized template, routing, delivery logic
 *   - Prisma: Database for logging delivery attempts
 *   - Tenant context (forTenant): Per-shop database isolation
 *
 * Related ADR: ADR-013 (Worker-Orchestrator Integration)
 */

import { Worker, type Job } from "bullmq";
import { forTenant } from "@witylogix/db";
import { getConfig } from "../lib/config.js";
import type { NotificationJobData } from "../lib/queue.js";
import { registerWorker } from "../lib/queue.js";
import {
  getNotificationOrchestrator,
  type NotificationResult,
} from "@witylogix/core/notifications";

// ──────────────────────────────────────────────────────────────────
// Error Classification Helpers
// ──────────────────────────────────────────────────────────────────

/**
 * Determine if error is retryable (transient).
 * Retryable errors will be re-thrown to BullMQ for retry.
 * Permanent errors will be logged to DLQ.
 */
function isRetryableError(error: string): boolean {
  if (!error) return true;

  const retryablePatterns = [
    /rate.?limit/i,
    /timeout/i,
    /temporarily/i,
    /try.?again/i,
    /connection.?reset/i,
    /econnrefused/i,
    /econnaborted/i,
    /econnreset/i,
    /etimedout/i,
    /5\d{2}/i, // 5xx HTTP status codes
    /unavailable/i,
    /service.?error/i,
  ];

  return retryablePatterns.some((pattern) => pattern.test(error));
}

/**
 * Determine if error is due to invalid recipient.
 * Invalid recipient errors should not be retried.
 */
function isInvalidRecipientError(error: string): boolean {
  const recipientPatterns = [
    /invalid.*(email|phone|address|token)/i,
    /malformed.*(email|phone)/i,
    /invalid.?recipient/i,
    /bad.?email/i,
    /invalid.?phone/i,
    /unsubscribed/i,
    /bounced/i,
  ];

  return recipientPatterns.some((pattern) => pattern.test(error));
}

/**
 * Determine if error is due to authentication/credentials.
 * Authentication errors should not be retried until credentials rotate.
 */
function isAuthenticationError(error: string): boolean {
  const authPatterns = [
    /authentication/i,
    /unauthorized/i,
    /credentials?/i,
    /api.?key/i,
    /invalid.?key/i,
    /expired.?token/i,
    /401/i, // HTTP 401 Unauthorized
    /403/i, // HTTP 403 Forbidden
  ];

  return authPatterns.some((pattern) => pattern.test(error));
}

/**
 * Determine if error is permanent (should not retry).
 */
function isPermanentError(error: string): boolean {
  return isInvalidRecipientError(error) || isAuthenticationError(error);
}

// ──────────────────────────────────────────────────────────────────
// Logging Helpers
// ──────────────────────────────────────────────────────────────────

/**
 * Log notification delivery attempt to database.
 * Uses Prisma (as any) pattern for typed table access.
 */
async function logDeliveryAttempt(
  shopId: string,
  channel: string,
  templateId: string,
  recipient: string,
  result: NotificationResult,
): Promise<void> {
  try {
    const db = forTenant(shopId);

    // Extract provider name from result metadata
    let providerName = "";
    if (
      result.providerResponse &&
      typeof result.providerResponse === "object"
    ) {
      const providerResponse = result.providerResponse as Record<
        string,
        unknown
      >;
      providerName = (providerResponse.providerName as string) || "";
    }

    await (db as any).notificationLog.create({
      data: {
        shopId,
        channel,
        templateId,
        recipient,
        providerName,
        messageId: result.messageId,
        status: result.success ? "SENT" : "FAILED",
        error: result.error,
        sentAt: result.success ? new Date() : undefined,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    // Don't throw — logging failure shouldn't block notification flow
    console.error(
      `[notification-worker] Failed to log delivery attempt for ${shopId}/${templateId}/${recipient}:`,
      error,
    );
  }
}

/**
 * Log dead-letter entry for permanently failed notification.
 */
async function logDeadLetterEntry(
  shopId: string,
  jobData: NotificationJobData,
  jobId: string | undefined,
  error: string,
  attemptCount: number,
): Promise<void> {
  try {
    console.error(
      `[notification-worker] DEAD_LETTER: job=${jobId} shopId=${shopId} ` +
        `channels=${jobData.channels.join(",")} recipient=${jobData.recipient.email || jobData.recipient.phone} ` +
        `error="${error}" attempts=${attemptCount}`,
    );

    // Optional: Store to DLQ table for ops investigation
    // await storeToDLQTable({
    //   jobId,
    //   shopId,
    //   jobData,
    //   error,
    //   attempts: attemptCount,
    //   createdAt: new Date(),
    // });
  } catch (err) {
    console.error(`[notification-worker] Failed to log DLQ entry:`, err);
  }
}

// ──────────────────────────────────────────────────────────────────
// Validation Helpers
// ──────────────────────────────────────────────────────────────────

/**
 * Validate required fields in job payload.
 * Throws if validation fails.
 */
function validateJobPayload(data: NotificationJobData): void {
  if (!data.shopId || typeof data.shopId !== "string") {
    throw new Error("Missing or invalid shopId");
  }

  if (!data.templateId || typeof data.templateId !== "string") {
    throw new Error("Missing or invalid templateId");
  }

  if (!Array.isArray(data.channels) || data.channels.length === 0) {
    throw new Error("Missing or empty channels array");
  }

  // Validate each channel
  const validChannels = ["EMAIL", "SMS", "WHATSAPP", "PUSH"];
  for (const channel of data.channels) {
    if (!validChannels.includes(channel)) {
      throw new Error(`Invalid channel: ${channel}`);
    }
  }

  // Validate recipient has at least one address
  if (
    !data.recipient ||
    typeof data.recipient !== "object" ||
    (!data.recipient.email && !data.recipient.phone && !data.recipient.fcmToken)
  ) {
    throw new Error(
      "Recipient must have at least one of: email, phone, or fcmToken",
    );
  }

  // Validate recipient format matches channels
  if (data.channels.includes("EMAIL") && !data.recipient.email) {
    throw new Error("EMAIL channel requires recipient.email");
  }

  if (
    (data.channels.includes("SMS") || data.channels.includes("WHATSAPP")) &&
    !data.recipient.phone
  ) {
    throw new Error("SMS/WHATSAPP channels require recipient.phone");
  }

  if (data.channels.includes("PUSH") && !data.recipient.fcmToken) {
    throw new Error("PUSH channel requires recipient.fcmToken");
  }
}

/**
 * Map channel string to proper case for orchestrator.
 */
function normalizeChannel(
  channel: string,
): "EMAIL" | "SMS" | "WHATSAPP" | "PUSH" {
  const normalized = channel.toUpperCase();
  if (!["EMAIL", "SMS", "WHATSAPP", "PUSH"].includes(normalized)) {
    throw new Error(`Invalid channel: ${channel}`);
  }
  return normalized as "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
}

// ──────────────────────────────────────────────────────────────────
// Recipient Extraction Helpers
// ──────────────────────────────────────────────────────────────────

/**
 * Get recipient address for a specific channel.
 */
function getRecipientForChannel(
  recipient: {
    email?: string;
    phone?: string;
    fcmToken?: string;
  },
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH",
): string {
  switch (channel) {
    case "EMAIL":
      if (!recipient.email) {
        throw new Error("Email recipient required for EMAIL channel");
      }
      return recipient.email;
    case "SMS":
    case "WHATSAPP":
      if (!recipient.phone) {
        throw new Error(`Phone recipient required for ${channel} channel`);
      }
      return recipient.phone;
    case "PUSH":
      if (!recipient.fcmToken) {
        throw new Error("FCM token required for PUSH channel");
      }
      return recipient.fcmToken;
    default:
      throw new Error(`Unknown channel: ${channel}`);
  }
}

// ──────────────────────────────────────────────────────────────────
// Main Worker Handler
// ──────────────────────────────────────────────────────────────────

/**
 * Process a single notification job.
 *
 * Flow:
 *   1. Validate payload
 *   2. For each channel:
 *      a. Get orchestrator
 *      b. Extract recipient for channel
 *      c. Call orchestrator.sendNotification()
 *      d. Log result
 *   3. Return results
 *   4. On error: classify and re-throw (for BullMQ retry) or log to DLQ
 */
async function notificationHandler(job: Job<NotificationJobData>): Promise<
  Array<{
    channel: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>
> {
  const { shopId, templateId, channels, recipient, variables } = job.data;

  // ─── Step 1: Validate payload ──────────────────────────────
  try {
    validateJobPayload(job.data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[notification-worker] Job ${job.id} validation failed: ${errorMessage}`,
    );
    // Validation errors are permanent — move to DLQ immediately
    await logDeadLetterEntry(
      shopId,
      job.data,
      job.id,
      `Validation failed: ${errorMessage}`,
      job.attemptsMade,
    );
    throw error;
  }

  // ─── Step 2: Get orchestrator ──────────────────────────────
  const orchestrator = getNotificationOrchestrator();

  // ─── Step 3: Process each channel ──────────────────────────
  const results: Array<{
    channel: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }> = [];

  let anyRetryableFailure = false;
  let anyPermanentFailure = false;

  for (const channelStr of channels) {
    try {
      const channel = normalizeChannel(channelStr);
      const to = getRecipientForChannel(recipient, channel);

      console.info(
        `[notification-worker] Job ${job.id} sending ${channel} via orchestrator to ${to}`,
      );

      // Call orchestrator to send notification
      const result = await orchestrator.sendNotification(
        shopId,
        channel,
        to,
        templateId,
        variables,
      );

      // Log delivery attempt
      await logDeliveryAttempt(shopId, channel, templateId, to, result);

      if (result.success) {
        console.info(
          `[notification-worker] Job ${job.id} ${channel} sent: ${result.messageId}`,
        );
        results.push({
          channel,
          success: true,
          messageId: result.messageId,
        });
      } else {
        // Orchestrator returned failure
        const error = result.error || "Unknown error";

        if (isRetryableError(error)) {
          // Retryable — will re-throw below
          anyRetryableFailure = true;
        } else if (isPermanentError(error)) {
          // Permanent — will log to DLQ below
          anyPermanentFailure = true;
        } else {
          // Default to retryable if unsure
          anyRetryableFailure = true;
        }

        console.warn(
          `[notification-worker] Job ${job.id} ${channel} failed ` +
            `(${isRetryableError(error) ? "retryable" : "permanent"}): ${error}`,
        );

        results.push({
          channel,
          success: false,
          error,
        });
      }
    } catch (error) {
      // Orchestrator threw an exception (not just failed result)
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const isRetryable =
        error instanceof Error &&
        (error.name === "RateLimitError" ||
          isRetryableError(errorMessage) ||
          errorMessage.includes("timeout") ||
          errorMessage.includes("ECONNRESET"));

      if (isRetryable) {
        anyRetryableFailure = true;
      } else {
        anyPermanentFailure = true;
      }

      console.error(
        `[notification-worker] Job ${job.id} ${channelStr} exception ` +
          `(${isRetryable ? "retryable" : "permanent"}): ${errorMessage}`,
      );

      results.push({
        channel: channelStr,
        success: false,
        error: errorMessage,
      });
    }
  }

  // ─── Step 4: Handle results ────────────────────────────────
  // If any channel is still pending or has retryable failure, let BullMQ retry
  if (anyRetryableFailure && !anyPermanentFailure) {
    const failures = results.filter((r) => !r.success);
    console.warn(
      `[notification-worker] Job ${job.id} has retryable failures, will be retried by BullMQ: ` +
        failures.map((f) => `${f.channel}: ${f.error}`).join("; "),
    );
    throw new Error(
      `Retryable failures: ${failures.map((f) => `${f.channel}: ${f.error}`).join("; ")}`,
    );
  }

  // If any permanent failure, log to DLQ and fail job
  if (anyPermanentFailure) {
    const failures = results.filter((r) => !r.success);
    const errorSummary = failures
      .map((f) => `${f.channel}: ${f.error}`)
      .join("; ");

    await logDeadLetterEntry(
      shopId,
      job.data,
      job.id,
      errorSummary,
      job.attemptsMade,
    );

    throw new Error(`Permanent failures (DLQ): ${errorSummary}`);
  }

  // All channels succeeded
  console.info(
    `[notification-worker] Job ${job.id} completed successfully for all channels`,
  );
  return results;
}

// ──────────────────────────────────────────────────────────────────
// Worker Setup and Configuration
// ──────────────────────────────────────────────────────────────────

/**
 * Start the notification worker.
 *
 * Configuration:
 *   - Concurrency: 10 (tunable based on CPU/memory)
 *   - Rate limiting: 100 jobs per minute per worker
 *   - Retry: 3 attempts with exponential backoff (configured by BullMQ)
 *   - Dead-letter: Failed jobs kept for inspection
 */
import { getQueueConnection } from "../lib/queue.js";

export function startNotificationWorker(): Worker {
  const config = getConfig();
  const connection = getQueueConnection();

  const worker = new Worker<NotificationJobData>(
    "notifications",
    notificationHandler,
    {
      connection,
      concurrency: 10, // Process 10 jobs concurrently
      limiter: {
        max: 100,
        duration: 60000, // 100 jobs per minute per worker
      },
      // Note: Retry configuration is typically set on the queue, not the worker.
      // Default BullMQ retry is typically 1 attempt (no retries).
      // Use Queue.addJob(..., { attempts: 3, backoff: {...} }) to configure.
    },
  );

  // Event handlers for monitoring
  worker.on("completed", (job) => {
    console.info(`[notification-worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    if (!job) {
      console.error(`[notification-worker] Worker failed without job:`, error);
      return;
    }

    console.error(
      `[notification-worker] Job ${job.id} failed after ${job.attemptsMade} attempts:`,
      error.message,
    );

    // Log to DLQ for ops investigation
    if (job.data) {
      logDeadLetterEntry(
        job.data.shopId,
        job.data,
        job.id,
        error.message,
        job.attemptsMade,
      ).catch((err) => {
        console.error(
          `[notification-worker] Failed to log DLQ for job ${job.id}:`,
          err,
        );
      });
    }
  });

  worker.on("error", (error) => {
    console.error(`[notification-worker] Worker error:`, error);
  });

  // Register worker for graceful shutdown
  registerWorker(worker);

  console.info("[notification-worker] Started");
  return worker;
}
