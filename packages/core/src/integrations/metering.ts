/**
 * Unified Integration Metering — replaces separate routing and
 * notification metering with a single event system.
 *
 * Deployers register a callback to capture integration events
 * (installs, uninstalls, syncs, health checks, metered fallback usage).
 * The callback typically writes to the IntegrationEvent DB model.
 */

import type { IntegrationEvent } from "./types.js";

// ─── Callback Registration ──────────────────────────────────

export type IntegrationMeteringCallback = (
  event: IntegrationEvent,
) => void | Promise<void>;

let _integrationMeteringCallback: IntegrationMeteringCallback | null = null;

/**
 * Register a global metering callback for integration events.
 * Replaces `onRoutingMeter()` and `onNotificationMeter()`.
 *
 * Example:
 *   onIntegrationMeter(async (event) => {
 *     await db.integrationEvent.create({
 *       data: {
 *         shopId: event.shopId,
 *         appSlug: event.appSlug,
 *         integrationId: event.integrationId,
 *         eventType: event.eventType,
 *         operation: event.operation,
 *         usedFallback: event.usedFallback,
 *         metadata: event.metadata ?? {},
 *         timestamp: event.timestamp,
 *       },
 *     });
 *   });
 */
export function onIntegrationMeter(
  callback: IntegrationMeteringCallback,
): void {
  _integrationMeteringCallback = callback;
}

/**
 * Emit an integration event. Fire-and-forget — never blocks the caller.
 */
export function emitIntegrationEvent(event: IntegrationEvent): void {
  if (_integrationMeteringCallback) {
    Promise.resolve(_integrationMeteringCallback(event)).catch((err) => {
      console.error("[integrations:metering] Callback error:", err);
    });
  }
}
