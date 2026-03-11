/**
 * Courier Webhook Types
 *
 * Type definitions for webhooks received from Onfleet, Stuart, and Uber Direct.
 * Includes payload schemas, signature verification types, and normalized event types.
 */

import type { DeliveryStatus } from "../types.js";

// ─── ONFLEET WEBHOOK TYPES ──────────────────────────────────────────────

/**
 * Onfleet webhook payload for task-related events.
 * Onfleet sends webhooks for task updates, worker updates, and team updates.
 */
export interface OnfleetWebhookPayload {
  /** Unique webhook ID */
  id: string;

  /** Trigger/event type ID */
  triggerId: string;

  /** Action type (e.g., "task_update", "worker_update", "team_update") */
  action: string;

  /** Unix timestamp in milliseconds when event occurred */
  time: number;

  /** Task ID associated with the event (if applicable) */
  taskId?: string;

  /** Worker ID associated with the event (if applicable) */
  workerId?: string;

  /** Team ID associated with the event (if applicable) */
  teamId?: string;

  /** Event-specific data */
  data: Record<string, unknown>;
}

/**
 * Onfleet task status enum (provider-specific)
 */
export enum OnfleetTaskStatus {
  UNASSIGNED = "unassigned",
  ASSIGNED = "assigned",
  ACTIVE = "active",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

/**
 * Onfleet worker on-duty status event
 */
export interface OnfleetWorkerDutyEvent {
  workerId: string;
  teamId: string;
  onDuty: boolean;
  timestamp: number;
}

// ─── STUART WEBHOOK TYPES ───────────────────────────────────────────────

/**
 * Stuart webhook payload for job-related events.
 * Stuart sends webhooks for job lifecycle events (created, picking, delivering, delivered, cancelled).
 */
export interface StuartWebhookPayload {
  /** Unique event ID for idempotency */
  event_id: string;

  /** Event type (e.g., "job.created", "job.delivering", "job.delivered") */
  event: string;

  /** Unix timestamp in seconds when event occurred */
  timestamp: number;

  /** Delivery/job data in the event */
  data: {
    id: string;
    status: string;
    customer_reference?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
    [key: string]: unknown;
  };
}

/**
 * Stuart job status enum (provider-specific)
 */
export enum StuartJobStatus {
  CREATED = "created",
  PICKING = "picking",
  DELIVERING = "delivering",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
  FAILED = "failed",
}

// ─── UBER DIRECT WEBHOOK TYPES ──────────────────────────────────────────

/**
 * Uber Direct webhook payload for delivery-related events.
 * Uber sends webhooks for delivery status changes and courier updates.
 */
export interface UberDirectWebhookPayload {
  /** Unique delivery ID */
  delivery_id: string;

  /** Current delivery status */
  status: string;

  /** Event type (e.g., "delivery.status_change", "delivery.courier_update") */
  event_type: string;

  /** Unique event ID for deduplication */
  event_id: string;

  /** ISO 8601 timestamp when event occurred */
  timestamp: string;

  /** Event-specific data */
  data: {
    previous_status?: string;
    current_status?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
    [key: string]: unknown;
  };
}

/**
 * Uber Direct delivery status enum (provider-specific)
 */
export enum UberDirectDeliveryStatus {
  CREATED = "created",
  EN_ROUTE_TO_PICKUP = "en_route_to_pickup",
  ARRIVED_AT_PICKUP = "arrived_at_pickup",
  PICKED_UP = "picked_up",
  EN_ROUTE_TO_DROPOFF = "en_route_to_dropoff",
  ARRIVED_AT_DROPOFF = "arrived_at_dropoff",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  FAILED = "failed",
}

// ─── WEBHOOK VERIFICATION TYPES ─────────────────────────────────────────

/**
 * Webhook signature verification result
 */
export interface WebhookVerificationResult {
  /** Whether signature verification passed */
  isValid: boolean;

  /** Error message if verification failed */
  error?: string;
}

/**
 * Onfleet webhook signature verification (HMAC-SHA512)
 */
export interface OnfleetSignatureVerification {
  provider: "onfleet";
  algorithm: "hmac-sha512";
  headerName: "X-Onfleet-Signature";
  payload: string;
  signature: string;
  secret: string;
}

/**
 * Stuart webhook signature verification (HMAC-SHA256)
 */
export interface StuartSignatureVerification {
  provider: "stuart";
  algorithm: "hmac-sha256";
  headerName: "X-Stuart-Signature";
  payload: string;
  signature: string;
  secret: string;
}

/**
 * Uber Direct webhook signature verification (HMAC-SHA256)
 */
export interface UberDirectSignatureVerification {
  provider: "uber_direct";
  algorithm: "hmac-sha256";
  headerName: "X-Uber-Signature";
  payload: string;
  signature: string;
  secret: string;
}

/**
 * Union type for all webhook verifications
 */
export type WebhookSignatureVerification =
  | OnfleetSignatureVerification
  | StuartSignatureVerification
  | UberDirectSignatureVerification;

// ─── NORMALIZED DELIVERY EVENT ──────────────────────────────────────────

/**
 * Provider-specific event types
 */
export enum ProviderEventType {
  // Onfleet
  ONFLEET_TASK_UPDATE = "onfleet.task_update",
  ONFLEET_WORKER_DUTY = "onfleet.worker_duty",

  // Stuart
  STUART_JOB_CREATED = "stuart.job_created",
  STUART_JOB_PICKING = "stuart.job_picking",
  STUART_JOB_DELIVERING = "stuart.job_delivering",
  STUART_JOB_DELIVERED = "stuart.job_delivered",
  STUART_JOB_CANCELLED = "stuart.job_cancelled",

  // Uber Direct
  UBER_DELIVERY_STATUS = "uber.delivery_status",
  UBER_COURIER_UPDATE = "uber.courier_update",
  UBER_RECEIPT = "uber.receipt",
}

/**
 * Normalized delivery event after processing webhook.
 * Maps provider-specific events to a unified format.
 */
export interface NormalizedDeliveryEvent {
  /** Unique event ID for deduplication */
  eventId: string;

  /** Event type (unified across providers) */
  eventType: ProviderEventType;

  /** Courier provider (onfleet, stuart, uber_direct) */
  provider: "onfleet" | "stuart" | "uber_direct";

  /** External delivery/task ID from provider */
  externalDeliveryId: string;

  /** Normalized delivery status */
  status?: DeliveryStatus;

  /** Driver information if available */
  driver?: {
    id?: string;
    name?: string;
    phone?: string;
    location?: {
      latitude: number;
      longitude: number;
      timestamp: Date;
    };
  };

  /** Proof of delivery if available */
  proofOfDelivery?: {
    signature?: string;
    photo?: string;
    timestamp: Date;
    recipientName?: string;
  };

  /** Event occurrence timestamp */
  timestamp: Date;

  /** Raw provider payload for auditing */
  rawPayload: Record<string, unknown>;

  /** Additional metadata */
  metadata?: {
    estimatedArrival?: Date;
    distance?: number;
    duration?: number;
    cancellationReason?: string;
    [key: string]: unknown;
  };
}

/**
 * Webhook processor result after handling webhook
 */
export interface WebhookProcessResult {
  /** Whether webhook was processed successfully */
  success: boolean;

  /** Delivery ID that was updated (if applicable) */
  deliveryId?: string;

  /** Normalized event that was emitted */
  event?: NormalizedDeliveryEvent;

  /** Error message if processing failed */
  error?: string;

  /** Whether this was a duplicate webhook (processed before) */
  isDuplicate: boolean;
}
