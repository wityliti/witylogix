/**
 * Courier Webhook Processor
 *
 * Handles webhook verification, normalization, and processing.
 * Supports Onfleet (HMAC-SHA512), Stuart (HMAC-SHA256), and Uber Direct (HMAC-SHA256).
 *
 * Flow:
 * 1. Verify signature based on provider
 * 2. Check for duplicate events (deduplication)
 * 3. Normalize provider-specific payload to unified event format
 * 4. Update CourierDelivery status in database
 * 5. Log webhook for audit trail
 * 6. Emit domain events for downstream processing
 */

import { createHmac, timingSafeEqual } from "crypto";
import { prisma, Prisma } from "@witylogix/db";
import {
  type OnfleetWebhookPayload,
  type StuartWebhookPayload,
  type UberDirectWebhookPayload,
  type NormalizedDeliveryEvent,
  type WebhookProcessResult,
  OnfleetTaskStatus,
  StuartJobStatus,
  UberDirectDeliveryStatus,
  ProviderEventType,
} from "./types.js";
import type { DeliveryStatus as DeliveryStatusType } from "../types.js";
import { DeliveryStatus } from "../types.js";

// ─── STATUS MAPPING ──────────────────────────────────────────────────────────

/**
 * Prisma DB-level delivery status values (uppercase string literals from the
 * generated enum). Defined locally so we don't depend on internal Prisma
 * namespace members that are not re-exported by @witylogix/db.
 */
type PrismaDbDeliveryStatus =
  | "PENDING"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "FAILED"
  | "CANCELLED"
  | "RETURNED";

/**
 * Map the application-layer DeliveryStatus (lowercase values) to the Prisma
 * DB enum value (uppercase). The two enums mirror the same states but use
 * different string casing.
 */
function toPrismaDeliveryStatus(
  status: DeliveryStatusType,
): PrismaDbDeliveryStatus {
  const map: Record<DeliveryStatusType, PrismaDbDeliveryStatus> = {
    pending: "PENDING",
    picked_up: "PICKED_UP",
    in_transit: "IN_TRANSIT",
    delivered: "DELIVERED",
    failed: "FAILED",
    cancelled: "CANCELLED",
    returned: "RETURNED",
  };
  return map[status];
}

// ─── SIGNATURE VERIFICATION ──────────────────────────────────────────────

/**
 * Verify Onfleet webhook signature using HMAC-SHA512
 * Onfleet signature format: HMAC-SHA512(payload, secret)
 */
export function verifyOnfleetSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  try {
    const computed = createHmac("sha512", secret).update(payload).digest("hex");
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Verify Stuart webhook signature using HMAC-SHA256
 * Stuart signature format: HMAC-SHA256(payload, secret)
 */
export function verifyStuartSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  try {
    const computed = createHmac("sha256", secret).update(payload).digest("hex");
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Verify Uber Direct webhook signature using HMAC-SHA256
 * Uber signature format: HMAC-SHA256(payload, secret)
 */
export function verifyUberDirectSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  try {
    const computed = createHmac("sha256", secret).update(payload).digest("hex");
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ─── NORMALIZATION ──────────────────────────────────────────────────────

/**
 * Normalize Onfleet webhook payload to unified event format
 */
function normalizeOnfleetEvent(
  payload: OnfleetWebhookPayload,
): NormalizedDeliveryEvent | null {
  const { taskId, data, time, action } = payload;

  // Only process task update events
  if (action !== "task_update" || !taskId) {
    return null;
  }

  const taskData = data as Record<string, unknown>;
  const status = taskData.status as string | undefined;
  const completionDetails = taskData.completionDetails as
    | Record<string, unknown>
    | undefined;

  // Map Onfleet status to normalized status
  let normalizedStatus: DeliveryStatusType | undefined;
  switch (status) {
    case OnfleetTaskStatus.UNASSIGNED:
    case OnfleetTaskStatus.ASSIGNED:
      normalizedStatus = DeliveryStatus.PENDING;
      break;
    case OnfleetTaskStatus.ACTIVE:
      normalizedStatus = DeliveryStatus.IN_TRANSIT;
      break;
    case OnfleetTaskStatus.COMPLETED:
      normalizedStatus = DeliveryStatus.DELIVERED;
      break;
    case OnfleetTaskStatus.FAILED:
      normalizedStatus = DeliveryStatus.FAILED;
      break;
    case OnfleetTaskStatus.CANCELLED:
      normalizedStatus = DeliveryStatus.CANCELLED;
      break;
  }

  const eventDate = new Date(time);

  // Extract proof of delivery if task was completed
  let proofOfDelivery: NormalizedDeliveryEvent["proofOfDelivery"] | undefined;
  if (completionDetails) {
    const location = completionDetails.location as [number, number] | undefined;
    proofOfDelivery = {
      timestamp: eventDate,
      recipientName: completionDetails.recipientName as string | undefined,
    };
  }

  return {
    eventId: payload.id,
    eventType: ProviderEventType.ONFLEET_TASK_UPDATE,
    provider: "onfleet",
    externalDeliveryId: taskId,
    status: normalizedStatus,
    timestamp: eventDate,
    rawPayload: payload,
    proofOfDelivery,
    metadata: {
      notes: completionDetails?.notes as string | undefined,
      success: completionDetails?.success as boolean | undefined,
    },
  };
}

/**
 * Normalize Stuart webhook payload to unified event format
 */
function normalizeStuartEvent(
  payload: StuartWebhookPayload,
): NormalizedDeliveryEvent | null {
  const { event_id, event, timestamp, data } = payload;
  const deliveryId = data.id;

  // Map Stuart event type to provider event type
  let eventType: ProviderEventType;
  let normalizedStatus: DeliveryStatusType | undefined;

  switch (event) {
    case "job.created":
      eventType = ProviderEventType.STUART_JOB_CREATED;
      normalizedStatus = DeliveryStatus.PENDING;
      break;
    case "job.picking":
      eventType = ProviderEventType.STUART_JOB_PICKING;
      normalizedStatus = DeliveryStatus.PICKED_UP;
      break;
    case "job.delivering":
      eventType = ProviderEventType.STUART_JOB_DELIVERING;
      normalizedStatus = DeliveryStatus.IN_TRANSIT;
      break;
    case "job.delivered":
      eventType = ProviderEventType.STUART_JOB_DELIVERED;
      normalizedStatus = DeliveryStatus.DELIVERED;
      break;
    case "job.cancelled":
      eventType = ProviderEventType.STUART_JOB_CANCELLED;
      normalizedStatus = DeliveryStatus.CANCELLED;
      break;
    default:
      return null;
  }

  const eventDate = new Date(timestamp * 1000); // Convert seconds to milliseconds

  return {
    eventId: event_id,
    eventType,
    provider: "stuart",
    externalDeliveryId: deliveryId,
    status: normalizedStatus,
    timestamp: eventDate,
    rawPayload: payload,
    metadata: {
      reference: data.customer_reference as string | undefined,
    },
  };
}

/**
 * Normalize Uber Direct webhook payload to unified event format
 */
function normalizeUberDirectEvent(
  payload: UberDirectWebhookPayload,
): NormalizedDeliveryEvent | null {
  const { delivery_id, event_type, event_id, timestamp, data } = payload;

  // Map Uber event type to provider event type
  let eventType: ProviderEventType;
  let normalizedStatus: DeliveryStatusType | undefined;

  if (event_type === "delivery.status_change") {
    const currentStatus = data.current_status as string | undefined;
    eventType = ProviderEventType.UBER_DELIVERY_STATUS;

    // Map Uber status to normalized status
    switch (currentStatus) {
      case UberDirectDeliveryStatus.CREATED:
      case UberDirectDeliveryStatus.EN_ROUTE_TO_PICKUP:
      case UberDirectDeliveryStatus.ARRIVED_AT_PICKUP:
        normalizedStatus = DeliveryStatus.PENDING;
        break;
      case UberDirectDeliveryStatus.PICKED_UP:
        normalizedStatus = DeliveryStatus.PICKED_UP;
        break;
      case UberDirectDeliveryStatus.EN_ROUTE_TO_DROPOFF:
      case UberDirectDeliveryStatus.ARRIVED_AT_DROPOFF:
        normalizedStatus = DeliveryStatus.IN_TRANSIT;
        break;
      case UberDirectDeliveryStatus.COMPLETED:
        normalizedStatus = DeliveryStatus.DELIVERED;
        break;
      case UberDirectDeliveryStatus.CANCELLED:
        normalizedStatus = DeliveryStatus.CANCELLED;
        break;
      case UberDirectDeliveryStatus.FAILED:
        normalizedStatus = DeliveryStatus.FAILED;
        break;
    }
  } else if (event_type === "delivery.courier_update") {
    eventType = ProviderEventType.UBER_COURIER_UPDATE;
  } else if (event_type === "delivery.receipt") {
    eventType = ProviderEventType.UBER_RECEIPT;
  } else {
    return null;
  }

  const eventDate = new Date(timestamp);

  return {
    eventId: event_id,
    eventType,
    provider: "uber_direct",
    externalDeliveryId: delivery_id,
    status: normalizedStatus,
    timestamp: eventDate,
    rawPayload: payload,
    metadata: {
      previousStatus: data.previous_status as string | undefined,
    },
  };
}

// ─── WEBHOOK PROCESSING ─────────────────────────────────────────────────

/**
 * Process webhook from a courier provider
 *
 * @param provider - Courier provider name (onfleet, stuart, uber_direct)
 * @param payload - Raw webhook payload
 * @param signature - Webhook signature from headers
 * @param secret - Webhook secret for verification
 * @param partnerId - Courier partner ID in database
 * @param requestBody - Original request body as string (for signature verification)
 * @returns WebhookProcessResult
 */
export async function processWebhook(
  provider: "onfleet" | "stuart" | "uber_direct",
  payload: string,
  signature: string,
  secret: string,
  partnerId: string,
  requestBody: string,
): Promise<WebhookProcessResult> {
  try {
    // Step 1: Check supported provider
    const supportedProviders = ["onfleet", "stuart", "uber_direct"];
    if (!supportedProviders.includes(provider as string)) {
      return {
        success: false,
        error: `Unsupported provider: ${provider}`,
        isDuplicate: false,
      };
    }

    // Step 2: Verify signature
    const isValid = verifySignature(provider, requestBody, signature, secret);
    if (!isValid) {
      return {
        success: false,
        error: "Invalid webhook signature",
        isDuplicate: false,
      };
    }

    // Step 3: Parse payload
    let parsedPayload:
      | OnfleetWebhookPayload
      | StuartWebhookPayload
      | UberDirectWebhookPayload;
    try {
      parsedPayload = JSON.parse(payload);
    } catch (error) {
      return {
        success: false,
        error: "Invalid JSON payload",
        isDuplicate: false,
      };
    }

    // Step 4: Normalize to unified event
    let normalizedEvent: NormalizedDeliveryEvent | null;
    let eventId: string;

    switch (provider) {
      case "onfleet": {
        const onfleetPayload = parsedPayload as OnfleetWebhookPayload;
        eventId = onfleetPayload.id;
        normalizedEvent = normalizeOnfleetEvent(onfleetPayload);
        break;
      }
      case "stuart": {
        const stuartPayload = parsedPayload as StuartWebhookPayload;
        eventId = stuartPayload.event_id;
        normalizedEvent = normalizeStuartEvent(stuartPayload);
        break;
      }
      case "uber_direct": {
        const uberPayload = parsedPayload as UberDirectWebhookPayload;
        eventId = uberPayload.event_id;
        normalizedEvent = normalizeUberDirectEvent(uberPayload);
        break;
      }
      default:
        return {
          success: false,
          error: `Unsupported provider: ${provider}`,
          isDuplicate: false,
        };
    }

    // Step 4: Check for duplicates
    const existingLog = await prisma.courierWebhookLog.findFirst({
      where: {
        partnerId,
        eventId,
      },
    });

    const isDuplicate = !!existingLog;
    if (isDuplicate) {
      return {
        success: true,
        isDuplicate: true,
        event: normalizedEvent ?? undefined,
      };
    }

    // Step 5: Update delivery status if we have a normalized event
    let deliveryId: string | undefined;
    if (normalizedEvent && normalizedEvent.status) {
      const delivery = await prisma.courierDelivery.findFirst({
        where: {
          partnerId,
          externalId: normalizedEvent.externalDeliveryId,
        },
      });

      if (delivery) {
        deliveryId = delivery.id;

        // Map normalized status back to database enum
        const dbStatus = toPrismaDeliveryStatus(normalizedEvent.status);

        await prisma.courierDelivery.update({
          where: { id: delivery.id },
          data: {
            status: dbStatus,
            lastStatusUpdate: new Date(),
            driverName: normalizedEvent.driver?.name,
            driverPhone: normalizedEvent.driver?.phone,
            driverLocation: normalizedEvent.driver?.location
              ? {
                  latitude: normalizedEvent.driver.location.latitude,
                  longitude: normalizedEvent.driver.location.longitude,
                  updatedAt:
                    normalizedEvent.driver.location.timestamp.toISOString(),
                }
              : Prisma.DbNull,
            proofOfDelivery: normalizedEvent.proofOfDelivery
              ? {
                  timestamp:
                    normalizedEvent.proofOfDelivery.timestamp.toISOString(),
                  recipientName:
                    normalizedEvent.proofOfDelivery.recipientName ?? null,
                  signature: normalizedEvent.proofOfDelivery.signature ?? null,
                  photo: normalizedEvent.proofOfDelivery.photo ?? null,
                }
              : Prisma.DbNull,
            deliveredAt:
              normalizedEvent.status === DeliveryStatus.DELIVERED
                ? normalizedEvent.timestamp
                : undefined,
          },
        });
      }
    }

    // Step 6: Log webhook
    await prisma.courierWebhookLog.create({
      data: {
        partnerId,
        deliveryId,
        eventType: normalizedEvent?.eventType ?? "unknown",
        eventId,
        payload: JSON.parse(payload),
        processed: true,
        processedAt: new Date(),
        receivedAt: new Date(),
      },
    });

    // Step 7: Emit domain events
    if (normalizedEvent && deliveryId) {
      emitDeliveryEvent(normalizedEvent, deliveryId);
    }

    return {
      success: true,
      deliveryId,
      event: normalizedEvent ?? undefined,
      isDuplicate: false,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Log failed webhook
    try {
      await prisma.courierWebhookLog.create({
        data: {
          partnerId,
          eventType: "error",
          eventId: `error_${Date.now()}`,
          payload: { raw: payload.substring(0, 1000) },
          processed: false,
          error: errorMsg,
          receivedAt: new Date(),
        },
      });
    } catch {
      // Silently ignore logging errors
    }

    return {
      success: false,
      error: errorMsg,
      isDuplicate: false,
    };
  }
}

/**
 * Verify webhook signature based on provider
 */
function verifySignature(
  provider: "onfleet" | "stuart" | "uber_direct",
  payload: string,
  signature: string,
  secret: string,
): boolean {
  switch (provider) {
    case "onfleet":
      return verifyOnfleetSignature(payload, signature, secret);
    case "stuart":
      return verifyStuartSignature(payload, signature, secret);
    case "uber_direct":
      return verifyUberDirectSignature(payload, signature, secret);
    default:
      return false;
  }
}

/**
 * Emit domain event based on delivery status change
 * In a real system, these would be published to an event bus
 */
function emitDeliveryEvent(
  event: NormalizedDeliveryEvent,
  deliveryId: string,
): void {
  // This would integrate with an event bus like Redis Streams, Kafka, or RabbitMQ
  // For now, we just log for demonstration
  const eventName = `delivery.${event.status?.toLowerCase() ?? "updated"}`;

  // Example: emit to event bus
  // await eventBus.publish('courier.delivery', {
  //   deliveryId,
  //   event: eventName,
  //   provider: event.provider,
  //   timestamp: event.timestamp,
  //   data: event
  // });

  console.log(
    `[Webhook] Emitted event: ${eventName} for delivery ${deliveryId}`,
  );
}

/** Type for a single webhook log row (includes all scalar fields from the model). */
type CourierWebhookLogRow = Awaited<
  ReturnType<typeof prisma.courierWebhookLog.findUniqueOrThrow>
>;

/**
 * Get webhook log by ID for auditing
 */
export async function getWebhookLog(
  webhookLogId: string,
): Promise<CourierWebhookLogRow | null> {
  return prisma.courierWebhookLog.findUnique({
    where: { id: webhookLogId },
  });
}

/**
 * Get recent webhook logs for a partner
 */
export async function getPartnerWebhookLogs(
  partnerId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<CourierWebhookLogRow[]> {
  return prisma.courierWebhookLog.findMany({
    where: { partnerId },
    orderBy: { receivedAt: "desc" },
    take: limit,
    skip: offset,
  });
}

/**
 * Count unprocessed webhooks for a partner
 */
export async function countUnprocessedWebhooks(
  partnerId: string,
): Promise<number> {
  return await prisma.courierWebhookLog.count({
    where: {
      partnerId,
      processed: false,
    },
  });
}

/**
 * Retry processing failed webhooks
 */
export async function retryFailedWebhooks(
  partnerId: string,
  limit: number = 10,
): Promise<number> {
  const failedLogs = await prisma.courierWebhookLog.findMany({
    where: {
      partnerId,
      processed: false,
      error: { not: null },
    },
    take: limit,
    orderBy: { receivedAt: "asc" },
  });

  let successCount = 0;

  for (const log of failedLogs) {
    try {
      // Re-process webhook
      const payload = JSON.stringify(log.payload);
      const headersObj: Record<string, unknown> | null =
        log.headers !== null &&
        typeof log.headers === "object" &&
        !Array.isArray(log.headers)
          ? (log.headers as Record<string, unknown>)
          : null;
      const signature =
        typeof headersObj?.["x-signature"] === "string"
          ? headersObj["x-signature"]
          : undefined;
      const secret =
        typeof headersObj?.["x-secret"] === "string"
          ? headersObj["x-secret"]
          : undefined;

      // Load partner to get provider type
      const partner = await prisma.courierPartner.findUnique({
        where: { id: log.partnerId },
        select: { provider: true },
      });

      if (signature && secret && partner) {
        const result = await processWebhook(
          partner.provider as "onfleet" | "stuart" | "uber_direct",
          payload,
          signature,
          secret,
          partnerId,
          payload,
        );

        if (result.success) {
          await prisma.courierWebhookLog.update({
            where: { id: log.id },
            data: {
              processed: true,
              processedAt: new Date(),
              error: null,
            },
          });
          successCount++;
        }
      }
    } catch {
      // Continue to next webhook
    }
  }

  return successCount;
}
