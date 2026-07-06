/**
 * Event-driven notification trigger system.
 *
 * Automatically sends notifications when shipment lifecycle events occur.
 * Decouples event publishing from notification delivery via an event bus.
 *
 * Architecture:
 *   1. Domain services emit events to the EventBus (async)
 *   2. NotificationTriggerEngine listens for events
 *   3. On event arrival, engine evaluates trigger rules from database
 *   4. Matching rules are processed: conditions evaluated, recipients resolved
 *   5. Notification queued to NotificationOrchestrator for delivery
 *
 * Example Usage:
 *   import { eventBus, triggerEngine, TriggerEvent } from "@witylogix/core/events";
 *
 *   // Emit a shipment delivery event
 *   eventBus.emit(TriggerEvent.SHIPMENT_DELIVERED, {
 *     shipmentId: "ship_123",
 *     customerId: "cust_456",
 *     deliveredAt: new Date(),
 *   });
 *
 *   // TriggerEngine automatically:
 *   // - Loads rules for the shipment's shop
 *   // - Evaluates conditions (e.g., only for specific zones)
 *   // - Resolves customer email/phone from payload
 *   // - Queues notifications via appropriate templates
 */

// ───────────────────────────────────────────────────────────────────
// EVENT TYPES & ENUMS
// ───────────────────────────────────────────────────────────────────

/**
 * All events that can trigger notifications.
 * Organized by domain: orders, shipments, drivers, delivery, payments.
 */
export enum TriggerEvent {
  // Order lifecycle
  ORDER_CREATED = "order.created",
  ORDER_CONFIRMED = "order.confirmed",

  // Shipment lifecycle
  SHIPMENT_CREATED = "shipment.created",
  SHIPMENT_LABEL_CREATED = "shipment.label_created",
  SHIPMENT_PICKED_UP = "shipment.picked_up",
  SHIPMENT_IN_TRANSIT = "shipment.in_transit",
  SHIPMENT_OUT_FOR_DELIVERY = "shipment.out_for_delivery",
  SHIPMENT_DELIVERED = "shipment.delivered",
  SHIPMENT_FAILED = "shipment.failed",
  SHIPMENT_RETURNED = "shipment.returned",

  // Driver lifecycle
  DRIVER_ASSIGNED = "driver.assigned",
  DRIVER_NEAR_DELIVERY = "driver.near_delivery", // 500m geofence

  // Delivery milestones
  DELIVERY_ATTEMPTED = "delivery.attempted",
  DELIVERY_PROOF_SUBMITTED = "delivery.proof_submitted",

  // Payment lifecycle
  PAYMENT_RECEIVED = "payment.received",
  PAYMENT_FAILED = "payment.failed",
}

// ───────────────────────────────────────────────────────────────────
// TRIGGER RULE & CONDITION TYPES
// ───────────────────────────────────────────────────────────────────

/**
 * A trigger rule: when event X happens, send notification via template Y to recipient Z.
 * Rules are typically configured by shop admins and stored in the database.
 */
export interface TriggerRule {
  /** Unique rule ID. */
  id: string;

  /** Shop/tenant that owns this rule. */
  shopId: string;

  /** The event that triggers this rule. */
  event: TriggerEvent;

  /** Notification template ID to use (references templates table). */
  templateId: string;

  /** Notification channel: email, SMS, WhatsApp, or push. */
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";

  /** Who receives the notification: customer, driver, admin, or custom recipient. */
  recipientType: "customer" | "driver" | "admin" | "custom";

  /**
   * Static recipient (email/phone) for custom rules.
   * Only used when recipientType === "custom".
   */
  customRecipient?: string;

  /**
   * Optional conditions to filter which events should trigger.
   * Examples:
   *   - { field: "shipment.zone", operator: "eq", value: "north_zone" }
   *   - { field: "order.total", operator: "gt", value: 100 }
   * If empty or undefined, all events of this type trigger.
   */
  conditions?: TriggerCondition[];

  /**
   * Delay in seconds before sending notification.
   * Useful for: "send reminder 1 hour after attempt" (delay: 3600).
   * Default: 0 (send immediately).
   */
  delay?: number;

  /** Whether this rule is currently active. */
  isActive: boolean;
}

/**
 * A condition that can filter trigger events.
 * Multiple conditions are AND'd together.
 */
export interface TriggerCondition {
  /** Field path in the event payload (e.g., "shipment.zone", "order.total"). */
  field: string;

  /** Comparison operator. */
  operator: "eq" | "neq" | "gt" | "lt" | "contains" | "in";

  /** Value to compare against. */
  value: unknown;
}

/**
 * Generic event payload. Emitted by domain services.
 * Structure depends on event type but includes common fields.
 */
export interface EventPayload {
  /** The triggering entity (shipment, order, driver, payment). */
  [key: string]: unknown;
}

/**
 * Result of processing an event through the trigger engine.
 */
export interface ProcessResult {
  /** Number of trigger rules that matched. */
  matchedRuleCount: number;

  /** Number of notifications queued. */
  queuedCount: number;

  /** Errors encountered during processing (if any). */
  errors: ProcessError[];

  /** Duration in milliseconds. */
  durationMs: number;
}

/**
 * An error encountered during event processing.
 */
export interface ProcessError {
  ruleId: string;
  error: Error | string;
}

// ───────────────────────────────────────────────────────────────────
// EVENT BUS
// ───────────────────────────────────────────────────────────────────

/** Function signature for event handlers. */
export type EventHandler = (payload: EventPayload) => void | Promise<void>;

/**
 * EventBus: Simple pub/sub for domain events.
 *
 * - Decouples event emitters (domain services) from listeners (trigger engine).
 * - Handlers are async-aware: emit() waits for all handlers to complete.
 * - Multiple handlers can listen to the same event.
 */
export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  /**
   * Register an event handler.
   *
   * @param event - The event to listen for.
   * @param handler - Function to call when event is emitted.
   *
   * @example
   *   eventBus.on(TriggerEvent.SHIPMENT_DELIVERED, async (payload) => {
   *     console.log("Shipment delivered:", payload.trackingNumber);
   *   });
   */
  on(event: TriggerEvent, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  /**
   * Unregister an event handler.
   *
   * @param event - The event to stop listening for.
   * @param handler - The specific handler to remove.
   */
  off(event: TriggerEvent, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  /**
   * Emit an event to all registered handlers.
   * Waits for all handlers to complete before returning.
   *
   * @param event - The event type.
   * @param payload - Event data to pass to handlers.
   *
   * @throws If any handler throws, the error is logged but processing continues.
   *
   * @example
   *   await eventBus.emit(TriggerEvent.SHIPMENT_DELIVERED, {
   *     shipmentId: "ship_123",
   *     customerId: "cust_456",
   *     deliveredAt: new Date(),
   *   });
   */
  async emit(event: TriggerEvent, payload: EventPayload): Promise<void> {
    const handlersForEvent = this.handlers.get(event);
    if (!handlersForEvent || handlersForEvent.size === 0) {
      return;
    }

    const promises: Promise<void>[] = [];

    for (const handler of Array.from(handlersForEvent)) {
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          promises.push(
            result.catch((err) => {
              console.error(
                `[EventBus] Handler error for event "${event}":`,
                err,
              );
            }),
          );
        }
      } catch (err) {
        console.error(`[EventBus] Handler error for event "${event}":`, err);
      }
    }

    // Wait for all async handlers to complete
    await Promise.all(promises);
  }

  /**
   * Get the count of handlers for an event (for testing/debugging).
   */
  getHandlerCount(event: TriggerEvent): number {
    return this.handlers.get(event)?.size ?? 0;
  }

  /**
   * Clear all handlers (for testing).
   */
  clear(): void {
    this.handlers.clear();
  }
}

// ───────────────────────────────────────────────────────────────────
// NOTIFICATION TRIGGER ENGINE
// ───────────────────────────────────────────────────────────────────

/**
 * NotificationTriggerEngine: Evaluates trigger rules and queues notifications.
 *
 * Responsibility:
 * 1. Load trigger rules from database based on shopId in event payload
 * 2. Evaluate conditions (filter which rules should fire)
 * 3. Resolve recipient (customer email, driver phone, admin contact, etc.)
 * 4. Build template variables from event payload
 * 5. Queue notification to orchestrator
 */
export class NotificationTriggerEngine {
  /**
   * Create a new trigger engine.
   *
   * @param eventBus - The event bus to subscribe to.
   * @param ruleLoader - Optional custom rule loader (defaults to DB query).
   * @param notificationQueue - Optional custom notification queue handler.
   */
  constructor(
    private eventBus: EventBus,
    private ruleLoader?: RuleLoader,
    private notificationQueue?: NotificationQueueHandler,
  ) {
    this.subscribeToEvents();
  }

  /**
   * Subscribe to all events. Called automatically in constructor.
   */
  private subscribeToEvents(): void {
    for (const event of Object.values(TriggerEvent)) {
      this.eventBus.on(event, (payload) => {
        this.processEvent(event, payload).catch((err) => {
          console.error(
            `[TriggerEngine] Error processing event "${event}":`,
            err,
          );
        });
      });
    }
  }

  /**
   * Load trigger rules for a specific shop and event type.
   *
   * @param shopId - The shop/tenant ID.
   * @param event - The event type (optional, to filter).
   * @returns Array of matching trigger rules.
   *
   * By default, queries the database. Can be overridden by injecting a custom
   * ruleLoader during construction.
   */
  async loadRules(
    shopId: string,
    event?: TriggerEvent,
  ): Promise<TriggerRule[]> {
    if (this.ruleLoader) {
      return this.ruleLoader(shopId, event);
    }

    // Default: no-op. Real implementation would query the database.
    console.warn(
      `[TriggerEngine] No rule loader configured. Skipping rules for shop "${shopId}".`,
    );
    return [];
  }

  /**
   * Evaluate whether a rule's conditions match the event payload.
   *
   * If the rule has no conditions, returns true (always match).
   * If multiple conditions exist, all must match (AND logic).
   *
   * @param rule - The trigger rule.
   * @param payload - The event payload.
   * @returns true if all conditions match, false otherwise.
   */
  evaluateConditions(rule: TriggerRule, payload: EventPayload): boolean {
    if (!rule.conditions || rule.conditions.length === 0) {
      return true; // No conditions = always match
    }

    return rule.conditions.every((cond) =>
      this.evaluateCondition(cond, payload),
    );
  }

  /**
   * Evaluate a single condition against the event payload.
   *
   * @param condition - The condition to evaluate.
   * @param payload - The event payload.
   * @returns true if the condition matches, false otherwise.
   */
  private evaluateCondition(
    condition: TriggerCondition,
    payload: EventPayload,
  ): boolean {
    // Resolve field value from payload (supports dot notation: "shipment.zone")
    const actualValue = this.getFieldValue(condition.field, payload);

    switch (condition.operator) {
      case "eq":
        return actualValue === condition.value;
      case "neq":
        return actualValue !== condition.value;
      case "gt":
        return typeof actualValue === "number" &&
          typeof condition.value === "number"
          ? actualValue > condition.value
          : false;
      case "lt":
        return typeof actualValue === "number" &&
          typeof condition.value === "number"
          ? actualValue < condition.value
          : false;
      case "contains":
        return typeof actualValue === "string" &&
          typeof condition.value === "string"
          ? actualValue.includes(condition.value)
          : false;
      case "in":
        return Array.isArray(condition.value)
          ? condition.value.includes(actualValue)
          : false;
      default:
        return false;
    }
  }

  /**
   * Get a value from the payload using dot notation (e.g., "shipment.zone").
   *
   * @param fieldPath - Path to the field (dot-separated).
   * @param payload - The event payload.
   * @returns The field value, or undefined if not found.
   */
  private getFieldValue(fieldPath: string, payload: EventPayload): unknown {
    const parts = fieldPath.split(".");
    let current: unknown = payload;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Resolve the recipient from the event payload based on the rule.
   *
   * @param rule - The trigger rule.
   * @param payload - The event payload.
   * @returns The resolved recipient (email, phone, user ID), or null if not found.
   *
   * Examples:
   *   - recipientType: "customer" → resolves from payload.customerId
   *   - recipientType: "driver" → resolves from payload.driverId
   *   - recipientType: "admin" → static admin contact from shop settings
   *   - recipientType: "custom" → returns rule.customRecipient
   */
  resolveRecipient(rule: TriggerRule, payload: EventPayload): string | null {
    switch (rule.recipientType) {
      case "custom":
        return rule.customRecipient ?? null;

      case "customer":
        // Try to resolve customer email/phone from payload
        return (
          (payload.customerEmail as string) ||
          (payload.customerId as string) ||
          null
        );

      case "driver":
        // Try to resolve driver phone/email from payload
        return (
          (payload.driverPhone as string) ||
          (payload.driverEmail as string) ||
          (payload.driverId as string) ||
          null
        );

      case "admin":
        // For admin notifications, return a placeholder.
        // Real implementation would fetch admin contact from shop settings.
        return (payload.shopId as string) || null;

      default:
        return null;
    }
  }

  /**
   * Build template variables from event payload.
   *
   * Extracts relevant fields from the payload and structures them as template
   * variables that can be used in notification templates.
   *
   * @param event - The event type.
   * @param payload - The event payload.
   * @returns An object with template variables.
   *
   * Example:
   *   Input: { shipmentId, trackingNumber, deliveredAt, driverName }
   *   Output: { tracking_number, delivered_at, driver_name, ... }
   */
  buildTemplateVars(
    event: TriggerEvent,
    payload: EventPayload,
  ): Record<string, unknown> {
    const vars: Record<string, unknown> = {};

    // Common fields across all events
    vars.event = event;
    vars.timestamp = payload.timestamp || new Date().toISOString();

    // Event-specific variables
    if (event.startsWith("order.")) {
      vars.order_id = payload.orderId;
      vars.customer_id = payload.customerId;
      vars.customer_email = payload.customerEmail;
      vars.customer_name = payload.customerName;
      vars.order_total = payload.orderTotal;
      vars.order_currency = payload.orderCurrency;
    }

    if (event.startsWith("shipment.")) {
      vars.shipment_id = payload.shipmentId;
      vars.tracking_number = payload.trackingNumber;
      vars.zone = payload.zone;
      vars.weight = payload.weight;
      vars.dimensions = payload.dimensions;
    }

    if (
      event === TriggerEvent.SHIPMENT_DELIVERED ||
      event === TriggerEvent.DELIVERY_ATTEMPTED ||
      event === TriggerEvent.DELIVERY_PROOF_SUBMITTED
    ) {
      vars.delivered_at = payload.deliveredAt;
      vars.attempted_at = payload.attemptedAt;
      vars.proof_url = payload.proofUrl;
      vars.delivery_notes = payload.deliveryNotes;
    }

    if (event.startsWith("driver.")) {
      vars.driver_id = payload.driverId;
      vars.driver_name = payload.driverName;
      vars.driver_phone = payload.driverPhone;
      vars.driver_email = payload.driverEmail;
      vars.vehicle_number = payload.vehicleNumber;
    }

    if (event.startsWith("payment.")) {
      vars.payment_id = payload.paymentId;
      vars.amount = payload.amount;
      vars.currency = payload.currency;
      vars.payment_method = payload.paymentMethod;
      vars.status = payload.status;
    }

    return vars;
  }

  /**
   * Process an event: evaluate rules, resolve recipients, queue notifications.
   *
   * @param event - The event type.
   * @param payload - The event payload.
   * @returns Processing result with statistics.
   */
  async processEvent(
    event: TriggerEvent,
    payload: EventPayload,
  ): Promise<ProcessResult> {
    const startTime = performance.now();
    const errors: ProcessError[] = [];
    let matchedRuleCount = 0;
    let queuedCount = 0;

    // Extract shop ID from payload (required for loading rules)
    const shopId = payload.shopId as string | undefined;
    if (!shopId) {
      console.warn(
        `[TriggerEngine] Event "${event}" missing required shopId in payload`,
      );
      return {
        matchedRuleCount: 0,
        queuedCount: 0,
        errors: [
          {
            ruleId: "none",
            error: "Event payload missing required shopId field",
          },
        ],
        durationMs: performance.now() - startTime,
      };
    }

    try {
      // Load rules for this shop and event
      const rules = await this.loadRules(shopId, event);
      const relevantRules = rules.filter(
        (r) => r.event === event && r.isActive,
      );

      // Process each matching rule
      for (const rule of relevantRules) {
        try {
          // Check conditions
          if (!this.evaluateConditions(rule, payload)) {
            continue;
          }

          matchedRuleCount++;

          // Resolve recipient
          const recipient = this.resolveRecipient(rule, payload);
          if (!recipient) {
            console.warn(
              `[TriggerEngine] Rule "${rule.id}" could not resolve recipient`,
            );
            continue;
          }

          // Build template variables
          const templateVars = this.buildTemplateVars(event, payload);

          // Queue notification
          if (this.notificationQueue) {
            await this.notificationQueue({
              ruleId: rule.id,
              templateId: rule.templateId,
              channel: rule.channel,
              recipient,
              templateVars,
              delay: rule.delay,
              shopId,
            });
            queuedCount++;
          }
        } catch (err) {
          errors.push({
            ruleId: rule.id,
            error: err instanceof Error ? err : String(err),
          });
        }
      }
    } catch (err) {
      errors.push({
        ruleId: "loader",
        error: err instanceof Error ? err : String(err),
      });
    }

    const durationMs = performance.now() - startTime;

    return {
      matchedRuleCount,
      queuedCount,
      errors,
      durationMs,
    };
  }
}

// ───────────────────────────────────────────────────────────────────
// RULE LOADER & NOTIFICATION QUEUE HANDLER (Dependency Injection)
// ───────────────────────────────────────────────────────────────────

/**
 * Custom rule loader function type.
 * Used for dependency injection (e.g., querying a database).
 */
export type RuleLoader = (
  shopId: string,
  event?: TriggerEvent,
) => Promise<TriggerRule[]>;

/**
 * Notification queue item: passed to the notification queue handler.
 */
export interface NotificationQueueItem {
  ruleId: string;
  templateId: string;
  channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
  recipient: string;
  templateVars: Record<string, unknown>;
  delay?: number;
  shopId: string;
}

/**
 * Custom notification queue handler function type.
 * Used for dependency injection (e.g., queueing to a message broker).
 */
export type NotificationQueueHandler = (
  item: NotificationQueueItem,
) => Promise<void>;

// ───────────────────────────────────────────────────────────────────
// SINGLETON INSTANCES
// ───────────────────────────────────────────────────────────────────

/** Global event bus instance. Used by all domain services. */
export const eventBus = new EventBus();

/** Global trigger engine instance. Listens to all events. */
export const triggerEngine = new NotificationTriggerEngine(eventBus);

// ───────────────────────────────────────────────────────────────────
// EVENT BUS V2 — Redis Streams (Sprint 4.4)
// ───────────────────────────────────────────────────────────────────

export * as EventBusV2 from "./event-bus";
export * as EventBusTypes from "./types";
export * as RedisStreamAdapter from "./redis-stream-adapter";
export * as EventStoreModule from "./event-store";
export * as DeadLetterModule from "./dead-letter";
