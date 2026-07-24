/**
 * Carrier Integration Module
 * Exports all carrier adapters and registry
 * Auto-registers adapters on module load
 */

// Export all types
export * from "./types";

// Export registry
export { carrierRegistry, CarrierRegistry } from "./registry";

// Export adapters
export { UpsAdapter } from "./adapters/ups";
export { FedExAdapter } from "./adapters/fedex";
export { DhlAdapter } from "./adapters/dhl";
export { GenericAdapter, createGenericCarrier } from "./adapters/generic";
export type { GenericCarrierConfig } from "./adapters/generic";

// ============================================================================
// Auto-initialization: Register adapters on module load
// ============================================================================

import { carrierRegistry } from "./registry";
import { UpsAdapter } from "./adapters/ups";
import { FedExAdapter } from "./adapters/fedex";
import { DhlAdapter } from "./adapters/dhl";
import { GenericAdapter } from "./adapters/generic";

/**
 * Initialize default carriers
 * This runs automatically when the module is imported
 */
export function initializeDefaultCarriers(): void {
  // Register UPS
  // In production, credentials would come from environment variables or config
  const upsAdapter = new UpsAdapter(
    process.env.UPS_CLIENT_ID || "mock_ups_client_id",
    process.env.UPS_CLIENT_SECRET || "mock_ups_client_secret",
    process.env.UPS_ACCOUNT_NUMBER,
  );

  carrierRegistry.registerOrUpdate(upsAdapter);

  // Register FedEx
  const fedexAdapter = new FedExAdapter(
    process.env.FEDEX_CLIENT_ID || "mock_fedex_client_id",
    process.env.FEDEX_CLIENT_SECRET || "mock_fedex_client_secret",
    process.env.FEDEX_ACCOUNT_NUMBER || "mock_fedex_account",
    process.env.FEDEX_METER_NUMBER || "mock_fedex_meter",
  );

  carrierRegistry.registerOrUpdate(fedexAdapter);

  // Register DHL
  const dhlAdapter = new DhlAdapter(
    process.env.DHL_API_KEY || "mock_dhl_api_key",
    process.env.DHL_CLIENT_ID || "mock_dhl_client_id",
    process.env.DHL_PASSWORD,
    process.env.DHL_ACCOUNT_NUMBER,
  );

  carrierRegistry.registerOrUpdate(dhlAdapter);

  // Register a generic carrier (example: local courier)
  const localCourierAdapter = new GenericAdapter({
    name: "Local Courier",
    code: "local_courier",
    defaultService: "standard",
    supportsPickup: true,
    supportsValidation: false,
    trackingPrefix: "LC",
    rates: [
      {
        code: "standard",
        name: "Standard Delivery",
        price: 5.99,
        currency: "USD",
        estimatedDays: 2,
      },
      {
        code: "express",
        name: "Express Delivery",
        price: 12.99,
        currency: "USD",
        estimatedDays: 1,
      },
      {
        code: "same_day",
        name: "Same Day Delivery",
        price: 24.99,
        currency: "USD",
        estimatedDays: 0,
        maxWeight: 5,
      },
    ],
  });

  carrierRegistry.registerOrUpdate(localCourierAdapter);

  // Register a bike messenger carrier (example)
  const bikeMessengerAdapter = new GenericAdapter({
    name: "Bike Messenger",
    code: "bike_messenger",
    defaultService: "standard",
    supportsPickup: false,
    supportsValidation: false,
    trackingPrefix: "BIKE",
    rates: [
      {
        code: "standard",
        name: "Standard Delivery",
        price: 8.99,
        currency: "USD",
        estimatedDays: 1,
        maxWeight: 2,
      },
    ],
  });

  carrierRegistry.registerOrUpdate(bikeMessengerAdapter);
}

/**
 * Register a custom carrier adapter
 * Useful for adding carriers at runtime
 * @param adapter - Carrier adapter to register
 */
export function registerCarrier(
  adapter: UpsAdapter | FedExAdapter | DhlAdapter | GenericAdapter,
): void {
  carrierRegistry.registerOrUpdate(adapter);
}

/**
 * Get a carrier by code
 * Convenience wrapper around registry
 * @param code - Carrier code
 * @returns Carrier adapter
 */
export function getCarrier(code: string) {
  return carrierRegistry.get(code as any);
}

/**
 * Shop rates across all registered carriers
 * Convenience wrapper around registry
 * @param request - Rate request
 * @param carriers - Optional list of carriers to query
 * @returns Rates sorted by price
 */
export async function shopRates(
  request: import("./types").RateRequest,
  carriers?: string[],
) {
  return carrierRegistry.shopRates(request, carriers as any);
}

/**
 * Initialize default carriers on module import
 */
if (
  typeof process !== "undefined" &&
  process.env.WITYLOGIX_INIT_CARRIERS !== "false"
) {
  // Allow disabling auto-init via environment variable
  try {
    initializeDefaultCarriers();
  } catch (error) {
    // Log initialization errors but don't throw
    // This allows the module to load even if initialization fails
    if (error instanceof Error) {
      console.error("Failed to initialize default carriers:", error.message);
    }
  }
}
