/**
 * WooCommerce Tracking Write-back Service — WIT-220
 *
 * Pushes Witylogix shipment tracking data back to WooCommerce via:
 *  1. Shipment Tracking plugin endpoint (preferred)
 *  2. meta_data fallback when the plugin is not installed (404)
 *
 * Also updates WC order status to `completed` when a shipment is delivered.
 * Failed writes are enqueued for BullMQ retry.
 */

import type { WooCommerceClient } from "./wc-client.js";

/**
 * Maps Witylogix carrier slugs to WooCommerce `tracking_provider` enum values.
 * Add new carriers here as integrations are added.
 */
export const CARRIER_SLUG_TO_WC_PROVIDER: Record<string, string> = {
  ups: "ups",
  fedex: "fedex",
  dhl: "dhl",
  usps: "usps",
  "dhl-express": "dhl",
  "fedex-ground": "fedex",
  "ups-ground": "ups",
  ontrac: "ontrac",
  lasership: "lasership",
  stamps: "stamps_com",
};

export interface TrackingWritebackParams {
  wcOrderId: number;
  trackingNumber: string;
  /** Witylogix internal carrier slug */
  carrierSlug: string;
  /** ISO date string e.g. "2026-04-04" */
  dateShipped: string;
}

/** Enqueue function signature for BullMQ (injected, not imported directly) */
export type EnqueueFn = (
  queueName: string,
  data: Record<string, unknown>,
) => Promise<void> | void;

const MAX_RETRIES = 3;

function is404(err: unknown): boolean {
  return err instanceof Error && err.message.includes("[404]");
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number,
): Promise<{ result: T; success: true } | { success: false; error: Error }> {
  let lastError: Error = new Error("unknown");
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await fn();
      return { result, success: true };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
      }
    }
  }
  return { success: false, error: lastError };
}

export class WCTrackingWritebackService {
  constructor(
    private readonly client: WooCommerceClient,
    private readonly enqueue: EnqueueFn,
  ) {}

  /**
   * Push tracking number to WooCommerce.
   * Tries the Shipment Tracking plugin first; falls back to meta_data on 404.
   * On repeated failures, enqueues a BullMQ retry job.
   */
  async pushTrackingNumber(params: TrackingWritebackParams): Promise<void> {
    const { wcOrderId, trackingNumber, carrierSlug, dateShipped } = params;

    const wcProvider = CARRIER_SLUG_TO_WC_PROVIDER[carrierSlug];
    const pluginPayload: Record<string, string> = {
      tracking_number: trackingNumber,
      tracking_provider: wcProvider ?? "custom",
      date_shipped: dateShipped,
    };
    if (!wcProvider) {
      pluginPayload.custom_tracking_provider = carrierSlug;
    }

    // Attempt Shipment Tracking plugin endpoint first
    let pluginError: Error | null = null;
    try {
      await this.client.post(
        `/orders/${wcOrderId}/shipment-tracking`,
        pluginPayload as unknown as Record<string, unknown>,
      );
      return;
    } catch (err) {
      pluginError = err instanceof Error ? err : new Error(String(err));
    }

    // Plugin not installed → fallback to meta_data (no retry — 404 is permanent)
    if (is404(pluginError)) {
      const trackingItem = {
        tracking_provider: wcProvider ?? "custom",
        custom_tracking_provider: !wcProvider ? carrierSlug : undefined,
        tracking_number: trackingNumber,
        date_shipped: dateShipped,
      };
      const fallbackResult = await withRetry(
        () =>
          this.client.put(`/orders/${wcOrderId}`, {
            meta_data: [
              {
                key: "_wc_shipment_tracking_items",
                value: [trackingItem],
              },
            ],
          }),
        MAX_RETRIES,
      );
      if (!fallbackResult.success) {
        await this.enqueue("wc-tracking-writeback", {
          wcOrderId,
          trackingNumber,
          carrierSlug,
          dateShipped,
        });
      }
      return;
    }

    // Transient error — retry plugin endpoint up to MAX_RETRIES total (already used 1 attempt)
    const retryResult = await withRetry(
      () =>
        this.client.post(
          `/orders/${wcOrderId}/shipment-tracking`,
          pluginPayload as unknown as Record<string, unknown>,
        ),
      MAX_RETRIES - 1,
    );

    if (!retryResult.success) {
      await this.enqueue("wc-tracking-writeback", {
        wcOrderId,
        trackingNumber,
        carrierSlug,
        dateShipped,
      });
    }
  }

  /**
   * Mark the WC order as `completed` when Witylogix shipment transitions to delivered.
   */
  async pushDeliveredStatus(wcOrderId: number): Promise<void> {
    const result = await withRetry(
      () => this.client.put(`/orders/${wcOrderId}`, { status: "completed" }),
      MAX_RETRIES,
    );

    if (!result.success) {
      await this.enqueue("wc-order-status-update", {
        wcOrderId,
        status: "completed",
      });
    }
  }
}
